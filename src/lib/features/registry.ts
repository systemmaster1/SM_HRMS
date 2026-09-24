/**
 * FEATURE REGISTRY — the single source of truth for modules in the app.
 *
 * The database table `public.features` holds the same keys and decides what
 * each organization may use (plan + SystemMaster overrides). This file tells
 * the app which screens, menu entries and permission keys belong to each key.
 *
 * Adding a module later:
 *   1. insert one row into public.features (+ feature_table_map for its tables)
 *   2. add one entry below and its route prefix(es)
 *   3. create  src/app/(app)/<route>/layout.tsx  →  <FeatureGate feature="…">
 * Navigation, route blocking, permissions and the Plan & Features list pick it up.
 */

export type FeatureKey =
  | "attendance"
  | "leave"
  | "tasks"
  | "tasks.delegation"
  | "tasks.checklist"
  | "field"
  | "field.tracking"
  | "field.visits"
  | "payroll";

export type FeatureInfo = {
  key: FeatureKey;
  label: string;
  parent?: FeatureKey;
  description: string;
};

export const FEATURES: Record<FeatureKey, FeatureInfo> = {
  attendance:         { key: "attendance", label: "Attendance", description: "Check-in / check-out, attendance register and reports" },
  leave:              { key: "leave", label: "Leave Management", description: "Leave requests, approvals, balances and reports" },
  tasks:              { key: "tasks", label: "Task Management", description: "Delegation and checklist tasks" },
  "tasks.delegation": { key: "tasks.delegation", parent: "tasks", label: "Delegation", description: "One-time tasks assigned to a person" },
  "tasks.checklist":  { key: "tasks.checklist", parent: "tasks", label: "Checklist", description: "Recurring tasks at a set frequency" },
  field:              { key: "field", label: "Field Employee Management", description: "Field staff tracking and customer visits" },
  "field.tracking":   { key: "field.tracking", parent: "field", label: "Field Tracking", description: "Duty-time live location, route history and KM" },
  "field.visits":     { key: "field.visits", parent: "field", label: "Visit Management", description: "Customer visits, check-in/out, notes and reports" },
  payroll:            { key: "payroll", label: "Payroll", description: "Salary structure, payroll processing and payslips" },
};

/** Route prefix → the feature that must be enabled to open it. Unlisted routes are core. */
export const ROUTE_FEATURES: [string, FeatureKey][] = [
  ["/attendance", "attendance"],
  ["/leave", "leave"],
  ["/tasks", "tasks"],
  ["/em-report", "tasks"],
  ["/field-visits", "field.visits"],
  ["/field-reports", "field.visits"],
  ["/tracking", "field"],
  ["/route-history", "field.tracking"],
  ["/payroll", "payroll"],
];

/** Per-user access keys (Team → Access) → the organization feature they belong to. */
export const ACCESS_KEY_FEATURE: Record<string, FeatureKey | null> = {
  dashboard: null,
  attendance: "attendance",
  leave: "leave",
  tasks: "tasks",
  field_visits: "field.visits",
  field_reports: "field.visits",
  live_tracking: "field.tracking",
  route_history: "field.tracking",
  payroll: "payroll",
  team: null,
  reports: null,
};

export function featureForPath(path: string): FeatureKey | null {
  const hit = ROUTE_FEATURES
    .filter(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}

/* ---------------------------------------------------------------------------
   Entitlements as returned by public.my_entitlements()
--------------------------------------------------------------------------- */
export type Entitlements = {
  /** false = the Phase A database update is not installed yet → everything allowed */
  installed: boolean;
  organization: {
    id: string;
    org_code: string | null;
    name: string;
    account_status: "active" | "suspended";
    suspended_reason?: string | null;
    onboarding_completed_at?: string | null;
    timezone: string | null;
    plan_code: string | null;
  } | null;
  ads_enabled: boolean;
  features: Partial<Record<FeatureKey, boolean>>;
  /** modules decided by SystemMaster (the organization cannot change them) */
  locked: FeatureKey[];
  /** paid modules requested and awaiting SystemMaster */
  requests: FeatureKey[];
  catalog: { key: FeatureKey; parent: FeatureKey | null; name: string; availability: string }[];
};

export const OPEN_ENTITLEMENTS: Entitlements = {
  installed: false,
  organization: null,
  ads_enabled: false,
  features: {},
  locked: [],
  requests: [],
  catalog: [],
};

/** The database already folds parents, plan, overrides and suspension into each value. */
export function isFeatureOn(ent: Entitlements | null | undefined, key?: FeatureKey | null): boolean {
  if (!key) return true;
  if (!ent || !ent.installed) return true;
  return ent.features[key] === true;
}

/** Final access = organization feature AND the user's own permission. */
export function canUse(
  ent: Entitlements | null | undefined,
  profile: { role?: string | null; access_permissions?: Record<string, string> | null } | null | undefined,
  accessKey: string,
): boolean {
  const feature = ACCESS_KEY_FEATURE[accessKey];
  if (feature && !isFeatureOn(ent, feature)) return false;
  if (profile?.role === "owner" || profile?.role === "admin") return true;
  const level = profile?.access_permissions?.[accessKey];
  return !!level && level !== "none";
}
