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

export const isAdminRole = (r?: Role | null) => r === "owner" || r === "admin";
