import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

const PURPOSE = "signup";
const MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hashOtp(email: string, code: string) {
  return createHash("sha256")
    .update(
      `${email}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    )
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");

    if (left.length !== right.length) return false;

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server configuration is missing");
  }

  return createClient(url, serviceKey, {
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
    const password = String(body?.password || "");
    const fullName = String(body?.name || "").trim();

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

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: otpRecord, error: otpError } = await supabase
      .from("auth_otp_codes")
      .select(
        "id,email,code_hash,expires_at,consumed_at,attempts,metadata,created_at"
      )
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;

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
        {
          status:
            nextAttempts >= MAX_ATTEMPTS ? 429 : 400,
        }
      );
    }

    /*
     * Make sure the name used to create the account matches
     * the registration request associated with this OTP.
     */
    const otpName = String(
      otpRecord.metadata?.full_name || ""
    ).trim();

    if (!otpName || otpName !== fullName) {
      return NextResponse.json(
        {
          error:
            "Registration details changed. Please request a new verification code.",
        },
        { status: 400 }
      );
    }

    /*
     * Re-check immediately before creating the user.
     */
    let page = 1;
    let existingUser = false;

    while (page <= 10) {
      const { data, error } =
        await supabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

      if (error) throw error;

      existingUser = data.users.some(
        (user) => normalizeEmail(user.email) === email
      );

      if (existingUser || data.users.length < 1000) {
        break;
      }

      page += 1;
    }

    if (existingUser) {
      await supabase
        .from("auth_otp_codes")
        .update({
          consumed_at: new Date().toISOString(),
        })
        .eq("id", otpRecord.id);

      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in instead.",
        },
        { status: 409 }
      );
    }

    /*
     * Create the Auth user only AFTER successful OTP verification.
     *
     * email_confirm: true means Supabase will consider the email
     * verified immediately and will not require its confirmation-link
     * workflow.
     */
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createError) throw createError;

    if (!created.user) {
      throw new Error("Supabase did not return the created user");
    }

    /*
     * Consume the OTP after successful account creation.
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
        "Email verified and account created successfully.",
    });
  } catch (error) {
    console.error("Signup verify-code error", error);

    return NextResponse.json(
      {
        error:
          "We couldn't complete your registration right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
