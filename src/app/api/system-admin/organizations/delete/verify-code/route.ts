import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUPER_ADMIN_EMAIL = "connect@systemmaster.in";
const PURPOSE = "system_admin_org_delete";
const MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
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
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server configuration is missing"
    );
  }

  return createAdminClient(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(
  request: Request
) {
  try {
    /*
     * ======================================================
     * 1. VERIFY CURRENT LOGGED-IN SESSION
     * ======================================================
     */

    const sessionSupabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await sessionSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Please sign in again before performing this action.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ======================================================
     * 2. ONLY connect@systemmaster.in CAN DELETE ORGS
     * ======================================================
     */

    const currentEmail =
      normalizeEmail(user.email);

    if (
      currentEmail !==
      SUPER_ADMIN_EMAIL
    ) {
      return NextResponse.json(
        {
          error:
            "Only connect@systemmaster.in can permanently delete an organization.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Email check alone is not enough.
     * Existing SystemMaster admin permission is also required.
     */

    const {
      data: isPlatformAdmin,
    } =
      await sessionSupabase.rpc(
        "is_platform_admin"
      );

    let allowed =
      isPlatformAdmin === true;

    if (!allowed) {
      const {
        data: isSystemAdmin,
      } =
        await sessionSupabase.rpc(
          "is_system_admin"
        );

      allowed =
        isSystemAdmin === true;
    }

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Your account does not have System Admin permission.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ======================================================
     * 3. VALIDATE REQUEST
     * ======================================================
     */

    const body =
      await request.json();

    const companyId = String(
      body?.companyId || ""
    ).trim();

    const code = String(
      body?.code || ""
    ).trim();

    if (!companyId) {
      return NextResponse.json(
        {
          error:
            "Organization ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          error:
            "Please enter the 6-digit verification code.",
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      getAdminClient();

    /*
     * ======================================================
     * 4. RE-CHECK ORGANIZATION
     * ======================================================
     */

    const {
      data: company,
      error: companyError,
    } =
      await admin
        .from("companies")
        .select(
          "id,name,org_code,email,owner_id,account_status,created_at"
        )
        .eq(
          "id",
          companyId
        )
        .maybeSingle();

    if (companyError) {
      throw companyError;
    }

    if (!company) {
      return NextResponse.json(
        {
          error:
            "Organization no longer exists.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ======================================================
     * 5. FIND LATEST UNUSED DELETE OTP
     * ======================================================
     */

    const {
      data: otpRecord,
      error: otpError,
    } =
      await admin
        .from("auth_otp_codes")
        .select(
          "id,email,code_hash,expires_at,consumed_at,attempts,metadata,created_at"
        )
        .eq(
          "email",
          SUPER_ADMIN_EMAIL
        )
        .eq(
          "purpose",
          PURPOSE
        )
        .is(
          "consumed_at",
          null
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
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
        {
          status: 400,
        }
      );
    }

    /*
     * ======================================================
     * 6. OTP MUST BELONG TO THIS EXACT ORGANIZATION
     * ======================================================
     */

    const otpCompanyId =
      String(
        otpRecord.metadata
          ?.company_id || ""
      ).trim();

    if (
      otpCompanyId !== companyId
    ) {
      return NextResponse.json(
        {
          error:
            "This verification code was issued for a different organization. Please request a new code.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * The OTP must also have been requested by the
     * currently logged-in Super Admin account.
     */

    const requestedBy =
      String(
        otpRecord.metadata
          ?.requested_by || ""
      ).trim();

    if (
      requestedBy &&
      requestedBy !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            "This verification code was requested by another administrator session.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ======================================================
     * 7. CHECK EXPIRY
     * ======================================================
     */

    if (
      new Date(
        otpRecord.expires_at
      ).getTime() <= Date.now()
    ) {
      await admin
        .from("auth_otp_codes")
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          otpRecord.id
        );

      return NextResponse.json(
        {
          error:
            "The verification code has expired. Please request a new code.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ======================================================
     * 8. ATTEMPT LIMIT
     * ======================================================
     */

    const attempts =
      Number(
        otpRecord.attempts || 0
      );

    if (
      attempts >= MAX_ATTEMPTS
    ) {
      await admin
        .from("auth_otp_codes")
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          otpRecord.id
        );

      return NextResponse.json(
        {
          error:
            "Too many incorrect attempts. Please request a new verification code.",
        },
        {
          status: 429,
        }
      );
    }

    /*
     * ======================================================
     * 9. VERIFY OTP HASH
     * ======================================================
     */

    const submittedHash =
      hashOtp(
        SUPER_ADMIN_EMAIL,
        code,
        companyId
      );

    if (
      !safeEqual(
        submittedHash,
        otpRecord.code_hash
      )
    ) {
      const nextAttempts =
        attempts + 1;

      await admin
        .from("auth_otp_codes")
        .update({
          attempts:
            nextAttempts,

          ...(nextAttempts >=
          MAX_ATTEMPTS
            ? {
                consumed_at:
                  new Date().toISOString(),
              }
            : {}),
        })
        .eq(
          "id",
          otpRecord.id
        );

      return NextResponse.json(
        {
          error:
            nextAttempts >=
            MAX_ATTEMPTS
              ? "Too many incorrect attempts. Please request a new verification code."
              : "The verification code is incorrect.",
        },
        {
          status:
            nextAttempts >=
            MAX_ATTEMPTS
              ? 429
              : 400,
        }
      );
    }

    /*
     * ======================================================
     * 10. CAPTURE ORGANIZATION AUTH USERS
     * ======================================================
     *
     * Profiles will be deleted by the database CASCADE.
     * Supabase Auth users are separate and therefore their
     * IDs must be captured BEFORE deleting the organization.
     */

    const {
      data: companyProfiles,
      error: profilesError,
    } =
      await admin
        .from("profiles")
        .select(
          "id,email,full_name,role"
        )
        .eq(
          "company_id",
          companyId
        );

    if (profilesError) {
      throw profilesError;
    }

    const authUserIds =
      (
        companyProfiles || []
      )
        .map(
          (profile) =>
            String(
              profile.id || ""
            ).trim()
        )
        .filter(Boolean);

    /*
     * ======================================================
     * 11. ABSOLUTE PROTECTION:
     *     NEVER DELETE SUPER ADMIN AUTH USER
     * ======================================================
     */

    if (
      authUserIds.includes(
        user.id
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Deletion blocked because the SystemMaster Super Admin account is linked to this organization.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Protect any platform administrator that may
     * accidentally be attached to the organization.
     */

    if (
      authUserIds.length > 0
    ) {
      const {
        data:
          protectedPlatformAdmins,
        error:
          protectedPlatformError,
      } =
        await admin
          .from(
            "platform_admins"
          )
          .select("user_id")
          .in(
            "user_id",
            authUserIds
          );

      if (
        protectedPlatformError
      ) {
        throw protectedPlatformError;
      }

      if (
        protectedPlatformAdmins &&
        protectedPlatformAdmins.length >
          0
      ) {
        return NextResponse.json(
          {
            error:
              "Deletion blocked because a SystemMaster platform administrator is linked to this organization.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * system_admins is part of the existing project.
       * Protect these users as well.
       */

      const {
        data:
          protectedSystemAdmins,
        error:
          protectedSystemError,
      } =
        await admin
          .from(
            "system_admins"
          )
          .select("user_id")
          .in(
            "user_id",
            authUserIds
          );

      if (
        protectedSystemError
      ) {
        throw protectedSystemError;
      }

      if (
        protectedSystemAdmins &&
        protectedSystemAdmins.length >
          0
      ) {
        return NextResponse.json(
          {
            error:
              "Deletion blocked because a SystemMaster administrator is linked to this organization.",
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
     * ======================================================
     * 12. CONSUME OTP BEFORE DESTRUCTIVE OPERATION
     * ======================================================
     *
     * This makes the OTP single-use.
     */

    const {
      error:
        consumeOtpError,
    } =
      await admin
        .from("auth_otp_codes")
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          otpRecord.id
        )
        .is(
          "consumed_at",
          null
        );

    if (consumeOtpError) {
      throw consumeOtpError;
    }

    /*
     * ======================================================
     * 13. DELETE ORGANIZATION THROUGH PROTECTED DB FUNCTION
     * ======================================================
     *
     * The SQL function:
     *
     * - handles NO ACTION profile references
     * - deletes companies row
     * - lets existing CASCADE constraints remove tenant data
     * - returns captured profile/Auth user IDs
     */

    const {
      data: deleteResult,
      error: deleteError,
    } =
      await admin.rpc(
        "system_admin_permanently_delete_organization",
        {
          p_company_id:
            companyId,
        }
      );

    if (deleteError) {
      throw deleteError;
    }

    /*
     * ======================================================
     * 14. DELETE SUPABASE AUTH USERS
     * ======================================================
     *
     * Database tenant data has now been removed.
     * Auth accounts are deleted separately so their email
     * addresses can be registered again in the future.
     */

    const authDeletionFailures: Array<{
      userId: string;
      error: string;
    }> = [];

    for (
      const targetUserId of
      authUserIds
    ) {
      /*
       * Extra defensive check.
       */

      if (
        targetUserId ===
        user.id
      ) {
        authDeletionFailures.push({
          userId:
            targetUserId,
          error:
            "Protected Super Admin user",
        });

        continue;
      }

      const {
        error:
          deleteAuthError,
      } =
        await admin.auth.admin.deleteUser(
          targetUserId
        );

      if (deleteAuthError) {
        authDeletionFailures.push({
          userId:
            targetUserId,
          error:
            deleteAuthError.message,
        });
      }
    }

    /*
     * ======================================================
     * 15. FINAL RESPONSE
     * ======================================================
     */

    if (
      authDeletionFailures.length >
      0
    ) {
      console.error(
        "Organization deleted but some Auth users could not be removed:",
        authDeletionFailures
      );

      return NextResponse.json(
        {
          success: true,

          partial: true,

          message:
            "Organization data was deleted, but one or more Supabase Auth accounts could not be removed automatically.",

          organization: {
            id: company.id,
            name: company.name,
            org_code:
              company.org_code ||
              null,
          },

          database:
            deleteResult,

          authUsers: {
            total:
              authUserIds.length,

            deleted:
              authUserIds.length -
              authDeletionFailures.length,

            failed:
              authDeletionFailures.length,
          },

          authDeletionFailures,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json({
      success: true,

      partial: false,

      message:
        "Organization and its associated accounts were permanently deleted successfully.",

      organization: {
        id: company.id,
        name: company.name,
        org_code:
          company.org_code ||
          null,
      },

      database:
        deleteResult,

      authUsers: {
        total:
          authUserIds.length,

        deleted:
          authUserIds.length,

        failed: 0,
      },
    });
  } catch (error) {
    console.error(
      "Organization permanent deletion error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Organization deletion failed.",
      },
      {
        status: 500,
      }
    );
  }
}
