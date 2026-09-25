import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

const PURPOSE = "password_reset";
const MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hashOtp(email: string, code: string) {
  return createHash("sha256")
    .update(`${email}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase server configuration is missing");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = normalizeEmail(body?.email);
    const code = String(body?.code || "").trim();
    const newPassword = String(body?.newPassword || "");

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Please enter the 6-digit verification code." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: otpRecord, error: otpError } = await supabase
      .from("auth_otp_codes")
      .select(
        "id,email,code_hash,expires_at,consumed_at,attempts,created_at"
      )
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      throw otpError;
    }

    if (!otpRecord) {
      return NextResponse.json(
        {
          error:
            "The verification code is invalid or has expired. Please request a new code.",
        },
        { status: 400 }
      );
    }

    if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
      await supabase
        .from("auth_otp_codes")
        .update({
          consumed_at: new Date().toISOString(),
        })
        .eq("id", otpRecord.id);

      return NextResponse.json(
        {
          error:
            "The verification code has expired. Please request a new code.",
        },
        { status: 400 }
      );
    }

    const attempts = Number(otpRecord.attempts || 0);

    if (attempts >= MAX_ATTEMPTS) {
      await supabase
        .from("auth_otp_codes")
        .update({
          consumed_at: new Date().toISOString(),
        })
        .eq("id", otpRecord.id);

      return NextResponse.json(
        {
          error:
            "Too many incorrect attempts. Please request a new code.",
        },
        { status: 429 }
      );
    }

    const submittedHash = hashOtp(email, code);

    if (!safeEqual(submittedHash, otpRecord.code_hash)) {
      const nextAttempts = attempts + 1;

      await supabase
        .from("auth_otp_codes")
        .update({
          attempts: nextAttempts,
          ...(nextAttempts >= MAX_ATTEMPTS
            ? { consumed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", otpRecord.id);

      return NextResponse.json(
        {
          error:
            nextAttempts >= MAX_ATTEMPTS
              ? "Too many incorrect attempts. Please request a new code."
              : "The verification code is incorrect.",
        },
        { status: nextAttempts >= MAX_ATTEMPTS ? 429 : 400 }
      );
    }

    /*
     * Locate the existing Supabase Auth account.
     */
    let page = 1;
    let authUser:
      | {
          id: string;
          email?: string;
        }
      | undefined;

    while (page <= 10) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        throw error;
      }

      authUser = data.users.find(
        (user) => normalizeEmail(user.email) === email
      );

      if (authUser || data.users.length < 1000) {
        break;
      }

      page += 1;
    }

    if (!authUser) {
      /*
       * Generic response avoids exposing account information.
       */
      await supabase
        .from("auth_otp_codes")
        .update({
          consumed_at: new Date().toISOString(),
        })
        .eq("id", otpRecord.id);

      return NextResponse.json(
        {
          error:
            "We couldn't reset this account. Please contact your administrator.",
        },
        { status: 400 }
      );
    }

    /*
     * Supabase Admin API securely updates the password.
     * Password is NOT stored in auth_otp_codes.
     */
    const { error: passwordError } =
      await supabase.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
      });

    if (passwordError) {
      throw passwordError;
    }

    /*
     * OTP becomes unusable immediately after successful reset.
     */
    await supabase
      .from("auth_otp_codes")
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq("id", otpRecord.id);

    return NextResponse.json({
      success: true,
      message:
        "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("Forgot password verify-reset error", error);

    return NextResponse.json(
      {
        error:
          "We couldn't reset your password right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
