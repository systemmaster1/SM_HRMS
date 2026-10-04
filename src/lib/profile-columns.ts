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

/**
 * Columns of public.companies a browser may read. The legacy
 * gsheet_webhook_url / gsheet_secret columns are excluded: the Google Sheet
 * backup secret lives in company_integrations (Owner/Admin only) and must not
 * reach every employee's browser.
 */
export const COMPANY_COLUMNS =
  "id,name,industry,size,address,city,phone,email,logo_url,plan,trial_ends_on,price_per_user,owner_id,created_at,website,gst_number,state,pincode,work_start,work_end,grace_minutes,half_day_minutes,full_day_minutes,weekly_offs,casual_leave_annual,sick_leave_annual,earned_leave_annual,short_leave_per_month,short_leave_hours,photo_policy,capture_location,capture_ip,day_types,buddy_enabled,buddy_required,buddy_scope,directory_enabled,directory_scope,directory_show_phone,directory_show_email,today_scope,tickets_enabled,geofence_enabled,office_lat,office_lng,office_radius_m,office_label,payroll_late_free_limit,payroll_late_step,payroll_late_deduction,payroll_leave_free_limit,payroll_leave_deduction,payroll_short_free_limit,payroll_short_deduction,payroll_absent_deduction,auto_leave_deduction_enabled,task_assignment_mode,kra_prefix,kra_counter,gsheet_backup_enabled,gsheet_last_backup,location_mandatory,timezone,gsheet_sync_interval_minutes,weekly_off_days,saturday_off_weeks,org_code,account_status,suspended_reason,ads_enabled,onboarding_completed_at" as const;
