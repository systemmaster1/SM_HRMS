-- =============================================================================
-- SM HRMS · PRODUCTION SCHEMA SNAPSHOT (structure only — NO data, NO secrets)
-- Source: Supabase project "SM HRMS" (aqnysihfxicwakjuwkbm), captured 4 Oct 2026
--         read-only from the catalog, after 20261004_p0_security_guards.sql.
--
-- Purpose: the core tables, RLS policies and RPCs were created directly in
-- Supabase and were never in Git. This file is the reference for audits and
-- the starting point for disaster recovery (see docs/DISASTER_RECOVERY.md).
--
-- NOT a migration: do not run it against production. To rebuild an empty
-- project, review it first (extensions, auth/storage setup and cron jobs are
-- configured separately).
-- =============================================================================

-- TABLES & COLUMNS
create table if not exists public.ai_action_log (id bigint not null, company_id uuid not null, user_id uuid not null, action text not null, target_type text, target_id text, payload jsonb, status text not null default 'executed'::text, created_at timestamp with time zone not null default now());
create table if not exists public.ai_conversations (id uuid not null default gen_random_uuid(), company_id uuid not null, user_id uuid not null, title text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.ai_messages (id uuid not null default gen_random_uuid(), company_id uuid not null, conversation_id uuid not null, user_id uuid not null, role text not null, content text not null default ''::text, tool_name text, tool_payload jsonb, created_at timestamp with time zone not null default now());
create table if not exists public.ai_pending_actions (id uuid not null default gen_random_uuid(), company_id uuid not null, user_id uuid not null, conversation_id uuid, action text not null, target_type text, target_id text, summary text not null, payload jsonb not null default '{}'::jsonb, status text not null default 'pending'::text, expires_at timestamp with time zone not null default (now() + '00:15:00'::interval), confirmed_at timestamp with time zone, executed_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.ai_settings (company_id uuid not null, enabled boolean not null default false, provider text, model text, model_options jsonb not null default '[]'::jsonb, api_key_ciphertext text, api_key_iv text, api_key_tag text, key_hint text, employee_enabled boolean not null default true, manager_enabled boolean not null default true, admin_enabled boolean not null default true, monthly_request_limit integer, monthly_token_limit bigint, updated_by uuid, updated_at timestamp with time zone not null default now());
create table if not exists public.ai_usage_log (id bigint not null, company_id uuid not null, user_id uuid not null, provider text not null, model text not null, requests integer not null default 1, input_tokens integer not null default 0, output_tokens integer not null default 0, created_at timestamp with time zone not null default now());
create table if not exists public.ai_user_access (company_id uuid not null, user_id uuid not null, enabled boolean not null, updated_by uuid, updated_at timestamp with time zone not null default now());
create table if not exists public.attendance (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, work_date date not null default CURRENT_DATE, check_in timestamp with time zone, check_in_lat double precision, check_in_lng double precision, check_out timestamp with time zone, check_out_lat double precision, check_out_lng double precision, status text not null default 'present'::text, work_minutes integer default 0, created_at timestamp with time zone not null default now(), is_late boolean not null default false, late_minutes integer not null default 0, notes text default ''::text, check_in_photo text, check_out_photo text, check_in_address text, check_out_address text, check_in_ip text, check_out_ip text, is_auto boolean not null default false, check_in_distance_m integer, check_out_distance_m integer, check_in_outside boolean not null default false, check_out_outside boolean not null default false, check_in_server_at timestamp with time zone, check_out_server_at timestamp with time zone, timestamp_source text not null default 'server'::text);
create table if not exists public.attendance_daily_log (employee_id uuid not null, work_date date not null, company_id uuid not null, status text not null, check_in timestamp with time zone, check_out timestamp with time zone, work_minutes integer, note text, finalized boolean not null default false, updated_at timestamp with time zone not null default now());
create table if not exists public.audit_logs (id uuid not null default gen_random_uuid(), company_id uuid, actor_id uuid, actor_label text, action text not null, entity text not null, entity_key text, old_value jsonb, new_value jsonb, created_at timestamp with time zone not null default now());
create table if not exists public.auth_otp_codes (id uuid not null default gen_random_uuid(), email text not null, purpose text not null default 'password_reset'::text, code_hash text not null, expires_at timestamp with time zone not null, consumed_at timestamp with time zone, attempts integer not null default 0, created_at timestamp with time zone not null default now(), metadata jsonb);
create table if not exists public.billing_adjustments (id uuid not null default gen_random_uuid(), company_id uuid not null, payment_id uuid, adjustment_type text not null, amount numeric not null, currency text not null default 'INR'::text, description text, old_plan text, new_plan text, effective_at timestamp with time zone not null default now(), metadata jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamp with time zone not null default now());
create table if not exists public.billing_email_log (id uuid not null default gen_random_uuid(), company_id uuid not null, payment_id uuid, email_type text not null, recipient_email text not null, status text not null default 'sent'::text, provider_message_id text, error_message text, sent_at timestamp with time zone not null default now(), metadata jsonb not null default '{}'::jsonb);
create table if not exists public.billing_payments (id uuid not null default gen_random_uuid(), company_id uuid not null, subscription_id text, plan_code text, billing_cycle text not null default 'monthly'::text, currency text not null default 'INR'::text, subtotal numeric not null default 0, discount_amount numeric not null default 0, adjustment_amount numeric not null default 0, tax_amount numeric not null default 0, total_amount numeric not null default 0, amount_paid numeric not null default 0, amount_due numeric not null default 0, status text not null default 'pending'::text, payment_method text, razorpay_payment_id text, razorpay_order_id text, razorpay_invoice_id text, razorpay_subscription_id text, receipt_number text, billing_period_start timestamp with time zone, billing_period_end timestamp with time zone, due_at timestamp with time zone, paid_at timestamp with time zone, source text not null default 'razorpay'::text, notes text, metadata jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.branches (id uuid not null default gen_random_uuid(), company_id uuid not null, name text not null, address text default ''::text, geofence_enabled boolean not null default false, office_lat double precision, office_lng double precision, office_radius_m integer not null default 200, active boolean not null default true, created_at timestamp with time zone not null default now());
create table if not exists public.calendar_connections (id uuid not null default gen_random_uuid(), company_id uuid not null, user_id uuid not null, provider text not null, calendar_id text, account_email text, access_token_ciphertext text, refresh_token_ciphertext text, token_iv text, token_tag text, expires_at timestamp with time zone, enabled boolean not null default true, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.checklist_instances (id uuid not null default gen_random_uuid(), company_id uuid not null, template_id uuid not null, assigned_to uuid not null, due_date date not null, completed_at timestamp with time zone, created_at timestamp with time zone not null default now(), due_time time without time zone not null default '09:00:00'::time without time zone, reminder_sent_at timestamp with time zone, status text not null default 'pending'::text);
create table if not exists public.checklist_templates (id uuid not null default gen_random_uuid(), company_id uuid not null, title text not null, description text default ''::text, assigned_to uuid not null, assigned_by uuid, frequency text not null, start_date date not null default CURRENT_DATE, end_date date, next_due_date date not null, active boolean not null default true, created_at timestamp with time zone not null default now(), kra_id text default ''::text, priority text not null default 'medium'::text, due_time time without time zone not null default '09:00:00'::time without time zone);
create table if not exists public.companies (id uuid not null default gen_random_uuid(), name text not null, industry text default ''::text, size text default ''::text, address text default ''::text, city text default ''::text, phone text default ''::text, email text default ''::text, logo_url text, plan text not null default 'trial'::text, trial_ends_on date default (CURRENT_DATE + 7), price_per_user integer not null default 19, owner_id uuid, created_at timestamp with time zone not null default now(), website text default ''::text, gst_number text default ''::text, state text default ''::text, pincode text default ''::text, work_start time without time zone default '09:30:00'::time without time zone, work_end time without time zone default '18:30:00'::time without time zone, grace_minutes integer not null default 15, half_day_minutes integer not null default 240, full_day_minutes integer not null default 480, weekly_offs int4[] not null default '{0}'::integer[], casual_leave_annual numeric not null default 12, sick_leave_annual numeric not null default 6, earned_leave_annual numeric not null default 15, short_leave_per_month integer not null default 2, short_leave_hours numeric not null default 2, photo_policy text not null default 'off'::text, capture_location boolean not null default true, capture_ip boolean not null default true, day_types jsonb not null default '["full_day", "first_half", "second_half", "short_morning", "short_evening", "wfh"]'::jsonb, buddy_enabled boolean not null default false, buddy_required boolean not null default false, buddy_scope text not null default 'department'::text, directory_enabled boolean not null default true, directory_scope text not null default 'company'::text, directory_show_phone boolean not null default true, directory_show_email boolean not null default true, today_scope text not null default 'company'::text, tickets_enabled boolean not null default true, geofence_enabled boolean not null default false, office_lat double precision, office_lng double precision, office_radius_m integer not null default 200, office_label text default ''::text, payroll_late_free_limit integer not null default 2, payroll_late_step integer not null default 2, payroll_late_deduction numeric not null default 0.5, payroll_leave_free_limit integer not null default 999, payroll_leave_deduction numeric not null default 1.0, payroll_short_free_limit integer not null default 2, payroll_short_deduction numeric not null default 0.5, payroll_absent_deduction numeric not null default 1.0, auto_leave_deduction_enabled boolean not null default true, task_assignment_mode text not null default 'department'::text, kra_prefix text not null default 'KRA'::text, kra_counter integer not null default 0, gsheet_webhook_url text default ''::text, gsheet_secret text default ''::text, gsheet_backup_enabled boolean not null default false, gsheet_last_backup timestamp with time zone, location_mandatory boolean not null default false, timezone text not null default 'Asia/Kolkata'::text, gsheet_sync_interval_minutes integer not null default 15, weekly_off_days int4[] not null default '{0}'::integer[], saturday_off_weeks int4[] not null default '{}'::integer[], org_code text, account_status text not null default 'active'::text, suspended_reason text, ads_enabled boolean, onboarding_completed_at timestamp with time zone);
create table if not exists public.company_integrations (company_id uuid not null, gsheet_webhook_url text, gsheet_secret text, updated_at timestamp with time zone not null default now());
create table if not exists public.company_subscriptions (company_id uuid not null, plan_code text not null, status text not null default 'trial'::text, licensed_users integer not null default 1, custom_price_per_user integer, discount_percent numeric not null default 0, billing_cycle text not null default 'monthly'::text, current_period_start timestamp with time zone, current_period_end timestamp with time zone, trial_ends_at timestamp with time zone, cancel_at_period_end boolean not null default false, cancelled_at timestamp with time zone, notes text default ''::text, razorpay_customer_id text, razorpay_subscription_id text, razorpay_plan_id text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), next_billing_at timestamp with time zone, last_payment_at timestamp with time zone, last_payment_status text, grace_until timestamp with time zone, pending_plan_code text, pending_plan_effective_at timestamp with time zone, billing_email text, auto_renew boolean not null default true);
create table if not exists public.daily_digest_log (employee_id uuid not null, day date not null, sent_at timestamp with time zone not null default now());
create table if not exists public.delegation_subtasks (id uuid not null default gen_random_uuid(), company_id uuid not null, delegation_id uuid not null, title text not null, done boolean not null default false, sort integer not null default 0, created_at timestamp with time zone not null default now());
create table if not exists public.delegations (id uuid not null default gen_random_uuid(), company_id uuid not null, title text not null, description text default ''::text, assigned_to uuid not null, assigned_by uuid, priority text not null default 'medium'::text, due_date date not null, due_time time without time zone, completed_at timestamp with time zone, created_at timestamp with time zone not null default now(), kra_id text default ''::text, revised_count integer not null default 0, reminder_sent_at timestamp with time zone, overdue_notified_at timestamp with time zone, status text not null default 'pending'::text);
create table if not exists public.departments (id uuid not null default gen_random_uuid(), company_id uuid not null, name text not null, created_at timestamp with time zone not null default now());
create table if not exists public.designations (id uuid not null default gen_random_uuid(), company_id uuid not null, name text not null, created_at timestamp with time zone not null default now());
create table if not exists public.documents (id uuid not null default gen_random_uuid(), company_id uuid not null, title text not null, description text default ''::text, category text not null default 'policy'::text, file_url text not null, file_name text default ''::text, file_size integer default 0, uploaded_by uuid, created_at timestamp with time zone not null default now());
create table if not exists public.em_weekly_targets (id uuid not null default gen_random_uuid(), company_id uuid not null, user_id uuid not null, iso_year integer not null, iso_week integer not null, metric text not null, planned numeric not null default 0, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.employee_documents (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, category text not null default 'other'::text, title text not null, file_url text not null, file_name text default ''::text, file_size integer default 0, uploaded_by uuid, created_at timestamp with time zone not null default now());
create table if not exists public.employee_live_locations (employee_id uuid not null, company_id uuid not null, visit_id uuid, latitude double precision, longitude double precision, accuracy_m integer, speed_mps double precision, heading double precision, permission_state text not null default 'unknown'::text, tracking_state text not null default 'idle'::text, app_state text not null default 'foreground'::text, last_seen_at timestamp with time zone, last_error text, updated_at timestamp with time zone not null default now(), duty_status text not null default 'off_duty'::text, duty_started_at timestamp with time zone, duty_ended_at timestamp with time zone, last_state_changed_at timestamp with time zone not null default clock_timestamp());
create table if not exists public.employee_location_history (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, visit_id uuid, latitude double precision not null, longitude double precision not null, accuracy_m integer, speed_mps double precision, heading double precision, source text not null default 'web_pwa'::text, captured_at timestamp with time zone not null default now(), created_at timestamp with time zone not null default now());
create table if not exists public.employee_tracking_events (id bigint not null, employee_id uuid not null, company_id uuid not null, visit_id uuid, event_type text not null, event_message text, latitude double precision, longitude double precision, created_at timestamp with time zone not null default now());
create table if not exists public.feature_gate_report (table_name text not null, feature_key text, result text, checked_at timestamp with time zone default now());
create table if not exists public.feature_table_map (table_name text not null, feature_key text not null, parent_table text, parent_fk text);
create table if not exists public.features (key text not null, parent_key text, name text not null, description text, availability text not null default 'paid'::text, sort_order integer not null default 100, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.field_visit_schedule_changes (id uuid not null default gen_random_uuid(), visit_id uuid not null, company_id uuid not null, old_at timestamp with time zone, new_at timestamp with time zone, changed_by uuid, changed_at timestamp with time zone not null default now());
create table if not exists public.field_visits (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, client_name text default ''::text, purpose text default ''::text, address text default ''::text, check_in_at timestamp with time zone, check_in_lat double precision, check_in_lng double precision, check_out_at timestamp with time zone, check_out_lat double precision, check_out_lng double precision, status text not null default 'planned'::text, notes text default ''::text, visit_date date not null default CURRENT_DATE, created_at timestamp with time zone not null default now(), assigned_by uuid, accepted_at timestamp with time zone, travel_started_at timestamp with time zone, reached_at timestamp with time zone, meeting_started_at timestamp with time zone, completed_at timestamp with time zone, last_lat double precision, last_lng double precision, last_location_at timestamp with time zone, person_met text default ''::text, outcome text default ''::text, completion_notes text default ''::text, next_followup_at timestamp with time zone, scheduled_at timestamp with time zone, target_duration_minutes integer not null default 60, destination_lat double precision, destination_lng double precision, company_name text, contact_person text, contact_number text, contact_email text, custom_data jsonb not null default '{}'::jsonb, remarks text, next_action text, next_follow_up_at timestamp with time zone, original_scheduled_at timestamp with time zone, reschedule_count integer not null default 0, reminder_sent_at timestamp with time zone);
create table if not exists public.gsheet_sync_logs (id uuid not null default gen_random_uuid(), company_id uuid not null, trigger text not null default 'cron'::text, started_at timestamp with time zone not null default now(), finished_at timestamp with time zone, ok boolean, tabs integer, rows_written integer, error text);
create table if not exists public.gsheet_sync_runs (id uuid not null default gen_random_uuid(), company_id uuid not null, started_at timestamp with time zone not null default now(), completed_at timestamp with time zone, status text not null default 'started'::text, sheets_written integer not null default 0, error_message text, trigger_source text not null default 'manual'::text, created_at timestamp with time zone not null default now());
create table if not exists public.holidays (id uuid not null default gen_random_uuid(), company_id uuid not null, holiday_date date not null, name text not null, holiday_type text not null default 'public'::text, created_at timestamp with time zone not null default now());
create table if not exists public.invites (id uuid not null default gen_random_uuid(), company_id uuid not null, full_name text not null, phone text not null, email text, role text not null default 'employee'::text, department text default ''::text, designation text default ''::text, status text not null default 'pending'::text, invited_by uuid, created_at timestamp with time zone not null default now());
create table if not exists public.leave_types (id uuid not null default gen_random_uuid(), company_id uuid not null, code text not null, name text not null, annual_quota numeric not null default 0, is_paid boolean not null default true, active boolean not null default true, sort_order integer not null default 0, created_at timestamp with time zone not null default now());
create table if not exists public.leaves (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, leave_type text, from_date date not null, to_date date not null, days numeric default 1, reason text default ''::text, status text not null default 'pending'::text, decided_by uuid, decided_at timestamp with time zone, created_at timestamp with time zone not null default now(), hours numeric default 0, leave_type_id uuid, day_type text not null default 'full_day'::text, buddy_id uuid, buddy_status text not null default 'none'::text, buddy_note text default ''::text);
create table if not exists public.notifications (id uuid not null default gen_random_uuid(), company_id uuid not null, user_id uuid not null, title text not null, body text default ''::text, kind text not null default 'info'::text, link text default ''::text, is_read boolean not null default false, created_at timestamp with time zone not null default now(), pushed_at timestamp with time zone, push_result text);
create table if not exists public.org_admin_2fa_challenges (id uuid not null default gen_random_uuid(), user_id uuid not null, company_id uuid not null, email text not null, purpose text not null, code_hash text not null, expires_at timestamp with time zone not null, attempts integer not null default 0, max_attempts integer not null default 5, consumed_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.org_admin_2fa_preferences (id uuid not null default gen_random_uuid(), user_id uuid not null, company_id uuid not null, enabled boolean not null default false, enabled_at timestamp with time zone, skipped_at timestamp with time zone, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.org_admin_2fa_sessions (id uuid not null default gen_random_uuid(), user_id uuid not null, company_id uuid not null, token_hash text not null, verified_at timestamp with time zone not null default now(), expires_at timestamp with time zone not null, revoked_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.organization_feature_overrides (company_id uuid not null, feature_key text not null, enabled boolean not null, reason text, updated_by uuid, updated_at timestamp with time zone not null default now(), source text not null default 'platform'::text);
create table if not exists public.organization_module_requests (id uuid not null default gen_random_uuid(), company_id uuid not null, feature_key text not null, status text not null default 'pending'::text, note text, requested_by uuid, requested_at timestamp with time zone not null default now(), decided_by uuid, decided_at timestamp with time zone, decision_note text);
create table if not exists public.payroll_actions (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, month integer not null, year integer not null, reason text not null, deduction_days numeric not null default 0.5, status text not null default 'pending'::text, deduct_from text, created_by uuid, decided_by uuid, decided_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.plan_features (plan_code text not null, feature_key text not null, enabled boolean not null default true, limit_value integer, note text);
create table if not exists public.platform_admins (user_id uuid not null, note text, created_at timestamp with time zone not null default now());
create table if not exists public.profiles (id uuid not null, company_id uuid, full_name text not null default ''::text, email text, phone text, role text not null default 'employee'::text, department text default ''::text, designation text default ''::text, employee_code text default ''::text, status text not null default 'active'::text, joined_on date default CURRENT_DATE, avatar_url text, created_at timestamp with time zone not null default now(), manager_id uuid, must_change_password boolean not null default false, photo_required boolean not null default false, auto_attendance boolean not null default false, auto_in_time time without time zone default '09:30:00'::time without time zone, auto_out_time time without time zone default '18:30:00'::time without time zone, date_of_birth date, branch_id uuid, address text default ''::text, city text default ''::text, state text default ''::text, pincode text default ''::text, bank_account_name text default ''::text, bank_account_number text default ''::text, bank_ifsc text default ''::text, bank_name text default ''::text, emergency_contact_name text default ''::text, emergency_contact_phone text default ''::text, status_note text default ''::text, status_changed_at timestamp with time zone, field_tracking_enabled boolean not null default false, employee_type text not null default 'office'::text, tracking_mode text not null default 'active_visit'::text, tracking_interval_minutes integer not null default 5, location_stale_minutes integer not null default 10, tracking_stale_after_minutes integer not null default 10, route_history_enabled boolean not null default true, work_manager_id uuid, field_manager_id uuid, left_at timestamp with time zone, notify_hr_manager boolean not null default true, notify_work_manager boolean not null default true, notify_field_manager boolean not null default true, access_permissions jsonb not null default '{"team": "none", "leave": "self", "tasks": "self", "payroll": "none", "reports": "none", "dashboard": "self", "attendance": "self", "field_visits": "none", "field_reports": "none", "live_tracking": "none", "route_history": "none"}'::jsonb, weekly_off_days int4[]);
create table if not exists public.push_devices (id uuid not null default gen_random_uuid(), user_id uuid not null, company_id uuid not null, platform text not null, token text not null, subscription jsonb, user_agent text, created_at timestamp with time zone not null default now(), last_seen_at timestamp with time zone not null default now());
create table if not exists public.razorpay_webhook_events (id uuid not null default gen_random_uuid(), razorpay_event_id text, event_type text not null, entity_id text, company_id uuid, payload jsonb not null default '{}'::jsonb, processing_status text not null default 'received'::text, error_message text, received_at timestamp with time zone not null default now(), processed_at timestamp with time zone);
create table if not exists public.salary_master (id uuid not null default gen_random_uuid(), company_id uuid not null, employee_id uuid not null, monthly_salary numeric not null default 0, basic numeric not null default 0, hra numeric not null default 0, other_allowance numeric not null default 0, pf numeric not null default 0, other_deduction numeric not null default 0, updated_at timestamp with time zone not null default now());
create table if not exists public.subscription_events (id uuid not null default gen_random_uuid(), company_id uuid not null, event_type text not null, old_plan text, new_plan text, actor_user_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamp with time zone not null default now());
create table if not exists public.subscription_plans (code text not null, name text not null, price_per_user integer, currency text not null default 'INR'::text, billing_period text not null default 'monthly'::text, is_custom boolean not null default false, active boolean not null default true, display_order integer not null default 0, description text default ''::text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), ads_enabled boolean);
create table if not exists public.support_meetings (id uuid not null default gen_random_uuid(), company_id uuid not null, ticket_id uuid, requested_by uuid not null, host_user_id uuid, title text not null, description text, starts_at timestamp with time zone not null, ends_at timestamp with time zone not null, timezone text not null default 'Asia/Kolkata'::text, status text not null default 'requested'::text, provider text not null default 'manual'::text, external_event_id text, meeting_url text, attendee_email text, attendee_name text, internal_notes text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), confirmation_email_sent_at timestamp with time zone, reminder_60_sent_at timestamp with time zone, reminder_10_sent_at timestamp with time zone, last_notification_error text);
create table if not exists public.system_admin_2fa_challenges (id uuid not null default gen_random_uuid(), user_id uuid not null, email text not null, code_hash text not null, expires_at timestamp with time zone not null, attempts integer not null default 0, max_attempts integer not null default 5, consumed_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.system_admin_2fa_sessions (id uuid not null default gen_random_uuid(), user_id uuid not null, token_hash text not null, verified_at timestamp with time zone not null default now(), expires_at timestamp with time zone not null, revoked_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.system_admins (user_id uuid not null, role text not null default 'super_admin'::text, active boolean not null default true, created_at timestamp with time zone not null default now());
create table if not exists public.task_activity_log (id uuid not null default gen_random_uuid(), company_id uuid not null, delegation_id uuid not null, actor_id uuid, activity_type text not null, old_value jsonb, new_value jsonb, message text, metadata jsonb not null default '{}'::jsonb, created_at timestamp with time zone not null default now());
create table if not exists public.task_attachments (id uuid not null default gen_random_uuid(), company_id uuid not null, delegation_id uuid, uploaded_by uuid not null, file_name text not null, file_path text, file_type text, mime_type text, file_size_bytes bigint, attachment_context text not null default 'work'::text, created_at timestamp with time zone not null default now(), checklist_instance_id uuid, storage_path text, file_size bigint);
create table if not exists public.task_comments (id uuid not null default gen_random_uuid(), company_id uuid not null, delegation_id uuid not null, user_id uuid not null, body text not null, created_at timestamp with time zone not null default now());
create table if not exists public.task_completion_submissions (id uuid not null default gen_random_uuid(), company_id uuid not null, delegation_id uuid not null, submitted_by uuid not null, completion_comment text, checklist_total integer not null default 0, checklist_completed integer not null default 0, submitted_at timestamp with time zone not null default now(), metadata jsonb not null default '{}'::jsonb);
create table if not exists public.task_extensions (id uuid not null default gen_random_uuid(), company_id uuid not null, delegation_id uuid not null, requested_by uuid not null, requested_date date not null, requested_time time without time zone, reason text, status text not null default 'pending'::text, decided_by uuid, decided_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.task_management_policies (id uuid not null default gen_random_uuid(), company_id uuid not null, scope_type text not null default 'company'::text, department_id uuid, employee_id uuid, status_pending_enabled boolean not null default true, status_in_progress_enabled boolean not null default true, status_hold_enabled boolean not null default true, status_complete_enabled boolean not null default true, can_create_task boolean not null default true, can_delegate_task boolean not null default true, can_reassign_task boolean not null default false, can_edit_due_date boolean not null default false, can_edit_priority boolean not null default false, can_reopen_completed_task boolean not null default false, comments_enabled boolean not null default true, completion_comment_required boolean not null default false, checklist_enabled boolean not null default true, checklist_edit_allowed boolean not null default true, checklist_required_for_completion boolean not null default false, attachments_enabled boolean not null default true, attachment_during_work_allowed boolean not null default true, attachment_on_completion_allowed boolean not null default true, attachment_required_for_completion boolean not null default false, attachment_download_allowed boolean not null default true, max_attachment_size_mb integer not null default 10, allowed_attachment_types text[] not null default ARRAY['pdf'::text, 'jpg'::text, 'jpeg'::text, 'png'::text, 'doc'::text, 'docx'::text, 'xls'::text, 'xlsx'::text], history_visibility text not null default 'own'::text, activity_history_enabled boolean not null default true, history_default_months integer not null default 1, created_by uuid, updated_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), checklist_early_complete_days integer not null default 0);
create table if not exists public.tasks (id uuid not null default gen_random_uuid(), company_id uuid not null, title text not null, description text default ''::text, assignee_id uuid, created_by uuid, priority text not null default 'medium'::text, status text not null default 'todo'::text, due_date date, completed_at timestamp with time zone, created_at timestamp with time zone not null default now());
create table if not exists public.ticket_comments (id uuid not null default gen_random_uuid(), ticket_id uuid not null, company_id uuid not null, author_id uuid not null, body text not null, is_request boolean not null default false, created_at timestamp with time zone not null default now());
create table if not exists public.tickets (id uuid not null default gen_random_uuid(), company_id uuid not null, ticket_no integer, raised_by uuid not null, assigned_to uuid, category text not null default 'general'::text, priority text not null default 'medium'::text, subject text not null, description text default ''::text, status text not null default 'open'::text, plan text default ''::text, target_date date, resolved_at timestamp with time zone, created_at timestamp with time zone not null default now(), source text not null default 'manual'::text, ai_summary text, meeting_required boolean not null default false, updated_at timestamp with time zone not null default now());
create table if not exists public.tracking_events (id uuid not null default gen_random_uuid(), company_id uuid not null, visit_id uuid, employee_id uuid not null, event_type text not null, event_time timestamp with time zone not null default now(), latitude double precision, longitude double precision, details jsonb not null default '{}'::jsonb, created_at timestamp with time zone not null default now(), server_recorded_at timestamp with time zone not null default clock_timestamp(), is_inferred boolean not null default false, source text not null default 'server'::text);
create table if not exists public.visit_custom_fields (id uuid not null default gen_random_uuid(), company_id uuid not null, field_key text not null, label text not null, field_type text not null default 'text'::text, placeholder text default ''::text, is_required boolean not null default false, is_active boolean not null default true, sort_order integer not null default 100, options jsonb not null default '[]'::jsonb, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.visit_form_settings (company_id uuid not null, customer_name_required boolean not null default true, company_name_required boolean not null default false, contact_person_required boolean not null default false, contact_number_required boolean not null default false, contact_email_required boolean not null default false, purpose_required boolean not null default true, address_required boolean not null default false, scheduled_at_required boolean not null default true, updated_by uuid, updated_at timestamp with time zone not null default now());
create table if not exists public.visit_location_history (id uuid not null default gen_random_uuid(), company_id uuid not null, visit_id uuid not null, employee_id uuid not null, latitude double precision not null, longitude double precision not null, accuracy_m integer, speed_mps double precision, heading double precision, captured_at timestamp with time zone not null default now(), created_at timestamp with time zone not null default now());
alter table public.delegations add constraint delegations_pkey PRIMARY KEY (id);
alter table public.holidays add constraint holidays_company_id_holiday_date_name_key UNIQUE (company_id, holiday_date, name);
alter table public.holidays add constraint holidays_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_category_check CHECK ((category = ANY (ARRAY['policy'::text, 'handbook'::text, 'form'::text, 'notice'::text, 'other'::text])));
alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table public.documents add constraint documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.delegations add constraint delegations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.delegations add constraint delegations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.delegations add constraint delegations_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.plan_features add constraint plan_features_pkey PRIMARY KEY (plan_code, feature_key);
alter table public.plan_features add constraint plan_features_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES subscription_plans(code) ON DELETE CASCADE;
alter table public.company_subscriptions add constraint company_subscriptions_pkey PRIMARY KEY (company_id);
alter table public.company_subscriptions add constraint company_subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.company_subscriptions add constraint company_subscriptions_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES subscription_plans(code);
alter table public.subscription_events add constraint subscription_events_pkey PRIMARY KEY (id);
alter table public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table public.tickets add constraint tickets_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.ticket_comments add constraint ticket_comments_pkey PRIMARY KEY (id);
alter table public.ticket_comments add constraint ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
alter table public.ticket_comments add constraint ticket_comments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ticket_comments add constraint ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.payroll_actions add constraint payroll_actions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.payroll_actions add constraint payroll_actions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.payroll_actions add constraint payroll_actions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.payroll_actions add constraint payroll_actions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.delegation_subtasks add constraint delegation_subtasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.delegation_subtasks add constraint delegation_subtasks_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE;
alter table public.task_comments add constraint task_comments_pkey PRIMARY KEY (id);
alter table public.task_comments add constraint task_comments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.task_comments add constraint task_comments_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE;
alter table public.task_comments add constraint task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.task_extensions add constraint task_extensions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table public.task_extensions add constraint task_extensions_pkey PRIMARY KEY (id);
alter table public.task_extensions add constraint task_extensions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.task_extensions add constraint task_extensions_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE;
alter table public.task_extensions add constraint task_extensions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.task_extensions add constraint task_extensions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id);
alter table public.subscription_events add constraint subscription_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.system_admins add constraint system_admins_pkey PRIMARY KEY (user_id);
alter table public.system_admins add constraint system_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.companies add constraint companies_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'cancelled'::text])));
alter table public.companies add constraint companies_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'employee'::text])));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.companies add constraint companies_owner_fk FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.invites add constraint invites_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'employee'::text])));
alter table public.branches add constraint branches_company_id_name_key UNIQUE (company_id, name);
alter table public.branches add constraint branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
alter table public.field_visits add constraint field_visits_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.visit_location_history add constraint visit_location_history_pkey PRIMARY KEY (id);
alter table public.visit_location_history add constraint visit_location_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.visit_location_history add constraint visit_location_history_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES field_visits(id) ON DELETE CASCADE;
alter table public.visit_location_history add constraint visit_location_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.invites add constraint invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text])));
alter table public.invites add constraint invites_pkey PRIMARY KEY (id);
alter table public.invites add constraint invites_company_id_phone_key UNIQUE (company_id, phone);
alter table public.invites add constraint invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.invites add constraint invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.attendance add constraint attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'leave'::text, 'half_day'::text, 'holiday'::text])));
alter table public.attendance add constraint attendance_pkey PRIMARY KEY (id);
alter table public.attendance add constraint attendance_employee_id_work_date_key UNIQUE (employee_id, work_date);
alter table public.attendance add constraint attendance_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.attendance add constraint attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.leaves add constraint leaves_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
alter table public.leaves add constraint leaves_pkey PRIMARY KEY (id);
alter table public.leaves add constraint leaves_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.leaves add constraint leaves_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.leaves add constraint leaves_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id);
alter table public.tracking_events add constraint tracking_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])));
alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table public.tasks add constraint tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.field_visits add constraint field_visits_pkey PRIMARY KEY (id);
alter table public.field_visits add constraint field_visits_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.field_visits add constraint field_visits_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leaves add constraint leaves_leave_type_check CHECK ((leave_type = ANY (ARRAY['casual'::text, 'sick'::text, 'earned'::text, 'unpaid'::text, 'short'::text])));
alter table public.holidays add constraint holidays_holiday_type_check CHECK ((holiday_type = ANY (ARRAY['public'::text, 'optional'::text, 'restricted'::text])));
alter table public.holidays add constraint holidays_pkey PRIMARY KEY (id);
alter table public.companies add constraint companies_photo_policy_check CHECK ((photo_policy = ANY (ARRAY['off'::text, 'all'::text, 'selected'::text])));
alter table public.departments add constraint departments_pkey PRIMARY KEY (id);
alter table public.departments add constraint departments_company_id_name_key UNIQUE (company_id, name);
alter table public.departments add constraint departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.designations add constraint designations_pkey PRIMARY KEY (id);
alter table public.designations add constraint designations_company_id_name_key UNIQUE (company_id, name);
alter table public.designations add constraint designations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.leave_types add constraint leave_types_pkey PRIMARY KEY (id);
alter table public.leave_types add constraint leave_types_company_id_code_key UNIQUE (company_id, code);
alter table public.leave_types add constraint leave_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.companies add constraint companies_buddy_scope_check CHECK ((buddy_scope = ANY (ARRAY['department'::text, 'company'::text])));
alter table public.leaves add constraint leaves_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE SET NULL;
alter table public.leaves add constraint leaves_day_type_check CHECK ((day_type = ANY (ARRAY['full_day'::text, 'first_half'::text, 'second_half'::text, 'short_morning'::text, 'short_evening'::text, 'wfh'::text])));
alter table public.leaves add constraint leaves_buddy_id_fkey FOREIGN KEY (buddy_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leaves add constraint leaves_buddy_status_check CHECK ((buddy_status = ANY (ARRAY['none'::text, 'pending'::text, 'accepted'::text, 'declined'::text])));
alter table public.delegations add constraint delegations_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.notifications add constraint notifications_kind_check CHECK ((kind = ANY (ARRAY['info'::text, 'buddy_request'::text, 'leave_status'::text, 'task'::text, 'ticket'::text])));
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.companies add constraint companies_directory_scope_check CHECK ((directory_scope = ANY (ARRAY['company'::text, 'department'::text])));
alter table public.companies add constraint companies_today_scope_check CHECK ((today_scope = ANY (ARRAY['company'::text, 'department'::text])));
alter table public.tickets add constraint tickets_category_check CHECK ((category = ANY (ARRAY['general'::text, 'it'::text, 'hr'::text, 'payroll'::text, 'facilities'::text, 'other'::text])));
alter table public.tickets add constraint tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])));
alter table public.tickets add constraint tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'on_hold'::text, 'resolved'::text, 'closed'::text])));
alter table public.checklist_templates add constraint checklist_templates_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'half_yearly'::text, 'yearly'::text])));
alter table public.checklist_templates add constraint checklist_templates_pkey PRIMARY KEY (id);
alter table public.checklist_templates add constraint checklist_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.checklist_templates add constraint checklist_templates_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.checklist_templates add constraint checklist_templates_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.checklist_instances add constraint checklist_instances_pkey PRIMARY KEY (id);
alter table public.checklist_instances add constraint checklist_instances_template_id_due_date_key UNIQUE (template_id, due_date);
alter table public.checklist_instances add constraint checklist_instances_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.checklist_instances add constraint checklist_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE;
alter table public.checklist_instances add constraint checklist_instances_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.salary_master add constraint salary_master_pkey PRIMARY KEY (id);
alter table public.salary_master add constraint salary_master_employee_id_key UNIQUE (employee_id);
alter table public.salary_master add constraint salary_master_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.salary_master add constraint salary_master_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.payroll_actions add constraint payroll_actions_month_check CHECK (((month >= 1) AND (month <= 12)));
alter table public.payroll_actions add constraint payroll_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table public.payroll_actions add constraint payroll_actions_deduct_from_check CHECK ((deduct_from = ANY (ARRAY['cl'::text, 'pl'::text, 'el'::text, 'salary'::text])));
alter table public.payroll_actions add constraint payroll_actions_pkey PRIMARY KEY (id);
alter table public.branches add constraint branches_pkey PRIMARY KEY (id);
alter table public.employee_documents add constraint employee_documents_category_check CHECK ((category = ANY (ARRAY['id_proof'::text, 'address_proof'::text, 'bank_proof'::text, 'offer_letter'::text, 'education'::text, 'other'::text])));
alter table public.employee_documents add constraint employee_documents_pkey PRIMARY KEY (id);
alter table public.employee_documents add constraint employee_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employee_documents add constraint employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.employee_documents add constraint employee_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'disabled'::text, 'left'::text])));
alter table public.companies add constraint companies_task_assignment_mode_check CHECK ((task_assignment_mode = ANY (ARRAY['department'::text, 'direct'::text])));
alter table public.checklist_templates add constraint checklist_templates_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.em_weekly_targets add constraint em_weekly_targets_metric_check CHECK ((metric = ANY (ARRAY['checklist_nd'::text, 'checklist_nd_ot'::text, 'delegation_nd'::text, 'delegation_nd_ot'::text])));
alter table public.em_weekly_targets add constraint em_weekly_targets_pkey PRIMARY KEY (id);
alter table public.em_weekly_targets add constraint em_weekly_targets_user_id_iso_year_iso_week_metric_key UNIQUE (user_id, iso_year, iso_week, metric);
alter table public.em_weekly_targets add constraint em_weekly_targets_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.em_weekly_targets add constraint em_weekly_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.delegation_subtasks add constraint delegation_subtasks_pkey PRIMARY KEY (id);
alter table public.field_visits add constraint field_visits_target_duration_check CHECK (((target_duration_minutes >= 5) AND (target_duration_minutes <= 1440)));
alter table public.employee_live_locations add constraint employee_live_locations_pkey PRIMARY KEY (employee_id);
alter table public.employee_live_locations add constraint employee_live_locations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.employee_live_locations add constraint employee_live_locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employee_live_locations add constraint employee_live_locations_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES field_visits(id) ON DELETE SET NULL;
alter table public.employee_location_history add constraint employee_location_history_pkey PRIMARY KEY (id);
alter table public.employee_location_history add constraint employee_location_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employee_location_history add constraint employee_location_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.employee_location_history add constraint employee_location_history_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES field_visits(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_tracking_interval_minutes_check CHECK (((tracking_interval_minutes >= 1) AND (tracking_interval_minutes <= 60)));
alter table public.subscription_plans add constraint subscription_plans_pkey PRIMARY KEY (code);
alter table public.profiles add constraint profiles_location_stale_minutes_check CHECK (((location_stale_minutes >= 1) AND (location_stale_minutes <= 240)));
alter table public.employee_tracking_events add constraint employee_tracking_events_pkey PRIMARY KEY (id);
alter table public.employee_tracking_events add constraint employee_tracking_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.employee_tracking_events add constraint employee_tracking_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employee_tracking_events add constraint employee_tracking_events_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES field_visits(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_tracking_stale_after_minutes_check CHECK (((tracking_stale_after_minutes >= 1) AND (tracking_stale_after_minutes <= 240)));
alter table public.profiles add constraint profiles_employee_type_check CHECK ((employee_type = ANY (ARRAY['office'::text, 'sales'::text, 'field'::text, 'hybrid'::text])));
alter table public.profiles add constraint profiles_tracking_mode_check CHECK ((tracking_mode = ANY (ARRAY['active_visit'::text, 'working_hours'::text, 'manual'::text])));
alter table public.profiles add constraint profiles_tracking_interval_check CHECK (((tracking_interval_minutes >= 1) AND (tracking_interval_minutes <= 60)));
alter table public.profiles add constraint profiles_tracking_stale_check CHECK (((tracking_stale_after_minutes >= 2) AND (tracking_stale_after_minutes <= 120)));
alter table public.tracking_events add constraint tracking_events_pkey PRIMARY KEY (id);
alter table public.tracking_events add constraint tracking_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.tracking_events add constraint tracking_events_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES field_visits(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_work_manager_id_fkey FOREIGN KEY (work_manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_field_manager_id_fkey FOREIGN KEY (field_manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.companies add constraint companies_gsheet_sync_interval_check CHECK (((gsheet_sync_interval_minutes >= 5) AND (gsheet_sync_interval_minutes <= 1440)));
alter table public.gsheet_sync_runs add constraint gsheet_sync_runs_pkey PRIMARY KEY (id);
alter table public.gsheet_sync_runs add constraint gsheet_sync_runs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.visit_custom_fields add constraint visit_custom_fields_pkey PRIMARY KEY (id);
alter table public.visit_custom_fields add constraint visit_custom_fields_company_id_field_key_key UNIQUE (company_id, field_key);
alter table public.visit_custom_fields add constraint visit_custom_fields_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.visit_custom_fields add constraint visit_custom_fields_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.visit_custom_fields add constraint visit_custom_fields_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'number'::text, 'email'::text, 'phone'::text, 'date'::text, 'datetime'::text, 'select'::text, 'checkbox'::text])));
alter table public.auth_otp_codes add constraint auth_otp_codes_pkey PRIMARY KEY (id);
alter table public.company_integrations add constraint company_integrations_pkey PRIMARY KEY (company_id);
alter table public.company_integrations add constraint company_integrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.gsheet_sync_logs add constraint gsheet_sync_logs_trigger_check CHECK ((trigger = ANY (ARRAY['cron'::text, 'manual'::text, 'auto'::text])));
alter table public.gsheet_sync_logs add constraint gsheet_sync_logs_pkey PRIMARY KEY (id);
alter table public.gsheet_sync_logs add constraint gsheet_sync_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.push_devices add constraint push_devices_platform_check CHECK ((platform = ANY (ARRAY['android'::text, 'web'::text])));
alter table public.push_devices add constraint push_devices_pkey PRIMARY KEY (id);
alter table public.push_devices add constraint push_devices_token_key UNIQUE (token);
alter table public.push_devices add constraint push_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.push_devices add constraint push_devices_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.attendance_daily_log add constraint attendance_daily_log_status_check CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'half_day'::text, 'on_leave'::text, 'holiday'::text, 'weekly_off'::text, 'absent'::text, 'pending'::text])));
alter table public.attendance_daily_log add constraint attendance_daily_log_pkey PRIMARY KEY (employee_id, work_date);
alter table public.attendance_daily_log add constraint attendance_daily_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.attendance_daily_log add constraint attendance_daily_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.field_visit_schedule_changes add constraint field_visit_schedule_changes_pkey PRIMARY KEY (id);
alter table public.field_visit_schedule_changes add constraint field_visit_schedule_changes_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES field_visits(id) ON DELETE CASCADE;
alter table public.field_visit_schedule_changes add constraint field_visit_schedule_changes_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.field_visit_schedule_changes add constraint field_visit_schedule_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.daily_digest_log add constraint daily_digest_log_pkey PRIMARY KEY (employee_id, day);
alter table public.daily_digest_log add constraint daily_digest_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.billing_payments add constraint billing_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'created'::text, 'authorized'::text, 'captured'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text, 'cancelled'::text])));
alter table public.features add constraint features_availability_check CHECK ((availability = ANY (ARRAY['free'::text, 'paid'::text, 'coming_soon'::text, 'disabled'::text])));
alter table public.features add constraint features_pkey PRIMARY KEY (key);
alter table public.features add constraint features_parent_key_fkey FOREIGN KEY (parent_key) REFERENCES features(key) ON DELETE RESTRICT;
alter table public.companies add constraint companies_account_status_check CHECK ((account_status = ANY (ARRAY['active'::text, 'suspended'::text])));
alter table public.organization_feature_overrides add constraint organization_feature_overrides_pkey PRIMARY KEY (company_id, feature_key);
alter table public.organization_feature_overrides add constraint organization_feature_overrides_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.organization_feature_overrides add constraint organization_feature_overrides_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES features(key) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.audit_logs add constraint audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
alter table public.feature_table_map add constraint feature_table_map_pkey PRIMARY KEY (table_name);
alter table public.feature_table_map add constraint feature_table_map_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES features(key);
alter table public.feature_gate_report add constraint feature_gate_report_pkey PRIMARY KEY (table_name);
alter table public.organization_feature_overrides add constraint org_feature_overrides_source_check CHECK ((source = ANY (ARRAY['platform'::text, 'organization'::text, 'grandfathered'::text])));
alter table public.organization_module_requests add constraint organization_module_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])));
alter table public.organization_module_requests add constraint organization_module_requests_pkey PRIMARY KEY (id);
alter table public.organization_module_requests add constraint organization_module_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.organization_module_requests add constraint organization_module_requests_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES features(key) ON DELETE CASCADE;
alter table public.platform_admins add constraint platform_admins_pkey PRIMARY KEY (user_id);
alter table public.billing_payments add constraint billing_payments_source_check CHECK ((source = ANY (ARRAY['razorpay'::text, 'manual'::text, 'bank'::text, 'cash'::text, 'upi'::text, 'system'::text])));
alter table public.billing_payments add constraint billing_payments_pkey PRIMARY KEY (id);
alter table public.billing_payments add constraint billing_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.billing_adjustments add constraint billing_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['upgrade_credit'::text, 'upgrade_charge'::text, 'downgrade_credit'::text, 'manual_credit'::text, 'manual_debit'::text, 'discount'::text, 'refund'::text])));
alter table public.billing_adjustments add constraint billing_adjustments_pkey PRIMARY KEY (id);
alter table public.billing_adjustments add constraint billing_adjustments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.billing_adjustments add constraint billing_adjustments_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES billing_payments(id) ON DELETE SET NULL;
alter table public.billing_email_log add constraint billing_email_log_email_type_check CHECK ((email_type = ANY (ARRAY['due_10_days'::text, 'due_today'::text, 'payment_success'::text, 'payment_failed'::text, 'past_due'::text, 'subscription_cancelled'::text])));
alter table public.billing_email_log add constraint billing_email_log_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text])));
alter table public.billing_email_log add constraint billing_email_log_pkey PRIMARY KEY (id);
alter table public.billing_email_log add constraint billing_email_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.billing_email_log add constraint billing_email_log_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES billing_payments(id) ON DELETE CASCADE;
alter table public.task_attachments add constraint task_attachments_checklist_instance_id_fkey FOREIGN KEY (checklist_instance_id) REFERENCES checklist_instances(id) ON DELETE CASCADE;
alter table public.razorpay_webhook_events add constraint razorpay_webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['received'::text, 'processed'::text, 'ignored'::text, 'failed'::text])));
alter table public.razorpay_webhook_events add constraint razorpay_webhook_events_pkey PRIMARY KEY (id);
alter table public.razorpay_webhook_events add constraint razorpay_webhook_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
alter table public.task_management_policies add constraint task_management_policies_scope_type_check CHECK ((scope_type = ANY (ARRAY['company'::text, 'department'::text, 'employee'::text])));
alter table public.task_management_policies add constraint task_management_policies_max_attachment_size_mb_check CHECK (((max_attachment_size_mb >= 1) AND (max_attachment_size_mb <= 100)));
alter table public.task_management_policies add constraint task_management_policies_history_visibility_check CHECK ((history_visibility = ANY (ARRAY['own'::text, 'assigned'::text, 'department'::text, 'company'::text])));
alter table public.task_management_policies add constraint task_management_policies_history_default_months_check CHECK (((history_default_months >= 1) AND (history_default_months <= 24)));
alter table public.task_management_policies add constraint task_policy_scope_target_check CHECK ((((scope_type = 'company'::text) AND (department_id IS NULL) AND (employee_id IS NULL)) OR ((scope_type = 'department'::text) AND (department_id IS NOT NULL) AND (employee_id IS NULL)) OR ((scope_type = 'employee'::text) AND (employee_id IS NOT NULL))));
alter table public.task_management_policies add constraint task_management_policies_pkey PRIMARY KEY (id);
alter table public.task_management_policies add constraint task_management_policies_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.task_management_policies add constraint task_management_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.task_management_policies add constraint task_management_policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.task_attachments add constraint task_attachments_file_size_bytes_check CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0)));
alter table public.task_attachments add constraint task_attachments_attachment_context_check CHECK ((attachment_context = ANY (ARRAY['work'::text, 'comment'::text, 'completion'::text])));
alter table public.task_attachments add constraint task_attachments_pkey PRIMARY KEY (id);
alter table public.task_attachments add constraint task_attachments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.task_attachments add constraint task_attachments_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE;
alter table public.task_attachments add constraint task_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.task_activity_log add constraint task_activity_log_activity_type_check CHECK ((activity_type = ANY (ARRAY['task_created'::text, 'task_assigned'::text, 'task_reassigned'::text, 'status_changed'::text, 'comment_added'::text, 'attachment_uploaded'::text, 'attachment_deleted'::text, 'checklist_completed'::text, 'checklist_reopened'::text, 'task_put_on_hold'::text, 'task_resumed'::text, 'task_completed'::text, 'task_reopened'::text, 'due_date_changed'::text, 'priority_changed'::text])));
alter table public.task_activity_log add constraint task_activity_log_pkey PRIMARY KEY (id);
alter table public.task_activity_log add constraint task_activity_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.task_activity_log add constraint task_activity_log_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE;
alter table public.task_activity_log add constraint task_activity_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.task_completion_submissions add constraint task_completion_submissions_pkey PRIMARY KEY (id);
alter table public.task_completion_submissions add constraint task_completion_submissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.task_completion_submissions add constraint task_completion_submissions_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES delegations(id) ON DELETE CASCADE;
alter table public.task_completion_submissions add constraint task_completion_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.delegations add constraint delegations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'hold'::text, 'complete'::text])));
alter table public.checklist_instances add constraint checklist_instances_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'hold'::text, 'complete'::text])));
alter table public.task_attachments add constraint task_attachment_parent_check CHECK (((delegation_id IS NOT NULL) OR (checklist_instance_id IS NOT NULL)));
alter table public.task_management_policies add constraint task_policy_early_complete_days_check CHECK (((checklist_early_complete_days >= 0) AND (checklist_early_complete_days <= 30)));
alter table public.ai_settings add constraint ai_settings_monthly_request_limit_check CHECK (((monthly_request_limit IS NULL) OR (monthly_request_limit > 0)));
alter table public.ai_settings add constraint ai_settings_monthly_token_limit_check CHECK (((monthly_token_limit IS NULL) OR (monthly_token_limit > 0)));
alter table public.ai_settings add constraint ai_settings_pkey PRIMARY KEY (company_id);
alter table public.ai_settings add constraint ai_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_settings add constraint ai_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.ai_user_access add constraint ai_user_access_pkey PRIMARY KEY (company_id, user_id);
alter table public.ai_user_access add constraint ai_user_access_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_user_access add constraint ai_user_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.ai_user_access add constraint ai_user_access_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.ai_conversations add constraint ai_conversations_pkey PRIMARY KEY (id);
alter table public.ai_conversations add constraint ai_conversations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_conversations add constraint ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.ai_messages add constraint ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'tool'::text])));
alter table public.ai_messages add constraint ai_messages_pkey PRIMARY KEY (id);
alter table public.ai_messages add constraint ai_messages_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_messages add constraint ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE;
alter table public.ai_messages add constraint ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.ai_usage_log add constraint ai_usage_log_pkey PRIMARY KEY (id);
alter table public.ai_usage_log add constraint ai_usage_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_usage_log add constraint ai_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.ai_action_log add constraint ai_action_log_pkey PRIMARY KEY (id);
alter table public.ai_action_log add constraint ai_action_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_action_log add constraint ai_action_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.ai_settings add constraint ai_settings_provider_check CHECK ((provider = ANY (ARRAY['gemini'::text, 'openai'::text, 'anthropic'::text, 'openrouter'::text])));
alter table public.ai_pending_actions add constraint ai_pending_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'executed'::text, 'failed'::text, 'expired'::text])));
alter table public.ai_pending_actions add constraint ai_pending_actions_pkey PRIMARY KEY (id);
alter table public.ai_pending_actions add constraint ai_pending_actions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.ai_pending_actions add constraint ai_pending_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.ai_pending_actions add constraint ai_pending_actions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE;
alter table public.system_admin_2fa_challenges add constraint system_admin_2fa_attempts_check CHECK ((attempts >= 0));
alter table public.system_admin_2fa_challenges add constraint system_admin_2fa_max_attempts_check CHECK (((max_attempts >= 1) AND (max_attempts <= 10)));
alter table public.system_admin_2fa_challenges add constraint system_admin_2fa_challenges_pkey PRIMARY KEY (id);
alter table public.system_admin_2fa_challenges add constraint system_admin_2fa_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.system_admin_2fa_sessions add constraint system_admin_2fa_sessions_pkey PRIMARY KEY (id);
alter table public.system_admin_2fa_sessions add constraint system_admin_2fa_sessions_token_hash_key UNIQUE (token_hash);
alter table public.system_admin_2fa_sessions add constraint system_admin_2fa_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.org_admin_2fa_preferences add constraint org_admin_2fa_preferences_pkey PRIMARY KEY (id);
alter table public.org_admin_2fa_preferences add constraint org_admin_2fa_preferences_user_id_company_id_key UNIQUE (user_id, company_id);
alter table public.org_admin_2fa_preferences add constraint org_admin_2fa_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.org_admin_2fa_preferences add constraint org_admin_2fa_preferences_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.org_admin_2fa_challenges add constraint org_admin_2fa_purpose_check CHECK ((purpose = ANY (ARRAY['enable'::text, 'login'::text, 'disable'::text])));
alter table public.org_admin_2fa_challenges add constraint org_admin_2fa_attempts_check CHECK ((attempts >= 0));
alter table public.org_admin_2fa_challenges add constraint org_admin_2fa_max_attempts_check CHECK (((max_attempts >= 1) AND (max_attempts <= 10)));
alter table public.org_admin_2fa_challenges add constraint org_admin_2fa_challenges_pkey PRIMARY KEY (id);
alter table public.org_admin_2fa_challenges add constraint org_admin_2fa_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.org_admin_2fa_challenges add constraint org_admin_2fa_challenges_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.org_admin_2fa_sessions add constraint org_admin_2fa_sessions_pkey PRIMARY KEY (id);
alter table public.org_admin_2fa_sessions add constraint org_admin_2fa_sessions_token_hash_key UNIQUE (token_hash);
alter table public.org_admin_2fa_sessions add constraint org_admin_2fa_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.org_admin_2fa_sessions add constraint org_admin_2fa_sessions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.visit_form_settings add constraint visit_form_settings_pkey PRIMARY KEY (company_id);
alter table public.visit_form_settings add constraint visit_form_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.visit_form_settings add constraint visit_form_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.field_visits add constraint field_visits_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'assigned'::text, 'accepted'::text, 'on_the_way'::text, 'reached'::text, 'checked_in'::text, 'meeting'::text, 'completed'::text, 'cancelled'::text])));
alter table public.support_meetings add constraint support_meetings_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'rescheduled'::text, 'completed'::text, 'cancelled'::text])));
alter table public.support_meetings add constraint support_meetings_provider_check CHECK ((provider = ANY (ARRAY['manual'::text, 'google_calendar'::text, 'outlook_calendar'::text])));
alter table public.support_meetings add constraint support_meetings_check CHECK ((ends_at > starts_at));
alter table public.support_meetings add constraint support_meetings_pkey PRIMARY KEY (id);
alter table public.support_meetings add constraint support_meetings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.support_meetings add constraint support_meetings_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
alter table public.support_meetings add constraint support_meetings_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.support_meetings add constraint support_meetings_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.calendar_connections add constraint calendar_connections_provider_check CHECK ((provider = ANY (ARRAY['google_calendar'::text, 'outlook_calendar'::text])));
alter table public.calendar_connections add constraint calendar_connections_pkey PRIMARY KEY (id);
alter table public.calendar_connections add constraint calendar_connections_user_id_provider_key UNIQUE (user_id, provider);
alter table public.calendar_connections add constraint calendar_connections_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.calendar_connections add constraint calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.support_meetings add constraint support_meetings_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE ((status <> ALL (ARRAY['cancelled'::text, 'completed'::text])));
CREATE INDEX org_module_requests_status_idx ON public.organization_module_requests USING btree (status, requested_at DESC);
CREATE INDEX field_visits_last_location_idx ON public.field_visits USING btree (company_id, last_location_at DESC);
CREATE INDEX field_visits_employee_status_idx ON public.field_visits USING btree (employee_id, status);
CREATE INDEX field_visits_company_date_idx ON public.field_visits USING btree (company_id, visit_date DESC);
CREATE INDEX visit_location_visit_time_idx ON public.visit_location_history USING btree (visit_id, captured_at DESC);
CREATE INDEX visit_location_employee_time_idx ON public.visit_location_history USING btree (employee_id, captured_at DESC);
CREATE INDEX ai_pending_actions_user_status_idx ON public.ai_pending_actions USING btree (user_id, status, created_at DESC);
CREATE INDEX visit_location_company_time_idx ON public.visit_location_history USING btree (company_id, captured_at DESC);
CREATE INDEX field_visits_scheduled_idx ON public.field_visits USING btree (company_id, scheduled_at DESC);
CREATE INDEX system_admin_2fa_challenges_user_created_idx ON public.system_admin_2fa_challenges USING btree (user_id, created_at DESC);
CREATE INDEX system_admin_2fa_challenges_active_idx ON public.system_admin_2fa_challenges USING btree (user_id, expires_at) WHERE (consumed_at IS NULL);
CREATE INDEX idx_profiles_company ON public.profiles USING btree (company_id);
CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone);
CREATE INDEX system_admin_2fa_sessions_user_idx ON public.system_admin_2fa_sessions USING btree (user_id, expires_at DESC);
CREATE INDEX system_admin_2fa_sessions_active_idx ON public.system_admin_2fa_sessions USING btree (token_hash, expires_at) WHERE (revoked_at IS NULL);
CREATE INDEX idx_invites_phone ON public.invites USING btree (phone);
CREATE INDEX idx_attendance_company_date ON public.attendance USING btree (company_id, work_date);
CREATE INDEX auth_otp_codes_email_purpose_idx ON public.auth_otp_codes USING btree (email, purpose);
CREATE INDEX auth_otp_codes_expires_at_idx ON public.auth_otp_codes USING btree (expires_at);
CREATE INDEX idx_leaves_company ON public.leaves USING btree (company_id);
CREATE INDEX auth_otp_codes_email_created_idx ON public.auth_otp_codes USING btree (email, created_at DESC);
CREATE INDEX idx_tasks_company ON public.tasks USING btree (company_id);
CREATE INDEX idx_visits_company_date ON public.field_visits USING btree (company_id, visit_date);
CREATE INDEX billing_payments_company_idx ON public.billing_payments USING btree (company_id);
CREATE INDEX billing_payments_status_idx ON public.billing_payments USING btree (status);
CREATE INDEX billing_payments_due_idx ON public.billing_payments USING btree (due_at);
CREATE INDEX billing_payments_created_idx ON public.billing_payments USING btree (created_at DESC);
CREATE INDEX idx_checklist_instances_assignee ON public.checklist_instances USING btree (assigned_to, due_date);
CREATE INDEX idx_delegations_company ON public.delegations USING btree (company_id);
CREATE INDEX idx_delegations_assignee ON public.delegations USING btree (assigned_to, due_date);
CREATE INDEX billing_adjustments_company_idx ON public.billing_adjustments USING btree (company_id);
CREATE INDEX idx_checklist_templates_company ON public.checklist_templates USING btree (company_id, active);
CREATE INDEX idx_profiles_manager ON public.profiles USING btree (manager_id);
CREATE INDEX idx_employee_documents_emp ON public.employee_documents USING btree (employee_id);
CREATE INDEX billing_email_log_company_idx ON public.billing_email_log USING btree (company_id);
CREATE INDEX billing_email_log_payment_idx ON public.billing_email_log USING btree (payment_id);
CREATE INDEX idx_payroll_actions_company ON public.payroll_actions USING btree (company_id, month, year);
CREATE INDEX gsheet_sync_logs_company_time_idx ON public.gsheet_sync_logs USING btree (company_id, started_at DESC);
CREATE INDEX idx_holidays_company ON public.holidays USING btree (company_id, holiday_date);
CREATE INDEX idx_documents_company ON public.documents USING btree (company_id);
CREATE INDEX idx_em_targets_lookup ON public.em_weekly_targets USING btree (company_id, user_id, iso_year, iso_week);
CREATE INDEX idx_profiles_branch ON public.profiles USING btree (branch_id);
CREATE INDEX razorpay_webhook_event_type_idx ON public.razorpay_webhook_events USING btree (event_type);
CREATE INDEX razorpay_webhook_company_idx ON public.razorpay_webhook_events USING btree (company_id);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX push_devices_user_idx ON public.push_devices USING btree (user_id);
CREATE INDEX idx_subtasks_delegation ON public.delegation_subtasks USING btree (delegation_id);
CREATE INDEX idx_comments_delegation ON public.task_comments USING btree (delegation_id);
CREATE INDEX idx_extensions_delegation ON public.task_extensions USING btree (delegation_id);
CREATE INDEX idx_tickets_company ON public.tickets USING btree (company_id, status);
CREATE INDEX idx_tickets_raiser ON public.tickets USING btree (raised_by);
CREATE INDEX idx_ticket_comments ON public.ticket_comments USING btree (ticket_id, created_at);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_task_policy_company ON public.task_management_policies USING btree (company_id);
CREATE INDEX idx_task_policy_department ON public.task_management_policies USING btree (company_id, department_id);
CREATE INDEX idx_task_policy_employee ON public.task_management_policies USING btree (company_id, employee_id);
CREATE INDEX idx_task_attachments_delegation ON public.task_attachments USING btree (delegation_id, created_at DESC);
CREATE INDEX idx_task_attachments_company ON public.task_attachments USING btree (company_id);
CREATE INDEX idx_task_activity_delegation ON public.task_activity_log USING btree (delegation_id, created_at DESC);
CREATE INDEX idx_task_activity_company ON public.task_activity_log USING btree (company_id, created_at DESC);
CREATE INDEX checklist_instances_template_due_idx ON public.checklist_instances USING btree (template_id, due_date);
CREATE INDEX field_visit_schedule_changes_visit_idx ON public.field_visit_schedule_changes USING btree (visit_id, changed_at);
CREATE INDEX idx_task_completion_delegation ON public.task_completion_submissions USING btree (delegation_id, submitted_at DESC);
CREATE INDEX holidays_company_date_idx ON public.holidays USING btree (company_id, holiday_date);
CREATE INDEX attendance_daily_log_company_date_idx ON public.attendance_daily_log USING btree (company_id, work_date);
CREATE INDEX org_admin_2fa_challenges_user_idx ON public.org_admin_2fa_challenges USING btree (user_id, company_id, created_at DESC);
CREATE INDEX idx_delegations_status ON public.delegations USING btree (company_id, status);
CREATE INDEX org_admin_2fa_sessions_user_idx ON public.org_admin_2fa_sessions USING btree (user_id, company_id, expires_at DESC);
CREATE INDEX employee_location_history_employee_time_idx ON public.employee_location_history USING btree (employee_id, captured_at DESC);
CREATE INDEX employee_location_history_company_time_idx ON public.employee_location_history USING btree (company_id, captured_at DESC);
CREATE INDEX employee_location_history_visit_time_idx ON public.employee_location_history USING btree (visit_id, captured_at DESC);
CREATE INDEX profiles_company_tracking_idx ON public.profiles USING btree (company_id, field_tracking_enabled) WHERE (field_tracking_enabled = true);
CREATE INDEX profiles_manager_tracking_idx ON public.profiles USING btree (manager_id, field_tracking_enabled) WHERE (field_tracking_enabled = true);
CREATE INDEX idx_profiles_company_tracking ON public.profiles USING btree (company_id, field_tracking_enabled) WHERE (field_tracking_enabled = true);
CREATE INDEX idx_profiles_manager_tracking ON public.profiles USING btree (manager_id, field_tracking_enabled) WHERE (field_tracking_enabled = true);
CREATE INDEX idx_location_history_employee_time ON public.employee_location_history USING btree (employee_id, captured_at DESC);
CREATE INDEX idx_location_history_visit_time ON public.employee_location_history USING btree (visit_id, captured_at DESC);
CREATE INDEX idx_tracking_events_employee_time ON public.employee_tracking_events USING btree (employee_id, created_at DESC);
CREATE INDEX idx_field_visits_employee_date_status ON public.field_visits USING btree (employee_id, visit_date DESC, status);
CREATE INDEX idx_field_visits_company_date ON public.field_visits USING btree (company_id, visit_date DESC);
CREATE INDEX tracking_events_employee_time_idx ON public.tracking_events USING btree (employee_id, event_time DESC);
CREATE INDEX tracking_events_company_time_idx ON public.tracking_events USING btree (company_id, event_time DESC);
CREATE INDEX employee_live_locations_company_seen_idx ON public.employee_live_locations USING btree (company_id, last_seen_at DESC);
CREATE INDEX idx_live_locations_company_updated ON public.employee_live_locations USING btree (company_id, updated_at DESC);
CREATE INDEX live_locations_duty_state_idx ON public.employee_live_locations USING btree (company_id, duty_status, tracking_state, last_seen_at DESC);
CREATE INDEX tracking_events_company_employee_time_v6_idx ON public.tracking_events USING btree (company_id, employee_id, event_time DESC);
CREATE INDEX attendance_employee_work_date_v6_idx ON public.attendance USING btree (employee_id, work_date DESC);
CREATE INDEX employee_location_history_emp_capture_v7_idx ON public.employee_location_history USING btree (employee_id, captured_at);
CREATE INDEX employee_location_history_company_employee_time_v8 ON public.employee_location_history USING btree (company_id, employee_id, captured_at);
CREATE INDEX attendance_employee_workdate_v8 ON public.attendance USING btree (employee_id, work_date DESC);
CREATE INDEX field_visits_employee_visitdate_v8 ON public.field_visits USING btree (employee_id, visit_date DESC);
CREATE INDEX tracking_events_employee_eventtime_v8 ON public.tracking_events USING btree (employee_id, event_time DESC);
CREATE INDEX company_subscriptions_plan_status_idx ON public.company_subscriptions USING btree (plan_code, status);
CREATE INDEX subscription_events_company_time_idx ON public.subscription_events USING btree (company_id, created_at DESC);
CREATE INDEX idx_checklist_instances_status ON public.checklist_instances USING btree (company_id, status);
CREATE INDEX idx_task_attachments_checklist_instance ON public.task_attachments USING btree (checklist_instance_id);
CREATE INDEX profiles_work_manager_idx ON public.profiles USING btree (work_manager_id) WHERE (work_manager_id IS NOT NULL);
CREATE INDEX profiles_field_manager_idx ON public.profiles USING btree (field_manager_id) WHERE (field_manager_id IS NOT NULL);
CREATE INDEX gsheet_sync_runs_company_time_idx ON public.gsheet_sync_runs USING btree (company_id, started_at DESC);
CREATE INDEX field_visits_company_date_status_v14_idx ON public.field_visits USING btree (company_id, visit_date DESC, status);
CREATE INDEX field_visits_employee_date_v14_idx ON public.field_visits USING btree (employee_id, visit_date DESC);
CREATE INDEX field_visits_client_lower_v14_idx ON public.field_visits USING btree (company_id, lower(client_name));
CREATE INDEX visit_custom_fields_company_active_sort_idx ON public.visit_custom_fields USING btree (company_id, is_active, sort_order);
CREATE INDEX field_visits_company_contact_idx ON public.field_visits USING btree (company_id, contact_number);
CREATE INDEX field_visits_company_lower_v14_idx ON public.field_visits USING btree (company_id, lower(company_name));
CREATE INDEX audit_logs_company_time_idx ON public.audit_logs USING btree (company_id, created_at DESC);
CREATE INDEX audit_logs_time_idx ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX support_meetings_company_start_idx ON public.support_meetings USING btree (company_id, starts_at);
CREATE INDEX support_meetings_ticket_idx ON public.support_meetings USING btree (ticket_id);
CREATE INDEX support_meetings_host_start_idx ON public.support_meetings USING btree (host_user_id, starts_at);
CREATE INDEX tickets_company_created_idx ON public.tickets USING btree (company_id, created_at DESC);
CREATE INDEX ticket_comments_company_ticket_idx ON public.ticket_comments USING btree (company_id, ticket_id, created_at);
CREATE INDEX support_meetings_no_overlap ON public.support_meetings USING gist (tstzrange(starts_at, ends_at, '[)'::text)) WHERE (status <> ALL (ARRAY['cancelled'::text, 'completed'::text]));
CREATE INDEX support_meetings_reminder_scan_idx ON public.support_meetings USING btree (status, starts_at) WHERE (status = ANY (ARRAY['confirmed'::text, 'rescheduled'::text]));
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages USING btree (conversation_id, created_at);
CREATE INDEX ai_usage_company_month_idx ON public.ai_usage_log USING btree (company_id, created_at);
CREATE INDEX ai_usage_user_time_idx ON public.ai_usage_log USING btree (user_id, created_at);
CREATE INDEX ai_conversations_user_updated_idx ON public.ai_conversations USING btree (user_id, updated_at DESC);
alter table public.organization_module_requests enable row level security;
alter table public.platform_admins enable row level security;
alter table public.visit_location_history enable row level security;
alter table public.ai_pending_actions enable row level security;
alter table public.auth_otp_codes enable row level security;
alter table public.invites enable row level security;
alter table public.tasks enable row level security;
alter table public.attendance enable row level security;
alter table public.leaves enable row level security;
alter table public.profiles enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_instances enable row level security;
alter table public.field_visits enable row level security;
alter table public.delegations enable row level security;
alter table public.companies enable row level security;
alter table public.company_integrations enable row level security;
alter table public.employee_documents enable row level security;
alter table public.salary_master enable row level security;
alter table public.payroll_actions enable row level security;
alter table public.gsheet_sync_logs enable row level security;
alter table public.holidays enable row level security;
alter table public.documents enable row level security;
alter table public.branches enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.em_weekly_targets enable row level security;
alter table public.departments enable row level security;
alter table public.designations enable row level security;
alter table public.billing_payments enable row level security;
alter table public.leave_types enable row level security;
alter table public.push_devices enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.billing_adjustments enable row level security;
alter table public.notifications enable row level security;
alter table public.billing_email_log enable row level security;
alter table public.razorpay_webhook_events enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_extensions enable row level security;
alter table public.system_admin_2fa_challenges enable row level security;
alter table public.system_admin_2fa_sessions enable row level security;
alter table public.delegation_subtasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_management_policies enable row level security;
alter table public.daily_digest_log enable row level security;
alter table public.attendance_daily_log enable row level security;
alter table public.field_visit_schedule_changes enable row level security;
alter table public.task_activity_log enable row level security;
alter table public.task_completion_submissions enable row level security;
alter table public.employee_tracking_events enable row level security;
alter table public.org_admin_2fa_preferences enable row level security;
alter table public.org_admin_2fa_challenges enable row level security;
alter table public.org_admin_2fa_sessions enable row level security;
alter table public.visit_form_settings enable row level security;
alter table public.features enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.visit_custom_fields enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscription_events enable row level security;
alter table public.system_admins enable row level security;
alter table public.gsheet_sync_runs enable row level security;
alter table public.organization_feature_overrides enable row level security;
alter table public.employee_location_history enable row level security;
alter table public.tracking_events enable row level security;
alter table public.feature_table_map enable row level security;
alter table public.audit_logs enable row level security;
alter table public.feature_gate_report enable row level security;
alter table public.employee_live_locations enable row level security;
alter table public.tickets enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.support_meetings enable row level security;
alter table public.ai_user_access enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.ai_action_log enable row level security;
alter table public.ai_settings enable row level security;
   FROM tickets t
  WHERE ((t.id = ticket_comments.ticket_id) AND ((t.raised_by = auth.uid()) OR (t.assigned_to = auth.uid()) OR is_company_admin()))))));
   FROM profiles
  WHERE (profiles.id = auth.uid())))) with check ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
   FROM profiles
  WHERE (profiles.id = auth.uid())))) with check ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
   FROM profiles
  WHERE (profiles.id = auth.uid())))) with check ((company_id = ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = p.company_id) AND (p.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))))) with check (((company_id = my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = p.company_id) AND (p.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))));
   FROM field_visits v
  WHERE ((v.id = field_visit_schedule_changes.visit_id) AND ((v.employee_id = auth.uid()) OR is_company_admin() OR reports_to_me(v.employee_id)))))));
   FROM profiles p
  WHERE (p.id = auth.uid()))));
   FROM profiles p
  WHERE (p.id = auth.uid())))));
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = task_attachments.company_id) AND (lower(COALESCE(p.role, ''::text)) = ANY (ARRAY['admin'::text, 'owner'::text, 'super_admin'::text])))))));
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = checklist_templates.company_id) AND (lower(COALESCE(p.role, ''::text)) = ANY (ARRAY['admin'::text, 'owner'::text, 'super_admin'::text]))))));
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = checklist_instances.company_id) AND (lower(COALESCE(p.role, ''::text)) = ANY (ARRAY['admin'::text, 'owner'::text, 'super_admin'::text]))))));
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.company_id = delegations.company_id) AND (lower(COALESCE(p.role, ''::text)) = ANY (ARRAY['admin'::text, 'owner'::text, 'super_admin'::text]))))));
   FROM profiles p
  WHERE (p.id = auth.uid())))));
   FROM profiles p
  WHERE (p.id = auth.uid())))));
   FROM profiles p
  WHERE (p.id = auth.uid())))));

-- FUNCTIONS & GRANTS

CREATE OR REPLACE FUNCTION public.add_months_anchored(p_date date, p_months integer, p_anchor_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select least(
    (date_trunc('month', p_date) + make_interval(months => p_months))::date + (p_anchor_day - 1),
    ((date_trunc('month', p_date) + make_interval(months => p_months + 1))::date - 1)
  )
$function$
;
grant execute on function add_months_anchored(date,integer,integer) to authenticated;
grant execute on function add_months_anchored(date,integer,integer) to anon;
grant execute on function add_months_anchored(date,integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.adjust_leave_balance(p_employee uuid, p_leave_type uuid, p_delta_days numeric, p_reason text)
 RETURNS leaves
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  rec       public.leaves%rowtype;
begin
  if not public.is_company_admin() then
    raise exception 'Admin only';
  end if;

  select company_id into v_company from public.profiles where id = p_employee;
  if v_company is null or v_company <> public.my_company_id() then
    raise exception 'Employee not found in your organization';
  end if;

  insert into public.leaves
    (company_id, employee_id, leave_type_id, day_type,
     from_date, to_date, days, reason, status, decided_by, decided_at)
  values
    (v_company, p_employee, p_leave_type, 'full_day',
     current_date, current_date, p_delta_days,
     coalesce(nullif(trim(p_reason), ''), 'Manual balance adjustment'),
     'approved', auth.uid(), now())
  returning * into rec;

  insert into public.notifications (company_id, user_id, title, body, kind, link)
  values (
    v_company, p_employee,
    'Leave balance adjusted',
    (case when p_delta_days >= 0 then 'Deducted ' else 'Credited ' end)
      || abs(p_delta_days) || ' day(s) — ' || coalesce(p_reason, ''),
    'leave_status', '/leave'
  );

  return rec;
end;
$function$
;
grant execute on function adjust_leave_balance(uuid,uuid,numeric,text) to authenticated;
grant execute on function adjust_leave_balance(uuid,uuid,numeric,text) to service_role;

CREATE OR REPLACE FUNCTION public.advance_due_date(p_date date, p_frequency text)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_frequency
    when 'daily'       then p_date + interval '1 day'
    when 'weekly'      then p_date + interval '7 days'
    when 'monthly'     then p_date + interval '1 month'
    when 'quarterly'   then p_date + interval '90 days'
    when 'half_yearly' then p_date + interval '180 days'
    when 'yearly'      then p_date + interval '1 year'
    else p_date + interval '1 day'
  end::date;
$function$
;
grant execute on function advance_due_date(date,text) to authenticated;
grant execute on function advance_due_date(date,text) to anon;
grant execute on function advance_due_date(date,text) to service_role;

CREATE OR REPLACE FUNCTION public.ai_access_allowed()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p record;
  s record;
  ov boolean;
begin
  if auth.uid() is null
     or not public.has_feature('ai.assistant')
  then
    return false;
  end if;

  select id,company_id,role,status
  into p
  from public.profiles
  where id=auth.uid();

  if p.id is null
     or p.status<>'active'
     or p.company_id<>public.my_company_id()
  then
    return false;
  end if;

  select *
  into s
  from public.ai_settings
  where company_id=p.company_id;

  if s.company_id is null or not s.enabled then
    return false;
  end if;

  select enabled
  into ov
  from public.ai_user_access
  where company_id=p.company_id
    and user_id=p.id;

  if ov is not null then
    return ov;
  end if;

  return case p.role
    when 'employee' then s.employee_enabled
    when 'manager' then s.manager_enabled
    else s.admin_enabled
  end;
end $function$
;
grant execute on function ai_access_allowed() to authenticated;
grant execute on function ai_access_allowed() to anon;
grant execute on function ai_access_allowed() to service_role;

CREATE OR REPLACE FUNCTION public.ai_touch_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN

  UPDATE public.ai_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;

END;
$function$
;
grant execute on function ai_touch_conversation() to authenticated;
grant execute on function ai_touch_conversation() to anon;
grant execute on function ai_touch_conversation() to service_role;

CREATE OR REPLACE FUNCTION public.ai_usage_allowed()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
  req bigint;
  tok bigint;
  user_minute bigint;
  org_minute bigint;
begin
  if not public.ai_access_allowed() then
    return false;
  end if;

  select *
  into s
  from public.ai_settings
  where company_id=public.my_company_id();

  select
    coalesce(sum(requests),0),
    coalesce(sum(input_tokens+output_tokens),0)
  into req,tok
  from public.ai_usage_log
  where company_id=public.my_company_id()
    and created_at>=date_trunc('month',now());

  select coalesce(sum(requests),0)
  into user_minute
  from public.ai_usage_log
  where user_id=auth.uid()
    and created_at>=now()-interval '1 minute';

  select coalesce(sum(requests),0)
  into org_minute
  from public.ai_usage_log
  where company_id=public.my_company_id()
    and created_at>=now()-interval '1 minute';

  if user_minute >= 20 or org_minute >= 100 then
    return false;
  end if;

  return
    (s.monthly_request_limit is null
      or req<s.monthly_request_limit)
    and
    (s.monthly_token_limit is null
      or tok<s.monthly_token_limit);
end $function$
;
grant execute on function ai_usage_allowed() to authenticated;
grant execute on function ai_usage_allowed() to anon;
grant execute on function ai_usage_allowed() to service_role;

CREATE OR REPLACE FUNCTION public.approve_payroll_action(p_action_id uuid, p_deduct_from text)
 RETURNS payroll_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    rec       public.payroll_actions%rowtype;
    v_lt_id   uuid;
    v_code    text;
    v_last    date;
    v_company uuid;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_company_admin() THEN
        RAISE EXCEPTION 'Admin only';
    END IF;

    v_company := public.my_company_id();

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'No organization context';
    END IF;

    IF p_deduct_from NOT IN ('cl','pl','el','salary') THEN
        RAISE EXCEPTION 'Invalid deduct_from';
    END IF;

    SELECT *
    INTO rec
    FROM public.payroll_actions
    WHERE id = p_action_id
      AND company_id = v_company;

    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'Action not found in your organization';
    END IF;

    IF rec.status = 'approved' THEN
        RAISE EXCEPTION 'Already approved';
    END IF;

    IF p_deduct_from IN ('cl','pl','el') THEN

        v_code := upper(p_deduct_from);

        SELECT id
        INTO v_lt_id
        FROM public.leave_types
        WHERE company_id = v_company
          AND code = v_code
        LIMIT 1;

        IF v_lt_id IS NULL THEN
            RAISE EXCEPTION
                'No % leave type configured for this company',
                v_code;
        END IF;

        v_last :=
            (
                make_date(rec.year, rec.month, 1)
                + interval '1 month - 1 day'
            )::date;

        INSERT INTO public.leaves
        (
            company_id,
            employee_id,
            leave_type_id,
            day_type,
            from_date,
            to_date,
            days,
            reason,
            status,
            decided_by,
            decided_at
        )
        VALUES
        (
            v_company,
            rec.employee_id,
            v_lt_id,
            'full_day',
            v_last,
            v_last,
            rec.deduction_days,
            'Payroll deduction: ' || rec.reason,
            'approved',
            auth.uid(),
            now()
        );

    END IF;

    UPDATE public.payroll_actions
    SET
        status       = 'approved',
        deduct_from  = p_deduct_from,
        decided_by   = auth.uid(),
        decided_at   = now()
    WHERE id = p_action_id
      AND company_id = v_company
    RETURNING *
    INTO rec;

    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'Payroll action not found in your organization';
    END IF;

    INSERT INTO public.notifications
    (
        company_id,
        user_id,
        title,
        body,
        kind,
        link
    )
    VALUES
    (
        v_company,
        rec.employee_id,
        'Payroll deduction approved',
        rec.reason || ' — ' ||
        rec.deduction_days ||
        ' day(s) from ' ||
        upper(p_deduct_from),
        'info',
        '/payroll'
    );

    RETURN rec;

END;
$function$
;
grant execute on function approve_payroll_action(uuid,text) to authenticated;
grant execute on function approve_payroll_action(uuid,text) to service_role;

CREATE OR REPLACE FUNCTION public.attendance_manager_notify_v9()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='INSERT' and new.check_in is not null then
    perform public.notify_employee_domain_manager_v9(
      new.employee_id,'hrms','Employee checked in',
      'Attendance IN recorded at ' || to_char(new.check_in at time zone 'Asia/Kolkata','DD Mon, HH12:MI AM'),
      '/attendance'
    );
  elsif tg_op='UPDATE' and old.check_out is null and new.check_out is not null then
    perform public.notify_employee_domain_manager_v9(
      new.employee_id,'hrms','Employee checked out',
      'Attendance OUT recorded at ' || to_char(new.check_out at time zone 'Asia/Kolkata','DD Mon, HH12:MI AM'),
      '/attendance'
    );
  end if;
  return new;
end;
$function$
;
grant execute on function attendance_manager_notify_v9() to authenticated;
grant execute on function attendance_manager_notify_v9() to anon;
grant execute on function attendance_manager_notify_v9() to service_role;

CREATE OR REPLACE FUNCTION public.audit_company_platform_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o jsonb := '{}'::jsonb; n jsonb := '{}'::jsonb; c text; jo jsonb := to_jsonb(old); jn jsonb := to_jsonb(new);
begin
  foreach c in array array['account_status', 'suspended_reason', 'ads_enabled', 'plan', 'trial_ends_on', 'price_per_user']
  loop
    if jo ? c and (jn->c) is distinct from (jo->c) then
      o := o || jsonb_build_object(c, jo->c);
      n := n || jsonb_build_object(c, jn->c);
    end if;
  end loop;
  if n <> '{}'::jsonb then
    perform public.write_audit(new.id, 'organization_updated', 'organization', new.org_code, o, n);
  end if;
  return new;
end $function$
;
grant execute on function audit_company_platform_fields() to authenticated;
grant execute on function audit_company_platform_fields() to anon;
grant execute on function audit_company_platform_fields() to service_role;

CREATE OR REPLACE FUNCTION public.audit_company_subscriptions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      begin
        perform public.write_audit(
          coalesce((to_jsonb(new)->>'company_id')::uuid, (to_jsonb(old)->>'company_id')::uuid),
          'subscription_' || lower(tg_op), 'subscription', to_jsonb(new)->>'plan_code',
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
        return coalesce(new, old);
      end $function$
;
grant execute on function audit_company_subscriptions() to authenticated;
grant execute on function audit_company_subscriptions() to anon;
grant execute on function audit_company_subscriptions() to service_role;

CREATE OR REPLACE FUNCTION public.audit_feature_overrides()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit(old.company_id, 'feature_override_removed', 'feature', old.feature_key,
                               jsonb_build_object('enabled', old.enabled), null);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.enabled is not distinct from old.enabled then
    return new;
  end if;
  perform public.write_audit(new.company_id,
    case when tg_op = 'INSERT' then 'feature_override_set' else 'feature_override_changed' end,
    'feature', new.feature_key,
    case when tg_op = 'UPDATE' then jsonb_build_object('enabled', old.enabled) else null end,
    jsonb_build_object('enabled', new.enabled, 'reason', new.reason));
  return new;
end $function$
;
grant execute on function audit_feature_overrides() to authenticated;
grant execute on function audit_feature_overrides() to anon;
grant execute on function audit_feature_overrides() to service_role;

CREATE OR REPLACE FUNCTION public.audit_module_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.company_id, 'module_requested', 'feature', new.feature_key, null,
                               jsonb_build_object('status', new.status, 'note', new.note));
  elsif new.status is distinct from old.status then
    perform public.write_audit(new.company_id, 'module_request_' || new.status, 'feature', new.feature_key,
                               jsonb_build_object('status', old.status),
                               jsonb_build_object('status', new.status, 'note', new.decision_note));
  end if;
  return new;
end $function$
;
grant execute on function audit_module_requests() to authenticated;
grant execute on function audit_module_requests() to anon;
grant execute on function audit_module_requests() to service_role;

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
grant execute on function billing_set_updated_at() to authenticated;
grant execute on function billing_set_updated_at() to anon;
grant execute on function billing_set_updated_at() to service_role;

CREATE OR REPLACE FUNCTION public.block_early_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if new.completed_at is not null and old.completed_at is null then
    if new.due_date > v_today then
      raise exception
        'This task is scheduled for % and cannot be completed before its due date.',
        to_char(new.due_date, 'DD Mon YYYY');
    end if;
  end if;
  return new;
end;
$function$
;
grant execute on function block_early_completion() to authenticated;
grant execute on function block_early_completion() to anon;
grant execute on function block_early_completion() to service_role;

CREATE OR REPLACE FUNCTION public.can_view_employee_file(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (storage.foldername(p_name))[1] = public.my_company_id()::text
    and (
      (storage.foldername(p_name))[2] = auth.uid()::text
      or public.is_company_admin()
      or coalesce(public.reports_to_me(public.try_uuid((storage.foldername(p_name))[2])), false)
    )
$function$
;
grant execute on function can_view_employee_file(text) to authenticated;
grant execute on function can_view_employee_file(text) to service_role;

CREATE OR REPLACE FUNCTION public.check_in(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_photo text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid        uuid := auth.uid();
  c          public.companies%rowtype;
  b          public.branches%rowtype;
  v_now      timestamptz := now();
  v_local    time;
  v_late     integer := 0;
  v_islate   boolean := false;
  v_dist     integer;
  v_outside  boolean := false;
  v_geo_on   boolean;
  v_glat     double precision;
  v_glng     double precision;
  v_gradius  integer;
  rec        public.attendance%rowtype;
  v_prof     public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_prof from public.profiles where id = uid;
  if v_prof.company_id is null then
    raise exception 'No organization';
  end if;

  select * into c from public.companies where id = v_prof.company_id;

  if v_prof.branch_id is not null then
    select * into b from public.branches where id = v_prof.branch_id;
  end if;

  -- Lateness
  v_local := (v_now at time zone 'Asia/Kolkata')::time;
  if v_local > (coalesce(c.work_start, '09:30') + (coalesce(c.grace_minutes, 15) || ' minutes')::interval) then
    v_islate := true;
    v_late   := extract(epoch from (v_local - coalesce(c.work_start, '09:30'))) / 60;
  end if;

  -- Geofence: prefer the employee's branch, else the company default
  if b.id is not null and b.geofence_enabled then
    v_geo_on := true; v_glat := b.office_lat; v_glng := b.office_lng; v_gradius := b.office_radius_m;
  elsif c.geofence_enabled then
    v_geo_on := true; v_glat := c.office_lat; v_glng := c.office_lng; v_gradius := c.office_radius_m;
  else
    v_geo_on := false;
  end if;

  if v_geo_on and v_glat is not null then
    v_dist := public.distance_m(p_lat, p_lng, v_glat, v_glng);
    v_outside := v_dist is not null and v_dist > coalesce(v_gradius, 200);
  end if;

  insert into public.attendance
    (company_id, employee_id, work_date, check_in, check_in_lat, check_in_lng,
     check_in_photo, check_in_address, check_in_ip,
     check_in_distance_m, check_in_outside,
     status, is_late, late_minutes)
  values
    (v_prof.company_id, uid, (v_now at time zone 'Asia/Kolkata')::date, v_now, p_lat, p_lng,
     p_photo, p_address, p_ip,
     v_dist, v_outside,
     'present', v_islate, greatest(v_late, 0))
  on conflict (employee_id, work_date) do update
    set check_in            = coalesce(public.attendance.check_in, excluded.check_in),
        check_in_lat        = coalesce(public.attendance.check_in_lat, excluded.check_in_lat),
        check_in_lng        = coalesce(public.attendance.check_in_lng, excluded.check_in_lng),
        check_in_photo      = coalesce(public.attendance.check_in_photo, excluded.check_in_photo),
        check_in_address    = coalesce(public.attendance.check_in_address, excluded.check_in_address),
        check_in_ip         = coalesce(public.attendance.check_in_ip, excluded.check_in_ip),
        check_in_distance_m = coalesce(public.attendance.check_in_distance_m, excluded.check_in_distance_m),
        check_in_outside    = public.attendance.check_in_outside or excluded.check_in_outside
  returning * into rec;

  return rec;
end;
$function$
;
grant execute on function check_in(double precision,double precision,text,text,text) to authenticated;
grant execute on function check_in(double precision,double precision,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.check_out(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_photo text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid        uuid := auth.uid();
  c          public.companies%rowtype;
  b          public.branches%rowtype;
  v_prof     public.profiles%rowtype;
  v_now      timestamptz := now();
  v_today    date;
  v_mins     integer;
  v_dist     integer;
  v_outside  boolean := false;
  v_geo_on   boolean;
  v_glat     double precision;
  v_glng     double precision;
  v_gradius  integer;
  rec        public.attendance%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_prof from public.profiles where id = uid;
  select * into c from public.companies where id = v_prof.company_id;
  if v_prof.branch_id is not null then
    select * into b from public.branches where id = v_prof.branch_id;
  end if;

  v_today := (v_now at time zone 'Asia/Kolkata')::date;

  select * into rec
  from public.attendance
  where employee_id = uid and work_date = v_today;

  if rec.id is null or rec.check_in is null then
    raise exception 'You have not checked in today';
  end if;

  v_mins := greatest(0, (extract(epoch from (v_now - rec.check_in)) / 60)::integer);

  if b.id is not null and b.geofence_enabled then
    v_geo_on := true; v_glat := b.office_lat; v_glng := b.office_lng; v_gradius := b.office_radius_m;
  elsif c.geofence_enabled then
    v_geo_on := true; v_glat := c.office_lat; v_glng := c.office_lng; v_gradius := c.office_radius_m;
  else
    v_geo_on := false;
  end if;

  if v_geo_on and v_glat is not null then
    v_dist := public.distance_m(p_lat, p_lng, v_glat, v_glng);
    v_outside := v_dist is not null and v_dist > coalesce(v_gradius, 200);
  end if;

  update public.attendance
  set check_out            = v_now,
      check_out_lat        = p_lat,
      check_out_lng        = p_lng,
      check_out_photo      = p_photo,
      check_out_address    = p_address,
      check_out_ip         = p_ip,
      check_out_distance_m = v_dist,
      check_out_outside    = v_outside,
      work_minutes         = v_mins,
      status               = case
                               when v_mins < coalesce(c.half_day_minutes, 240) then 'half_day'
                               else 'present'
                             end
  where id = rec.id
  returning * into rec;

  return rec;
end;
$function$
;
grant execute on function check_out(double precision,double precision,text,text,text) to authenticated;
grant execute on function check_out(double precision,double precision,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.companies_assign_org_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.org_code is null then
    new.org_code := 'ORG-' || lpad(nextval('public.org_code_seq')::text, 5, '0');
  end if;
  return new;
end $function$
;
grant execute on function companies_assign_org_code() to authenticated;
grant execute on function companies_assign_org_code() to anon;
grant execute on function companies_assign_org_code() to service_role;

CREATE OR REPLACE FUNCTION public.companies_protect_platform_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j_old jsonb; j_new jsonb; fix jsonb := '{}'::jsonb; c text;
begin
  if public.is_platform_admin() then
    return new;
  end if;
  j_old := to_jsonb(old);
  j_new := to_jsonb(new);
  foreach c in array array['org_code', 'account_status', 'suspended_reason', 'ads_enabled',
                           'plan', 'trial_ends_on', 'price_per_user']
  loop
    if j_old ? c and (j_new->c) is distinct from (j_old->c) then
      fix := fix || jsonb_build_object(c, j_old->c);
    end if;
  end loop;
  if fix <> '{}'::jsonb then
    new := jsonb_populate_record(new, fix);
  end if;
  return new;
end $function$
;
grant execute on function companies_protect_platform_fields() to authenticated;
grant execute on function companies_protect_platform_fields() to anon;
grant execute on function companies_protect_platform_fields() to service_role;

CREATE OR REPLACE FUNCTION public.company_has_feature(p_feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select pf.enabled
    from public.company_subscriptions cs
    join public.plan_features pf on pf.plan_code=cs.plan_code
    where cs.company_id=public.my_company_id()
      and pf.feature_key=p_feature_key
      and cs.status in ('trial','active','past_due')
  ),false);
$function$
;
grant execute on function company_has_feature(text) to authenticated;
grant execute on function company_has_feature(text) to anon;
grant execute on function company_has_feature(text) to service_role;

CREATE OR REPLACE FUNCTION public.complete_organization_setup(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid := public.my_company_id();
  v_tz      text := nullif(trim(p->>'timezone'), '');
  v_result  jsonb;
  v_code    text;
  arr       text[];
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'Organization not found for this account';
  end if;
  if v_tz is not null and not exists (select 1 from pg_timezone_names where name = v_tz) then
    raise exception 'Unknown time zone: %', v_tz;
  end if;

  update public.companies set
    industry = coalesce(nullif(trim(p->>'industry'), ''), industry),
    size     = coalesce(nullif(trim(p->>'size'), ''), size),
    phone    = coalesce(nullif(trim(p->>'phone'), ''), phone),
    email    = coalesce(nullif(lower(trim(p->>'email')), ''), email),
    address  = coalesce(nullif(trim(p->>'address'), ''), address),
    city     = coalesce(nullif(trim(p->>'city'), ''), city),
    state    = coalesce(nullif(trim(p->>'state'), ''), state),
    pincode  = coalesce(nullif(trim(p->>'pincode'), ''), pincode),
    timezone = coalesce(v_tz, timezone),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_company;

  update public.profiles set
    full_name = coalesce(nullif(trim(p->>'admin_name'), ''), full_name),
    phone     = coalesce(nullif(trim(p->>'phone'), ''), phone)
  where id = auth.uid();

  if jsonb_typeof(p->'modules') = 'array' then
    select array_agg(x) into arr from jsonb_array_elements_text(p->'modules') x;
    v_result := public.org_set_modules(coalesce(arr, '{}'));
  end if;

  select org_code into v_code from public.companies where id = v_company;
  perform public.write_audit(v_company, 'organization_registered', 'organization', v_code, null,
                             jsonb_build_object('modules', p->'modules', 'timezone', v_tz));

  return jsonb_build_object('org_code', v_code, 'modules', v_result);
end $function$
;
grant execute on function complete_organization_setup(jsonb) to authenticated;
grant execute on function complete_organization_setup(jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.create_company(p_name text, p_industry text DEFAULT ''::text, p_size text DEFAULT ''::text, p_city text DEFAULT ''::text, p_phone text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_id uuid;
  uid    uuid := auth.uid();
  u_rec  auth.users%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Make sure the caller has a profile row (self-healing).
  if not exists (select 1 from public.profiles where id = uid) then
    select * into u_rec from auth.users where id = uid;

    insert into public.profiles (id, full_name, email, phone, status)
    values (
      uid,
      coalesce(u_rec.raw_user_meta_data->>'full_name', split_part(u_rec.email, '@', 1), ''),
      u_rec.email,
      coalesce(u_rec.phone, u_rec.raw_user_meta_data->>'phone'),
      'active'
    );
  end if;

  -- Already in an organization?
  if exists (
    select 1 from public.profiles
    where id = uid and company_id is not null
  ) then
    raise exception 'You already belong to an organization';
  end if;

  insert into public.companies (name, industry, size, city, phone, owner_id)
  values (p_name, p_industry, p_size, p_city, p_phone, uid)
  returning id into new_id;

  update public.profiles
  set company_id = new_id,
      role       = 'owner',
      status     = 'active'
  where id = uid;

  return new_id;
end;
$function$
;
grant execute on function create_company(text,text,text,text,text) to authenticated;
grant execute on function create_company(text,text,text,text,text) to anon;
grant execute on function create_company(text,text,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.customer_set_cancel_at_period_end(p_cancel boolean)
 RETURNS company_subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_sub public.company_subscriptions;
begin
  if not public.is_company_admin() then
    raise exception 'Only company Owner/Admin can manage subscription';
  end if;

  update public.company_subscriptions
  set cancel_at_period_end=p_cancel,
      updated_at=clock_timestamp()
  where company_id=public.my_company_id()
  returning * into v_sub;

  insert into public.subscription_events(company_id,event_type,actor_user_id,details)
  values(v_sub.company_id,
         case when p_cancel then 'cancel_requested' else 'cancel_request_removed' end,
         auth.uid(),
         jsonb_build_object('effective','period_end','timestamp_source','server'));

  return v_sub;
end;
$function$
;
grant execute on function customer_set_cancel_at_period_end(boolean) to authenticated;
grant execute on function customer_set_cancel_at_period_end(boolean) to anon;
grant execute on function customer_set_cancel_at_period_end(boolean) to service_role;

CREATE OR REPLACE FUNCTION public.day_off_reason(p_company uuid, p_employee uuid, p_date date)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_week int[];
  v_sat  int[];
  v_dow  int := extract(dow from p_date)::int;
begin
  if exists (
    select 1 from public.holidays h
    where h.company_id = p_company and h.holiday_date = p_date
      and coalesce(nullif(to_jsonb(h)->>'holiday_type', ''), 'public') = 'public'
  ) then
    return 'holiday';
  end if;

  select coalesce(p.weekly_off_days, c.weekly_off_days, '{0}'), coalesce(c.saturday_off_weeks, '{}')
    into v_week, v_sat
  from public.companies c
  left join public.profiles p on p.id = p_employee
  where c.id = p_company;

  if v_dow = any(coalesce(v_week, '{0}')) then
    return 'weekly_off';
  end if;

  -- 1st Saturday = days 1-7, 2nd = 8-14, … (only for employees on the company pattern)
  if v_dow = 6 and ((extract(day from p_date)::int - 1) / 7 + 1) = any(coalesce(v_sat, '{}')) then
    if (select p.weekly_off_days from public.profiles p where p.id = p_employee) is null then
      return 'weekly_off';
    end if;
  end if;

  return null;
end $function$
;
grant execute on function day_off_reason(uuid,uuid,date) to authenticated;
grant execute on function day_off_reason(uuid,uuid,date) to anon;
grant execute on function day_off_reason(uuid,uuid,date) to service_role;

CREATE OR REPLACE FUNCTION public.directory()
 RETURNS TABLE(id uuid, full_name text, designation text, department text, branch text, email text, phone text, avatar_url text, role text, joined_on date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  uid       uuid := auth.uid();
  v_company uuid;
  v_dept    text;
  c         public.companies%rowtype;
begin
  select p.company_id, p.department into v_company, v_dept
  from public.profiles p where p.id = uid;

  if v_company is null then
    return;
  end if;

  select * into c from public.companies where id = v_company;

  if not coalesce(c.directory_enabled, true) then
    return;
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.designation,
    p.department,
    br.name,
    case when coalesce(c.directory_show_email, true) or p.id = uid
         then p.email else null end,
    case when coalesce(c.directory_show_phone, true) or p.id = uid
         then p.phone else null end,
    p.avatar_url,
    p.role,
    p.joined_on
  from public.profiles p
  left join public.branches br on br.id = p.branch_id
  where p.company_id = v_company
    and p.status = 'active'
    and (
      coalesce(c.directory_scope, 'company') = 'company'
      or p.department is not distinct from v_dept
    )
  order by p.full_name;
end;
$function$
;
grant execute on function directory() to authenticated;
grant execute on function directory() to service_role;

CREATE OR REPLACE FUNCTION public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  r    double precision := 6371000;  -- earth radius, metres
  dlat double precision;
  dlng double precision;
  a    double precision;
begin
  if lat1 is null or lng1 is null or lat2 is null or lng2 is null then
    return null;
  end if;

  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);

  a := sin(dlat / 2) ^ 2
     + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ^ 2;

  return round(r * 2 * atan2(sqrt(a), sqrt(1 - a)))::integer;
end;
$function$
;
grant execute on function distance_m(double precision,double precision,double precision,double precision) to authenticated;
grant execute on function distance_m(double precision,double precision,double precision,double precision) to anon;
grant execute on function distance_m(double precision,double precision,double precision,double precision) to service_role;

CREATE OR REPLACE FUNCTION public.em_report(p_user uuid, p_year integer, p_week integer)
 RETURNS TABLE(metric text, label text, no_of_task integer, affected integer, actual_pct numeric, actual_score numeric, planned numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_company        uuid;
    v_target_company uuid;
    v_now            timestamptz := now();

    ck_total integer := 0;
    ck_late  integer := 0;
    ck_miss  integer := 0;

    dg_total integer := 0;
    dg_late  integer := 0;
    dg_miss  integer := 0;

BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_company := public.my_company_id();

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'No organization context';
    END IF;

    SELECT company_id
    INTO v_target_company
    FROM public.profiles
    WHERE id = p_user
      AND status = 'active';

    IF v_target_company IS NULL
       OR v_target_company <> v_company THEN
        RAISE EXCEPTION 'Employee not found in your organization';
    END IF;

    IF NOT (
        p_user = auth.uid()
        OR public.is_company_admin()
        OR coalesce(public.reports_to_me(p_user), false)
    ) THEN
        RAISE EXCEPTION 'Not allowed to view this employee report';
    END IF;


    SELECT
        count(*),
        count(*) FILTER (
            WHERE ci.completed_at IS NOT NULL
              AND ci.completed_at >
                  (
                    (
                        ci.due_date
                        +
                        coalesce(
                            ci.due_time,
                            '09:00'::time
                        )
                    )
                    AT TIME ZONE 'Asia/Kolkata'
                  )
        ),
        count(*) FILTER (
            WHERE ci.completed_at IS NULL
              AND
                  (
                    (
                        ci.due_date
                        +
                        coalesce(
                            ci.due_time,
                            '09:00'::time
                        )
                    )
                    AT TIME ZONE 'Asia/Kolkata'
                  ) < v_now
        )

    INTO
        ck_total,
        ck_late,
        ck_miss

    FROM public.checklist_instances ci

    WHERE ci.company_id = v_company
      AND ci.assigned_to = p_user
      AND extract(isoyear FROM ci.due_date) = p_year
      AND extract(week FROM ci.due_date) = p_week;


    SELECT
        count(*),
        count(*) FILTER (
            WHERE d.completed_at IS NOT NULL
              AND d.completed_at >
                  (
                    (
                        d.due_date
                        +
                        coalesce(
                            d.due_time,
                            '23:59:59'::time
                        )
                    )
                    AT TIME ZONE 'Asia/Kolkata'
                  )
        ),
        count(*) FILTER (
            WHERE d.completed_at IS NULL
              AND
                  (
                    (
                        d.due_date
                        +
                        coalesce(
                            d.due_time,
                            '23:59:59'::time
                        )
                    )
                    AT TIME ZONE 'Asia/Kolkata'
                  ) < v_now
        )

    INTO
        dg_total,
        dg_late,
        dg_miss

    FROM public.delegations d

    WHERE d.company_id = v_company
      AND d.assigned_to = p_user
      AND extract(isoyear FROM d.due_date) = p_year
      AND extract(week FROM d.due_date) = p_week;


    RETURN QUERY

    WITH rows_out AS (

        SELECT
            'checklist_nd'::text AS metric,
            'Checklist % Work Not Done'::text AS label,
            ck_total AS no_of_task,
            ck_miss AS affected

        UNION ALL

        SELECT
            'checklist_nd_ot',
            'Checklist % Work Not Done OT',
            ck_total,
            ck_late

        UNION ALL

        SELECT
            'delegation_nd',
            'Delegation % Work Not Done',
            dg_total,
            dg_miss

        UNION ALL

        SELECT
            'delegation_nd_ot',
            'Delegation % Work Not Done OT',
            dg_total,
            dg_late
    )

    SELECT
        r.metric,
        r.label,
        r.no_of_task,
        r.affected,

        CASE
            WHEN r.no_of_task = 0 THEN 0
            ELSE round(
                r.affected::numeric
                * 100
                / r.no_of_task,
                1
            )
        END,

        CASE
            WHEN r.no_of_task = 0 THEN 0
            ELSE -round(
                r.affected::numeric
                * 100
                / r.no_of_task,
                1
            )
        END,

        t.planned

    FROM rows_out r

    LEFT JOIN public.em_weekly_targets t
      ON t.user_id = p_user
     AND t.iso_year = p_year
     AND t.iso_week = p_week
     AND t.metric = r.metric;

END;
$function$
;
grant execute on function em_report(uuid,integer,integer) to authenticated;
grant execute on function em_report(uuid,integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.em_report_all(p_year integer, p_week integer)
 RETURNS TABLE(user_id uuid, full_name text, department text, total_tasks integer, done_on_time integer, done_late integer, not_done integer, em_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_company uuid;
    v_now timestamptz := now();
    v_admin boolean;

BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_company := public.my_company_id();

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'No organization context';
    END IF;

    v_admin := public.is_company_admin();

    -- Ordinary employee must not receive organization-wide reports.
    IF NOT v_admin
       AND NOT EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.company_id = v_company
              AND p.manager_id = auth.uid()
              AND p.status = 'active'
       ) THEN
        RAISE EXCEPTION 'Manager/Admin access required';
    END IF;


    RETURN QUERY

    WITH allowed_users AS (

        SELECT p.id

        FROM public.profiles p

        WHERE p.company_id = v_company
          AND p.status = 'active'

          AND (
              v_admin
              OR p.id = auth.uid()
              OR p.manager_id = auth.uid()
          )

    ),

    all_tasks AS (

        SELECT
            ci.assigned_to AS uid,
            ci.completed_at,

            (
                (
                    ci.due_date
                    +
                    coalesce(
                        ci.due_time,
                        '09:00'::time
                    )
                )
                AT TIME ZONE 'Asia/Kolkata'
            ) AS due_ts

        FROM public.checklist_instances ci

        JOIN allowed_users au
          ON au.id = ci.assigned_to

        WHERE ci.company_id = v_company
          AND extract(isoyear FROM ci.due_date) = p_year
          AND extract(week FROM ci.due_date) = p_week


        UNION ALL


        SELECT
            d.assigned_to,
            d.completed_at,

            (
                (
                    d.due_date
                    +
                    coalesce(
                        d.due_time,
                        '23:59:59'::time
                    )
                )
                AT TIME ZONE 'Asia/Kolkata'
            )

        FROM public.delegations d

        JOIN allowed_users au
          ON au.id = d.assigned_to

        WHERE d.company_id = v_company
          AND extract(isoyear FROM d.due_date) = p_year
          AND extract(week FROM d.due_date) = p_week

    ),

    agg AS (

        SELECT
            uid,

            count(*)::integer AS total_tasks,

            count(*) FILTER (
                WHERE completed_at IS NOT NULL
                  AND completed_at <= due_ts
            )::integer AS done_on_time,

            count(*) FILTER (
                WHERE completed_at IS NOT NULL
                  AND completed_at > due_ts
            )::integer AS done_late,

            count(*) FILTER (
                WHERE completed_at IS NULL
                  AND due_ts < v_now
            )::integer AS not_done

        FROM all_tasks

        GROUP BY uid

    )

    SELECT
        p.id,
        p.full_name,
        coalesce(p.department, '—'),

        coalesce(a.total_tasks,0),
        coalesce(a.done_on_time,0),
        coalesce(a.done_late,0),
        coalesce(a.not_done,0),

        CASE
            WHEN coalesce(a.total_tasks,0) = 0
                THEN 0
            ELSE round(
                a.done_on_time::numeric
                * 100
                / a.total_tasks,
                1
            )
        END

    FROM public.profiles p

    JOIN allowed_users au
      ON au.id = p.id

    LEFT JOIN agg a
      ON a.uid = p.id

    WHERE p.company_id = v_company
      AND p.status = 'active'

    ORDER BY
        8 ASC,
        p.full_name;

END;
$function$
;
grant execute on function em_report_all(integer,integer) to authenticated;
grant execute on function em_report_all(integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.em_save_target(p_user uuid, p_year integer, p_week integer, p_metric text, p_planned numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
begin
  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then
    raise exception 'No company context.';
  end if;

  insert into public.em_weekly_targets
    (company_id, user_id, iso_year, iso_week, metric, planned)
  values
    (v_company, p_user, p_year, p_week, p_metric, p_planned)
  on conflict (user_id, iso_year, iso_week, metric)
  do update set planned = excluded.planned, updated_at = now();
end;
$function$
;
grant execute on function em_save_target(uuid,integer,integer,text,numeric) to authenticated;
grant execute on function em_save_target(uuid,integer,integer,text,numeric) to anon;
grant execute on function em_save_target(uuid,integer,integer,text,numeric) to service_role;

CREATE OR REPLACE FUNCTION public.email_for_phone(p_phone text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select email
  from public.profiles
  where phone = p_phone
    and status = 'active'
  limit 1;
$function$
;
grant execute on function email_for_phone(text) to service_role;

CREATE OR REPLACE FUNCTION public.employee_is_on_duty_v6(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.attendance a
    join public.companies c on c.id=a.company_id
    where a.employee_id=p_employee_id
      and a.work_date=(clock_timestamp() at time zone coalesce(c.timezone,'Asia/Kolkata'))::date
      and a.check_in is not null
      and a.check_out is null
  );
$function$
;
grant execute on function employee_is_on_duty_v6(uuid) to authenticated;
grant execute on function employee_is_on_duty_v6(uuid) to anon;
grant execute on function employee_is_on_duty_v6(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.enforce_location_mandatory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_company   uuid;
  v_mandatory boolean := false;
  j           jsonb := to_jsonb(new);
  v_in_lat    text;
  v_out_lat   text;
begin
  -- company id: direct column ho to use karo, warna profile se
  if (j ? 'company_id') and (j->>'company_id') is not null then
    v_company := (j->>'company_id')::uuid;
  else
    select company_id into v_company
    from public.profiles where id = new.employee_id;
  end if;

  select coalesce(location_mandatory, false) into v_mandatory
  from public.companies where id = v_company;

  if not v_mandatory then
    return new;
  end if;

  -- common lat column names cover kiye hain
  v_in_lat  := coalesce(j->>'check_in_lat',  j->>'in_lat',  j->>'lat');
  v_out_lat := coalesce(j->>'check_out_lat', j->>'out_lat');

  if tg_op = 'INSERT' then
    if v_in_lat is null then
      raise exception 'Location is mandatory for attendance. Please enable location permission and try again.';
    end if;
  elsif tg_op = 'UPDATE' then
    -- check-out abhi record ho raha hai
    if new.check_out is not null and old.check_out is null and v_out_lat is null then
      raise exception 'Location is mandatory for attendance. Please enable location permission and try again.';
    end if;
  end if;

  return new;
end;
$function$
;
grant execute on function enforce_location_mandatory() to authenticated;
grant execute on function enforce_location_mandatory() to anon;
grant execute on function enforce_location_mandatory() to service_role;

CREATE OR REPLACE FUNCTION public.enforce_server_attendance_time_v6()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_tz text := 'Asia/Kolkata';
  v_is_admin boolean := false;
begin
  select coalesce(c.timezone, 'Asia/Kolkata') into v_tz
  from public.companies c where c.id = new.company_id;

  begin
    v_is_admin := public.is_company_admin();
  exception when others then
    v_is_admin := false;
  end;

  -- First check-in is ALWAYS server time and server-derived date.
  if tg_op = 'INSERT' and new.check_in is not null then
    new.check_in := v_now;
    new.check_in_server_at := v_now;
    new.work_date := (v_now at time zone v_tz)::date;
    new.timestamp_source := 'server';
  elsif tg_op = 'UPDATE' then
    if old.check_in is null and new.check_in is not null then
      new.check_in := v_now;
      new.check_in_server_at := v_now;
      new.work_date := (v_now at time zone v_tz)::date;
      new.timestamp_source := 'server';
    elsif old.check_in is not null and new.check_in is distinct from old.check_in and not v_is_admin then
      -- Employee/client cannot backdate or edit an existing punch.
      new.check_in := old.check_in;
      new.check_in_server_at := coalesce(old.check_in_server_at, old.check_in);
    end if;
  end if;

  -- First check-out is ALWAYS server time.
  if tg_op = 'INSERT' and new.check_out is not null then
    new.check_out := v_now;
    new.check_out_server_at := v_now;
    new.timestamp_source := 'server';
  elsif tg_op = 'UPDATE' then
    if old.check_out is null and new.check_out is not null then
      new.check_out := v_now;
      new.check_out_server_at := v_now;
      new.timestamp_source := 'server';
    elsif old.check_out is not null and new.check_out is distinct from old.check_out and not v_is_admin then
      new.check_out := old.check_out;
      new.check_out_server_at := coalesce(old.check_out_server_at, old.check_out);
    end if;
  end if;

  if new.check_in is not null and new.check_out is not null then
    new.work_minutes := greatest(0, floor(extract(epoch from (new.check_out - new.check_in)) / 60)::integer);
  end if;

  return new;
end;
$function$
;
grant execute on function enforce_server_attendance_time_v6() to authenticated;
grant execute on function enforce_server_attendance_time_v6() to anon;
grant execute on function enforce_server_attendance_time_v6() to service_role;

CREATE OR REPLACE FUNCTION public.enforce_support_meeting_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  s_local timestamp;
  e_local timestamp;
begin

  s_local := new.starts_at at time zone 'Asia/Kolkata';
  e_local := new.ends_at at time zone 'Asia/Kolkata';

  if extract(isodow from s_local) = 7 then
    raise exception 'Support meetings are not available on Sunday';
  end if;

  if
    s_local::date <> e_local::date
    or s_local::time < time '10:00'
    or e_local::time > time '19:00'
  then
    raise exception
      'Support meetings can be booked only between 10:00 AM and 7:00 PM IST';
  end if;

  return new;
end
$function$
;
grant execute on function enforce_support_meeting_schedule() to authenticated;
grant execute on function enforce_support_meeting_schedule() to anon;
grant execute on function enforce_support_meeting_schedule() to service_role;

CREATE OR REPLACE FUNCTION public.field_manager_notify_v9()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='UPDATE' and new.status is distinct from old.status then
    perform public.notify_employee_domain_manager_v9(
      new.employee_id,'field','Field visit status updated',
      coalesce(new.client_name,'Client visit') || ' · ' || replace(new.status,'_',' '),
      '/field-visits'
    );
  end if;
  return new;
end;
$function$
;
grant execute on function field_manager_notify_v9() to authenticated;
grant execute on function field_manager_notify_v9() to anon;
grant execute on function field_manager_notify_v9() to service_role;

CREATE OR REPLACE FUNCTION public.field_reports_to_me(p_employee uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.profiles p where p.id=p_employee and p.company_id=public.my_company_id() and p.field_manager_id=auth.uid());
$function$
;
grant execute on function field_reports_to_me(uuid) to authenticated;
grant execute on function field_reports_to_me(uuid) to anon;
grant execute on function field_reports_to_me(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.field_tracking_compliance_report_v6(p_from date, p_to date)
 RETURNS TABLE(employee_id uuid, full_name text, designation text, tracking_mode text, duty_minutes bigint, gps_points bigint, expected_points bigint, interruptions bigint, gps_blocked bigint, stale_events bigint, restored_events bigint, compliance_percent integer, last_interruption timestamp with time zone, last_restored timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with scoped as (
  select p.id,p.full_name,p.designation,p.tracking_mode,coalesce(p.tracking_interval_minutes,5) interval_mins
  from public.profiles p
  where p.company_id=public.my_company_id() and p.field_tracking_enabled=true
    and (public.is_company_admin() or public.reports_to_me(p.id) or p.id=auth.uid())
), duty as (
  select a.employee_id,
    sum(coalesce(a.work_minutes,
      case when a.check_in is not null and a.check_out is null
        then greatest(0,floor(extract(epoch from (clock_timestamp()-a.check_in))/60)::integer)
        else 0 end))::bigint duty_minutes
  from public.attendance a join scoped s on s.id=a.employee_id
  where a.work_date between p_from and p_to
  group by a.employee_id
), points as (
  select h.employee_id,count(*)::bigint gps_points
  from public.employee_location_history h join scoped s on s.id=h.employee_id
  where (h.captured_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  group by h.employee_id
), ev as (
  select e.employee_id,
    count(*) filter(where e.event_type in ('location_permission_denied','location_unavailable','location_timeout','network_offline','tracking_stale'))::bigint interruptions,
    count(*) filter(where e.event_type='location_permission_denied')::bigint gps_blocked,
    count(*) filter(where e.event_type='tracking_stale')::bigint stale_events,
    count(*) filter(where e.event_type='location_restored')::bigint restored_events,
    max(e.event_time) filter(where e.event_type in ('location_permission_denied','location_unavailable','location_timeout','network_offline','tracking_stale')) last_interruption,
    max(e.event_time) filter(where e.event_type='location_restored') last_restored
  from public.tracking_events e join scoped s on s.id=e.employee_id
  where (e.event_time at time zone 'Asia/Kolkata')::date between p_from and p_to
  group by e.employee_id
)
select s.id,s.full_name,s.designation,s.tracking_mode,
  coalesce(d.duty_minutes,0),coalesce(p.gps_points,0),
  case when coalesce(d.duty_minutes,0)=0 then 0 else greatest(1,ceil(coalesce(d.duty_minutes,0)::numeric/s.interval_mins)::bigint) end expected_points,
  coalesce(ev.interruptions,0),coalesce(ev.gps_blocked,0),coalesce(ev.stale_events,0),coalesce(ev.restored_events,0),
  case when coalesce(d.duty_minutes,0)=0 then 0
       else least(100,round(100.0*coalesce(p.gps_points,0)/greatest(1,ceil(coalesce(d.duty_minutes,0)::numeric/s.interval_mins)))::integer) end compliance_percent,
  ev.last_interruption,ev.last_restored
from scoped s
left join duty d on d.employee_id=s.id
left join points p on p.employee_id=s.id
left join ev on ev.employee_id=s.id
order by s.full_name;
$function$
;
grant execute on function field_tracking_compliance_report_v6(date,date) to authenticated;
grant execute on function field_tracking_compliance_report_v6(date,date) to anon;
grant execute on function field_tracking_compliance_report_v6(date,date) to service_role;

CREATE OR REPLACE FUNCTION public.field_visit_action_v6(p_visit_id uuid, p_action text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_person_met text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text, p_completion_notes text DEFAULT NULL::text, p_next_followup_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS field_visits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.field_visits;
  v_company uuid := public.my_company_id();
  v_now timestamptz := now();
begin

  -- ---------------------------------------------------------------
  -- 1. Session / organisation validation
  -- ---------------------------------------------------------------
  if auth.uid() is null or v_company is null then
    raise exception
      'Your session is no longer valid. Please sign in again.';
  end if;


  -- ---------------------------------------------------------------
  -- 2. Load visit only from logged-in user's organisation
  -- ---------------------------------------------------------------
  select *
  into v
  from public.field_visits
  where id = p_visit_id
    and company_id = v_company
  for update;

  if v.id is null then
    raise exception
      'Visit not found in your organization.';
  end if;


  -- ---------------------------------------------------------------
  -- 3. Permission check
  -- Employee = own visit
  -- Admin/Owner = organisation visits
  -- Manager = reporting employee visit
  -- ---------------------------------------------------------------
  if v.employee_id <> auth.uid()
     and not public.is_company_admin()
     and not public.reports_to_me(v.employee_id)
  then
    raise exception
      'You do not have permission to update this visit.';
  end if;


  -- ===============================================================
  -- ACCEPT VISIT
  -- ===============================================================
  if p_action = 'accept' then

    if v.status not in ('assigned', 'planned') then
      raise exception
        'This visit cannot be accepted from its current status (%).',
        v.status;
    end if;

    update public.field_visits
    set
      status = 'accepted',
      accepted_at = coalesce(accepted_at, v_now)
    where id = v.id
    returning * into v;


  -- ===============================================================
  -- START TRAVEL
  -- ===============================================================
  elsif p_action = 'start_travel' then

    if v.status not in ('assigned', 'planned', 'accepted') then
      raise exception
        'Start Travel is not available from status (%).',
        v.status;
    end if;

    if p_lat is null or p_lng is null then
      raise exception
        'Current location is required to start travel.';
    end if;

    update public.field_visits
    set
      status = 'on_the_way',

      accepted_at =
        coalesce(accepted_at, v_now),

      travel_started_at =
        coalesce(travel_started_at, v_now),

      last_lat = p_lat,
      last_lng = p_lng,
      last_location_at = v_now

    where id = v.id
    returning * into v;


  -- ===============================================================
  -- CHECK IN
  -- ===============================================================
  elsif p_action = 'check_in' then

    if v.status not in (
      'accepted',
      'on_the_way',
      'reached'
    ) then
      raise exception
        'Check In is not available from status (%).',
        v.status;
    end if;

    if p_lat is null or p_lng is null then
      raise exception
        'Current location is required to check in.';
    end if;

    update public.field_visits
    set
      status = 'checked_in',

      reached_at =
        coalesce(reached_at, v_now),

      check_in_at =
        coalesce(check_in_at, v_now),

      check_in_lat =
        coalesce(check_in_lat, p_lat),

      check_in_lng =
        coalesce(check_in_lng, p_lng),

      last_lat = p_lat,
      last_lng = p_lng,
      last_location_at = v_now

    where id = v.id
    returning * into v;


  -- ===============================================================
  -- START MEETING
  -- ===============================================================
  elsif p_action = 'meeting' then

    if v.status not in (
      'checked_in',
      'meeting'
    ) then
      raise exception
        'Start Meeting is available only after Check In.';
    end if;

    update public.field_visits
    set
      status = 'meeting',

      meeting_started_at =
        coalesce(meeting_started_at, v_now)

    where id = v.id
    returning * into v;


  -- ===============================================================
  -- COMPLETE VISIT
  -- ===============================================================
  elsif p_action = 'complete' then

    if v.status not in (
      'checked_in',
      'meeting'
    ) then
      raise exception
        'Complete Visit is available only after Check In.';
    end if;


    -- Person Met required
    if nullif(
      btrim(coalesce(p_person_met, '')),
      ''
    ) is null then

      raise exception
        'Person met is required.';

    end if;


    -- Outcome required
    if nullif(
      btrim(coalesce(p_outcome, '')),
      ''
    ) is null then

      raise exception
        'Visit outcome is required.';

    end if;


    -- Visit notes required
    if nullif(
      btrim(coalesce(p_completion_notes, '')),
      ''
    ) is null then

      raise exception
        'Visit notes are required.';

    end if;


    -- Follow-up date required only when follow-up selected
    if p_outcome = 'follow_up_required'
       and p_next_followup_at is null
    then

      raise exception
        'Next follow-up date and time is required.';

    end if;


    update public.field_visits
    set

      status = 'completed',

      meeting_started_at =
        coalesce(
          meeting_started_at,
          check_in_at,
          v_now
        ),

      completed_at =
        coalesce(
          completed_at,
          v_now
        ),

      check_out_at =
        coalesce(
          check_out_at,
          v_now
        ),

      person_met =
        btrim(p_person_met),

      outcome =
        p_outcome,

      completion_notes =
        btrim(p_completion_notes),

      next_followup_at =
        p_next_followup_at,

      -- Fresh GPS is optional at completion.
      -- Existing check-in / last known GPS is preserved.
      last_lat =
        coalesce(
          p_lat,
          last_lat,
          check_in_lat
        ),

      last_lng =
        coalesce(
          p_lng,
          last_lng,
          check_in_lng
        ),

      last_location_at =
        case
          when p_lat is not null
           and p_lng is not null
          then v_now
          else last_location_at
        end

    where id = v.id
    returning * into v;


  -- ===============================================================
  -- INVALID ACTION
  -- ===============================================================
  else

    raise exception
      'Unknown visit action (%).',
      p_action;

  end if;


  return v;

end;
$function$
;
grant execute on function field_visit_action_v6(uuid,text,double precision,double precision,text,text,text,timestamp with time zone) to authenticated;
grant execute on function field_visit_action_v6(uuid,text,double precision,double precision,text,text,text,timestamp with time zone) to anon;
grant execute on function field_visit_action_v6(uuid,text,double precision,double precision,text,text,text,timestamp with time zone) to service_role;

CREATE OR REPLACE FUNCTION public.field_visits_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o   jsonb;
  n   jsonb;
  c   text;
  fix jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    new.original_scheduled_at := coalesce(new.original_scheduled_at, new.scheduled_at);
    return new;
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);
  foreach c in array array['accepted_at', 'travel_started_at', 'reached_at', 'check_in_at',
                           'meeting_started_at', 'completed_at', 'check_out_at', 'original_scheduled_at']
  loop
    if o ? c and (o->>c) is not null and (n->>c) is distinct from (o->>c) then
      fix := fix || jsonb_build_object(c, o->c);
    end if;
  end loop;
  if fix <> '{}'::jsonb then
    new := jsonb_populate_record(new, fix);
  end if;

  -- Reschedule: keep the first plan, log the change, re-arm the 30-min reminder.
  if new.scheduled_at is distinct from old.scheduled_at then
    new.original_scheduled_at := coalesce(old.original_scheduled_at, old.scheduled_at, new.scheduled_at);
    if old.scheduled_at is not null then
      new.reschedule_count := coalesce(old.reschedule_count, 0) + 1;
    end if;
    new.reminder_sent_at := null;
  end if;

  return new;
end $function$
;
grant execute on function field_visits_guard() to authenticated;
grant execute on function field_visits_guard() to anon;
grant execute on function field_visits_guard() to service_role;

CREATE OR REPLACE FUNCTION public.field_visits_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := coalesce(auth.uid(), new.assigned_by);
  v_name  text;
  v_when  text;
begin
  select full_name into v_name from public.profiles where id = v_actor;
  v_when := case when new.scheduled_at is null then to_char(new.visit_date, 'DD Mon YYYY')
                 else to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') end;

  if tg_op = 'INSERT' then
    if v_actor is not null and v_actor <> new.employee_id then
      insert into public.notifications (company_id, user_id, title, body, kind, link)
      values (new.company_id, new.employee_id,
              'New visit planned: ' || coalesce(nullif(new.client_name, ''), 'Client visit'),
              coalesce(v_name, 'Your manager') || ' planned this visit for ' || v_when || '.',
              'visit_planned', '/field-visits');
    end if;
    return new;
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    insert into public.field_visit_schedule_changes (visit_id, company_id, old_at, new_at, changed_by)
    values (new.id, new.company_id, old.scheduled_at, new.scheduled_at, v_actor);

    if v_actor is not null and v_actor <> new.employee_id then
      insert into public.notifications (company_id, user_id, title, body, kind, link)
      values (new.company_id, new.employee_id,
              'Visit rescheduled: ' || coalesce(nullif(new.client_name, ''), 'Client visit'),
              'New time: ' || v_when || ' (changed by ' || coalesce(v_name, 'your manager') || ').',
              'visit_rescheduled', '/field-visits');
    end if;
  end if;
  return new;
end $function$
;
grant execute on function field_visits_notify() to authenticated;
grant execute on function field_visits_notify() to anon;
grant execute on function field_visits_notify() to service_role;

CREATE OR REPLACE FUNCTION public.generate_billing_receipt_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_seq bigint;
begin
  v_seq := nextval('public.billing_receipt_seq');

  return
    'SMR-' ||
    to_char(current_date, 'YYYY') ||
    '-' ||
    lpad(v_seq::text, 6, '0');
end;
$function$
;
grant execute on function generate_billing_receipt_number() to authenticated;
grant execute on function generate_billing_receipt_number() to anon;
grant execute on function generate_billing_receipt_number() to service_role;

CREATE OR REPLACE FUNCTION public.generate_checklist_instances()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company  uuid;
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
  v_horizon  date := v_today + 7;
  tmpl       record;
  v_due      date;
  v_created  integer := 0;
  v_guard    integer;
  v_new_id   uuid;
begin
  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then
    return 0;
  end if;

  for tmpl in
    select * from public.checklist_templates
    where company_id = v_company
      and active
      and next_due_date <= v_horizon
      and (end_date is null or next_due_date <= end_date)
    order by next_due_date
  loop
    v_guard := 0;
    while tmpl.next_due_date <= v_horizon
      and (tmpl.end_date is null or tmpl.next_due_date <= tmpl.end_date)
      and v_guard < 200
    loop
      v_guard := v_guard + 1;
      v_due := public.next_working_day(v_company, tmpl.next_due_date);

      insert into public.checklist_instances (company_id, template_id, assigned_to, due_date, due_time)
      values (v_company, tmpl.id, tmpl.assigned_to, v_due, coalesce(tmpl.due_time, '09:00'))
      on conflict (template_id, due_date) do nothing
      returning id into v_new_id;

      if v_new_id is not null then
        v_created := v_created + 1;

        insert into public.notifications (company_id, user_id, title, body, kind, link)
        values (
          v_company, tmpl.assigned_to,
          'Checklist task due ' || to_char(v_due, 'DD Mon') || ' at ' || to_char(coalesce(tmpl.due_time, '09:00'), 'HH12:MI AM'),
          tmpl.title,
          'task',
          '/tasks'
        );
      end if;

      tmpl.next_due_date := public.advance_due_date(tmpl.next_due_date, tmpl.frequency);
      v_new_id := null;
    end loop;

    update public.checklist_templates
    set next_due_date = tmpl.next_due_date
    where id = tmpl.id;
  end loop;

  return v_created;
end;
$function$
;
grant execute on function generate_checklist_instances() to authenticated;
grant execute on function generate_checklist_instances() to anon;
grant execute on function generate_checklist_instances() to service_role;

CREATE OR REPLACE FUNCTION public.generate_my_company_tasks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_company_id() is null then return 0; end if;
  return public.generate_recurring_tasks(7, public.my_company_id());
end $function$
;
grant execute on function generate_my_company_tasks() to authenticated;
grant execute on function generate_my_company_tasks() to anon;
grant execute on function generate_my_company_tasks() to service_role;

CREATE OR REPLACE FUNCTION public.generate_recurring_tasks(p_days_ahead integer DEFAULT 7, p_company uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t        record;
  occ      date;
  due      date;
  nxt      date;
  anchor   int;
  horizon  date := public.today_ist() + p_days_ahead;
  created  integer := 0;
  guard    int;
  v_time   time;
  v_start  time;
  v_end    time;
begin
  for t in
    select ct.*, coalesce(c.work_start::time, '09:30'::time) as ws, coalesce(c.work_end::time, '18:30'::time) as we
    from public.checklist_templates ct
    join public.companies c on c.id = ct.company_id
    where ct.next_due_date is not null
      and ct.next_due_date <= horizon
      and coalesce((to_jsonb(ct)->>'active')::boolean, true)
      and (p_company is null or ct.company_id = p_company)
      and public.org_feature_enabled(ct.company_id, 'tasks.checklist')
    for update of ct skip locked
  loop
    occ    := t.next_due_date;
    anchor := extract(day from coalesce(t.start_date, t.next_due_date))::int;
    guard  := 0;

    -- keep the due time inside working hours
    v_start := t.ws; v_end := t.we;
    v_time  := coalesce(nullif(to_jsonb(t)->>'due_time', '')::time, v_start);
    if v_end > v_start then
      v_time := greatest(v_start, least(v_time, v_end));
    end if;

    while occ <= horizon and guard < 400 loop
      guard := guard + 1;
      exit when t.end_date is not null and occ > t.end_date;

      -- Occurrences missed for more than 3 days are skipped, not dumped as overdue.
      if occ >= public.today_ist() - 3 then
        due := case when t.frequency = 'daily'
                    then occ   -- daily: simply skip off days (no pile-up on Monday)
                    else public.next_working_day(t.company_id, t.assigned_to, occ) end;

        if public.day_off_reason(t.company_id, t.assigned_to, due) is null
           and (t.end_date is null or due <= t.end_date + 7)
           and not exists (
             select 1 from public.checklist_instances i
             where i.template_id = t.id and i.due_date = due
           )
        then
          insert into public.checklist_instances (company_id, template_id, assigned_to, due_date, due_time)
          values (t.company_id, t.id, t.assigned_to, due, v_time);
          created := created + 1;
        end if;
      end if;

      nxt := case t.frequency
        when 'daily'       then occ + 1
        when 'weekly'      then occ + 7
        when 'monthly'     then public.add_months_anchored(occ, 1, anchor)
        when 'quarterly'   then public.add_months_anchored(occ, 3, anchor)
        when 'half_yearly' then public.add_months_anchored(occ, 6, anchor)
        when 'yearly'      then public.add_months_anchored(occ, 12, anchor)
        else null
      end;
      exit when nxt is null or nxt <= occ;
      occ := nxt;
    end loop;

    update public.checklist_templates set next_due_date = occ where id = t.id;
  end loop;

  return created;
end $function$
;
grant execute on function generate_recurring_tasks(integer,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.geo_distance_km_v7(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when lat1 is null or lon1 is null or lat2 is null or lon2 is null then 0
  else 6371.0088 * 2 * asin(sqrt(
    power(sin(radians(lat2-lat1)/2),2) +
    cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)
  )) end;
$function$
;
grant execute on function geo_distance_km_v7(double precision,double precision,double precision,double precision) to authenticated;
grant execute on function geo_distance_km_v7(double precision,double precision,double precision,double precision) to anon;
grant execute on function geo_distance_km_v7(double precision,double precision,double precision,double precision) to service_role;

CREATE OR REPLACE FUNCTION public.get_payroll(p_month integer, p_year integer, p_employee uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, full_name text, employee_code text, department text, designation text, phone text, work_days integer, present_days integer, late_count integer, wfh_days numeric, leave_days numeric, short_count integer, absent_days numeric, late_deduction numeric, leave_deduction numeric, short_deduction numeric, absent_deduction numeric, salary_deduction numeric, total_deduction numeric, payable_days numeric, monthly_salary numeric, basic numeric, hra numeric, other_allowance numeric, pf numeric, other_deduction numeric, per_day_rate numeric, gross_pay numeric, net_salary numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  uid        uuid := auth.uid();
  v_company  uuid;
  v_admin    boolean;
  c          public.companies%rowtype;
  v_from     date := make_date(p_year, p_month, 1);
  v_to       date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_days     integer;
  v_offdays  integer;
  v_holidays integer;
  v_workdays integer;
  emp        record;
  v_present  integer;
  v_late     integer;
  v_wfh      numeric;
  v_leave    numeric;
  v_short    integer;
  v_absent   numeric;
  v_ded_late numeric;
  v_ded_leave numeric;
  v_ded_short numeric;
  v_ded_absent numeric;
  v_ded_salary numeric;
  v_total    numeric;
  v_payable  numeric;
  v_sm       public.salary_master%rowtype;
  v_perday   numeric;
  v_gross    numeric;
  v_net      numeric;
begin
  select p.company_id, public.is_company_admin() into v_company, v_admin
  from public.profiles p where p.id = uid;

  if v_company is null then
    return;
  end if;

  select * into c from public.companies where id = v_company;
  v_days := (extract(day from v_to))::integer;

  select count(*) into v_offdays
  from generate_series(v_from, v_to, interval '1 day') d
  where extract(dow from d)::integer = any(coalesce(c.weekly_offs, '{0}'));

  select count(*) into v_holidays
  from public.holidays h
  where h.company_id = v_company
    and h.holiday_date between v_from and v_to
    and extract(dow from h.holiday_date)::integer <> all(coalesce(c.weekly_offs, '{0}'));

  v_workdays := greatest(0, v_days - v_offdays - v_holidays);

  for emp in
    select p.* from public.profiles p
    where p.company_id = v_company
      and p.status = 'active'
      and ( v_admin or p.id = uid )
      and (p_employee is null or p.id = p_employee)
    order by p.full_name
  loop
    select count(*) filter (where a.status in ('present','half_day')),
           count(*) filter (where a.is_late)
      into v_present, v_late
    from public.attendance a
    where a.employee_id = emp.id and a.work_date between v_from and v_to;

    v_present := coalesce(v_present, 0);
    v_late    := coalesce(v_late, 0);

    select coalesce(sum(l.days) filter (where l.day_type = 'wfh'), 0),
           coalesce(sum(l.days) filter (where l.day_type not in ('wfh','short_morning','short_evening')), 0),
           count(*) filter (where l.day_type in ('short_morning','short_evening'))
      into v_wfh, v_leave, v_short
    from public.leaves l
    where l.employee_id = emp.id and l.status = 'approved'
      and l.from_date between v_from and v_to;

    v_wfh   := coalesce(v_wfh, 0);
    v_leave := coalesce(v_leave, 0);
    v_short := coalesce(v_short, 0);

    v_absent := greatest(0, v_workdays - v_present - v_wfh - v_leave);

    if v_late <= c.payroll_late_free_limit then
      v_ded_late := 0;
    else
      v_ded_late := ceil((v_late - c.payroll_late_free_limit)::numeric / greatest(c.payroll_late_step,1))
                    * c.payroll_late_deduction;
    end if;

    v_ded_leave  := greatest(0, v_leave - c.payroll_leave_free_limit) * c.payroll_leave_deduction;
    v_ded_short  := greatest(0, v_short - c.payroll_short_free_limit) * c.payroll_short_deduction;
    v_ded_absent := v_absent * c.payroll_absent_deduction;

    select coalesce(sum(pa.deduction_days), 0) into v_ded_salary
    from public.payroll_actions pa
    where pa.employee_id = emp.id and pa.month = p_month and pa.year = p_year
      and pa.status = 'approved' and pa.deduct_from = 'salary';

    v_total   := v_ded_late + v_ded_leave + v_ded_short + v_ded_absent + v_ded_salary;
    v_payable := greatest(0, v_workdays - v_total);

    select * into v_sm from public.salary_master sm where sm.employee_id = emp.id;
    if v_sm.id is null then
      v_sm.monthly_salary := 0; v_sm.basic := 0; v_sm.hra := 0;
      v_sm.other_allowance := 0; v_sm.pf := 0; v_sm.other_deduction := 0;
    end if;

    v_perday := case when v_workdays > 0 then round(v_sm.monthly_salary / v_workdays, 2) else 0 end;
    v_gross  := round(v_payable * v_perday, 2);
    v_net    := greatest(0, v_gross - v_sm.pf - v_sm.other_deduction);

    employee_id := emp.id; full_name := emp.full_name; employee_code := emp.employee_code;
    department := emp.department; designation := emp.designation; phone := emp.phone;
    work_days := v_workdays; present_days := v_present; late_count := v_late;
    wfh_days := v_wfh; leave_days := v_leave; short_count := v_short; absent_days := v_absent;
    late_deduction := v_ded_late; leave_deduction := v_ded_leave;
    short_deduction := v_ded_short; absent_deduction := v_ded_absent;
    salary_deduction := v_ded_salary; total_deduction := v_total; payable_days := v_payable;
    monthly_salary := v_sm.monthly_salary; basic := v_sm.basic; hra := v_sm.hra;
    other_allowance := v_sm.other_allowance; pf := v_sm.pf; other_deduction := v_sm.other_deduction;
    per_day_rate := v_perday; gross_pay := v_gross; net_salary := v_net;

    return next;
  end loop;
end;
$function$
;
grant execute on function get_payroll(integer,integer,uuid) to authenticated;
grant execute on function get_payroll(integer,integer,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inv     public.invites%rowtype;
  u_phone text;
begin
  u_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone');

  select * into inv
  from public.invites
  where status = 'pending'
    and (
      (u_phone   is not null and phone = u_phone)
      or (new.email is not null and email = new.email)
    )
  order by created_at desc
  limit 1;

  if inv.id is not null then
    -- Invited user: join their company immediately.
    insert into public.profiles
      (id, company_id, full_name, email, phone, role, department, designation, status)
    values
      (new.id, inv.company_id, inv.full_name, new.email, u_phone,
       inv.role, inv.department, inv.designation, 'active')
    on conflict (id) do nothing;

    update public.invites set status = 'accepted' where id = inv.id;
  else
    -- No invite: user has no company yet and will create one.
    insert into public.profiles (id, full_name, email, phone, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email,
      u_phone,
      'active'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$function$
;
grant execute on function handle_new_user() to authenticated;
grant execute on function handle_new_user() to anon;
grant execute on function handle_new_user() to service_role;

CREATE OR REPLACE FUNCTION public.has_feature(p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.org_feature_enabled(public.my_company_id(), p_key)
$function$
;
grant execute on function has_feature(text) to authenticated;
grant execute on function has_feature(text) to anon;
grant execute on function has_feature(text) to service_role;

CREATE OR REPLACE FUNCTION public.is_company_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin')
  );
$function$
;
grant execute on function is_company_admin() to authenticated;
grant execute on function is_company_admin() to service_role;

CREATE OR REPLACE FUNCTION public.is_employee_on_duty_v7(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.attendance a
    where a.employee_id = p_employee_id
      and a.company_id = (select company_id from public.profiles where id = p_employee_id)
      and a.work_date = (now() at time zone 'Asia/Kolkata')::date
      and a.check_in is not null
      and a.check_out is null
  );
$function$
;
grant execute on function is_employee_on_duty_v7(uuid) to authenticated;
grant execute on function is_employee_on_duty_v7(uuid) to anon;
grant execute on function is_employee_on_duty_v7(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_role text;
    v_user uuid;
BEGIN

    -- --------------------------------------------------------
    -- Determine current request role.
    -- Fail closed if anything is unclear.
    -- --------------------------------------------------------

    v_role := NULLIF(
        COALESCE(
            NULLIF(
                current_setting(
                    'request.jwt.claims',
                    true
                ),
                ''
            )::jsonb ->> 'role',

            current_setting(
                'request.jwt.claim.role',
                true
            )
        ),
        ''
    );


    -- --------------------------------------------------------
    -- Trusted backend service role
    -- --------------------------------------------------------

    IF v_role = 'service_role' THEN
        RETURN TRUE;
    END IF;


    -- --------------------------------------------------------
    -- Everything except authenticated users is denied.
    --
    -- Missing role is also denied.
    -- --------------------------------------------------------

    IF v_role IS NULL
       OR v_role <> 'authenticated'
    THEN
        RETURN FALSE;
    END IF;


    v_user := auth.uid();


    IF v_user IS NULL THEN
        RETURN FALSE;
    END IF;


    -- --------------------------------------------------------
    -- Explicit SystemMaster Platform Admin
    -- --------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM public.platform_admins pa
        WHERE pa.user_id = v_user
    ) THEN
        RETURN TRUE;
    END IF;


    -- --------------------------------------------------------
    -- Existing legacy SystemMaster administrator
    --
    -- This preserves current SystemMaster admin accounts.
    -- Organization admins are NOT checked here.
    -- --------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM public.system_admins sa
        WHERE sa.user_id = v_user
    ) THEN
        RETURN TRUE;
    END IF;


    RETURN FALSE;

EXCEPTION
    WHEN OTHERS THEN
        -- Authorization functions must always fail closed.
        RETURN FALSE;
END;
$function$
;
grant execute on function is_platform_admin() to authenticated;
grant execute on function is_platform_admin() to service_role;

CREATE OR REPLACE FUNCTION public.is_system_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.system_admins sa
    where sa.user_id=auth.uid() and sa.active=true
  );
$function$
;
grant execute on function is_system_admin() to authenticated;
grant execute on function is_system_admin() to service_role;

CREATE OR REPLACE FUNCTION public.last_working_day_v8(p_employee_id uuid)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select max(a.work_date)
  from public.attendance a
  where a.employee_id = p_employee_id
    and a.company_id = public.my_company_id()
    and a.check_in is not null
    and (
      a.employee_id = auth.uid()
      or public.is_company_admin()
      or public.reports_to_me(a.employee_id)
    );
$function$
;
grant execute on function last_working_day_v8(uuid) to authenticated;
grant execute on function last_working_day_v8(uuid) to anon;
grant execute on function last_working_day_v8(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.leave_balance(p_employee uuid DEFAULT NULL::uuid)
 RETURNS TABLE(type_id uuid, code text, name text, quota numeric, used numeric, balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller       uuid := auth.uid();
    uid            uuid := coalesce(p_employee, auth.uid());

    v_company      uuid;
    v_target_company uuid;

    y_start        date :=
        date_trunc('year', current_date)::date;

    y_end          date :=
        (
            date_trunc('year', current_date)
            + interval '1 year - 1 day'
        )::date;

    c              public.companies%rowtype;

    v_auto_on      boolean;

    rec            record;

    v_late_excess  numeric := 0;
    v_short_excess numeric := 0;
    v_total_auto   numeric;
    v_remaining    numeric;

    pl_id uuid;
    cl_id uuid;
    el_id uuid;

    pl_extra numeric := 0;
    cl_extra numeric := 0;
    el_extra numeric := 0;

    pl_base numeric := 0;
    cl_base numeric := 0;

    pl_quota numeric := 0;
    cl_quota numeric := 0;

    pl_cap numeric;
    cl_cap numeric;

BEGIN

    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_company := public.my_company_id();

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'No organization context';
    END IF;

    SELECT company_id
    INTO v_target_company
    FROM public.profiles
    WHERE id = uid
      AND status = 'active';

    IF v_target_company IS NULL
       OR v_target_company <> v_company THEN
        RAISE EXCEPTION 'Employee not found in your organization';
    END IF;

    IF NOT (
        uid = v_caller
        OR public.is_company_admin()
        OR coalesce(public.reports_to_me(uid), false)
    ) THEN
        RAISE EXCEPTION 'Not allowed to view this employee leave balance';
    END IF;


    SELECT *
    INTO c
    FROM public.companies
    WHERE id = v_company;

    v_auto_on :=
        coalesce(c.auto_leave_deduction_enabled, true);


    -- --------------------------------------------------------
    -- Automatic late deductions
    -- --------------------------------------------------------

    IF v_auto_on THEN

        FOR rec IN

            SELECT
                date_trunc('month', work_date) AS mth,
                count(*) FILTER (WHERE is_late) AS lates

            FROM public.attendance

            WHERE company_id = v_company
              AND employee_id = uid
              AND work_date BETWEEN y_start AND y_end

            GROUP BY 1

        LOOP

            IF rec.lates >
               coalesce(c.payroll_late_free_limit, 2) THEN

                v_late_excess :=
                    v_late_excess
                    +
                    ceil(
                        (
                            rec.lates
                            -
                            coalesce(
                                c.payroll_late_free_limit,
                                2
                            )
                        )::numeric
                        /
                        greatest(
                            coalesce(
                                c.payroll_late_step,
                                2
                            ),
                            1
                        )
                    )
                    *
                    coalesce(
                        c.payroll_late_deduction,
                        0.5
                    );

            END IF;

        END LOOP;


        FOR rec IN

            SELECT
                date_trunc('month', from_date) AS mth,
                count(*) AS shorts

            FROM public.leaves

            WHERE company_id = v_company
              AND employee_id = uid
              AND status IN ('pending','approved')
              AND day_type IN (
                    'short_morning',
                    'short_evening'
              )
              AND from_date BETWEEN y_start AND y_end

            GROUP BY 1

        LOOP

            IF rec.shorts >
               coalesce(c.payroll_short_free_limit, 2) THEN

                v_short_excess :=
                    v_short_excess
                    +
                    (
                        rec.shorts
                        -
                        coalesce(
                            c.payroll_short_free_limit,
                            2
                        )
                    )
                    *
                    coalesce(
                        c.payroll_short_deduction,
                        0.5
                    );

            END IF;

        END LOOP;

    END IF;


    v_total_auto :=
        v_late_excess + v_short_excess;

    v_remaining := v_total_auto;


    -- --------------------------------------------------------
    -- Leave types
    -- --------------------------------------------------------

    SELECT lt.id, lt.annual_quota
    INTO pl_id, pl_quota
    FROM public.leave_types lt
    WHERE lt.company_id = v_company
      AND lt.code = 'PL'
    LIMIT 1;


    SELECT lt.id, lt.annual_quota
    INTO cl_id, cl_quota
    FROM public.leave_types lt
    WHERE lt.company_id = v_company
      AND lt.code = 'CL'
    LIMIT 1;


    SELECT lt.id
    INTO el_id
    FROM public.leave_types lt
    WHERE lt.company_id = v_company
      AND lt.code = 'EL'
    LIMIT 1;


    IF pl_id IS NOT NULL THEN

        SELECT coalesce(sum(l.days),0)
        INTO pl_base
        FROM public.leaves l
        WHERE l.company_id = v_company
          AND l.employee_id = uid
          AND l.status IN ('pending','approved')
          AND l.leave_type_id = pl_id
          AND l.from_date BETWEEN y_start AND y_end;

    END IF;


    IF cl_id IS NOT NULL THEN

        SELECT coalesce(sum(l.days),0)
        INTO cl_base
        FROM public.leaves l
        WHERE l.company_id = v_company
          AND l.employee_id = uid
          AND l.status IN ('pending','approved')
          AND l.leave_type_id = cl_id
          AND l.from_date BETWEEN y_start AND y_end;

    END IF;


    IF v_remaining > 0
       AND pl_id IS NOT NULL THEN

        pl_cap :=
            greatest(
                0,
                coalesce(pl_quota,0) - pl_base
            );

        pl_extra :=
            least(v_remaining, pl_cap);

        v_remaining :=
            v_remaining - pl_extra;

    END IF;


    IF v_remaining > 0
       AND cl_id IS NOT NULL THEN

        cl_cap :=
            greatest(
                0,
                coalesce(cl_quota,0) - cl_base
            );

        cl_extra :=
            least(v_remaining, cl_cap);

        v_remaining :=
            v_remaining - cl_extra;

    END IF;


    IF v_remaining > 0
       AND el_id IS NOT NULL THEN

        el_extra := v_remaining;

    END IF;


    RETURN QUERY

    SELECT

        lt.id,
        lt.code,
        lt.name,
        lt.annual_quota,

        (
            (
                SELECT coalesce(sum(l.days),0)

                FROM public.leaves l

                WHERE l.company_id = v_company
                  AND l.employee_id = uid
                  AND l.status IN ('pending','approved')
                  AND l.leave_type_id = lt.id
                  AND l.from_date BETWEEN y_start AND y_end
            )

            +

            CASE
                WHEN lt.id = pl_id THEN pl_extra
                WHEN lt.id = cl_id THEN cl_extra
                WHEN lt.id = el_id THEN el_extra
                ELSE 0
            END

        )::numeric,


        (
            lt.annual_quota
            -
            (
                (
                    SELECT coalesce(sum(l.days),0)

                    FROM public.leaves l

                    WHERE l.company_id = v_company
                      AND l.employee_id = uid
                      AND l.status IN ('pending','approved')
                      AND l.leave_type_id = lt.id
                      AND l.from_date BETWEEN y_start AND y_end
                )

                +

                CASE
                    WHEN lt.id = pl_id THEN pl_extra
                    WHEN lt.id = cl_id THEN cl_extra
                    WHEN lt.id = el_id THEN el_extra
                    ELSE 0
                END
            )

        )::numeric

    FROM public.leave_types lt

    WHERE lt.company_id = v_company
      AND lt.active

    ORDER BY
        lt.sort_order,
        lt.code;

END;
$function$
;
grant execute on function leave_balance(uuid) to authenticated;
grant execute on function leave_balance(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.module_access(p_module text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p.role in ('owner','admin') then 'company'
    else coalesce(p.access_permissions ->> p_module, 'none')
  end
  from public.profiles p where p.id = auth.uid();
$function$
;
grant execute on function module_access(text) to authenticated;
grant execute on function module_access(text) to anon;
grant execute on function module_access(text) to service_role;

CREATE OR REPLACE FUNCTION public.my_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select company_id from public.profiles
  where id = auth.uid() and status = 'active';
$function$
;
grant execute on function my_company_id() to authenticated;
grant execute on function my_company_id() to service_role;

CREATE OR REPLACE FUNCTION public.my_entitlements()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid := public.my_company_id();
  v_row     public.companies;
  v_feats   jsonb;
begin
  if v_company is null then
    return jsonb_build_object('organization', null, 'features', '{}'::jsonb);
  end if;
  select * into v_row from public.companies where id = v_company;
  select coalesce(jsonb_object_agg(f.key, public.org_feature_enabled(v_company, f.key)), '{}'::jsonb)
    into v_feats from public.features f;
  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_row.id, 'org_code', v_row.org_code, 'name', v_row.name,
      'account_status', v_row.account_status, 'timezone', v_row.timezone,
      'suspended_reason', v_row.suspended_reason,
      'onboarding_completed_at', v_row.onboarding_completed_at,
      'plan_code', public.org_plan_code(v_company)),
    'ads_enabled', public.org_ads_enabled(v_company),
    'features', v_feats,
    'locked', (select coalesce(jsonb_agg(feature_key), '[]'::jsonb)
               from public.organization_feature_overrides
               where company_id = v_company and source = 'platform'),
    'requests', (select coalesce(jsonb_agg(feature_key), '[]'::jsonb)
                 from public.organization_module_requests
                 where company_id = v_company and status = 'pending'),
    'catalog', (select coalesce(jsonb_agg(jsonb_build_object(
                  'key', key, 'parent', parent_key, 'name', name, 'availability', availability)
                  order by sort_order), '[]'::jsonb) from public.features)
  );
end $function$
;
grant execute on function my_entitlements() to authenticated;
grant execute on function my_entitlements() to anon;
grant execute on function my_entitlements() to service_role;

CREATE OR REPLACE FUNCTION public.next_employee_code_v9()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid := public.my_company_id();
  v_num integer;
begin
  if v_company is null then raise exception 'No company context'; end if;
  perform pg_advisory_xact_lock(hashtext(v_company::text || ':employee_code'));
  select coalesce(max(
    case when employee_code ~ '^EMP-[0-9]+$'
         then substring(employee_code from 5)::integer
         else 0 end
  ),0)+1
  into v_num
  from public.profiles
  where company_id=v_company;
  return 'EMP-' || lpad(v_num::text,4,'0');
end;
$function$
;
grant execute on function next_employee_code_v9() to authenticated;
grant execute on function next_employee_code_v9() to anon;
grant execute on function next_employee_code_v9() to service_role;

CREATE OR REPLACE FUNCTION public.next_kra_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_prefix  text;
  v_next    integer;
begin
  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then
    raise exception 'No company context.';
  end if;

  update public.companies
     set kra_counter = kra_counter + 1
   where id = v_company
  returning kra_counter, kra_prefix into v_next, v_prefix;

  return coalesce(v_prefix, 'KRA') || '-' || lpad(v_next::text, 4, '0');
end;
$function$
;
grant execute on function next_kra_id() to authenticated;
grant execute on function next_kra_id() to anon;
grant execute on function next_kra_id() to service_role;

CREATE OR REPLACE FUNCTION public.next_working_day(p_company uuid, p_date date)
 RETURNS date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d      date := p_date;
  offs   integer[];
  guard  integer := 0;
begin
  select weekly_offs into offs from public.companies where id = p_company;
  offs := coalesce(offs, '{0}');

  loop
    guard := guard + 1;
    exit when guard > 30;  -- safety valve

    if extract(dow from d)::integer = any(offs)
       or exists (select 1 from public.holidays h
                  where h.company_id = p_company and h.holiday_date = d)
    then
      d := d + 1;
    else
      exit;
    end if;
  end loop;

  return d;
end;
$function$
;
grant execute on function next_working_day(uuid,date) to authenticated;
grant execute on function next_working_day(uuid,date) to anon;
grant execute on function next_working_day(uuid,date) to service_role;

CREATE OR REPLACE FUNCTION public.next_working_day(p_company uuid, p_employee uuid, p_date date)
 RETURNS date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := p_date;
begin
  for i in 1..60 loop
    if public.day_off_reason(p_company, p_employee, d) is null then
      return d;
    end if;
    d := d + 1;
  end loop;
  return p_date;  -- everything is off for 60 days: do not move
end $function$
;
grant execute on function next_working_day(uuid,uuid,date) to authenticated;
grant execute on function next_working_day(uuid,uuid,date) to anon;
grant execute on function next_working_day(uuid,uuid,date) to service_role;

CREATE OR REPLACE FUNCTION public.notifications_send_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  cfg private.push_config;
begin
  select * into cfg from private.push_config where id = 1;
  if cfg.dispatch_url is null or cfg.secret like 'PASTE_%' then
    return new;
  end if;

  perform net.http_post(
    url := cfg.dispatch_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.secret
    ),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- A push problem must never stop the notification itself from being saved.
  raise warning 'push dispatch failed: %', sqlerrm;
  return new;
end $function$
;
grant execute on function notifications_send_push() to authenticated;
grant execute on function notifications_send_push() to anon;
grant execute on function notifications_send_push() to service_role;

CREATE OR REPLACE FUNCTION public.notify_employee_domain_manager_v9(p_employee uuid, p_domain text, p_title text, p_body text, p_link text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_manager uuid;
  v_enabled boolean := true;
begin
  select
    company_id,
    case
      when p_domain = 'hrms' then manager_id
      when p_domain = 'work' then coalesce(work_manager_id, manager_id)
      when p_domain = 'field' then coalesce(field_manager_id, manager_id)
    end,
    case
      when p_domain = 'hrms' then notify_hr_manager
      when p_domain = 'work' then notify_work_manager
      when p_domain = 'field' then notify_field_manager
      else false
    end
  into
    v_company,
    v_manager,
    v_enabled
  from public.profiles
  where id = p_employee;

  if v_company is null
     or v_manager is null
     or not coalesce(v_enabled, false) then
    return;
  end if;

  begin
    insert into public.notifications (
      company_id,
      user_id,
      title,
      body,
      kind,
      link
    )
    values (
      v_company,
      v_manager,
      p_title,
      p_body,

      -- use an existing safe notification type
      'info',

      p_link
    );

  exception
    when others then
      -- Notification must NEVER block Attendance / Task / Field Visit.
      raise notice 'Manager notification skipped: %', sqlerrm;
  end;
end;
$function$
;
grant execute on function notify_employee_domain_manager_v9(uuid,text,text,text,text) to authenticated;
grant execute on function notify_employee_domain_manager_v9(uuid,text,text,text,text) to anon;
grant execute on function notify_employee_domain_manager_v9(uuid,text,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.org_ads_enabled(p_company uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_org boolean; v_plan boolean; v_code text;
begin
  select ads_enabled into v_org from public.companies where id = p_company;
  if v_org is not null then return v_org; end if;
  v_code := public.org_plan_code(p_company);
  if v_code is not null and to_regclass('public.subscription_plans') is not null then
    begin
      execute 'select ads_enabled from public.subscription_plans where code::text = $1 limit 1'
        into v_plan using v_code;
    exception when others then v_plan := null;
    end;
  end if;
  return coalesce(v_plan, true);
end $function$
;
grant execute on function org_ads_enabled(uuid) to authenticated;
grant execute on function org_ads_enabled(uuid) to anon;
grant execute on function org_ads_enabled(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.org_billing_class(p_company uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s jsonb := public.org_subscription_json(p_company); st text;
begin
  st := lower(coalesce(s->>'status', ''));
  if st in ('active', 'past_due') and lower(coalesce(s->>'plan_code', '')) <> 'free' then return 'paid'; end if;
  if st = 'trial' then return 'trial'; end if;
  return 'free';
end $function$
;
grant execute on function org_billing_class(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.org_feature_enabled(p_company uuid, p_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_plan   text;
  v_key    text := p_key;
  v_parent text;
  depth    int := 0;
begin
  if p_company is null or p_key is null then return false; end if;

  select account_status into v_status from public.companies where id = p_company;
  if v_status is null or v_status <> 'active' then return false; end if;

  v_plan := public.org_plan_code(p_company);

  while v_key is not null and depth < 5 loop
    if not public.org_feature_enabled_self(p_company, v_key, v_plan) then
      return false;
    end if;
    select parent_key into v_parent from public.features where key = v_key;
    v_key := v_parent;
    depth := depth + 1;
  end loop;
  return true;
end $function$
;
grant execute on function org_feature_enabled(uuid,text) to authenticated;
grant execute on function org_feature_enabled(uuid,text) to anon;
grant execute on function org_feature_enabled(uuid,text) to service_role;

CREATE OR REPLACE FUNCTION public.org_feature_enabled_self(p_company uuid, p_key text, p_plan text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_avail text;
  v_override boolean;
  v_plan boolean;
begin
  select availability into v_avail from public.features where key = p_key;
  if v_avail is null or v_avail = 'disabled' then
    return false;                                   -- unknown key: fail closed
  end if;

  select enabled into v_override from public.organization_feature_overrides
  where company_id = p_company and feature_key = p_key;
  if v_override is not null then
    return v_override;                              -- SystemMaster decision wins (incl. beta access)
  end if;

  if v_avail = 'coming_soon' then
    return false;
  end if;

  if p_plan is not null and to_regclass('public.plan_features') is not null then
    begin
      execute 'select enabled from public.plan_features where plan_code::text = $1 and feature_key = $2 limit 1'
        into v_plan using p_plan, p_key;
    exception when others then
      v_plan := null;
    end;
    if v_plan is not null then
      return v_plan;
    end if;
  end if;

  return v_avail = 'free';
end $function$
;
grant execute on function org_feature_enabled_self(uuid,text,text) to authenticated;
grant execute on function org_feature_enabled_self(uuid,text,text) to anon;
grant execute on function org_feature_enabled_self(uuid,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.org_last_activity(p_company uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v timestamptz;
begin
  execute 'select max(u.last_sign_in_at) from auth.users u join public.profiles p on p.id = u.id where p.company_id = $1'
    into v using p_company;
  return v;
exception when others then
  return null;
end $function$
;
grant execute on function org_last_activity(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.org_plan_code(p_company uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v text;
begin
  if to_regclass('public.company_subscriptions') is null then return null; end if;
  execute 'select plan_code::text from public.company_subscriptions where company_id = $1 limit 1'
    into v using p_company;
  return v;
exception when others then
  return null;
end $function$
;
grant execute on function org_plan_code(uuid) to authenticated;
grant execute on function org_plan_code(uuid) to anon;
grant execute on function org_plan_code(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.org_request_module(p_key text, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_company uuid := public.my_company_id();
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'Only the organization owner or an admin can request modules';
  end if;
  if not exists (select 1 from public.features where key = p_key and availability in ('free', 'paid')) then
    raise exception 'This module cannot be requested right now';
  end if;
  if public.org_feature_enabled(v_company, p_key) then
    return 'already_active';
  end if;
  insert into public.organization_module_requests (company_id, feature_key, note, requested_by)
  values (v_company, p_key, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  on conflict do nothing;
  return 'requested';
end $function$
;
grant execute on function org_request_module(text,text) to authenticated;
grant execute on function org_request_module(text,text) to service_role;

CREATE OR REPLACE FUNCTION public.org_set_modules(p_modules text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company  uuid := public.my_company_id();
  v_plan     text;
  f          record;
  v_row      public.organization_feature_overrides;
  v_want     boolean;
  v_enabled  text[] := '{}';
  v_disabled text[] := '{}';
  v_requested text[] := '{}';
  v_locked   text[] := '{}';
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'Only the organization owner or an admin can choose modules';
  end if;
  v_plan := public.org_plan_code(v_company);

  for f in select * from public.features where availability <> 'disabled' order by sort_order loop
    -- A parent is wanted if it, or any of its sub-features, is selected.
    v_want := f.key = any(p_modules)
              or exists (select 1 from public.features c where c.parent_key = f.key and c.key = any(p_modules));

    select * into v_row from public.organization_feature_overrides
    where company_id = v_company and feature_key = f.key;

    -- SystemMaster decision: the organization cannot change it.
    if v_row.source = 'platform' then
      if v_want is distinct from v_row.enabled then v_locked := v_locked || f.key; end if;
      continue;
    end if;

    -- Existing client: keeps what it had, may switch freely.
    if v_row.source = 'grandfathered' then
      if v_row.enabled is distinct from v_want then
        update public.organization_feature_overrides
        set enabled = v_want, updated_by = auth.uid(), updated_at = now(),
            reason = case when v_want then 'Re-enabled by organization' else 'Switched off by organization' end
        where company_id = v_company and feature_key = f.key;
      end if;
      if v_want then v_enabled := v_enabled || f.key; else v_disabled := v_disabled || f.key; end if;
      continue;
    end if;

    if not v_want then
      insert into public.organization_feature_overrides (company_id, feature_key, enabled, reason, updated_by, source)
      values (v_company, f.key, false, 'Not selected by organization', auth.uid(), 'organization')
      on conflict (company_id, feature_key) do update
        set enabled = false, reason = excluded.reason, updated_by = excluded.updated_by,
            updated_at = now(), source = 'organization';
      -- withdraw an open request for a module that is no longer wanted
      update public.organization_module_requests set status = 'cancelled', decided_at = now()
      where company_id = v_company and feature_key = f.key and status = 'pending';
      v_disabled := v_disabled || f.key;
      continue;
    end if;

    -- Wanted: remove the organization's own "off" switch, then check entitlement.
    delete from public.organization_feature_overrides
    where company_id = v_company and feature_key = f.key and source = 'organization';

    if public.org_feature_enabled_self(v_company, f.key, v_plan) then
      v_enabled := v_enabled || f.key;
    elsif f.availability = 'coming_soon' then
      v_locked := v_locked || f.key;
    else
      insert into public.organization_module_requests (company_id, feature_key, note, requested_by)
      values (v_company, f.key, 'Selected by the organization', auth.uid())
      on conflict do nothing;
      v_requested := v_requested || f.key;
    end if;
  end loop;

  return jsonb_build_object('enabled', v_enabled, 'disabled', v_disabled,
                            'requested', v_requested, 'locked', v_locked);
end $function$
;
grant execute on function org_set_modules(text[]) to authenticated;
grant execute on function org_set_modules(text[]) to service_role;

CREATE OR REPLACE FUNCTION public.org_subscription_json(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if to_regclass('public.company_subscriptions') is null then return null; end if;
  execute 'select to_jsonb(s) from public.company_subscriptions s where s.company_id = $1 limit 1'
    into v using p_company;
  return v;
exception when others then
  return null;
end $function$
;
grant execute on function org_subscription_json(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.photo_required_for_me()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when c.photo_policy = 'all'      then true
    when c.photo_policy = 'selected' then coalesce(p.photo_required, false)
    else false
  end
  from public.profiles p
  join public.companies c on c.id = p.company_id
  where p.id = auth.uid();
$function$
;
grant execute on function photo_required_for_me() to authenticated;
grant execute on function photo_required_for_me() to anon;
grant execute on function photo_required_for_me() to service_role;

CREATE OR REPLACE FUNCTION public.rebuild_my_attendance_log(p_from date, p_to date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date; total integer := 0; v_company uuid := public.my_company_id();
begin
  if not public.is_company_admin() then
    raise exception 'Only admins can rebuild the attendance register';
  end if;
  if p_to - p_from > 400 then
    raise exception 'Please choose at most 400 days at a time';
  end if;
  d := p_from;
  while d <= least(p_to, public.today_ist()) loop
    total := total + public.refresh_attendance_log(d, d < public.today_ist(), v_company);
    d := d + 1;
  end loop;
  return total;
end $function$
;
grant execute on function rebuild_my_attendance_log(date,date) to authenticated;
grant execute on function rebuild_my_attendance_log(date,date) to anon;
grant execute on function rebuild_my_attendance_log(date,date) to service_role;

CREATE OR REPLACE FUNCTION public.record_employee_location(p_latitude double precision, p_longitude double precision, p_accuracy_m double precision DEFAULT NULL::double precision, p_speed_mps double precision DEFAULT NULL::double precision, p_heading double precision DEFAULT NULL::double precision, p_visit_id uuid DEFAULT NULL::uuid, p_permission_state text DEFAULT 'granted'::text, p_gps_state text DEFAULT 'available'::text, p_source text DEFAULT 'web'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_enabled boolean;
begin
  select company_id, field_tracking_enabled
    into v_company, v_enabled
  from public.profiles
  where id = auth.uid();

  if v_company is null then
    raise exception 'Profile not found';
  end if;

  if coalesce(v_enabled, false) = false then
    return;
  end if;

  insert into public.employee_live_locations(
    employee_id, company_id, visit_id,
    latitude, longitude, accuracy_m, speed_mps, heading,
    permission_state, gps_state, source, captured_at, updated_at
  )
  values(
    auth.uid(), v_company, p_visit_id,
    p_latitude, p_longitude, p_accuracy_m, p_speed_mps, p_heading,
    p_permission_state, p_gps_state, coalesce(p_source,'web'), now(), now()
  )
  on conflict (employee_id) do update set
    visit_id = excluded.visit_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    speed_mps = excluded.speed_mps,
    heading = excluded.heading,
    permission_state = excluded.permission_state,
    gps_state = excluded.gps_state,
    source = excluded.source,
    captured_at = excluded.captured_at,
    updated_at = now();

  insert into public.employee_location_history(
    employee_id, company_id, visit_id,
    latitude, longitude, accuracy_m, speed_mps, heading, source, captured_at
  )
  values(
    auth.uid(), v_company, p_visit_id,
    p_latitude, p_longitude, p_accuracy_m, p_speed_mps, p_heading,
    coalesce(p_source,'web'), now()
  );
end;
$function$
;
grant execute on function record_employee_location(double precision,double precision,double precision,double precision,double precision,uuid,text,text,text) to authenticated;
grant execute on function record_employee_location(double precision,double precision,double precision,double precision,double precision,uuid,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.record_employee_location_v5(p_latitude double precision, p_longitude double precision, p_accuracy_m integer DEFAULT NULL::integer, p_speed_mps double precision DEFAULT NULL::double precision, p_heading double precision DEFAULT NULL::double precision, p_app_state text DEFAULT 'foreground'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile public.profiles;
  v_visit_id uuid;
  v_now timestamptz := now();
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  if coalesce(v_profile.field_tracking_enabled,false) = false then return; end if;

  select id into v_visit_id
  from public.field_visits
  where employee_id = auth.uid()
    and status in ('accepted','on_the_way','reached','checked_in','meeting')
  order by travel_started_at desc nulls last, created_at desc
  limit 1;

  if v_profile.tracking_mode = 'active_visit' and v_visit_id is null then
    return;
  end if;

  insert into public.employee_live_locations(
    employee_id, company_id, visit_id, latitude, longitude, accuracy_m,
    speed_mps, heading, permission_state, tracking_state, app_state,
    last_seen_at, last_error, updated_at
  ) values (
    auth.uid(), v_profile.company_id, v_visit_id, p_latitude, p_longitude, p_accuracy_m,
    p_speed_mps, p_heading, 'granted', 'active', coalesce(p_app_state,'foreground'),
    v_now, null, v_now
  )
  on conflict (employee_id) do update set
    visit_id = excluded.visit_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    speed_mps = excluded.speed_mps,
    heading = excluded.heading,
    permission_state = 'granted',
    tracking_state = 'active',
    app_state = excluded.app_state,
    last_seen_at = excluded.last_seen_at,
    last_error = null,
    updated_at = excluded.updated_at;

  if coalesce(v_profile.route_history_enabled,true) then
    insert into public.employee_location_history(
      company_id, employee_id, visit_id, latitude, longitude, accuracy_m,
      speed_mps, heading, source, captured_at
    ) values (
      v_profile.company_id, auth.uid(), v_visit_id, p_latitude, p_longitude,
      p_accuracy_m, p_speed_mps, p_heading, 'web_pwa', v_now
    );
  end if;

  if v_visit_id is not null then
    insert into public.visit_location_history(
      company_id, visit_id, employee_id, latitude, longitude, accuracy_m,
      speed_mps, heading, captured_at
    ) values (
      v_profile.company_id, v_visit_id, auth.uid(), p_latitude, p_longitude,
      p_accuracy_m, p_speed_mps, p_heading, v_now
    );

    update public.field_visits
    set last_lat = p_latitude, last_lng = p_longitude, last_location_at = v_now
    where id = v_visit_id;
  end if;

  insert into public.tracking_events(
    company_id, visit_id, employee_id, event_type, event_time,
    latitude, longitude, details
  ) values (
    v_profile.company_id, v_visit_id, auth.uid(), 'location_received', v_now,
    p_latitude, p_longitude,
    jsonb_build_object('accuracy_m',p_accuracy_m,'mode',v_profile.tracking_mode)
  );
end;
$function$
;
grant execute on function record_employee_location_v5(double precision,double precision,integer,double precision,double precision,text) to authenticated;
grant execute on function record_employee_location_v5(double precision,double precision,integer,double precision,double precision,text) to service_role;

CREATE OR REPLACE FUNCTION public.record_employee_location_v6(p_latitude double precision, p_longitude double precision, p_accuracy_m integer DEFAULT NULL::integer, p_speed_mps double precision DEFAULT NULL::double precision, p_heading double precision DEFAULT NULL::double precision, p_app_state text DEFAULT 'foreground'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p public.profiles;
  v_live public.employee_live_locations;
  v_visit_id uuid;
  v_now timestamptz := clock_timestamp();
  v_on_duty boolean;
  v_mode text;
begin
  select * into v_p from public.profiles where id=auth.uid();
  if v_p.id is null then raise exception 'Profile not found'; end if;
  if coalesce(v_p.field_tracking_enabled,false)=false then return jsonb_build_object('status','disabled'); end if;

  v_on_duty := public.employee_is_on_duty_v6(auth.uid());
  if not v_on_duty then
    update public.employee_live_locations set duty_status='off_duty',tracking_state='off_duty',app_state='off_duty',last_state_changed_at=v_now,updated_at=v_now
    where employee_id=auth.uid();
    return jsonb_build_object('status','off_duty','message','Employee Off Duty');
  end if;

  v_mode := coalesce(v_p.tracking_mode,'working_hours');
  select id into v_visit_id from public.field_visits
  where employee_id=auth.uid() and status in ('accepted','on_the_way','reached','checked_in','meeting')
  order by travel_started_at desc nulls last, created_at desc limit 1;

  -- Active-visit mode is still bounded by Attendance IN/OUT.
  if v_mode='active_visit' and v_visit_id is null then
    insert into public.employee_live_locations(employee_id,company_id,duty_status,permission_state,tracking_state,app_state,last_state_changed_at,updated_at)
    values(auth.uid(),v_p.company_id,'on_duty','granted','waiting_visit',coalesce(p_app_state,'foreground'),v_now,v_now)
    on conflict(employee_id) do update set duty_status='on_duty',permission_state='granted',tracking_state='waiting_visit',app_state=excluded.app_state,last_error=null,last_state_changed_at=v_now,updated_at=v_now;
    return jsonb_build_object('status','waiting_visit','server_time',v_now);
  end if;

  select * into v_live from public.employee_live_locations where employee_id=auth.uid();

  if v_live.employee_id is not null and v_live.tracking_state in ('blocked','error','offline','stale','background') then
    insert into public.tracking_events(company_id,visit_id,employee_id,event_type,event_time,server_recorded_at,latitude,longitude,details,source)
    values(v_p.company_id,v_visit_id,auth.uid(),'location_restored',v_now,v_now,p_latitude,p_longitude,
      jsonb_build_object('previous_state',v_live.tracking_state,'time_source','server'),'server_location_rpc');
  end if;

  insert into public.employee_live_locations(
    employee_id,company_id,visit_id,latitude,longitude,accuracy_m,speed_mps,heading,
    permission_state,tracking_state,app_state,last_seen_at,last_error,duty_status,duty_started_at,last_state_changed_at,updated_at
  ) values(
    auth.uid(),v_p.company_id,v_visit_id,p_latitude,p_longitude,p_accuracy_m,p_speed_mps,p_heading,
    'granted','active',coalesce(p_app_state,'foreground'),v_now,null,'on_duty',coalesce(v_live.duty_started_at,v_now),v_now,v_now
  )
  on conflict(employee_id) do update set
    company_id=excluded.company_id, visit_id=excluded.visit_id, latitude=excluded.latitude,longitude=excluded.longitude,
    accuracy_m=excluded.accuracy_m,speed_mps=excluded.speed_mps,heading=excluded.heading,
    permission_state='granted',tracking_state='active',app_state=excluded.app_state,last_seen_at=v_now,last_error=null,
    duty_status='on_duty',last_state_changed_at=v_now,updated_at=v_now;

  if coalesce(v_p.route_history_enabled,true) then
    insert into public.employee_location_history(company_id,employee_id,visit_id,latitude,longitude,accuracy_m,speed_mps,heading,source,captured_at,created_at)
    values(v_p.company_id,auth.uid(),v_visit_id,p_latitude,p_longitude,p_accuracy_m,p_speed_mps,p_heading,'web_pwa',v_now,v_now);
  end if;

  if v_visit_id is not null then
    insert into public.visit_location_history(company_id,visit_id,employee_id,latitude,longitude,accuracy_m,speed_mps,heading,captured_at,created_at)
    values(v_p.company_id,v_visit_id,auth.uid(),p_latitude,p_longitude,p_accuracy_m,p_speed_mps,p_heading,v_now,v_now);
    update public.field_visits set last_lat=p_latitude,last_lng=p_longitude,last_location_at=v_now where id=v_visit_id;
  end if;

  insert into public.tracking_events(company_id,visit_id,employee_id,event_type,event_time,server_recorded_at,latitude,longitude,details,source)
  values(v_p.company_id,v_visit_id,auth.uid(),'location_received',v_now,v_now,p_latitude,p_longitude,
    jsonb_build_object('accuracy_m',p_accuracy_m,'tracking_mode',v_mode,'time_source','server'),'server_location_rpc');

  return jsonb_build_object('status','active','server_time',v_now,'visit_id',v_visit_id);
end;
$function$
;
grant execute on function record_employee_location_v6(double precision,double precision,integer,double precision,double precision,text) to authenticated;
grant execute on function record_employee_location_v6(double precision,double precision,integer,double precision,double precision,text) to service_role;

CREATE OR REPLACE FUNCTION public.record_employee_location_v7(p_latitude double precision, p_longitude double precision, p_accuracy_m integer DEFAULT NULL::integer, p_speed_mps double precision DEFAULT NULL::double precision, p_heading double precision DEFAULT NULL::double precision, p_app_state text DEFAULT 'foreground'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_enabled boolean;
  v_route boolean;
  v_visit uuid;
  v_prev_state text;
  v_now timestamptz := clock_timestamp();
begin
  select company_id, field_tracking_enabled, coalesce(route_history_enabled,true)
    into v_company, v_enabled, v_route
  from public.profiles where id=v_uid;

  if v_company is null or not coalesce(v_enabled,false) then return; end if;

  -- Hard privacy boundary: never store a coordinate outside an open attendance duty.
  if not public.is_employee_on_duty_v7(v_uid) then
    perform public.record_tracking_state_v7('off_duty','Attendance OUT / employee off duty',p_app_state);
    return;
  end if;

  select id into v_visit
  from public.field_visits
  where employee_id=v_uid
    and status in ('accepted','on_the_way','reached','checked_in','meeting')
  order by created_at desc limit 1;

  select tracking_state into v_prev_state
  from public.employee_live_locations where employee_id=v_uid;

  insert into public.employee_live_locations(
    employee_id,company_id,visit_id,latitude,longitude,accuracy_m,speed_mps,heading,
    permission_state,tracking_state,app_state,duty_status,duty_started_at,duty_ended_at,
    last_seen_at,last_error,last_state_changed_at,updated_at
  ) values (
    v_uid,v_company,v_visit,p_latitude,p_longitude,p_accuracy_m,p_speed_mps,p_heading,
    'granted','live',coalesce(p_app_state,'foreground'),'on_duty',v_now,null,
    v_now,null,v_now,v_now
  )
  on conflict(employee_id) do update set
    company_id=excluded.company_id,
    visit_id=excluded.visit_id,
    latitude=excluded.latitude, longitude=excluded.longitude,
    accuracy_m=excluded.accuracy_m, speed_mps=excluded.speed_mps, heading=excluded.heading,
    permission_state='granted', tracking_state='live', app_state=excluded.app_state,
    duty_status='on_duty',
    duty_started_at=coalesce(public.employee_live_locations.duty_started_at,v_now),
    duty_ended_at=null,
    last_seen_at=v_now,last_error=null,
    last_state_changed_at=case when public.employee_live_locations.tracking_state <> 'live'
                               then v_now else public.employee_live_locations.last_state_changed_at end,
    updated_at=v_now;

  if v_route then
    insert into public.employee_location_history(
      company_id,employee_id,visit_id,latitude,longitude,accuracy_m,speed_mps,heading,source,captured_at,created_at
    ) values (
      v_company,v_uid,v_visit,p_latitude,p_longitude,p_accuracy_m,p_speed_mps,p_heading,'web_pwa',v_now,v_now
    );
  end if;

  -- Only write restoration event on a state transition, avoiding event spam every GPS ping.
  if v_prev_state is distinct from 'live' then
    insert into public.tracking_events(company_id,employee_id,visit_id,event_type,event_time,latitude,longitude,details)
    values(v_company,v_uid,v_visit,
      case when v_prev_state in ('permission_denied','unavailable','timeout','offline','stale')
           then 'location_restored' else 'location_received' end,
      v_now,p_latitude,p_longitude,
      jsonb_build_object('accuracy_m',p_accuracy_m,'timestamp_source','server'));
  end if;
end;
$function$
;
grant execute on function record_employee_location_v7(double precision,double precision,integer,double precision,double precision,text) to authenticated;
grant execute on function record_employee_location_v7(double precision,double precision,integer,double precision,double precision,text) to service_role;

CREATE OR REPLACE FUNCTION public.record_tracking_state_v6(p_state text, p_reason text DEFAULT NULL::text, p_app_state text DEFAULT 'foreground'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_p public.profiles;
  v_live public.employee_live_locations;
  v_now timestamptz := clock_timestamp();
  v_on_duty boolean;
  v_event text;
  v_tracking_state text;
begin
  select * into v_p from public.profiles where id=auth.uid();
  if v_p.id is null then raise exception 'Profile not found'; end if;
  if coalesce(v_p.field_tracking_enabled,false)=false then return jsonb_build_object('status','disabled'); end if;

  v_on_duty := public.employee_is_on_duty_v6(auth.uid());
  if not v_on_duty then
    insert into public.employee_live_locations(employee_id,company_id,duty_status,tracking_state,app_state,last_state_changed_at,updated_at)
    values(auth.uid(),v_p.company_id,'off_duty','off_duty','off_duty',v_now,v_now)
    on conflict(employee_id) do update set duty_status='off_duty', tracking_state='off_duty', app_state='off_duty', last_state_changed_at=v_now, updated_at=v_now;
    return jsonb_build_object('status','off_duty','message','Employee Off Duty');
  end if;

  select * into v_live from public.employee_live_locations where employee_id=auth.uid();
  v_tracking_state := case p_state
    when 'permission_denied' then 'blocked'
    when 'unavailable' then 'error'
    when 'timeout' then 'error'
    when 'offline' then 'offline'
    when 'background' then 'background'
    else coalesce(nullif(p_state,''),'error') end;
  v_event := case p_state
    when 'permission_denied' then 'location_permission_denied'
    when 'unavailable' then 'location_unavailable'
    when 'timeout' then 'location_timeout'
    when 'offline' then 'network_offline'
    when 'background' then 'app_backgrounded'
    else 'tracking_state_changed' end;

  insert into public.employee_live_locations(
    employee_id,company_id,duty_status,duty_started_at,permission_state,tracking_state,app_state,last_error,last_state_changed_at,updated_at
  ) values(
    auth.uid(),v_p.company_id,'on_duty',v_live.duty_started_at,
    case when p_state='permission_denied' then 'denied' else coalesce(v_live.permission_state,'unknown') end,
    v_tracking_state,coalesce(p_app_state,'foreground'),p_reason,v_now,v_now
  )
  on conflict(employee_id) do update set
    duty_status='on_duty',
    permission_state=case when p_state='permission_denied' then 'denied' else public.employee_live_locations.permission_state end,
    tracking_state=v_tracking_state, app_state=coalesce(p_app_state,'foreground'), last_error=p_reason,
    last_state_changed_at=v_now, updated_at=v_now;

  -- Record only genuine state transitions, not repeated polling failures.
  if v_live.employee_id is null or coalesce(v_live.tracking_state,'') is distinct from v_tracking_state then
    insert into public.tracking_events(company_id,employee_id,event_type,event_time,server_recorded_at,details,source)
    values(v_p.company_id,auth.uid(),v_event,v_now,v_now,
      jsonb_build_object('reason',p_reason,'observed_state',p_state,'time_source','server'), 'server_tracking_rpc');
  end if;
  return jsonb_build_object('status',v_tracking_state,'server_time',v_now);
end;
$function$
;
grant execute on function record_tracking_state_v6(text,text,text) to authenticated;
grant execute on function record_tracking_state_v6(text,text,text) to anon;
grant execute on function record_tracking_state_v6(text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.record_tracking_state_v7(p_state text, p_reason text DEFAULT NULL::text, p_app_state text DEFAULT 'foreground'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_on_duty boolean;
  v_event text;
  v_prev text;
begin
  select company_id into v_company from public.profiles
  where id = v_uid and field_tracking_enabled = true;

  if v_company is null then return; end if;

  v_on_duty := public.is_employee_on_duty_v7(v_uid);

  -- Privacy: after OUT we only store the off-duty state, never a new GPS failure trail.
  if not v_on_duty then
    insert into public.employee_live_locations(
      employee_id, company_id, duty_status, tracking_state, app_state,
      duty_ended_at, last_state_changed_at, updated_at
    )
    values(v_uid, v_company, 'off_duty', 'off_duty', coalesce(p_app_state,'foreground'),
           clock_timestamp(), clock_timestamp(), clock_timestamp())
    on conflict (employee_id) do update set
      duty_status='off_duty',
      tracking_state='off_duty',
      app_state=excluded.app_state,
      duty_ended_at=coalesce(public.employee_live_locations.duty_ended_at, clock_timestamp()),
      last_state_changed_at=case when public.employee_live_locations.tracking_state <> 'off_duty'
                                 then clock_timestamp() else public.employee_live_locations.last_state_changed_at end,
      updated_at=clock_timestamp();
    return;
  end if;

  select tracking_state into v_prev
  from public.employee_live_locations where employee_id=v_uid;

  v_event := case
    when p_state = 'permission_denied' then 'location_permission_denied'
    when p_state = 'timeout' then 'location_timeout'
    when p_state in ('unavailable','offline') then 'location_unavailable'
    when p_state = 'background' then 'app_background'
    else 'tracking_state_changed'
  end;

  insert into public.employee_live_locations(
    employee_id, company_id, permission_state, tracking_state, app_state,
    duty_status, duty_started_at, last_error, last_state_changed_at, updated_at
  )
  values(
    v_uid, v_company,
    case when p_state='permission_denied' then 'denied' else 'unknown' end,
    p_state, coalesce(p_app_state,'foreground'), 'on_duty', clock_timestamp(),
    p_reason, clock_timestamp(), clock_timestamp()
  )
  on conflict (employee_id) do update set
    permission_state=case
      when p_state='permission_denied' then 'denied'
      else public.employee_live_locations.permission_state end,
    tracking_state=p_state,
    app_state=excluded.app_state,
    duty_status='on_duty',
    duty_started_at=coalesce(public.employee_live_locations.duty_started_at, clock_timestamp()),
    duty_ended_at=null,
    last_error=p_reason,
    last_state_changed_at=case when public.employee_live_locations.tracking_state is distinct from p_state
                               then clock_timestamp() else public.employee_live_locations.last_state_changed_at end,
    updated_at=clock_timestamp();

  if v_prev is distinct from p_state then
    insert into public.tracking_events(company_id, employee_id, event_type, event_time, details)
    values(v_company, v_uid, v_event, clock_timestamp(),
           jsonb_build_object('reason',p_reason,'state',p_state,'timestamp_source','server'));
  end if;
end;
$function$
;
grant execute on function record_tracking_state_v7(text,text,text) to authenticated;
grant execute on function record_tracking_state_v7(text,text,text) to anon;
grant execute on function record_tracking_state_v7(text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.refresh_attendance_log(p_date date, p_final boolean DEFAULT false, p_company uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with emp as (
    select p.id, p.company_id
    from public.profiles p
    where coalesce(p.status, 'active') = 'active'
      and p.company_id is not null
      and (p_company is null or p.company_id = p_company)
      and coalesce(nullif(to_jsonb(p)->>'joined_on', '')::date, p_date) <= p_date
      and public.org_feature_enabled(p.company_id, 'attendance')
  ),
  att as (
    select distinct on (a.employee_id)
      a.employee_id,
      lower(coalesce(to_jsonb(a)->>'status', ''))                       as st,
      coalesce((to_jsonb(a)->>'is_late')::boolean, false)               as late,
      nullif(coalesce(to_jsonb(a)->>'check_in', to_jsonb(a)->>'check_in_at'), '')::timestamptz   as cin,
      nullif(coalesce(to_jsonb(a)->>'check_out', to_jsonb(a)->>'check_out_at'), '')::timestamptz as cout,
      nullif(to_jsonb(a)->>'work_minutes', '')::integer                 as mins
    from public.attendance a
    join emp on emp.id = a.employee_id
    where a.work_date = p_date
    order by a.employee_id, nullif(coalesce(to_jsonb(a)->>'check_in', to_jsonb(a)->>'check_in_at'), '') nulls last
  ),
  lv as (
    select distinct l.employee_id,
           coalesce(nullif(to_jsonb(l)->>'day_type', ''), 'full_day') as day_type
    from public.leaves l
    join emp on emp.id = l.employee_id
    where l.status = 'approved'
      and p_date between l.from_date and coalesce(l.to_date, l.from_date)
  ),
  calc as (
    select
      emp.id as employee_id, emp.company_id,
      att.cin, att.cout, att.mins,
      public.day_off_reason(emp.company_id, emp.id, p_date) as off,
      case
        when att.employee_id is not null and (att.cin is not null or att.st in ('present', 'late', 'half_day'))
          then case
                 when att.st = 'half_day' then 'half_day'
                 when att.late or att.st = 'late' then 'late'
                 else 'present'
               end
        when lv.employee_id is not null then 'on_leave'
        else null
      end as worked_or_leave,
      lv.day_type,
      att.st
    from emp
    left join att on att.employee_id = emp.id
    left join lv  on lv.employee_id  = emp.id
  ),
  final as (
    select employee_id, company_id, cin, cout, mins,
      coalesce(
        worked_or_leave,
        off,
        case when p_final or st = 'absent' then 'absent' else 'pending' end
      ) as status,
      case
        when worked_or_leave is not null and off is not null then 'Worked on ' || replace(off, '_', ' ')
        when worked_or_leave = 'on_leave' and day_type <> 'full_day' then replace(day_type, '_', ' ')
        else null
      end as note
    from calc
  ),
  up as (
    insert into public.attendance_daily_log as t
      (employee_id, work_date, company_id, status, check_in, check_out, work_minutes, note, finalized, updated_at)
    select employee_id, p_date, company_id, status, cin, cout, mins, note, p_final, now()
    from final
    on conflict (employee_id, work_date) do update
      set status       = excluded.status,
          check_in     = excluded.check_in,
          check_out    = excluded.check_out,
          work_minutes = excluded.work_minutes,
          note         = excluded.note,
          finalized    = t.finalized or excluded.finalized,
          updated_at   = now()
    returning 1
  )
  select count(*) into n from up;
  return n;
end $function$
;
grant execute on function refresh_attendance_log(date,boolean,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.refresh_tracking_health_v6()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz;
begin
  for r in
    select l.*, p.tracking_stale_after_minutes, p.full_name
    from public.employee_live_locations l
    join public.profiles p on p.id=l.employee_id
    where l.company_id=public.my_company_id()
      and p.field_tracking_enabled=true
      and l.duty_status='on_duty'
      and (public.is_company_admin() or public.reports_to_me(l.employee_id) or l.employee_id=auth.uid())
      and l.last_seen_at is not null
      and l.tracking_state not in ('stale','off_duty','blocked')
  loop
    v_cutoff := r.last_seen_at + make_interval(mins => greatest(2,coalesce(r.tracking_stale_after_minutes,10)));
    if v_now > v_cutoff then
      update public.employee_live_locations set tracking_state='stale',last_error='No GPS heartbeat received within configured interval',last_state_changed_at=v_cutoff,updated_at=v_now
      where employee_id=r.employee_id;
      insert into public.tracking_events(company_id,visit_id,employee_id,event_type,event_time,server_recorded_at,details,is_inferred,source)
      values(r.company_id,r.visit_id,r.employee_id,'tracking_stale',v_cutoff,v_now,
        jsonb_build_object('last_seen_at',r.last_seen_at,'stale_after_minutes',r.tracking_stale_after_minutes,'time_source','server_derived'),true,'server_health_check');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$
;
grant execute on function refresh_tracking_health_v6() to authenticated;
grant execute on function refresh_tracking_health_v6() to anon;
grant execute on function refresh_tracking_health_v6() to service_role;

CREATE OR REPLACE FUNCTION public.refresh_tracking_health_v7()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer := 0;
  r record;
  v_limit integer;
begin
  for r in
    select p.id, p.company_id, coalesce(p.tracking_stale_after_minutes,10) stale_minutes,
           l.last_seen_at, l.tracking_state
    from public.profiles p
    left join public.employee_live_locations l on l.employee_id=p.id
    where p.company_id=public.my_company_id()
      and p.field_tracking_enabled=true
      and (public.is_company_admin() or p.id=auth.uid() or public.reports_to_me(p.id))
  loop
    if public.is_employee_on_duty_v7(r.id) then
      v_limit := greatest(2,r.stale_minutes);
      if r.last_seen_at is null or r.last_seen_at < clock_timestamp() - make_interval(mins=>v_limit) then
        if coalesce(r.tracking_state,'') <> 'stale' then
          insert into public.employee_live_locations(
            employee_id,company_id,tracking_state,duty_status,last_state_changed_at,updated_at
          ) values(r.id,r.company_id,'stale','on_duty',clock_timestamp(),clock_timestamp())
          on conflict(employee_id) do update set
            tracking_state='stale', duty_status='on_duty',
            last_state_changed_at=clock_timestamp(), updated_at=clock_timestamp();

          insert into public.tracking_events(company_id,employee_id,event_type,event_time,details)
          values(r.company_id,r.id,'location_stale',clock_timestamp(),
                 jsonb_build_object('reason','No GPS received within configured stale threshold',
                                    'threshold_minutes',v_limit,'inferred',true,'timestamp_source','server'));
          v_count := v_count + 1;
        end if;
      end if;
    else
      update public.employee_live_locations
      set duty_status='off_duty', tracking_state='off_duty',
          duty_ended_at=coalesce(duty_ended_at,clock_timestamp()),
          last_state_changed_at=case when tracking_state <> 'off_duty' then clock_timestamp() else last_state_changed_at end,
          updated_at=clock_timestamp()
      where employee_id=r.id and tracking_state <> 'off_duty';
    end if;
  end loop;
  return v_count;
end;
$function$
;
grant execute on function refresh_tracking_health_v7() to authenticated;
grant execute on function refresh_tracking_health_v7() to anon;
grant execute on function refresh_tracking_health_v7() to service_role;

CREATE OR REPLACE FUNCTION public.register_push_device(p_platform text, p_token text, p_subscription jsonb DEFAULT NULL::jsonb, p_user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_platform not in ('android', 'web') then raise exception 'Invalid platform'; end if;
  if coalesce(length(p_token), 0) < 20 then raise exception 'Invalid token'; end if;

  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then raise exception 'No company for this user'; end if;

  insert into public.push_devices (user_id, company_id, platform, token, subscription, user_agent)
  values (auth.uid(), v_company, p_platform, p_token, p_subscription, left(p_user_agent, 300))
  on conflict (token) do update
    set user_id = excluded.user_id,
        company_id = excluded.company_id,
        platform = excluded.platform,
        subscription = excluded.subscription,
        user_agent = excluded.user_agent,
        last_seen_at = now();
end $function$
;
grant execute on function register_push_device(text,text,jsonb,text) to authenticated;
grant execute on function register_push_device(text,text,jsonb,text) to service_role;

CREATE OR REPLACE FUNCTION public.reject_payroll_action(p_action_id uuid)
 RETURNS payroll_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    rec       public.payroll_actions%rowtype;
    v_company uuid;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_company_admin() THEN
        RAISE EXCEPTION 'Admin only';
    END IF;

    v_company := public.my_company_id();

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'No organization context';
    END IF;

    UPDATE public.payroll_actions
    SET
        status     = 'rejected',
        decided_by = auth.uid(),
        decided_at = now()
    WHERE id = p_action_id
      AND company_id = v_company
    RETURNING *
    INTO rec;

    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'Action not found in your organization';
    END IF;

    RETURN rec;

END;
$function$
;
grant execute on function reject_payroll_action(uuid) to authenticated;
grant execute on function reject_payroll_action(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.reports_field_to_me(p_employee uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.profiles p
    where p.id=p_employee
      and p.company_id=public.my_company_id()
      and (p.field_manager_id=auth.uid() or (p.field_manager_id is null and p.manager_id=auth.uid()))
  );
$function$
;
grant execute on function reports_field_to_me(uuid) to authenticated;
grant execute on function reports_field_to_me(uuid) to anon;
grant execute on function reports_field_to_me(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.reports_to_me(p_employee uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = p_employee
      and manager_id = auth.uid()
  );
$function$
;
grant execute on function reports_to_me(uuid) to authenticated;
grant execute on function reports_to_me(uuid) to anon;
grant execute on function reports_to_me(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.reports_work_to_me(p_employee uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.profiles p
    where p.id=p_employee
      and p.company_id=public.my_company_id()
      and (p.work_manager_id=auth.uid() or (p.work_manager_id is null and p.manager_id=auth.uid()))
  );
$function$
;
grant execute on function reports_work_to_me(uuid) to authenticated;
grant execute on function reports_work_to_me(uuid) to anon;
grant execute on function reports_work_to_me(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.reserve_kra_ids(p_count integer)
 RETURNS SETOF text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_prefix  text;
  v_end     integer;
  i         integer;
begin
  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then
    raise exception 'No company context.';
  end if;
  if p_count is null or p_count < 1 then
    return;
  end if;

  update public.companies
     set kra_counter = kra_counter + p_count
   where id = v_company
  returning kra_counter, kra_prefix into v_end, v_prefix;

  for i in (v_end - p_count + 1)..v_end loop
    return next coalesce(v_prefix, 'KRA') || '-' || lpad(i::text, 4, '0');
  end loop;
end;
$function$
;
grant execute on function reserve_kra_ids(integer) to authenticated;
grant execute on function reserve_kra_ids(integer) to anon;
grant execute on function reserve_kra_ids(integer) to service_role;

CREATE OR REPLACE FUNCTION public.route_history_summary_v8(p_employee_id uuid, p_work_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid := public.my_company_id();
  v_start timestamptz;
  v_end timestamptz;
  v_att public.attendance;
  v_distance numeric := 0;
  v_points bigint := 0;
  v_visits_total bigint := 0;
  v_visits_completed bigint := 0;
  v_gaps bigint := 0;
  v_first_gps timestamptz;
  v_last_gps timestamptz;
begin
  if v_company is null then
    raise exception 'No company context';
  end if;

  if not (
    p_employee_id = auth.uid()
    or public.is_company_admin()
    or public.reports_to_me(p_employee_id)
  ) then
    raise exception 'Not allowed';
  end if;

  select *
  into v_att
  from public.attendance
  where company_id = v_company
    and employee_id = p_employee_id
    and work_date = p_work_date
  order by created_at desc
  limit 1;

  v_start := coalesce(
    v_att.check_in,
    (p_work_date::timestamp at time zone 'Asia/Kolkata')
  );

  v_end := coalesce(
    v_att.check_out,
    case
      when p_work_date = (now() at time zone 'Asia/Kolkata')::date then clock_timestamp()
      else ((p_work_date + 1)::timestamp at time zone 'Asia/Kolkata')
    end
  );

  with pts as (
    select h.captured_at,h.latitude,h.longitude,h.accuracy_m,
           lag(h.latitude) over(order by h.captured_at) p_lat,
           lag(h.longitude) over(order by h.captured_at) p_lng,
           lag(h.captured_at) over(order by h.captured_at) p_time
    from public.employee_location_history h
    where h.company_id=v_company
      and h.employee_id=p_employee_id
      and h.captured_at between v_start and v_end
      and (h.accuracy_m is null or h.accuracy_m <= 200)
  ), seg as (
    select *,
      public.geo_distance_km_v7(p_lat,p_lng,latitude,longitude) km,
      greatest(1,extract(epoch from (captured_at-p_time))) seconds
    from pts
  )
  select
    round(coalesce(sum(case
      when p_lat is null then 0
      when km <= 10 and (km*1000/seconds) <= 55 then km
      else 0 end),0)::numeric,2),
    count(*),
    min(captured_at),
    max(captured_at)
  into v_distance,v_points,v_first_gps,v_last_gps
  from seg;

  select count(*), count(*) filter (where status='completed')
  into v_visits_total,v_visits_completed
  from public.field_visits
  where company_id=v_company
    and employee_id=p_employee_id
    and visit_date=p_work_date;

  select count(*)
  into v_gaps
  from public.tracking_events
  where company_id=v_company
    and employee_id=p_employee_id
    and event_time between v_start and v_end
    and event_type in (
      'location_permission_denied',
      'location_timeout',
      'location_unavailable',
      'location_stale'
    );

  return jsonb_build_object(
    'employee_id',p_employee_id,
    'work_date',p_work_date,
    'check_in',v_att.check_in,
    'check_out',v_att.check_out,
    'first_gps',v_first_gps,
    'last_gps',v_last_gps,
    'distance_km',coalesce(v_distance,0),
    'gps_points',coalesce(v_points,0),
    'visits_total',coalesce(v_visits_total,0),
    'visits_completed',coalesce(v_visits_completed,0),
    'gps_gaps',coalesce(v_gaps,0)
  );
end;
$function$
;
grant execute on function route_history_summary_v8(uuid,date) to authenticated;
grant execute on function route_history_summary_v8(uuid,date) to service_role;

CREATE OR REPLACE FUNCTION public.run_auto_attendance()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now      timestamptz := now();
  v_today    date := (v_now at time zone 'Asia/Kolkata')::date;
  v_local    time := (v_now at time zone 'Asia/Kolkata')::time;
  emp        record;
  v_in_ts    timestamptz;
  v_out_ts   timestamptz;
  v_att      public.attendance%rowtype;
  v_processed integer := 0;
begin
  for emp in
    select p.id, p.company_id,
           coalesce(p.auto_in_time, '09:30')  as auto_in_time,
           coalesce(p.auto_out_time, '18:30') as auto_out_time,
           coalesce(c.half_day_minutes, 240)  as half_day_minutes
    from public.profiles p
    join public.companies c on c.id = p.company_id
    where p.status = 'active'
      and p.auto_attendance = true
  loop
    select * into v_att from public.attendance
    where employee_id = emp.id and work_date = v_today;

    -- Auto check-in: past the scheduled time and not checked in yet today
    if v_local >= emp.auto_in_time and (v_att.id is null or v_att.check_in is null) then
      v_in_ts := (v_today::text || ' ' || emp.auto_in_time::text)::timestamp
                   at time zone 'Asia/Kolkata';

      insert into public.attendance
        (company_id, employee_id, work_date, check_in, status, is_late, late_minutes, is_auto)
      values
        (emp.company_id, emp.id, v_today, v_in_ts, 'present', false, 0, true)
      on conflict (employee_id, work_date) do update
        set check_in = coalesce(public.attendance.check_in, excluded.check_in),
            is_auto   = true
      returning * into v_att;

      v_processed := v_processed + 1;
    end if;

    -- Auto check-out: past the scheduled time, checked in, not checked out yet
    if v_local >= emp.auto_out_time and v_att.id is not null
       and v_att.check_in is not null and v_att.check_out is null then
      v_out_ts := (v_today::text || ' ' || emp.auto_out_time::text)::timestamp
                    at time zone 'Asia/Kolkata';

      update public.attendance
      set check_out    = v_out_ts,
          work_minutes = greatest(0, (extract(epoch from (v_out_ts - check_in)) / 60)::integer),
          status       = case
                           when (extract(epoch from (v_out_ts - check_in)) / 60) < emp.half_day_minutes
                           then 'half_day' else 'present'
                         end,
          is_auto      = true
      where id = v_att.id;

      v_processed := v_processed + 1;
    end if;
  end loop;

  return v_processed;
end;
$function$
;
grant execute on function run_auto_attendance() to authenticated;
grant execute on function run_auto_attendance() to anon;
grant execute on function run_auto_attendance() to service_role;

CREATE OR REPLACE FUNCTION public.run_reminders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now    timestamptz := now();
  v_today  date := public.today_ist();
  v_visits int := 0;
  v_tasks  int := 0;
  v_digest int := 0;
  v_over   int := 0;
begin
  -- 1. Visits starting within 30 minutes
  with due as (
    update public.field_visits v
    set reminder_sent_at = v_now
    where v.scheduled_at > v_now
      and v.scheduled_at <= v_now + interval '30 minutes'
      and v.reminder_sent_at is null
      and v.travel_started_at is null
      and coalesce(v.status, '') not in ('completed', 'cancelled', 'rejected', 'missed')
      and public.org_feature_enabled(v.company_id, 'field.visits')
    returning v.company_id, v.employee_id, v.client_name, v.address, v.scheduled_at
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, employee_id,
           'Visit in 30 minutes: ' || coalesce(nullif(client_name, ''), 'Client visit'),
           'Planned for ' || to_char(scheduled_at at time zone 'Asia/Kolkata', 'HH12:MI AM')
             || coalesce(' · ' || nullif(address, ''), '') || '. Tap to start travel.',
           'visit_reminder', '/field-visits'
    from due
    returning 1
  ) select count(*) into v_visits from ins;

  -- 2a. Checklist tasks due within 30 minutes
  with due as (
    update public.checklist_instances i
    set reminder_sent_at = v_now
    from public.checklist_templates t
    where t.id = i.template_id
      and i.completed_at is null
      and i.reminder_sent_at is null
      and i.due_date = v_today
      and i.due_time is not null
      and public.org_feature_enabled(i.company_id, 'tasks.checklist')
      and ((i.due_date + i.due_time::time) at time zone 'Asia/Kolkata') > v_now
      and ((i.due_date + i.due_time::time) at time zone 'Asia/Kolkata') <= v_now + interval '30 minutes'
    returning i.company_id, i.assigned_to, t.title, i.due_time
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, assigned_to, 'Task due soon: ' || title,
           'Due today at ' || to_char(v_today + due_time::time, 'HH12:MI AM') || '.', 'task_reminder', '/tasks'
    from due returning 1
  ) select count(*) into v_tasks from ins;

  -- 2b. Delegations due within 30 minutes
  with due as (
    update public.delegations d
    set reminder_sent_at = v_now
    where d.completed_at is null
      and d.reminder_sent_at is null
      and d.due_date = v_today
      and public.org_feature_enabled(d.company_id, 'tasks.delegation')
      and d.due_time is not null
      and ((d.due_date + d.due_time::time) at time zone 'Asia/Kolkata') > v_now
      and ((d.due_date + d.due_time::time) at time zone 'Asia/Kolkata') <= v_now + interval '30 minutes'
    returning d.company_id, d.assigned_to, d.title, d.due_time
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, assigned_to, 'Task due soon: ' || title,
           'Due today at ' || to_char(v_today + due_time::time, 'HH12:MI AM') || '.', 'task_reminder', '/tasks'
    from due returning 1
  ) select v_tasks + count(*) into v_tasks from ins;

  -- 3. Morning summary, once a day, when the company's working day starts
  --    (not on holidays / weekly offs / approved leave)
  with emp as (
    select p.id, p.company_id
    from public.profiles p
    join public.companies c on c.id = p.company_id
    where coalesce(p.status, 'active') = 'active'
      and (v_now at time zone 'Asia/Kolkata')::time >= coalesce(c.work_start::time, '09:30'::time)
      and (v_now at time zone 'Asia/Kolkata')::time <  coalesce(c.work_start::time, '09:30'::time) + interval '2 hours'
      and public.day_off_reason(p.company_id, p.id, v_today) is null
      and not exists (select 1 from public.daily_digest_log g where g.employee_id = p.id and g.day = v_today)
      and not exists (select 1 from public.leaves l where l.employee_id = p.id and l.status = 'approved'
                      and v_today between l.from_date and coalesce(l.to_date, l.from_date))
  ), counts as (
    select emp.id, emp.company_id,
      (case when public.org_feature_enabled(emp.company_id, 'tasks.checklist') then
        (select count(*) from public.checklist_instances i
          where i.assigned_to = emp.id and i.due_date = v_today and i.completed_at is null) else 0 end)
      + (case when public.org_feature_enabled(emp.company_id, 'tasks.delegation') then
        (select count(*) from public.delegations d
          where d.assigned_to = emp.id and d.due_date <= v_today and d.completed_at is null) else 0 end) as tasks,
      (case when public.org_feature_enabled(emp.company_id, 'field.visits') then
        (select count(*) from public.field_visits v
          where v.employee_id = emp.id and v.visit_date = v_today
            and coalesce(v.status, '') not in ('completed', 'cancelled', 'rejected')) else 0 end) as visits
    from emp
  ), logged as (
    insert into public.daily_digest_log (employee_id, day)
    select id, v_today from counts where tasks + visits > 0
    on conflict do nothing
    returning employee_id
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select c.company_id, c.id, 'Your plan for today',
           case
             when c.tasks > 0 and c.visits > 0 then
               'You have ' || c.tasks || ' open task' || case when c.tasks = 1 then '' else 's' end
               || ' and ' || c.visits || ' visit' || case when c.visits = 1 then '' else 's' end || ' today.'
             when c.tasks > 0 then
               'You have ' || c.tasks || ' open task' || case when c.tasks = 1 then '' else 's' end || ' today.'
             else
               'You have ' || c.visits || ' visit' || case when c.visits = 1 then '' else 's' end || ' planned today.'
           end,
           'daily_digest', case when c.visits > 0 then '/field-visits' else '/tasks' end
    from counts c join logged l on l.employee_id = c.id
    returning 1
  ) select count(*) into v_digest from ins;

  -- 4. Delegation overdue → tell the person who assigned it (once)
  with od as (
    update public.delegations d
    set overdue_notified_at = v_now
    where d.completed_at is null
      and d.overdue_notified_at is null
      and public.org_feature_enabled(d.company_id, 'tasks.delegation')
      and d.assigned_by is not null
      and d.assigned_by <> d.assigned_to
      and ((d.due_date + coalesce(d.due_time::time, '23:59'::time)) at time zone 'Asia/Kolkata') < v_now
      and d.due_date >= v_today - 7
    returning d.company_id, d.assigned_by, d.assigned_to, d.title
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select od.company_id, od.assigned_by, 'Overdue: ' || od.title,
           coalesce(p.full_name, 'The assignee') || ' has not completed this task yet.',
           'task_overdue', '/tasks'
    from od left join public.profiles p on p.id = od.assigned_to
    returning 1
  ) select count(*) into v_over from ins;

  return jsonb_build_object('visits', v_visits, 'tasks', v_tasks, 'digests', v_digest, 'overdue', v_over);
end $function$
;
grant execute on function run_reminders() to service_role;

CREATE OR REPLACE FUNCTION public.set_checklist_done(p_instance uuid, p_done boolean)
 RETURNS checklist_instances
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rec public.checklist_instances%rowtype;
begin
  update public.checklist_instances
  set completed_at = case when p_done then now() else null end
  where id = p_instance
    and ( assigned_to = auth.uid() or public.is_company_admin() )
  returning * into rec;

  return rec;
end;
$function$
;
grant execute on function set_checklist_done(uuid,boolean) to authenticated;
grant execute on function set_checklist_done(uuid,boolean) to anon;
grant execute on function set_checklist_done(uuid,boolean) to service_role;

CREATE OR REPLACE FUNCTION public.set_employee_status(p_employee uuid, p_status text, p_note text DEFAULT ''::text)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    rec       public.profiles%rowtype;
    v_company uuid;
BEGIN

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_company_admin() THEN
        RAISE EXCEPTION 'Admin only';
    END IF;

    v_company := public.my_company_id();

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'No organization context';
    END IF;

    IF p_status NOT IN ('active','disabled','left') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    SELECT *
    INTO rec
    FROM public.profiles
    WHERE id = p_employee
      AND company_id = v_company;

    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'Employee not found in your organization';
    END IF;

    IF rec.role = 'owner'
       AND p_status <> 'active' THEN
        RAISE EXCEPTION 'The owner cannot be disabled';
    END IF;

    UPDATE public.profiles
    SET
        status            = p_status,
        status_note       = coalesce(p_note,''),
        status_changed_at = now()
    WHERE id = p_employee
      AND company_id = v_company
    RETURNING *
    INTO rec;

    RETURN rec;

END;
$function$
;
grant execute on function set_employee_status(uuid,text,text) to authenticated;
grant execute on function set_employee_status(uuid,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.set_employee_tracking_config(p_employee_id uuid, p_enabled boolean, p_employee_type text DEFAULT 'field'::text, p_tracking_mode text DEFAULT 'active_visit'::text, p_interval_minutes integer DEFAULT 5, p_stale_minutes integer DEFAULT 10, p_route_history boolean DEFAULT true)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.profiles;
begin
  if not public.is_company_admin() then
    raise exception 'Only Owner/Admin can change field tracking settings';
  end if;

  update public.profiles
  set field_tracking_enabled = p_enabled,
      employee_type = case when p_employee_type in ('office','sales','field','hybrid') then p_employee_type else 'field' end,
      tracking_mode = case when p_tracking_mode in ('active_visit','working_hours','manual') then p_tracking_mode else 'active_visit' end,
      tracking_interval_minutes = greatest(1, least(60, coalesce(p_interval_minutes,5))),
      tracking_stale_after_minutes = greatest(2, least(120, coalesce(p_stale_minutes,10))),
      route_history_enabled = coalesce(p_route_history,true)
  where id = p_employee_id
    and company_id = public.my_company_id()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Employee not found in your company';
  end if;
  return v_row;
end;
$function$
;
grant execute on function set_employee_tracking_config(uuid,boolean,text,text,integer,integer,boolean) to authenticated;
grant execute on function set_employee_tracking_config(uuid,boolean,text,text,integer,integer,boolean) to service_role;

CREATE OR REPLACE FUNCTION public.set_task_policy_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$
;
grant execute on function set_task_policy_updated_at() to authenticated;
grant execute on function set_task_policy_updated_at() to anon;
grant execute on function set_task_policy_updated_at() to service_role;

CREATE OR REPLACE FUNCTION public.set_ticket_no()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.ticket_no is null then
    select coalesce(max(ticket_no), 0) + 1 into new.ticket_no
    from public.tickets where company_id = new.company_id;
  end if;
  return new;
end;
$function$
;
grant execute on function set_ticket_no() to authenticated;
grant execute on function set_ticket_no() to anon;
grant execute on function set_ticket_no() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_actor()
 RETURNS TABLE(user_id uuid, company_id uuid, role text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.company_id, p.role::text, coalesce(p.status::text, 'active')
  from public.profiles p
  where p.id = auth.uid();
$function$
;
grant execute on function smhrms_actor() to authenticated;
grant execute on function smhrms_actor() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_can_claim_new_company(p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.companies c
    where c.id = p_company
      and (c.owner_id = auth.uid()
           or (c.created_at > now() - interval '15 minutes'
               and not exists (select 1 from public.profiles m where m.company_id = c.id)))
  );
$function$
;
grant execute on function smhrms_can_claim_new_company(uuid) to authenticated;
grant execute on function smhrms_can_claim_new_company(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_changed_keys(o jsonb, n jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(k), '{}')
  from (
    select key as k from jsonb_object_keys(coalesce(n, '{}'::jsonb)) as key
    where (o -> key) is distinct from (n -> key)
  ) x;
$function$
;
grant execute on function smhrms_changed_keys(jsonb,jsonb) to authenticated;
grant execute on function smhrms_changed_keys(jsonb,jsonb) to anon;
grant execute on function smhrms_changed_keys(jsonb,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_employee_managers(p_employee uuid)
 RETURNS TABLE(manager_id uuid, work_manager_id uuid, field_manager_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.manager_id, p.work_manager_id, p.field_manager_id
  from public.profiles p
  where p.id = p_employee
    and p.company_id = (select company_id from public.profiles where id = auth.uid());
$function$
;
grant execute on function smhrms_employee_managers(uuid) to authenticated;
grant execute on function smhrms_employee_managers(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_field_visits_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  lifecycle text[] := array[
    'status','accepted_at','travel_started_at','reached_at','check_in_at',
    'meeting_started_at','completed_at','check_out_at','check_in_lat','check_in_lng',
    'person_met','outcome','completion_notes','created_at'];
  changed text[];
  n jsonb;
  fix jsonb := '{}'::jsonb;
  k text;
begin
  -- Customer Name is mandatory for every new visit (all callers).
  if tg_op = 'INSERT' and nullif(btrim(coalesce(new.client_name, '')), '') is null then
    raise exception 'Customer name is required.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.client_name is distinct from old.client_name
     and nullif(btrim(coalesce(new.client_name, '')), '') is null then
    raise exception 'Customer name is required.' using errcode = '23514';
  end if;

  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  n := to_jsonb(new);

  if tg_op = 'INSERT' then
    -- New visits always start at the beginning of the lifecycle, with a
    -- server timestamp.
    if coalesce(new.status, 'planned') not in ('planned', 'assigned') then
      raise exception 'A new visit must start as Planned or Assigned.' using errcode = '23514';
    end if;
    foreach k in array lifecycle loop
      if k not in ('status', 'created_at') and n ? k and (n ->> k) is not null then
        fix := fix || jsonb_build_object(k, null);
      end if;
    end loop;
    if n ? 'created_at' then
      fix := fix || jsonb_build_object('created_at', now());
    end if;
    if fix <> '{}'::jsonb then
      new := jsonb_populate_record(new, fix);
    end if;
    return new;
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), n);
  if changed && lifecycle then
    raise exception 'This visit cannot be moved to that status from here. Refresh and use the visit buttons.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$
;
grant execute on function smhrms_field_visits_guard() to authenticated;
grant execute on function smhrms_field_visits_guard() to anon;
grant execute on function smhrms_field_visits_guard() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_is_browser_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select current_user in ('authenticated', 'anon');
$function$
;
grant execute on function smhrms_is_browser_role() to authenticated;
grant execute on function smhrms_is_browser_role() to anon;
grant execute on function smhrms_is_browser_role() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_leaves_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  a record;
  emp record;
  changed text[];
  o_to date;
  n_to date;
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  select * into a from public.smhrms_actor();
  if a.user_id is null or a.status <> 'active' then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.company_id is distinct from a.company_id then
      raise exception 'Leave must belong to your organization.' using errcode = '42501';
    end if;
    if new.employee_id is distinct from a.user_id and a.role not in ('owner', 'admin') then
      raise exception 'You can apply leave only for yourself.' using errcode = '42501';
    end if;
    -- Every new request starts pending; decisions come later from an approver.
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;

    n_to := coalesce(new.to_date, new.from_date);
    if n_to < new.from_date then
      raise exception 'Leave end date cannot be before the start date.' using errcode = '23514';
    end if;
    -- No overlapping active requests. Two different half days on the same
    -- date (first_half + second_half) are allowed.
    if exists (
      select 1 from public.leaves l
      where l.employee_id = new.employee_id
        and coalesce(l.status, 'pending') in ('pending', 'approved')
        and daterange(l.from_date, coalesce(l.to_date, l.from_date), '[]')
            && daterange(new.from_date, n_to, '[]')
        and not (
          l.from_date = coalesce(l.to_date, l.from_date)
          and new.from_date = n_to
          and coalesce(l.day_type, '') in ('first_half', 'second_half')
          and coalesce(new.day_type, '') in ('first_half', 'second_half')
          and l.day_type is distinct from new.day_type
        )
    ) then
      raise exception 'You already have a leave request for these dates.' using errcode = '23505';
    end if;
    return new;
  end if;

  -- UPDATE
  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  if 'company_id' = any(changed) or 'employee_id' = any(changed) then
    raise exception 'This leave request cannot be moved.' using errcode = '42501';
  end if;

  if 'status' = any(changed) or 'decided_by' = any(changed) or 'decided_at' = any(changed) then
    select * into emp from public.smhrms_employee_managers(old.employee_id);

    if new.status::text = 'cancelled' and coalesce(old.employee_id = a.user_id, false) then
      null; -- employees may withdraw their own request
    elsif coalesce(a.company_id = old.company_id
          and (a.role in ('owner', 'admin')
               or a.user_id in (emp.manager_id, emp.work_manager_id, emp.field_manager_id)), false) then
      if old.employee_id = a.user_id and a.role not in ('owner', 'admin') then
        raise exception 'You cannot approve your own leave.' using errcode = '42501';
      end if;
    else
      raise exception 'Only an Owner/Admin or the reporting manager can decide this leave.' using errcode = '42501';
    end if;

    -- Decision metadata always comes from the server.
    if new.status::text in ('approved', 'rejected') then
      new.decided_by := a.user_id;
      new.decided_at := now();
    end if;
  end if;

  if 'buddy_status' = any(changed)
     and not coalesce(old.buddy_id = a.user_id or (a.role in ('owner', 'admin') and a.company_id = old.company_id), false) then
    raise exception 'Only the nominated buddy can respond to this request.' using errcode = '42501';
  end if;

  return new;
end;
$function$
;
grant execute on function smhrms_leaves_guard() to authenticated;
grant execute on function smhrms_leaves_guard() to anon;
grant execute on function smhrms_leaves_guard() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_lock_location_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.smhrms_is_browser_role() then
    raise exception 'Recorded location history is immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$
;
grant execute on function smhrms_lock_location_history() to authenticated;
grant execute on function smhrms_lock_location_history() to anon;
grant execute on function smhrms_lock_location_history() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_lock_tracking_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.smhrms_is_browser_role() then
    raise exception 'Recorded tracking events are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$
;
grant execute on function smhrms_lock_tracking_events() to authenticated;
grant execute on function smhrms_lock_tracking_events() to anon;
grant execute on function smhrms_lock_tracking_events() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_lock_visit_created_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  elsif new.created_at is null then
    new.created_at := now();
  end if;

  return new;
end;
$function$
;
grant execute on function smhrms_lock_visit_created_at() to authenticated;
grant execute on function smhrms_lock_visit_created_at() to anon;
grant execute on function smhrms_lock_visit_created_at() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_profiles_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  a record;
  changed text[];
  -- Organization-structure fields only Owner/Admin may set.
  admin_only text[] := array[
    'role','status','left_at','employee_code','manager_id','work_manager_id',
    'field_manager_id','access_permissions','branch_id','department','designation',
    'photo_required','auto_attendance','auto_in_time','auto_out_time',
    'weekly_off_days','joined_on','employee_type'];
  -- Fields of the Owner's record nobody else may touch.
  owner_protected text[] := array['role','status','left_at','email','phone','access_permissions','company_id'];
  -- Fields an Admin may not change on another Admin.
  admin_protected text[] := array['role','status','left_at','email','access_permissions'];
  is_self boolean;
  is_org_admin boolean;
  is_their_manager boolean;
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  select * into a from public.smhrms_actor();
  if a.user_id is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- A browser may only create its own blank profile (normally the signup
    -- trigger does this server-side).
    if new.id is distinct from auth.uid()
       or new.company_id is not null
       or coalesce(new.role::text, 'employee') in ('owner', 'admin', 'manager') then
      raise exception 'You do not have permission to create this profile.' using errcode = '42501';
    end if;
    return new;
  end if;

  if a.status <> 'active' then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  if coalesce(array_length(changed, 1), 0) = 0 then
    return new;
  end if;

  -- coalesce(): a NULL here must mean "no", never "unknown".
  is_self := coalesce(new.id = a.user_id, false);
  is_org_admin := coalesce(a.role in ('owner', 'admin') and a.company_id = old.company_id, false);
  is_their_manager := coalesce(a.company_id = old.company_id
                  and a.user_id in (old.manager_id, old.work_manager_id, old.field_manager_id), false);

  -- Organization membership never changes through a plain UPDATE, except the
  -- very first assignment of a brand-new owner to the company they own
  -- (compatibility with older onboarding code).
  if 'company_id' = any(changed) then
    if not (is_self and old.company_id is null
            and public.smhrms_can_claim_new_company(new.company_id)) then
      raise exception 'Organization membership cannot be changed here.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Login email is managed only by the server (it must match the login account).
  if 'email' = any(changed) then
    raise exception 'Login email can only be changed by an Owner/Admin from Team > Edit.' using errcode = '42501';
  end if;

  -- Ownership never moves through a plain UPDATE.
  if 'role' = any(changed) and (new.role::text = 'owner' or old.role::text = 'owner') then
    raise exception 'Ownership can only be moved with Transfer Ownership.' using errcode = '42501';
  end if;

  -- The Owner's record is protected from everyone but the Owner.
  if old.role::text = 'owner' and not is_self and changed && owner_protected then
    raise exception 'Only the Organization Owner can change these details.' using errcode = '42501';
  end if;

  -- Only the Owner grants or removes Admin.
  if 'role' = any(changed) and (new.role::text = 'admin' or old.role::text = 'admin')
     and a.role <> 'owner' then
    raise exception 'Only the Organization Owner can grant or remove the Admin role.' using errcode = '42501';
  end if;

  -- Admins cannot change another Admin's role/status/access.
  if old.role::text = 'admin' and not is_self and a.role <> 'owner' and changed && admin_protected then
    raise exception 'Only the Organization Owner can change another Admin.' using errcode = '42501';
  end if;

  -- Organization-structure fields: Owner/Admin of the same organization only,
  -- and nobody changes their own role/status/access.
  if changed && admin_only then
    if not is_org_admin then
      raise exception 'Only an Owner/Admin can change these employee settings.' using errcode = '42501';
    end if;
    if is_self and changed && array['role','status','left_at','access_permissions'] then
      raise exception 'You cannot change your own role, status or access.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Personal fields (name, phone, address, bank, emergency contact, photo ...):
  -- the person themself, an Owner/Admin of the organization, or their manager.
  if not (is_self or is_org_admin or is_their_manager) then
    raise exception 'You do not have permission to edit this employee.' using errcode = '42501';
  end if;

  return new;
end;
$function$
;
grant execute on function smhrms_profiles_guard() to authenticated;
grant execute on function smhrms_profiles_guard() to anon;
grant execute on function smhrms_profiles_guard() to service_role;

CREATE OR REPLACE FUNCTION public.smhrms_support_meetings_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  changed text[];
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;
  if coalesce(public.is_platform_admin(), false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.meeting_url := null;
    new.internal_notes := null;
    new.host_user_id := null;
    return new;
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  changed := array(select x from unnest(changed) x where x <> 'updated_at');
  if coalesce(array_length(changed, 1), 0) = 0 then
    return new;
  end if;
  if changed <@ array['status'] and new.status = 'cancelled'
     and old.status in ('requested', 'confirmed', 'rescheduled') then
    return new;
  end if;
  raise exception 'Only SystemMaster support can confirm or change a meeting. You can cancel your request.'
    using errcode = '42501';
end;
$function$
;
grant execute on function smhrms_support_meetings_guard() to authenticated;
grant execute on function smhrms_support_meetings_guard() to anon;
grant execute on function smhrms_support_meetings_guard() to service_role;

CREATE OR REPLACE FUNCTION public.sync_tracking_with_attendance_v6()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_enabled boolean := false;
  v_prev_state text;
begin
  select coalesce(field_tracking_enabled,false) into v_enabled
  from public.profiles where id = new.employee_id;
  if not v_enabled then return new; end if;

  if (tg_op = 'INSERT' and new.check_in is not null)
     or (tg_op = 'UPDATE' and old.check_in is null and new.check_in is not null) then
    insert into public.employee_live_locations(
      employee_id, company_id, duty_status, duty_started_at, duty_ended_at,
      permission_state, tracking_state, app_state, last_state_changed_at, updated_at
    ) values (
      new.employee_id, new.company_id, 'on_duty', new.check_in, null,
      'unknown', 'waiting_gps', 'unknown', v_now, v_now
    )
    on conflict (employee_id) do update set
      company_id = excluded.company_id,
      duty_status = 'on_duty', duty_started_at = new.check_in, duty_ended_at = null,
      tracking_state = case when public.employee_live_locations.tracking_state='off_duty' then 'waiting_gps' else public.employee_live_locations.tracking_state end,
      last_state_changed_at = v_now, updated_at = v_now;

    insert into public.tracking_events(company_id, employee_id, event_type, event_time, server_recorded_at, details, source)
    values (new.company_id, new.employee_id, 'duty_tracking_started', new.check_in, v_now,
      jsonb_build_object('attendance_work_date',new.work_date,'time_source','server'), 'server_attendance');
  end if;

  if (tg_op = 'INSERT' and new.check_out is not null)
     or (tg_op = 'UPDATE' and old.check_out is null and new.check_out is not null) then
    update public.employee_live_locations
      set duty_status='off_duty', duty_ended_at=new.check_out,
          tracking_state='off_duty', app_state='off_duty', last_error=null,
          last_state_changed_at=v_now, updated_at=v_now
    where employee_id=new.employee_id;

    insert into public.tracking_events(company_id, employee_id, event_type, event_time, server_recorded_at, details, source)
    values (new.company_id, new.employee_id, 'duty_tracking_stopped', new.check_out, v_now,
      jsonb_build_object('attendance_work_date',new.work_date,'time_source','server'), 'server_attendance');
  end if;
  return new;
end;
$function$
;
grant execute on function sync_tracking_with_attendance_v6() to authenticated;
grant execute on function sync_tracking_with_attendance_v6() to anon;
grant execute on function sync_tracking_with_attendance_v6() to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_account_list(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_rows jsonb;
  v_total bigint;
begin

  if not (
    coalesce(public.is_platform_admin(), false)
    or coalesce(public.is_system_admin(), false)
  ) then
    raise exception 'Unauthorized';
  end if;

  select count(*)
  into v_total
  from auth.users u
  left join public.profiles p
    on p.id = u.id
  left join public.companies c
    on c.id = p.company_id
  where
    (
      p_search is null
      or p_search = ''
      or coalesce(u.email, '') ilike '%' || p_search || '%'
      or coalesce(p.full_name, '') ilike '%' || p_search || '%'
      or coalesce(p.phone, '') ilike '%' || p_search || '%'
      or coalesce(c.name, '') ilike '%' || p_search || '%'
      or coalesce(c.org_code, '') ilike '%' || p_search || '%'
    )
    and
    (
      p_status is null
      or p_status = ''
      or (
        p_status = 'orphan'
        and (
          p.id is null
          or p.company_id is null
        )
      )
      or (
        p_status = 'incomplete'
        and p.company_id is not null
        and c.onboarding_completed_at is null
      )
      or (
        p_status = 'active'
        and p.company_id is not null
        and c.onboarding_completed_at is not null
        and coalesce(c.account_status, 'active') = 'active'
      )
      or (
        p_status = 'suspended'
        and p.company_id is not null
        and c.account_status = 'suspended'
      )
    );

  select coalesce(jsonb_agg(x), '[]'::jsonb)
  into v_rows
  from (
    select
      u.id as user_id,

      u.email,

      p.full_name,
      p.phone,
      p.role,

      p.company_id,

      c.name as company_name,
      c.org_code,
      c.account_status,
      c.onboarding_completed_at,

      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,

      case
        when p.id is null then 'orphan'
        when p.company_id is null then 'orphan'
        when c.id is null then 'orphan'
        when c.onboarding_completed_at is null then 'incomplete'
        when c.account_status = 'suspended' then 'suspended'
        else 'active'
      end as account_state,

      case
        when p.id is null then
          'Auth account exists but profile is missing'

        when p.company_id is null then
          'Profile exists but organization is not assigned'

        when c.id is null then
          'Profile references a missing organization'

        when c.onboarding_completed_at is null then
          'Organization onboarding is incomplete'

        when c.account_status = 'suspended' then
          'Organization is suspended'

        else
          'Account is active'
      end as state_reason

    from auth.users u

    left join public.profiles p
      on p.id = u.id

    left join public.companies c
      on c.id = p.company_id

    where
      (
        p_search is null
        or p_search = ''
        or coalesce(u.email, '') ilike '%' || p_search || '%'
        or coalesce(p.full_name, '') ilike '%' || p_search || '%'
        or coalesce(p.phone, '') ilike '%' || p_search || '%'
        or coalesce(c.name, '') ilike '%' || p_search || '%'
        or coalesce(c.org_code, '') ilike '%' || p_search || '%'
      )

      and
      (
        p_status is null
        or p_status = ''

        or (
          p_status = 'orphan'
          and (
            p.id is null
            or p.company_id is null
          )
        )

        or (
          p_status = 'incomplete'
          and p.company_id is not null
          and c.onboarding_completed_at is null
        )

        or (
          p_status = 'active'
          and p.company_id is not null
          and c.onboarding_completed_at is not null
          and coalesce(c.account_status, 'active') = 'active'
        )

        or (
          p_status = 'suspended'
          and p.company_id is not null
          and c.account_status = 'suspended'
        )
      )

    order by u.created_at desc

    limit greatest(1, least(coalesce(p_limit, 50), 200))
    offset greatest(coalesce(p_offset, 0), 0)

  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );

end;
$function$
;
grant execute on function system_admin_account_list(text,text,integer,integer) to authenticated;
grant execute on function system_admin_account_list(text,text,integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_audit(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_total int; v_rows jsonb; q text := nullif(trim(p_search), '');
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;
  select count(*) into v_total
  from public.audit_logs a left join public.companies c on c.id = a.company_id
  where q is null or c.org_code ilike '%' || q || '%' or c.name ilike '%' || q || '%'
        or a.action ilike '%' || q || '%' or a.entity_key ilike '%' || q || '%' or a.actor_label ilike '%' || q || '%';

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rows from (
    select a.created_at, a.actor_label, a.action, a.entity, a.entity_key, a.old_value, a.new_value,
           c.org_code, c.name as org_name
    from public.audit_logs a left join public.companies c on c.id = a.company_id
    where q is null or c.org_code ilike '%' || q || '%' or c.name ilike '%' || q || '%'
          or a.action ilike '%' || q || '%' or a.entity_key ilike '%' || q || '%' or a.actor_label ilike '%' || q || '%'
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $function$
;
grant execute on function system_admin_audit(text,integer,integer) to authenticated;
grant execute on function system_admin_audit(text,integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_billing_list(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allowed boolean := false;
  v_result jsonb;
begin

  begin
    select public.is_platform_admin()
    into v_allowed;
  exception when others then
    v_allowed := false;
  end;

  if not coalesce(v_allowed, false) then
    begin
      select public.is_system_admin()
      into v_allowed;
    exception when others then
      v_allowed := false;
    end;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Not authorized';
  end if;

  with base as (

    select
      c.id as company_id,
      c.org_code,
      c.name,
      c.email,

      cs.plan_code,
      cs.status,
      cs.licensed_users,
      cs.custom_price_per_user,
      cs.discount_percent,
      cs.billing_cycle,

      cs.current_period_start,
      cs.current_period_end,
      cs.trial_ends_at,
      cs.next_billing_at,
      cs.last_payment_at,
      cs.last_payment_status,
      cs.billing_email,

      cs.razorpay_customer_id,
      cs.razorpay_subscription_id,
      cs.razorpay_plan_id,

      (
        select coalesce(
          sum(bp.amount_paid),
          0
        )
        from public.billing_payments bp
        where bp.company_id = c.id
        and bp.status in (
          'paid',
          'captured'
        )
      ) as total_paid,

      (
        select coalesce(
          sum(bp.amount_due),
          0
        )
        from public.billing_payments bp
        where bp.company_id = c.id
        and bp.status in (
          'pending',
          'created',
          'authorized',
          'failed'
        )
      ) as total_due,

      (
        select max(bp.paid_at)
        from public.billing_payments bp
        where bp.company_id = c.id
        and bp.status in (
          'paid',
          'captured'
        )
      ) as latest_paid_at

    from public.companies c

    left join
      public.company_subscriptions cs
      on cs.company_id = c.id

    where
      (
        p_search is null
        or trim(p_search) = ''
        or c.name ilike
          '%' || p_search || '%'
        or coalesce(
          c.org_code,
          ''
        ) ilike
          '%' || p_search || '%'
        or coalesce(
          c.email,
          ''
        ) ilike
          '%' || p_search || '%'
      )

      and (
        p_status is null
        or trim(p_status) = ''
        or cs.status = p_status
      )
  ),

  counted as (
    select count(*) as total
    from base
  ),

  paged as (
    select *
    from base
    order by name asc
    limit greatest(
      1,
      least(
        coalesce(
          p_limit,
          50
        ),
        200
      )
    )
    offset greatest(
      coalesce(
        p_offset,
        0
      ),
      0
    )
  )

  select jsonb_build_object(
    'total',
    (
      select total
      from counted
    ),

    'rows',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(paged)
        )
        from paged
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$function$
;
grant execute on function system_admin_billing_list(text,text,integer,integer) to authenticated;
grant execute on function system_admin_billing_list(text,text,integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_billing_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allowed boolean := false;
  v_result jsonb;
begin

  begin
    select public.is_platform_admin()
    into v_allowed;
  exception when others then
    v_allowed := false;
  end;

  if not coalesce(v_allowed, false) then
    begin
      select public.is_system_admin()
      into v_allowed;
    exception when others then
      v_allowed := false;
    end;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(

    'total_organizations',
    (
      select count(*)
      from public.companies
    ),

    'paid_organizations',
    (
      select count(*)
      from public.company_subscriptions
      where status = 'active'
        and plan_code not in ('free', 'trial')
    ),

    'trial_organizations',
    (
      select count(*)
      from public.company_subscriptions
      where status = 'trial'
    ),

    'past_due_organizations',
    (
      select count(*)
      from public.company_subscriptions
      where status = 'past_due'
    ),

    'expiring_10_days',
    (
      select count(*)
      from public.company_subscriptions
      where coalesce(
        current_period_end,
        trial_ends_at
      ) between now()
        and now() + interval '10 days'
    ),

    'received_total',
    (
      select coalesce(
        sum(amount_paid),
        0
      )
      from public.billing_payments
      where status in (
        'paid',
        'captured'
      )
    ),

    'outstanding_total',
    (
      select coalesce(
        sum(amount_due),
        0
      )
      from public.billing_payments
      where status in (
        'pending',
        'created',
        'authorized',
        'failed'
      )
    ),

    'payments_30d',
    (
      select coalesce(
        sum(amount_paid),
        0
      )
      from public.billing_payments
      where status in (
        'paid',
        'captured'
      )
      and paid_at >=
        now() - interval '30 days'
    )

  )
  into v_result;

  return v_result;
end;
$function$
;
grant execute on function system_admin_billing_overview() to authenticated;
grant execute on function system_admin_billing_overview() to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_clients()
 RETURNS TABLE(company_id uuid, company_name text, plan_code text, status text, licensed_users integer, active_users bigint, price_per_user integer, monthly_value numeric, current_period_end timestamp with time zone, trial_ends_at timestamp with time zone, cancel_at_period_end boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id,
    c.name,
    s.plan_code,
    s.status,
    s.licensed_users,
    (select count(*) from public.profiles p where p.company_id=c.id),
    coalesce(s.custom_price_per_user,sp.price_per_user),
    round(
      coalesce(s.custom_price_per_user,sp.price_per_user,0)
      * greatest(1,s.licensed_users)
      * (1-(coalesce(s.discount_percent,0)/100.0))
    ,2),
    s.current_period_end,
    s.trial_ends_at,
    s.cancel_at_period_end
  from public.companies c
  join public.company_subscriptions s on s.company_id=c.id
  join public.subscription_plans sp on sp.code=s.plan_code
  where public.is_system_admin()
  order by c.created_at desc;
$function$
;
grant execute on function system_admin_clients() to authenticated;
grant execute on function system_admin_clients() to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_decide_module_request(p_request uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.organization_module_requests;
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can decide module requests';
  end if;
  select * into r from public.organization_module_requests where id = p_request;
  if r.id is null or r.status <> 'pending' then
    raise exception 'Request not found or already decided';
  end if;
  if p_approve then
    perform public.system_admin_set_feature(r.company_id, r.feature_key, true,
                                            coalesce(p_note, 'Module request approved'));
  else
    update public.organization_module_requests
    set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_request;
  end if;
end $function$
;
grant execute on function system_admin_decide_module_request(uuid,boolean,text) to authenticated;
grant execute on function system_admin_decide_module_request(uuid,boolean,text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_module_requests(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id, 'company_id', r.company_id, 'org_code', c.org_code, 'org_name', c.name,
             'feature_key', r.feature_key, 'feature_name', f.name, 'status', r.status, 'note', r.note,
             'requested_at', r.requested_at, 'decided_at', r.decided_at, 'decision_note', r.decision_note,
             'requested_by', (select full_name from public.profiles where id = r.requested_by))
           order by r.requested_at desc), '[]'::jsonb)
    from public.organization_module_requests r
    join public.companies c on c.id = r.company_id
    join public.features f on f.key = r.feature_key
    where p_status is null or p_status = '' or r.status = p_status
    limit 500);
end $function$
;
grant execute on function system_admin_module_requests(text) to authenticated;
grant execute on function system_admin_module_requests(text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_org_detail(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare c public.companies; v_plan text;
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;
  select * into c from public.companies where id = p_company;
  if c.id is null then raise exception 'Organization not found'; end if;
  v_plan := public.org_plan_code(p_company);

  return jsonb_build_object(
    'organization', to_jsonb(c) - 'gsheet_secret' - 'gsheet_webhook_url',
    'billing', public.org_billing_class(p_company),
    'subscription', public.org_subscription_json(p_company),
    'ads_effective', public.org_ads_enabled(p_company),
    'last_activity', public.org_last_activity(p_company),
    'admin', (select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone)
              from public.profiles p where p.company_id = p_company and p.role = 'owner'
              order by p.created_at nulls last limit 1),
    'counts', jsonb_build_object(
      'employees', (select count(*) from public.profiles where company_id = p_company
                      and coalesce(status, 'active') not in ('left', 'disabled')),
      'admins',    (select count(*) from public.profiles where company_id = p_company and role in ('owner', 'admin')),
      'field_tracked', (select count(*) from public.profiles where company_id = p_company
                          and coalesce((to_jsonb(profiles)->>'field_tracking_enabled')::boolean, false))),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', f.key, 'parent', f.parent_key, 'name', f.name, 'availability', f.availability,
               'effective', public.org_feature_enabled(p_company, f.key),
               'override', o.enabled, 'source', o.source, 'reason', o.reason, 'updated_at', o.updated_at,
               'by_plan', public.org_feature_enabled_self(p_company, f.key, v_plan) and o.company_id is null)
             order by f.sort_order), '[]'::jsonb)
      from public.features f
      left join public.organization_feature_overrides o on o.company_id = p_company and o.feature_key = f.key),
    'requests', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.requested_at desc), '[]'::jsonb)
      from (select * from public.organization_module_requests where company_id = p_company
            order by requested_at desc limit 20) r),
    'audit', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
      from (select created_at, actor_label, action, entity, entity_key, old_value, new_value
            from public.audit_logs where company_id = p_company order by created_at desc limit 30) a)
  );
end $function$
;
grant execute on function system_admin_org_detail(uuid) to authenticated;
grant execute on function system_admin_org_detail(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_org_list(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_billing text DEFAULT NULL::text, p_ads text DEFAULT NULL::text, p_module text DEFAULT NULL::text, p_sort text DEFAULT 'created_at'::text, p_dir text DEFAULT 'desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_total int;
  v_rows  jsonb;
  v_sort  text := case p_sort
                    when 'name' then 'name' when 'org_code' then 'org_code'
                    when 'employees' then 'employees' when 'last_activity' then 'last_activity'
                    when 'plan_end' then 'plan_end' else 'created_at' end;
  v_dir   text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;

  execute format($q$
    with base as (
      select c.id, c.org_code, c.name, c.account_status, c.created_at, c.phone, c.email, c.city,
             c.ads_enabled as ads_override,
             public.org_ads_enabled(c.id) as ads,
             public.org_billing_class(c.id) as billing,
             public.org_subscription_json(c.id) as sub,
             (select count(*) from public.profiles p where p.company_id = c.id
                and coalesce(p.status, 'active') not in ('left', 'disabled')) as employees,
             public.org_last_activity(c.id) as last_activity,
             (select jsonb_build_object('name', p.full_name, 'email', p.email, 'phone', p.phone)
                from public.profiles p where p.company_id = c.id and p.role = 'owner'
                order by p.created_at nulls last limit 1) as admin,
             (select count(*) from public.organization_module_requests r
                where r.company_id = c.id and r.status = 'pending') as pending_requests
      from public.companies c
      where ($1 is null or c.name ilike '%%' || $1 || '%%' or c.org_code ilike '%%' || $1 || '%%'
             or c.phone ilike '%%' || $1 || '%%' or c.email ilike '%%' || $1 || '%%'
             or exists (select 1 from public.profiles p where p.company_id = c.id and p.role = 'owner'
                        and (p.full_name ilike '%%' || $1 || '%%' or p.email ilike '%%' || $1 || '%%')))
        and ($2 is null or c.account_status = $2)
    ), filtered as (
      select b.*,
             coalesce(nullif(b.sub->>'current_period_end', ''), nullif(b.sub->>'trial_ends_at', ''))::timestamptz as plan_end,
             nullif(b.sub->>'current_period_start', '')::timestamptz as plan_start
      from base b
      where ($3 is null or b.billing = $3)
        and ($4 is null or ($4 = 'on' and b.ads) or ($4 = 'off' and not b.ads))
        and ($5 is null or public.org_feature_enabled(b.id, $5))
    )
    select (select count(*) from filtered),
           (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) from (
              select f.id, f.org_code, f.name, f.account_status, f.created_at, f.phone, f.email, f.city,
                     f.admin, f.billing, f.sub->>'plan_code' as plan_code, f.sub->>'status' as sub_status,
                     f.plan_start, f.plan_end, f.employees, f.ads, f.ads_override, f.last_activity,
                     f.pending_requests,
                     (select coalesce(jsonb_agg(ft.key order by ft.sort_order), '[]'::jsonb)
                        from public.features ft where ft.parent_key is null
                          and public.org_feature_enabled(f.id, ft.key)) as modules
              from filtered f
              order by %I %s nulls last, f.id
              limit $6 offset $7) x)
  $q$, v_sort, v_dir)
  into v_total, v_rows
  using nullif(trim(p_search), ''), nullif(p_status, ''), nullif(p_billing, ''), nullif(p_ads, ''),
        nullif(p_module, ''), least(greatest(coalesce(p_limit, 25), 1), 200), greatest(coalesce(p_offset, 0), 0);

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $function$
;
grant execute on function system_admin_org_list(text,text,text,text,text,text,text,integer,integer) to authenticated;
grant execute on function system_admin_org_list(text,text,text,text,text,text,text,integer,integer) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  r jsonb;
  v_active_users int := null;
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;

  begin
    execute $q$select count(*) from auth.users u join public.profiles p on p.id = u.id
               where p.company_id is not null and u.last_sign_in_at > now() - interval '30 days'$q$
      into v_active_users;
  exception when others then v_active_users := null;
  end;

  with orgs as (
    select c.id, c.created_at, c.account_status,
           public.org_billing_class(c.id) as billing,
           public.org_ads_enabled(c.id) as ads
    from public.companies c
  )
  select jsonb_build_object(
    'organizations',       (select count(*) from orgs),
    'active',              (select count(*) from orgs where account_status = 'active'),
    'suspended',           (select count(*) from orgs where account_status = 'suspended'),
    'free',                (select count(*) from orgs where billing = 'free'),
    'trial',               (select count(*) from orgs where billing = 'trial'),
    'paid',                (select count(*) from orgs where billing = 'paid'),
    'ads_on',              (select count(*) from orgs where ads),
    'ad_free',             (select count(*) from orgs where not ads),
    'employees',           (select count(*) from public.profiles where company_id is not null
                              and coalesce(status, 'active') not in ('left', 'disabled')),
    'active_users_30d',    v_active_users,
    'new_7d',              (select count(*) from orgs where created_at > now() - interval '7 days'),
    'new_30d',             (select count(*) from orgs where created_at > now() - interval '30 days'),
    'pending_requests',    (select count(*) from public.organization_module_requests where status = 'pending'),
    'registrations_by_month', (
       select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon YY'), 'count', n) order by m), '[]'::jsonb)
       from (
         select gs as m,
                (select count(*) from orgs o
                 where date_trunc('month', o.created_at at time zone 'Asia/Kolkata') = gs) as n
         from generate_series(date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '5 months',
                              date_trunc('month', now() at time zone 'Asia/Kolkata'), interval '1 month') gs
       ) t),
    'module_adoption', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'key', f.key, 'name', f.name, 'parent', f.parent_key, 'availability', f.availability,
                'organizations', (select count(*) from orgs o where public.org_feature_enabled(o.id, f.key)))
              order by f.sort_order), '[]'::jsonb)
       from public.features f)
  ) into r;
  return r;
end $function$
;
grant execute on function system_admin_overview() to authenticated;
grant execute on function system_admin_overview() to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_payment_history(p_company_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allowed boolean := false;
  v_result jsonb;
begin

  begin
    select public.is_platform_admin()
    into v_allowed;
  exception when others then
    v_allowed := false;
  end;

  if not coalesce(v_allowed, false) then
    begin
      select public.is_system_admin()
      into v_allowed;
    exception when others then
      v_allowed := false;
    end;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Not authorized';
  end if;

  select coalesce(
    jsonb_agg(
      x.row_json
      order by x.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      bp.created_at,
      to_jsonb(bp)
      ||
      jsonb_build_object(
        'company_name',
        c.name,
        'org_code',
        c.org_code
      ) as row_json

    from public.billing_payments bp

    join public.companies c
      on c.id =
        bp.company_id

    where
      p_company_id is null
      or bp.company_id =
        p_company_id

    order by
      bp.created_at desc

    limit greatest(
      1,
      least(
        coalesce(
          p_limit,
          100
        ),
        500
      )
    )
  ) x;

  return v_result;
end;
$function$
;
grant execute on function system_admin_payment_history(uuid,integer) to authenticated;
grant execute on function system_admin_payment_history(uuid,integer) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_permanently_delete_organization(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_name text;
  v_org_code text;
  v_user_ids uuid[];
  v_deleted_profiles integer := 0;
begin
  /*
   * This function must never be callable directly by normal
   * authenticated users. It will be called only from the
   * server using the Supabase service role.
   */

  select
    name,
    org_code
  into
    v_company_name,
    v_org_code
  from public.companies
  where id = p_company_id
  for update;

  if not found then
    raise exception 'Organization not found';
  end if;

  /*
   * Capture all users belonging to the organization before
   * deleting anything.
   */
  select coalesce(
    array_agg(id),
    array[]::uuid[]
  )
  into v_user_ids
  from public.profiles
  where company_id = p_company_id;

  /*
   * Two profile references in the current schema use
   * NO ACTION rather than CASCADE/SET NULL.
   *
   * Clear them before deleting company profiles.
   */

  update public.leaves
  set decided_by = null
  where decided_by = any(v_user_ids);

  update public.task_extensions
  set decided_by = null
  where decided_by = any(v_user_ids);

  /*
   * Delete the organization.
   *
   * Existing FK CASCADE rules remove company-scoped rows,
   * including profiles and other tenant data.
   *
   * Audit rows configured as SET NULL remain as historical
   * records without the deleted company reference.
   */
  delete from public.companies
  where id = p_company_id;

  if not found then
    raise exception 'Organization deletion failed';
  end if;

  v_deleted_profiles :=
    coalesce(array_length(v_user_ids, 1), 0);

  return jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'company_name', v_company_name,
    'org_code', v_org_code,
    'auth_user_ids', to_jsonb(v_user_ids),
    'profile_count', v_deleted_profiles
  );
end;
$function$
;
grant execute on function system_admin_permanently_delete_organization(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_set_ads(p_company uuid, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can change ads settings';
  end if;
  update public.companies set ads_enabled = p_enabled where id = p_company;  -- null = follow plan
end $function$
;
grant execute on function system_admin_set_ads(uuid,boolean) to authenticated;
grant execute on function system_admin_set_ads(uuid,boolean) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_set_feature(p_company uuid, p_key text, p_enabled boolean, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can change organization features';
  end if;
  if not exists (select 1 from public.features where key = p_key) then
    raise exception 'Unknown feature: %', p_key;
  end if;
  if p_enabled is null then
    delete from public.organization_feature_overrides where company_id = p_company and feature_key = p_key;
  else
    insert into public.organization_feature_overrides (company_id, feature_key, enabled, reason, updated_by, updated_at, source)
    values (p_company, p_key, p_enabled, p_reason, auth.uid(), now(), 'platform')
    on conflict (company_id, feature_key) do update
      set enabled = excluded.enabled, reason = excluded.reason,
          updated_by = excluded.updated_by, updated_at = now(), source = 'platform';
  end if;
  -- An approval closes any open request for the same module
  if p_enabled is true then
    update public.organization_module_requests
    set status = 'approved', decided_by = auth.uid(), decided_at = now(),
        decision_note = coalesce(p_reason, decision_note)
    where company_id = p_company and feature_key = p_key and status = 'pending';
  end if;
end $function$
;
grant execute on function system_admin_set_feature(uuid,text,boolean,text) to authenticated;
grant execute on function system_admin_set_feature(uuid,text,boolean,text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_set_feature_availability(p_key text, p_availability text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_old text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can change feature availability';
  end if;
  select availability into v_old from public.features where key = p_key;
  update public.features set availability = p_availability, updated_at = now() where key = p_key;
  perform public.write_audit(null, 'feature_availability_changed', 'feature', p_key,
                             jsonb_build_object('availability', v_old),
                             jsonb_build_object('availability', p_availability));
end $function$
;
grant execute on function system_admin_set_feature_availability(text,text) to authenticated;
grant execute on function system_admin_set_feature_availability(text,text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_set_org_status(p_company uuid, p_status text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can suspend or activate organizations';
  end if;
  update public.companies
  set account_status = p_status,
      suspended_reason = case when p_status = 'suspended' then p_reason else null end
  where id = p_company;
end $function$
;
grant execute on function system_admin_set_org_status(uuid,text,text) to authenticated;
grant execute on function system_admin_set_org_status(uuid,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_support_meetings(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, company_id uuid, org_name text, org_code text, ticket_id uuid, ticket_no bigint, title text, description text, starts_at timestamp with time zone, ends_at timestamp with time zone, timezone text, status text, provider text, meeting_url text, attendee_name text, attendee_email text, requested_by uuid, requested_by_name text, host_user_id uuid, internal_notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

    if not public.is_system_admin() then
        raise exception 'System admin access required';
    end if;

    return query

    select
        m.id::uuid,
        m.company_id::uuid,

        c.name::text,
        c.org_code::text,

        m.ticket_id::uuid,
        t.ticket_no::bigint,

        m.title::text,
        m.description::text,

        m.starts_at::timestamptz,
        m.ends_at::timestamptz,
        m.timezone::text,

        m.status::text,
        m.provider::text,

        m.meeting_url::text,

        m.attendee_name::text,
        m.attendee_email::text,

        m.requested_by::uuid,
        p.full_name::text,

        m.host_user_id::uuid,

        m.internal_notes::text

    from public.support_meetings m

    join public.companies c
        on c.id = m.company_id

    left join public.tickets t
        on t.id = m.ticket_id

    left join public.profiles p
        on p.id = m.requested_by

    where
        p_status is null
        or p_status = ''
        or m.status::text = p_status

    order by
        m.starts_at asc;

end;
$function$
;
grant execute on function system_admin_support_meetings(text) to authenticated;
grant execute on function system_admin_support_meetings(text) to anon;
grant execute on function system_admin_support_meetings(text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_support_tickets(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, ticket_no bigint, company_id uuid, org_name text, org_code text, subject text, description text, category text, priority text, status text, raised_by uuid, raised_by_name text, raised_by_email text, assigned_to uuid, source text, ai_summary text, meeting_required boolean, plan text, target_date date, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

    if not public.is_system_admin() then
        raise exception 'System admin access required';
    end if;

    return query

    select
        t.id::uuid,
        t.ticket_no::bigint,
        t.company_id::uuid,

        c.name::text,
        c.org_code::text,

        t.subject::text,
        t.description::text,
        t.category::text,
        t.priority::text,
        t.status::text,

        t.raised_by::uuid,
        p.full_name::text,
        p.email::text,

        t.assigned_to::uuid,

        t.source::text,
        t.ai_summary::text,
        t.meeting_required::boolean,

        t.plan::text,
        t.target_date::date,

        t.created_at::timestamptz,
        t.updated_at::timestamptz

    from public.tickets t

    join public.companies c
        on c.id = t.company_id

    left join public.profiles p
        on p.id = t.raised_by

    where
        p_status is null
        or p_status = ''
        or t.status::text = p_status

    order by
        case
            when t.priority::text = 'urgent' then 0
            when t.priority::text = 'high' then 1
            else 2
        end,
        t.created_at desc;

end;
$function$
;
grant execute on function system_admin_support_tickets(text) to authenticated;
grant execute on function system_admin_support_tickets(text) to anon;
grant execute on function system_admin_support_tickets(text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_update_subscription(p_company_id uuid, p_plan_code text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_licensed_users integer DEFAULT NULL::integer, p_custom_price_per_user integer DEFAULT NULL::integer, p_discount_percent numeric DEFAULT NULL::numeric, p_extend_days integer DEFAULT NULL::integer, p_cancel_at_period_end boolean DEFAULT NULL::boolean, p_notes text DEFAULT NULL::text)
 RETURNS company_subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old public.company_subscriptions;
  v_new public.company_subscriptions;
begin
  if not public.is_system_admin() then
    raise exception 'SystemMaster Super Admin access required';
  end if;

  select * into v_old from public.company_subscriptions where company_id=p_company_id;
  if v_old.company_id is null then raise exception 'Subscription not found'; end if;

  update public.company_subscriptions
  set
    plan_code=coalesce(p_plan_code,plan_code),
    status=coalesce(p_status,status),
    licensed_users=greatest(1,coalesce(p_licensed_users,licensed_users)),
    custom_price_per_user=case when p_custom_price_per_user is null then custom_price_per_user else p_custom_price_per_user end,
    discount_percent=greatest(0,least(100,coalesce(p_discount_percent,discount_percent))),
    current_period_end=case
      when p_extend_days is not null then coalesce(current_period_end,clock_timestamp()) + make_interval(days=>p_extend_days)
      else current_period_end end,
    cancel_at_period_end=coalesce(p_cancel_at_period_end,cancel_at_period_end),
    cancelled_at=case when coalesce(p_status,status)='cancelled' then clock_timestamp() else cancelled_at end,
    notes=coalesce(p_notes,notes),
    updated_at=clock_timestamp()
  where company_id=p_company_id
  returning * into v_new;

  insert into public.subscription_events(company_id,event_type,old_plan,new_plan,actor_user_id,details)
  values(
    p_company_id,'system_admin_subscription_update',v_old.plan_code,v_new.plan_code,auth.uid(),
    jsonb_build_object(
      'old_status',v_old.status,'new_status',v_new.status,
      'licensed_users',v_new.licensed_users,
      'custom_price_per_user',v_new.custom_price_per_user,
      'discount_percent',v_new.discount_percent,
      'extend_days',p_extend_days,
      'cancel_at_period_end',v_new.cancel_at_period_end,
      'timestamp_source','server'
    )
  );
  return v_new;
end;
$function$
;
grant execute on function system_admin_update_subscription(uuid,text,text,integer,integer,numeric,integer,boolean,text) to authenticated;
grant execute on function system_admin_update_subscription(uuid,text,text,integer,integer,numeric,integer,boolean,text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_update_support_meeting(p_meeting uuid, p_status text DEFAULT NULL::text, p_meeting_url text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  if not public.is_system_admin() then
    raise exception 'System admin access required';
  end if;

  update public.support_meetings
  set
    status = coalesce(p_status, status),
    meeting_url = coalesce(p_meeting_url, meeting_url),
    internal_notes = coalesce(p_notes, internal_notes),
    updated_at = now()

  where id = p_meeting;

end;
$function$
;
grant execute on function system_admin_update_support_meeting(uuid,text,text,text) to authenticated;
grant execute on function system_admin_update_support_meeting(uuid,text,text,text) to anon;
grant execute on function system_admin_update_support_meeting(uuid,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.system_admin_update_support_ticket(p_ticket uuid, p_status text DEFAULT NULL::text, p_priority text DEFAULT NULL::text, p_plan text DEFAULT NULL::text, p_target_date date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  if not public.is_system_admin() then
    raise exception 'System admin access required';
  end if;

  update public.tickets
  set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    plan = coalesce(p_plan, plan),
    target_date = coalesce(p_target_date, target_date),

    resolved_at =
      case
        when p_status = 'resolved'
          then now()
        when p_status is not null
          and p_status <> 'resolved'
          then null
        else resolved_at
      end,

    updated_at = now()

  where id = p_ticket;

end;
$function$
;
grant execute on function system_admin_update_support_ticket(uuid,text,text,text,date) to authenticated;
grant execute on function system_admin_update_support_ticket(uuid,text,text,text,date) to anon;
grant execute on function system_admin_update_support_ticket(uuid,text,text,text,date) to service_role;

CREATE OR REPLACE FUNCTION public.task_user_stats(p_from date, p_to date)
 RETURNS TABLE(user_id uuid, full_name text, department text, unique_checklists integer, checklist_due integer, checklist_done integer, checklist_pending integer, delegation_total integer, delegation_done integer, delegation_pending integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_company uuid;
begin
  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then
    return;
  end if;

  return query
  with tmpl as (
    select ct.assigned_to as uid, count(*)::integer as n
    from public.checklist_templates ct
    where ct.company_id = v_company and ct.active
    group by ct.assigned_to
  ),
  inst as (
    select ci.assigned_to as uid,
           count(*)::integer as due,
           count(*) filter (where ci.completed_at is not null)::integer as done
    from public.checklist_instances ci
    where ci.company_id = v_company
      and ci.due_date between p_from and p_to
    group by ci.assigned_to
  ),
  dele as (
    select d.assigned_to as uid,
           count(*)::integer as total,
           count(*) filter (where d.completed_at is not null)::integer as done
    from public.delegations d
    where d.company_id = v_company
      and d.due_date between p_from and p_to
    group by d.assigned_to
  )
  select
    p.id,
    p.full_name,
    coalesce(p.department, '—'),
    coalesce(t.n, 0),
    coalesce(i.due, 0),
    coalesce(i.done, 0),
    coalesce(i.due, 0) - coalesce(i.done, 0),
    coalesce(dl.total, 0),
    coalesce(dl.done, 0),
    coalesce(dl.total, 0) - coalesce(dl.done, 0)
  from public.profiles p
  left join tmpl t  on t.uid  = p.id
  left join inst i  on i.uid  = p.id
  left join dele dl on dl.uid = p.id
  where p.company_id = v_company
    and p.status = 'active'
  order by p.full_name;
end;
$function$
;
grant execute on function task_user_stats(date,date) to authenticated;
grant execute on function task_user_stats(date,date) to anon;
grant execute on function task_user_stats(date,date) to service_role;

CREATE OR REPLACE FUNCTION public.today_ist()
 RETURNS date
 LANGUAGE sql
 STABLE
AS $function$ select (now() at time zone 'Asia/Kolkata')::date $function$
;
grant execute on function today_ist() to authenticated;
grant execute on function today_ist() to anon;
grant execute on function today_ist() to service_role;

CREATE OR REPLACE FUNCTION public.today_updates()
 RETURNS TABLE(kind text, employee_id uuid, full_name text, department text, designation text, avatar_url text, detail text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  uid       uuid := auth.uid();
  v_company uuid;
  v_scope   text;
  v_dept    text;
  v_today   date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select p.company_id, p.department into v_company, v_dept
  from public.profiles p where p.id = uid;

  if v_company is null then
    return;
  end if;

  select coalesce(comp.today_scope, 'company') into v_scope
  from public.companies comp where comp.id = v_company;

  return query
  select
    'birthday'::text,
    p.id,
    p.full_name,
    p.department,
    p.designation,
    p.avatar_url,
    to_char(p.date_of_birth, 'DD Mon')::text
  from public.profiles p
  where p.company_id = v_company
    and p.status = 'active'
    and p.date_of_birth is not null
    and extract(month from p.date_of_birth) = extract(month from v_today)
    and extract(day   from p.date_of_birth) = extract(day   from v_today)
    and (v_scope = 'company' or p.department is not distinct from v_dept);

  return query
  select
    'on_leave'::text,
    p.id,
    p.full_name,
    p.department,
    p.designation,
    p.avatar_url,
    coalesce(lt.code, l.day_type)::text
  from public.leaves l
  join public.profiles p on p.id = l.employee_id
  left join public.leave_types lt on lt.id = l.leave_type_id
  where l.company_id = v_company
    and l.status = 'approved'
    and v_today between l.from_date and l.to_date
    and (v_scope = 'company' or p.department is not distinct from v_dept);
end;
$function$
;
grant execute on function today_updates() to authenticated;
grant execute on function today_updates() to anon;
grant execute on function today_updates() to service_role;

CREATE OR REPLACE FUNCTION public.tracking_distance_today_v7()
 RETURNS TABLE(employee_id uuid, distance_km numeric, gps_points bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with pts as (
  select h.employee_id,h.captured_at,h.latitude,h.longitude,h.accuracy_m,
         lag(h.latitude) over(partition by h.employee_id order by h.captured_at) p_lat,
         lag(h.longitude) over(partition by h.employee_id order by h.captured_at) p_lng,
         lag(h.captured_at) over(partition by h.employee_id order by h.captured_at) p_time
  from public.employee_location_history h
  where h.company_id=public.my_company_id()
    and h.captured_at >= ((now() at time zone 'Asia/Kolkata')::date::timestamp at time zone 'Asia/Kolkata')
    and (h.accuracy_m is null or h.accuracy_m <= 200)
    and (h.employee_id=auth.uid() or public.is_company_admin() or public.reports_to_me(h.employee_id))
), seg as (
  select *, public.geo_distance_km_v7(p_lat,p_lng,latitude,longitude) km,
         greatest(1,extract(epoch from (captured_at-p_time))) seconds
  from pts
)
select employee_id,
       round(coalesce(sum(case
         when p_lat is null then 0
         when km <= 10 and (km*1000/seconds) <= 55 then km
         else 0 end),0)::numeric,2) distance_km,
       count(*) gps_points
from seg
group by employee_id;
$function$
;
grant execute on function tracking_distance_today_v7() to authenticated;
grant execute on function tracking_distance_today_v7() to anon;
grant execute on function tracking_distance_today_v7() to service_role;

CREATE OR REPLACE FUNCTION public.trim_gsheet_sync_logs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.gsheet_sync_logs
  where company_id = new.company_id and started_at < now() - interval '120 days';
  return new;
end $function$
;
grant execute on function trim_gsheet_sync_logs() to authenticated;
grant execute on function trim_gsheet_sync_logs() to anon;
grant execute on function trim_gsheet_sync_logs() to service_role;

CREATE OR REPLACE FUNCTION public.try_uuid(p text)
 RETURNS uuid
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then p::uuid else null end
$function$
;
grant execute on function try_uuid(text) to authenticated;
grant execute on function try_uuid(text) to anon;
grant execute on function try_uuid(text) to service_role;

CREATE OR REPLACE FUNCTION public.unregister_push_device(p_token text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.push_devices where token = p_token and user_id = auth.uid();
$function$
;
grant execute on function unregister_push_device(text) to authenticated;
grant execute on function unregister_push_device(text) to service_role;

CREATE OR REPLACE FUNCTION public.work_manager_notify_v9()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.completed_at is null and new.completed_at is not null and new.assignee_id is not null then
    perform public.notify_employee_domain_manager_v9(
      new.assignee_id,'work','Task completed',
      coalesce(new.title,'Task') || ' was marked complete.',
      '/tasks'
    );
  end if;
  return new;
end;
$function$
;
grant execute on function work_manager_notify_v9() to authenticated;
grant execute on function work_manager_notify_v9() to anon;
grant execute on function work_manager_notify_v9() to service_role;

CREATE OR REPLACE FUNCTION public.write_audit(p_company uuid, p_action text, p_entity text, p_key text, p_old jsonb, p_new jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_label text;
begin
  if auth.uid() is not null then
    select coalesce(full_name, email) into v_label from public.profiles where id = auth.uid();
  end if;
  insert into public.audit_logs (company_id, actor_id, actor_label, action, entity, entity_key, old_value, new_value)
  values (p_company, auth.uid(),
          coalesce(v_label, case when auth.uid() is null then 'System / SQL' else 'Unknown user' end),
          p_action, p_entity, p_key, p_old, p_new);
end $function$
;
grant execute on function write_audit(uuid,text,text,text,jsonb,jsonb) to service_role;

-- POLICIES & TRIGGERS
create policy companies_select_own on public.companies as PERMISSIVE for SELECT to public using ((id = my_company_id()));
create policy companies_update_by_admin on public.companies as PERMISSIVE for UPDATE to public using (((id = my_company_id()) AND is_company_admin()));
create policy profiles_select_self on public.profiles as PERMISSIVE for SELECT to public using ((id = auth.uid()));
create policy profiles_select_colleagues on public.profiles as PERMISSIVE for SELECT to public using (((company_id IS NOT NULL) AND (company_id = my_company_id())));
create policy profiles_update_self on public.profiles as PERMISSIVE for UPDATE to public using ((id = auth.uid()));
create policy profiles_manage_by_admin on public.profiles as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy invites_manage_by_admin on public.invites as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy attendance_insert on public.attendance as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy attendance_update on public.attendance as PERMISSIVE for UPDATE to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy leaves_insert_own on public.leaves as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND (employee_id = auth.uid())));
create policy logos_public_read on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'company-logos'::text));
create policy departments_read on public.departments as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy departments_admin on public.departments as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy designations_read on public.designations as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy logos_admin_write on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'company-logos'::text) AND (auth.uid() IS NOT NULL) AND is_company_admin()));
create policy logos_admin_update on storage.objects as PERMISSIVE for UPDATE to public using (((bucket_id = 'company-logos'::text) AND is_company_admin()));
create policy logos_admin_delete on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'company-logos'::text) AND is_company_admin()));
create policy attendance_select on public.attendance as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_to_me(employee_id))));
create policy attendance_delete on public.attendance as PERMISSIVE for DELETE to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy holidays_read on public.holidays as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy holidays_admin on public.holidays as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy documents_read on public.documents as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy documents_admin on public.documents as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy designations_admin on public.designations as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy leave_types_read on public.leave_types as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy leave_types_admin on public.leave_types as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy leaves_select on public.leaves as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR (buddy_id = auth.uid()) OR is_company_admin() OR reports_to_me(employee_id))));
create policy leaves_update on public.leaves as PERMISSIVE for UPDATE to public using (((company_id = my_company_id()) AND (is_company_admin() OR (employee_id = auth.uid()) OR (buddy_id = auth.uid()) OR reports_to_me(employee_id))));
create policy notifications_read on public.notifications as PERMISSIVE for SELECT to public using ((user_id = auth.uid()));
create policy notifications_update on public.notifications as PERMISSIVE for UPDATE to public using ((user_id = auth.uid()));
create policy notifications_insert on public.notifications as PERMISSIVE for INSERT to public with check ((company_id = my_company_id()));
create policy avatars_read on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'avatars'::text));
create policy avatars_write on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL)));
create policy avatars_update on storage.objects as PERMISSIVE for UPDATE to public using (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL)));
create policy tickets_select on public.tickets as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((raised_by = auth.uid()) OR (assigned_to = auth.uid()) OR is_company_admin())));
create policy tickets_insert on public.tickets as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND (raised_by = auth.uid())));
create policy tickets_update on public.tickets as PERMISSIVE for UPDATE to public using (((company_id = my_company_id()) AND ((assigned_to = auth.uid()) OR (raised_by = auth.uid()) OR is_company_admin())));
create policy ticket_comments_select on public.ticket_comments as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND (EXISTS ( SELECT 1
create policy ticket_comments_insert on public.ticket_comments as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND (author_id = auth.uid())));
create policy delegations_select on public.delegations as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((assigned_to = auth.uid()) OR (assigned_by = auth.uid()) OR is_company_admin() OR reports_to_me(assigned_to))));
create policy delegations_insert on public.delegations as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND (is_company_admin() OR reports_to_me(assigned_to) OR (assigned_to = auth.uid()))));
create policy delegations_update on public.delegations as PERMISSIVE for UPDATE to public using (((company_id = my_company_id()) AND ((assigned_to = auth.uid()) OR (assigned_by = auth.uid()) OR is_company_admin())));
create policy checklist_templates_select on public.checklist_templates as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((assigned_to = auth.uid()) OR (assigned_by = auth.uid()) OR is_company_admin() OR reports_to_me(assigned_to))));
create policy checklist_templates_insert on public.checklist_templates as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND (is_company_admin() OR reports_to_me(assigned_to))));
create policy checklist_templates_update on public.checklist_templates as PERMISSIVE for UPDATE to public using (((company_id = my_company_id()) AND (is_company_admin() OR (assigned_by = auth.uid()))));
create policy checklist_instances_select on public.checklist_instances as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((assigned_to = auth.uid()) OR is_company_admin() OR reports_to_me(assigned_to))));
create policy checklist_instances_update on public.checklist_instances as PERMISSIVE for UPDATE to public using (((company_id = my_company_id()) AND ((assigned_to = auth.uid()) OR is_company_admin())));
create policy salary_select on public.salary_master as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy salary_admin on public.salary_master as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy payroll_actions_select on public.payroll_actions as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy payroll_actions_admin on public.payroll_actions as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy branches_read on public.branches as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy branches_admin on public.branches as PERMISSIVE for ALL to public using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy empdocs_select on public.employee_documents as PERMISSIVE for SELECT to public using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy empdocs_insert on public.employee_documents as PERMISSIVE for INSERT to public with check (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin())));
create policy empdocs_delete on public.employee_documents as PERMISSIVE for DELETE to public using (((company_id = my_company_id()) AND is_company_admin()));
create policy em_targets_select on public.em_weekly_targets as PERMISSIVE for SELECT to public using ((company_id = my_company_id()));
create policy em_targets_insert on public.em_weekly_targets as PERMISSIVE for INSERT to public with check ((company_id = my_company_id()));
create policy visit_location_delete on public.visit_location_history as PERMISSIVE for DELETE to authenticated using (((company_id = my_company_id()) AND is_company_admin()));
create policy em_targets_update on public.em_weekly_targets as PERMISSIVE for UPDATE to public using ((company_id = my_company_id())) with check ((company_id = my_company_id()));
create policy subtasks_company on public.delegation_subtasks as PERMISSIVE for ALL to public using ((company_id = ( SELECT profiles.company_id
create policy comments_company on public.task_comments as PERMISSIVE for ALL to public using ((company_id = ( SELECT profiles.company_id
create policy extensions_company on public.task_extensions as PERMISSIVE for ALL to public using ((company_id = ( SELECT profiles.company_id
create policy smhrms_employee_docs_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'employee-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND (is_company_admin() OR ((storage.foldername(name))[2] = (auth.uid())::text))));
create policy smhrms_org_feature_gate on public.attendance as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('attendance'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('attendance'::text) AS has_feature)));
create policy live_locations_insert_own on public.employee_live_locations as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (employee_id = auth.uid())));
create policy visit_form_settings_select on public.visit_form_settings as PERMISSIVE for SELECT to authenticated using ((company_id = my_company_id()));
create policy visit_form_settings_insert on public.visit_form_settings as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND is_company_admin()));
create policy visit_form_settings_update on public.visit_form_settings as PERMISSIVE for UPDATE to authenticated using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy employee_live_delete on public.employee_live_locations as PERMISSIVE for DELETE to authenticated using (((company_id = my_company_id()) AND is_company_admin()));
create policy live_locations_select on public.employee_live_locations as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_to_me(employee_id))));
create policy live_locations_update_own on public.employee_live_locations as PERMISSIVE for UPDATE to authenticated using (((company_id = my_company_id()) AND (employee_id = auth.uid()))) with check (((company_id = my_company_id()) AND (employee_id = auth.uid())));
create policy location_history_select on public.employee_location_history as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_to_me(employee_id))));
create policy location_history_insert_own on public.employee_location_history as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (employee_id = auth.uid())));
create policy tracking_events_select on public.employee_tracking_events as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_to_me(employee_id))));
create policy tracking_events_insert_own on public.employee_tracking_events as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (employee_id = auth.uid())));
create policy tasks_delete on public.tasks as PERMISSIVE for DELETE to authenticated using (((company_id = my_company_id()) AND (is_company_admin() OR ((assignee_id IS NOT NULL) AND reports_work_to_me(assignee_id)))));
create policy visits_insert on public.field_visits as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_field_to_me(employee_id))));
create policy subscription_plans_read on public.subscription_plans as PERMISSIVE for SELECT to authenticated using ((active = true));
create policy plan_features_read on public.plan_features as PERMISSIVE for SELECT to authenticated using (true);
create policy company_subscriptions_read on public.company_subscriptions as PERMISSIVE for SELECT to authenticated using ((is_system_admin() OR (company_id = my_company_id())));
create policy subscription_events_read on public.subscription_events as PERMISSIVE for SELECT to authenticated using ((is_system_admin() OR (company_id = my_company_id())));
create policy system_admins_self_read on public.system_admins as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));
create policy tasks_select on public.tasks as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((assignee_id = auth.uid()) OR (created_by = auth.uid()) OR is_company_admin() OR ((assignee_id IS NOT NULL) AND reports_work_to_me(assignee_id)))));
create policy tasks_insert on public.tasks as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (is_company_admin() OR ((assignee_id IS NOT NULL) AND reports_work_to_me(assignee_id) AND (created_by = auth.uid())))));
create policy tasks_update on public.tasks as PERMISSIVE for UPDATE to authenticated using (((company_id = my_company_id()) AND ((assignee_id = auth.uid()) OR is_company_admin() OR ((assignee_id IS NOT NULL) AND reports_work_to_me(assignee_id))))) with check ((company_id = my_company_id()));
create policy visits_update on public.field_visits as PERMISSIVE for UPDATE to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_field_to_me(employee_id)))) with check (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_field_to_me(employee_id))));
create policy visits_delete on public.field_visits as PERMISSIVE for DELETE to authenticated using (((company_id = my_company_id()) AND (is_company_admin() OR reports_field_to_me(employee_id))));
create policy visit_location_select on public.visit_location_history as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_field_to_me(employee_id))));
create policy gsheet_sync_logs_select on public.gsheet_sync_logs as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND is_company_admin()));
create policy smhrms_attendance_photos_read on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'attendance-photos'::text) AND can_view_employee_file(name)));
create policy smhrms_attendance_photos_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'attendance-photos'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));
create policy smhrms_employee_docs_read on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'employee-docs'::text) AND can_view_employee_file(name)));
create policy tracking_events_select on public.tracking_events as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_field_to_me(employee_id))));
create policy visits_select on public.field_visits as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND (((employee_id = auth.uid()) AND (module_access('field_visits'::text) <> 'none'::text)) OR is_company_admin() OR ((module_access('field_visits'::text) = ANY (ARRAY['team'::text, 'company'::text])) AND (field_reports_to_me(employee_id) OR (module_access('field_visits'::text) = 'company'::text))) OR ((module_access('live_tracking'::text) = ANY (ARRAY['team'::text, 'company'::text])) AND (field_reports_to_me(employee_id) OR (module_access('live_tracking'::text) = 'company'::text))))));
create policy employee_live_select on public.employee_live_locations as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND (((employee_id = auth.uid()) AND (module_access('live_tracking'::text) <> 'none'::text)) OR is_company_admin() OR ((module_access('live_tracking'::text) = 'team'::text) AND field_reports_to_me(employee_id)) OR (module_access('live_tracking'::text) = 'company'::text))));
create policy employee_location_history_select on public.employee_location_history as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND (((employee_id = auth.uid()) AND (module_access('route_history'::text) <> 'none'::text)) OR is_company_admin() OR ((module_access('route_history'::text) = 'team'::text) AND field_reports_to_me(employee_id)) OR (module_access('route_history'::text) = 'company'::text))));
create policy gsheet_sync_runs_select on public.gsheet_sync_runs as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND is_company_admin()));
create policy visit_custom_fields_select on public.visit_custom_fields as PERMISSIVE for SELECT to authenticated using ((company_id = my_company_id()));
create policy visit_custom_fields_manage on public.visit_custom_fields as PERMISSIVE for ALL to authenticated using (((company_id = my_company_id()) AND (EXISTS ( SELECT 1
create policy company_integrations_select on public.company_integrations as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND is_company_admin()));
create policy company_integrations_insert on public.company_integrations as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND is_company_admin()));
create policy company_integrations_update on public.company_integrations as PERMISSIVE for UPDATE to authenticated using (((company_id = my_company_id()) AND is_company_admin())) with check (((company_id = my_company_id()) AND is_company_admin()));
create policy smhrms_employee_docs_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'employee-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND is_company_admin()));
create policy push_devices_select_own on public.push_devices as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));
create policy push_devices_delete_own on public.push_devices as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy attendance_daily_log_select on public.attendance_daily_log as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((employee_id = auth.uid()) OR is_company_admin() OR reports_to_me(employee_id))));
create policy field_visit_schedule_changes_select on public.field_visit_schedule_changes as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND (EXISTS ( SELECT 1
create policy features_read on public.features as PERMISSIVE for SELECT to authenticated using (true);
create policy org_feature_overrides_read on public.organization_feature_overrides as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) OR is_platform_admin()));
create policy audit_logs_read on public.audit_logs as PERMISSIVE for SELECT to authenticated using ((is_platform_admin() OR ((company_id = my_company_id()) AND is_company_admin())));
create policy smhrms_org_feature_gate on public.attendance_daily_log as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('attendance'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('attendance'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.leaves as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('leave'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('leave'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.leave_types as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('leave'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('leave'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.delegations as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks.delegation'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks.delegation'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.delegation_subtasks as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks.delegation'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks.delegation'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.checklist_templates as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks.checklist'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks.checklist'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.checklist_instances as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks.checklist'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks.checklist'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.task_comments as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.task_extensions as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.em_weekly_targets as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('tasks'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('tasks'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.employee_location_history as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.tracking'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.tracking'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.employee_live_locations as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.tracking'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.tracking'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.tracking_events as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.tracking'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.tracking'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.field_visits as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.visits'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.visits'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.visit_custom_fields as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.visits'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.visits'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.visit_location_history as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.visits'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.visits'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.field_visit_schedule_changes as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('field.visits'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('field.visits'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.salary_master as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('payroll'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('payroll'::text) AS has_feature)));
create policy smhrms_org_feature_gate on public.payroll_actions as RESTRICTIVE for ALL to public using ((((company_id IS NULL) OR (company_id = ( SELECT my_company_id() AS my_company_id))) AND ( SELECT has_feature('payroll'::text) AS has_feature))) with check (((company_id = ( SELECT my_company_id() AS my_company_id)) AND ( SELECT has_feature('payroll'::text) AS has_feature)));
create policy org_module_requests_read on public.organization_module_requests as PERMISSIVE for SELECT to authenticated using ((is_platform_admin() OR ((company_id = my_company_id()) AND is_company_admin())));
create policy task_attachments_select_company on public.task_attachments as PERMISSIVE for SELECT to authenticated using ((company_id = ( SELECT p.company_id
create policy task_attachments_insert_company on public.task_attachments as PERMISSIVE for INSERT to authenticated with check (((uploaded_by = auth.uid()) AND (company_id = ( SELECT p.company_id
create policy task_attachments_delete_owner_admin on public.task_attachments as PERMISSIVE for DELETE to authenticated using (((uploaded_by = auth.uid()) OR (EXISTS ( SELECT 1
create policy checklist_templates_delete_admin_only on public.checklist_templates as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
create policy checklist_instances_delete_admin_only on public.checklist_instances as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
create policy delegations_delete_admin_only on public.delegations as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
create policy task_attachment_storage_select on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'task-attachments'::text) AND ((storage.foldername(name))[1] = ( SELECT (p.company_id)::text AS company_id
create policy task_attachment_storage_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'task-attachments'::text) AND ((storage.foldername(name))[1] = ( SELECT (p.company_id)::text AS company_id
create policy task_attachment_storage_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'task-attachments'::text) AND ((storage.foldername(name))[1] = ( SELECT (p.company_id)::text AS company_id
create policy ai_settings_admin on public.ai_settings as PERMISSIVE for ALL to authenticated using (((company_id = my_company_id()) AND is_company_admin() AND has_feature('ai.assistant'::text))) with check (((company_id = my_company_id()) AND is_company_admin() AND has_feature('ai.assistant'::text)));
create policy ai_user_access_read on public.ai_user_access as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((user_id = auth.uid()) OR is_company_admin()) AND has_feature('ai.assistant'::text)));
create policy ai_user_access_admin on public.ai_user_access as PERMISSIVE for ALL to authenticated using (((company_id = my_company_id()) AND is_company_admin() AND has_feature('ai.assistant'::text))) with check (((company_id = my_company_id()) AND is_company_admin() AND has_feature('ai.assistant'::text)));
create policy ai_conversations_own on public.ai_conversations as PERMISSIVE for ALL to authenticated using (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text))) with check (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text)));
create policy ai_messages_own on public.ai_messages as PERMISSIVE for ALL to authenticated using (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text))) with check (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text)));
create policy ai_usage_own_admin on public.ai_usage_log as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((user_id = auth.uid()) OR is_company_admin()) AND has_feature('ai.assistant'::text)));
create policy ai_usage_insert_own on public.ai_usage_log as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text)));
create policy ai_action_read on public.ai_action_log as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((user_id = auth.uid()) OR is_company_admin()) AND has_feature('ai.assistant'::text)));
create policy ai_pending_actions_own on public.ai_pending_actions as PERMISSIVE for ALL to authenticated using (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text))) with check (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text)));
create policy ai_action_insert_own on public.ai_action_log as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (user_id = auth.uid()) AND has_feature('ai.assistant'::text)));
create policy smhrms_company_docs_read on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'company-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text)));
create policy smhrms_company_docs_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'company-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND is_company_admin()));
create policy smhrms_company_docs_update on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'company-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND is_company_admin())) with check (((bucket_id = 'company-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND is_company_admin()));
create policy smhrms_company_docs_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'company-docs'::text) AND ((storage.foldername(name))[1] = (my_company_id())::text) AND is_company_admin()));
create policy support_meetings_read on public.support_meetings as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND ((requested_by = auth.uid()) OR (host_user_id = auth.uid()) OR is_company_admin())));
create policy support_meetings_create on public.support_meetings as PERMISSIVE for INSERT to authenticated with check (((company_id = my_company_id()) AND (requested_by = auth.uid())));
create policy support_meetings_manage on public.support_meetings as PERMISSIVE for UPDATE to authenticated using (((company_id = my_company_id()) AND ((host_user_id = auth.uid()) OR is_company_admin()))) with check ((company_id = my_company_id()));
create policy calendar_connections_own on public.calendar_connections as PERMISSIVE for SELECT to authenticated using (((company_id = my_company_id()) AND (user_id = auth.uid())));
create trigger trg_ticket_no BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION set_ticket_no();
create trigger trg_block_early_checklist BEFORE UPDATE ON public.checklist_instances FOR EACH ROW EXECUTE FUNCTION block_early_completion();
create trigger trg_block_early_delegation BEFORE UPDATE ON public.delegations FOR EACH ROW EXECUTE FUNCTION block_early_completion();
create trigger trg_enforce_location_mandatory BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION enforce_location_mandatory();
create trigger trg_attendance_server_time_v6 BEFORE INSERT OR UPDATE OF check_in, check_out ON public.attendance FOR EACH ROW EXECUTE FUNCTION enforce_server_attendance_time_v6();
create trigger trg_attendance_tracking_v6 AFTER INSERT OR UPDATE OF check_in, check_out ON public.attendance FOR EACH ROW EXECUTE FUNCTION sync_tracking_with_attendance_v6();
create trigger attendance_manager_notify_v9 AFTER INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION attendance_manager_notify_v9();
create trigger field_manager_notify_v9 AFTER UPDATE ON public.field_visits FOR EACH ROW EXECUTE FUNCTION field_manager_notify_v9();
create trigger work_manager_notify_v9 AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION work_manager_notify_v9();
create trigger gsheet_sync_logs_trim AFTER INSERT ON public.gsheet_sync_logs FOR EACH ROW EXECUTE FUNCTION trim_gsheet_sync_logs();
create trigger notifications_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION notifications_send_push();
create trigger field_visits_guard BEFORE INSERT OR UPDATE ON public.field_visits FOR EACH ROW EXECUTE FUNCTION field_visits_guard();
create trigger field_visits_notify AFTER INSERT OR UPDATE OF scheduled_at ON public.field_visits FOR EACH ROW EXECUTE FUNCTION field_visits_notify();
create trigger companies_assign_org_code BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION companies_assign_org_code();
create trigger companies_protect_platform_fields BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION companies_protect_platform_fields();
create trigger audit_feature_overrides AFTER INSERT OR DELETE OR UPDATE ON public.organization_feature_overrides FOR EACH ROW EXECUTE FUNCTION audit_feature_overrides();
create trigger audit_company_platform_fields AFTER UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION audit_company_platform_fields();
create trigger audit_company_subscriptions AFTER INSERT OR DELETE OR UPDATE ON public.company_subscriptions FOR EACH ROW EXECUTE FUNCTION audit_company_subscriptions();
create trigger audit_module_requests AFTER INSERT OR UPDATE ON public.organization_module_requests FOR EACH ROW EXECUTE FUNCTION audit_module_requests();
create trigger trg_billing_payments_updated_at BEFORE UPDATE ON public.billing_payments FOR EACH ROW EXECUTE FUNCTION billing_set_updated_at();
create trigger trg_task_policy_updated_at BEFORE UPDATE ON public.task_management_policies FOR EACH ROW EXECUTE FUNCTION set_task_policy_updated_at();
create trigger trg_ai_touch_conversation AFTER INSERT ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION ai_touch_conversation();
create trigger trg_smhrms_lock_visit_created_at BEFORE INSERT OR UPDATE ON public.field_visits FOR EACH ROW EXECUTE FUNCTION smhrms_lock_visit_created_at();
create trigger trg_smhrms_lock_location_history BEFORE DELETE OR UPDATE ON public.employee_location_history FOR EACH ROW EXECUTE FUNCTION smhrms_lock_location_history();
create trigger trg_smhrms_lock_tracking_events BEFORE DELETE OR UPDATE ON public.tracking_events FOR EACH ROW EXECUTE FUNCTION smhrms_lock_tracking_events();
create trigger support_meeting_schedule_guard BEFORE INSERT OR UPDATE OF starts_at, ends_at, status ON public.support_meetings FOR EACH ROW WHEN ((new.status <> ALL (ARRAY['cancelled'::text, 'completed'::text]))) EXECUTE FUNCTION enforce_support_meeting_schedule();
create trigger smhrms_profiles_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION smhrms_profiles_guard();
create trigger smhrms_field_visits_guard BEFORE INSERT OR UPDATE ON public.field_visits FOR EACH ROW EXECUTE FUNCTION smhrms_field_visits_guard();
create trigger smhrms_leaves_guard BEFORE INSERT OR UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION smhrms_leaves_guard();
create trigger smhrms_support_meetings_guard BEFORE INSERT OR UPDATE ON public.support_meetings FOR EACH ROW EXECUTE FUNCTION smhrms_support_meetings_guard();
