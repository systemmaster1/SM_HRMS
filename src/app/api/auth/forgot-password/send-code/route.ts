import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "crypto";
import { sendGmailMessage } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const PURPOSE = "password_reset";
const OTP_EXPIRY_MINUTES = 10;

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hashOtp(email: string, code: string) {
  return createHash("sha256")
    .update(`${email}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest("hex");
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

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    /*
     * Check whether this email belongs to an existing Supabase Auth user.
     * We intentionally return a generic success response when no account
     * exists, so the endpoint does not reveal registered email addresses.
     */
    let page = 1;
    let userExists = false;

    while (page <= 10) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        throw error;
      }

      const users = data?.users || [];

      userExists = users.some(
        (user) => normalizeEmail(user.email) === email
      );

      if (userExists || users.length < 1000) {
        break;
      }

      page += 1;
    }

    const genericResponse = {
      success: true,
      message:
        "If an account exists for this email, a verification code has been sent.",
    };

    if (!userExists) {
      return NextResponse.json(genericResponse);
    }

    /*
     * Basic resend protection:
     * don't issue another code within 60 seconds.
     */
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: recentOtp } = await supabase
      .from("auth_otp_codes")
      .select("id")
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .gte("created_at", oneMinuteAgo)
      .limit(1)
      .maybeSingle();

    if (recentOtp) {
      return NextResponse.json(
        {
          error:
            "A code was sent recently. Please wait a minute before requesting another code.",
        },
        { status: 429 }
      );
    }

    /*
     * Invalidate older unused password-reset OTPs.
     */
    await supabase
      .from("auth_otp_codes")
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .is("consumed_at", null);

    const otp = String(randomInt(100000, 1000000));

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    const codeHash = hashOtp(email, otp);

    const { data: insertedOtp, error: insertError } = await supabase
      .from("auth_otp_codes")
      .insert({
        email,
        purpose: PURPOSE,
        code_hash: codeHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const emailHtml = `
      <div style="
        font-family:Arial,Helvetica,sans-serif;
        max-width:560px;
        margin:0 auto;
        color:#0f172a;
      ">
        <div style="
          background:#173f82;
          padding:24px;
          border-radius:14px 14px 0 0;
          color:#ffffff;
        ">
          <div style="font-size:22px;font-weight:700;">
            SM HRMS
          </div>
          <div style="
            margin-top:4px;
            font-size:13px;
            color:#dbeafe;
          ">
            SystemMaster Automations
          </div>
        </div>

        <div style="
          border:1px solid #e2e8f0;
          border-top:0;
          padding:28px;
          border-radius:0 0 14px 14px;
        ">
          <h2 style="margin-top:0;color:#0f172a;">
            Reset your password
          </h2>

          <p style="
            font-size:15px;
            line-height:1.6;
            color:#475569;
          ">
            We received a request to reset your SM HRMS password.
            Use the verification code below:
          </p>

          <div style="
            margin:26px 0;
            padding:18px;
            text-align:center;
            background:#f1f5f9;
            border-radius:10px;
            font-size:32px;
            font-weight:700;
            letter-spacing:8px;
            color:#173f82;
          ">
            ${otp}
          </div>

          <p style="
            font-size:14px;
            color:#475569;
          ">
            This code expires in
            <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>

          <p style="
            font-size:14px;
            line-height:1.6;
            color:#64748b;
          ">
            If you did not request a password reset, you can safely
            ignore this email.
          </p>

          <hr style="
            border:0;
            border-top:1px solid #e2e8f0;
            margin:24px 0;
          " />

          <p style="
            margin:0;
            font-size:12px;
            color:#94a3b8;
          ">
            This is an automated security email from SM HRMS.
            Please do not reply to this message.
          </p>
        </div>
      </div>
    `;

    try {
      await sendGmailMessage(
        email,
        `${otp} is your SM HRMS verification code`,
        emailHtml
      );
    } catch (mailError) {
      /*
       * If Gmail fails, invalidate the OTP so a code that was never
       * delivered cannot remain active.
       */
      await supabase
        .from("auth_otp_codes")
        .update({
          consumed_at: new Date().toISOString(),
        })
        .eq("id", insertedOtp.id);

      throw mailError;
    }

    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error("Forgot password send-code error", error);

    return NextResponse.json(
      {
        error:
          "We couldn't send the verification code right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
