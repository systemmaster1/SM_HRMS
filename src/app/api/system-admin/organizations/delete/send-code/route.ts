import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { sendGmailMessage } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const SUPER_ADMIN_EMAIL = "connect@systemmaster.in";
const PURPOSE = "system_admin_org_delete";
const OTP_EXPIRY_MINUTES = 10;

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hashOtp(
  email: string,
  code: string,
  companyId: string
) {
  return createHash("sha256")
    .update(
      `${email}:${code}:${companyId}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    )
    .digest("hex");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server configuration is missing"
    );
  }

  return createAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    /*
     * -------------------------------------------------------
     * 1. VERIFY CURRENT LOGGED-IN USER
     * -------------------------------------------------------
     */

    const sessionSupabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Please sign in again before performing this action.",
        },
        { status: 401 }
      );
    }

    /*
     * -------------------------------------------------------
     * 2. ONLY connect@systemmaster.in MAY REQUEST DELETE OTP
     * -------------------------------------------------------
     */

    const currentEmail = normalizeEmail(user.email);

    if (currentEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        {
          error:
            "Only the SystemMaster Super Admin can permanently delete an organization.",
        },
        { status: 403 }
      );
    }

    /*
     * Existing platform/system admin authorization is also
     * checked. Email alone is NOT enough.
     */

    const { data: platformAdmin } =
      await sessionSupabase.rpc(
        "is_platform_admin"
      );

    let allowed = platformAdmin === true;

    if (!allowed) {
      const { data: systemAdmin } =
        await sessionSupabase.rpc(
          "is_system_admin"
        );

      allowed = systemAdmin === true;
    }

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Your account does not have System Admin permission.",
        },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * 3. GET ORGANIZATION
     * -------------------------------------------------------
     */

    const body = await request.json();

    const companyId = String(
      body?.companyId || ""
    ).trim();

    if (!companyId) {
      return NextResponse.json(
        {
          error: "Organization ID is required.",
        },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const {
      data: company,
      error: companyError,
    } = await admin
      .from("companies")
      .select(
        "id,name,org_code,email,account_status,owner_id,created_at"
      )
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      throw companyError;
    }

    if (!company) {
      return NextResponse.json(
        {
          error:
            "Organization was not found.",
        },
        { status: 404 }
      );
    }

    /*
     * -------------------------------------------------------
     * 4. RESEND PROTECTION
     * -------------------------------------------------------
     */

    const oneMinuteAgo = new Date(
      Date.now() - 60 * 1000
    ).toISOString();

    const {
      data: recentOtp,
      error: recentError,
    } = await admin
      .from("auth_otp_codes")
      .select("id")
      .eq(
        "email",
        SUPER_ADMIN_EMAIL
      )
      .eq("purpose", PURPOSE)
      .gte("created_at", oneMinuteAgo)
      .limit(1)
      .maybeSingle();

    if (recentError) {
      throw recentError;
    }

    if (recentOtp) {
      return NextResponse.json(
        {
          error:
            "A verification code was sent recently. Please wait one minute before requesting another code.",
        },
        { status: 429 }
      );
    }

    /*
     * -------------------------------------------------------
     * 5. INVALIDATE OLD DELETE OTPs
     * -------------------------------------------------------
     */

    const { error: invalidateError } =
      await admin
        .from("auth_otp_codes")
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq(
          "email",
          SUPER_ADMIN_EMAIL
        )
        .eq("purpose", PURPOSE)
        .is("consumed_at", null);

    if (invalidateError) {
      throw invalidateError;
    }

    /*
     * -------------------------------------------------------
     * 6. GENERATE OTP
     * -------------------------------------------------------
     */

    const otp = String(
      randomInt(100000, 1000000)
    );

    const expiresAt = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES *
          60 *
          1000
    ).toISOString();

    const codeHash = hashOtp(
      SUPER_ADMIN_EMAIL,
      otp,
      company.id
    );

    /*
     * Company information is stored in metadata.
     * The verify/delete API will verify the SAME company ID.
     */

    const {
      data: otpRecord,
      error: insertError,
    } = await admin
      .from("auth_otp_codes")
      .insert({
        email: SUPER_ADMIN_EMAIL,
        purpose: PURPOSE,
        code_hash: codeHash,
        expires_at: expiresAt,

        metadata: {
          company_id: company.id,
          company_name: company.name,
          org_code: company.org_code,
          requested_by: user.id,
          requested_by_email:
            currentEmail,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    /*
     * -------------------------------------------------------
     * 7. SEND OTP THROUGH EXISTING SYSTEMMASTER GMAIL
     * -------------------------------------------------------
     */

    const emailHtml = `
      <div style="
        font-family:Arial,Helvetica,sans-serif;
        max-width:580px;
        margin:0 auto;
        color:#0f172a;
      ">

        <div style="
          background:#0f172a;
          padding:24px;
          border-radius:14px 14px 0 0;
          color:#ffffff;
        ">

          <div style="
            font-size:22px;
            font-weight:700;
          ">
            SM HRMS
          </div>

          <div style="
            margin-top:4px;
            font-size:13px;
            color:#cbd5e1;
          ">
            SystemMaster Super Admin Security
          </div>

        </div>

        <div style="
          border:1px solid #e2e8f0;
          border-top:0;
          padding:28px;
          border-radius:0 0 14px 14px;
        ">

          <h2 style="
            margin-top:0;
            color:#b91c1c;
          ">
            Organization deletion requested
          </h2>

          <p style="
            font-size:15px;
            line-height:1.6;
            color:#475569;
          ">
            A permanent deletion request has been made
            from the SystemMaster Super Admin panel.
          </p>

          <div style="
            margin:20px 0;
            padding:16px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:10px;
          ">

            <div style="
              font-size:13px;
              color:#64748b;
            ">
              Organization
            </div>

            <div style="
              margin-top:4px;
              font-size:18px;
              font-weight:700;
              color:#0f172a;
            ">
              ${company.name}
            </div>

            <div style="
              margin-top:5px;
              font-size:13px;
              color:#64748b;
            ">
              Org ID:
              ${company.org_code || "Not assigned"}
            </div>

          </div>

          <p style="
            font-size:14px;
            color:#475569;
          ">
            Enter this verification code in the
            Super Admin panel to authorize the deletion:
          </p>

          <div style="
            margin:24px 0;
            padding:18px;
            text-align:center;
            background:#fef2f2;
            border:1px solid #fecaca;
            border-radius:10px;
            font-size:32px;
            font-weight:700;
            letter-spacing:8px;
            color:#b91c1c;
          ">
            ${otp}
          </div>

          <p style="
            font-size:14px;
            color:#475569;
          ">
            This code expires in
            <strong>
              ${OTP_EXPIRY_MINUTES} minutes
            </strong>.
          </p>

          <p style="
            font-size:14px;
            line-height:1.6;
            color:#b91c1c;
          ">
            <strong>Warning:</strong>
            Permanent organization deletion may remove
            organization-related HRMS data. Do not share
            this OTP with anyone.
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
            Security notification generated by
            SystemMaster Automations.
          </p>

        </div>

      </div>
    `;

    try {
      await sendGmailMessage(
        SUPER_ADMIN_EMAIL,
        `${otp} - Confirm deletion of ${company.name}`,
        emailHtml
      );
    } catch (mailError) {
      /*
       * OTP must not remain usable when email delivery fails.
       */

      await admin
        .from("auth_otp_codes")
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq("id", otpRecord.id);

      throw mailError;
    }

    /*
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      message:
        "Verification code sent to connect@systemmaster.in.",

      organization: {
        id: company.id,
        name: company.name,
        org_code:
          company.org_code || null,
      },

      expiresInMinutes:
        OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error(
      "Organization delete OTP error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "We couldn't send the organization deletion verification code. Please try again.",
      },
      { status: 500 }
    );
  }
}
