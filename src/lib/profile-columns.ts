/**
 * Columns of public.profiles a browser may read.
 *
 * Bank account, home address, date of birth and emergency contact are NOT in
 * this list: they are read/written only through the
 * get_employee_private_details / set_employee_private_details RPCs (self or
 * Owner/Admin of the same organization). Never use select("*") on profiles
 * in browser code — after migration 20261005_2b1_profiles_column_privileges
 * a "*" select fails because those columns are not granted.
 */
export const PROFILE_PRIVATE_FIELDS = [
  "date_of_birth", "address", "city", "state", "pincode",
  "bank_account_name", "bank_account_number", "bank_ifsc", "bank_name",
  "emergency_contact_name", "emergency_contact_phone",
] as const;

export type ProfilePrivateField = (typeof PROFILE_PRIVATE_FIELDS)[number];
export type ProfilePrivateDetails = Partial<Record<ProfilePrivateField, string | null>>;

// A string literal (not .join) so supabase-js can type the selected row.
export const PROFILE_COLUMNS =
  "id,company_id,full_name,email,phone,role,department,designation,employee_code,status,joined_on,avatar_url,created_at,manager_id,must_change_password,photo_required,auto_attendance,auto_in_time,auto_out_time,branch_id,status_note,status_changed_at,field_tracking_enabled,employee_type,tracking_mode,tracking_interval_minutes,location_stale_minutes,tracking_stale_after_minutes,route_history_enabled,work_manager_id,field_manager_id,left_at,notify_hr_manager,notify_work_manager,notify_field_manager,access_permissions,weekly_off_days" as const;
