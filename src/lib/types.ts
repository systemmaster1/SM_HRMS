export type Role = "owner" | "admin" | "manager" | "employee";

export interface Company {
  id: string;
  name: string;
  industry: string;
  size: string;
  city: string;
  phone: string;
  email: string;
  logo_url: string | null;
  plan: "trial" | "active" | "past_due" | "cancelled";
  location_mandatory?: boolean;
  trial_ends_on: string | null;
  price_per_user: number;
  website: string;
  gst_number: string;
  state: string;
  pincode: string;
  address: string;
  owner_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  company_id: string | null;

  full_name: string;
  email: string | null;
  phone: string | null;

  role: Role;

  department: string;
  designation: string;
  employee_code: string;

  branch_id: string | null;

  status: "invited" | "active" | "disabled" | "left";

  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;

  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  joined_on: string;

  avatar_url: string | null;

  manager_id: string | null;

  must_change_password: boolean;

  created_at: string;

  /*
   * ------------------------------------------------------
   * FIELD / SALES EMPLOYEE TRACKING
   * ------------------------------------------------------
   *
   * These properties are used by the professional
   * Field Visit / Sales Tracking module.
   */

  employee_type?: "office" | "sales" | "field" | "hybrid";

  /**
   * Owner/Admin can enable tracking only for employees
   * who actually require field tracking.
   */
  field_tracking_enabled?: boolean;

  /**
   * active_visit:
   * Track only while an official field visit is active.
   *
   * working_hours:
   * Reserved for working-hours based tracking.
   *
   * manual:
   * Employee manually starts/stops tracking.
   */
  tracking_mode?: "active_visit" | "working_hours" | "manual";

  /**
   * GPS capture interval.
   * Default recommended value = 5 minutes.
   */
  tracking_interval_minutes?: number;

  /**
   * If no GPS location is received within this period,
   * Owner/Manager dashboard can mark location as stale.
   */
  tracking_stale_after_minutes?: number;

  /**
   * Save location history so visit route can be displayed.
   */
  route_history_enabled?: boolean;

  /** Per-module access: none, self, team, company. Owners/admins are company-wide. */
  access_permissions?: Record<string, "none" | "self" | "team" | "company">;
}

export interface Invite {
  id: string;
  company_id: string;

  full_name: string;
  phone: string;
  email: string | null;

  role: Exclude<Role, "owner">;

  department: string;
  designation: string;

  status: "pending" | "accepted" | "cancelled";

  created_at: string;
}

export interface Task {
  id: string;
  company_id: string;

  title: string;
  description: string;

  assignee_id: string | null;
  created_by: string | null;

  priority: "low" | "medium" | "high";

  status: "todo" | "in_progress" | "done";

  due_date: string | null;

  created_at: string;
}

/**
 * Owner/Admin company-level administrative access.
 */
export const isAdminRole = (r?: Role | null) =>
  r === "owner" || r === "admin";

/**
 * Owner/Admin can manage the whole company.
 * Manager can manage/report on their own team.
 */
export const canManageTeam = (r?: Role | null) =>
  r === "owner" || r === "admin" || r === "manager";
