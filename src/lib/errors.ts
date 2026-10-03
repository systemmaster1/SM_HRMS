/**
 * Turns technical failures (PostgreSQL / Supabase / network) into messages a
 * normal user can act on. Technical details are logged, never shown.
 *
 * Messages that the database raises on purpose for users (our RPCs use
 * `raise exception 'Start Meeting is available only after Check In.'`) are
 * already human-readable and are passed through unchanged.
 */

const TECHNICAL = [
  /violates (check|foreign key|not-null|unique|exclusion) constraint/i,
  /duplicate key value/i,
  /row-level security/i,
  /permission denied for (table|function|schema|relation)/i,
  /relation ".*" does not exist/i,
  /column ".*" (of relation ".*" )?does not exist/i,
  /function .* does not exist/i,
  /could not find the function/i,
  /structure of query does not match function result type/i,
  /invalid input syntax/i,
  /JWT|jwt expired|invalid claim/i,
  /PGRST\d+/,
  /syntax error at or near/i,
  /null value in column/i,
  /value too long for type/i,
  /out of range for type/i,
  /failed to fetch|networkerror|load failed|fetch failed/i,
  /^\s*\{[\s\S]*\}\s*$/,
];

function rawMessage(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return String(anyE.message || anyE.error_description || anyE.error || anyE.details || "");
}

export function isTechnicalError(e: unknown): boolean {
  const m = rawMessage(e);
  return !m || TECHNICAL.some((re) => re.test(m));
}

/**
 * @param fallback what the user was trying to do, e.g. "save the visit".
 */
export function friendlyError(e: unknown, fallback = "complete this action"): string {
  const m = rawMessage(e);
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(m)) {
    return "No internet connection. Check your network and try again.";
  }
  if (/JWT|jwt expired|invalid claim|session/i.test(m) && /expired|invalid|missing/i.test(m)) {
    return "Your session has expired. Please sign in again.";
  }
  if (/row-level security|permission denied/i.test(m)) {
    return "You don't have permission to do this. Contact your administrator if you need access.";
  }
  if (/field_visits_status_check/i.test(m)) {
    return "This visit cannot be moved to that status. Refresh and try again.";
  }
  if (/duplicate key value|already exists/i.test(m)) {
    return "This record already exists. Refresh and check before trying again.";
  }
  if (/exclusion constraint|support_meetings_no_overlap/i.test(m)) {
    return "This time slot is already booked. Please choose another time.";
  }
  if (isTechnicalError(e)) {
    if (typeof console !== "undefined") console.error("[SM HRMS]", e);
    return `We couldn't ${fallback}. Please refresh and try again.`;
  }
  return m;
}
