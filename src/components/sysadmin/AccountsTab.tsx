"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  UserCog,
  UserCheck,
  UserX,
  Building2,
  Clock3,
  ShieldAlert,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { card, inputCls, btnGhost, fmtDate, ago, Chip } from "./shared";

const PAGE_SIZE = 25;

type AccountState =
  | "active"
  | "orphan"
  | "incomplete"
  | "suspended";

type AccountRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;

  company_id: string | null;
  company_name: string | null;
  org_code: string | null;
  account_status: string | null;
  onboarding_completed_at: string | null;

  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;

  account_state: AccountState;
  state_reason: string;
};

function stateChip(state: AccountState) {
  if (state === "active") {
    return <Chip tone="green">Active</Chip>;
  }

  if (state === "orphan") {
    return <Chip tone="red">Orphan</Chip>;
  }

  if (state === "incomplete") {
    return <Chip tone="amber">Incomplete</Chip>;
  }

  if (state === "suspended") {
    return <Chip tone="slate">Suspended</Chip>;
  }

  return <Chip tone="slate">{state}</Chip>;
}

export default function AccountsTab() {
  const supabase = createClient();

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [status, setStatus] = useState("");

  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc(
      "system_admin_account_list",
      {
        p_search: query || null,
        p_status: status || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      }
    );

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setError("");

    const result = data as {
      rows?: AccountRow[];
      total?: number;
    } | null;

    setRows(result?.rows || []);
    setTotal(Number(result?.total || 0));
  }, [supabase, query, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeCount = rows.filter(
    (row) => row.account_state === "active"
  ).length;

  const orphanCount = rows.filter(
    (row) => row.account_state === "orphan"
  ).length;

  const incompleteCount = rows.filter(
    (row) => row.account_state === "incomplete"
  ).length;

  const suspendedCount = rows.filter(
    (row) => row.account_state === "suspended"
  ).length;

  return (
    <div className="space-y-5">
      {/* Information */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-500/20 dark:bg-blue-500/10">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />

          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              SystemMaster Account Control
            </h3>

            <p className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-200">
              This screen compares authentication accounts with
              employee profiles and organizations. Orphan and
              incomplete accounts can be reviewed before any
              permanent cleanup is performed.
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Visible accounts
            </span>

            <UserCog className="h-4 w-4 text-brand-600" />
          </div>

          <p className="mt-2 text-2xl font-bold tabular-nums">
            {rows.length}
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            {total} matching total
          </p>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Active
            </span>

            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>

          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">
            {activeCount}
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            Current page
          </p>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Orphan
            </span>

            <UserX className="h-4 w-4 text-rose-600" />
          </div>

          <p className="mt-2 text-2xl font-bold tabular-nums text-rose-600">
            {orphanCount}
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            Review required
          </p>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Incomplete
            </span>

            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>

          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-600">
            {incompleteCount}
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            Current page
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`${card} flex flex-col gap-3 p-4 lg:flex-row lg:items-center`}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            className={`${inputCls} pl-9`}
            placeholder="Search email, name, phone, organization or Org ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={`${inputCls} lg:w-52`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="orphan">Orphan accounts</option>
          <option value="incomplete">Incomplete onboarding</option>
          <option value="suspended">Suspended</option>
        </select>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className={btnGhost}
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">
                  Account
                </th>

                <th className="px-4 py-3">
                  Contact
                </th>

                <th className="px-4 py-3">
                  Organization
                </th>

                <th className="px-4 py-3">
                  Role
                </th>

                <th className="px-4 py-3">
                  Created
                </th>

                <th className="px-4 py-3">
                  Email
                </th>

                <th className="px-4 py-3">
                  Last Login
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3">
                  Reason
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Loading accounts...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center"
                  >
                    <UserCog className="mx-auto h-8 w-8 text-slate-300" />

                    <p className="mt-3 font-medium text-slate-600 dark:text-slate-300">
                      No accounts found
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Try changing the search or account filter.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.user_id}
                    className="align-top transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    {/* Account */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {row.full_name || "Unnamed account"}
                      </p>

                      <p
                        className="mt-1 max-w-[220px] truncate font-mono text-[10px] text-slate-400"
                        title={row.user_id}
                      >
                        {row.user_id}
                      </p>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-xs">
                        <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {row.email || "—"}
                        </p>

                        {row.phone && (
                          <p className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="h-3.5 w-3.5" />
                            {row.phone}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Organization */}
                    <td className="px-4 py-3">
                      {row.company_id ? (
                        <>
                          <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />

                            {row.company_name || "Unknown organization"}
                          </p>

                          <p className="mt-1 font-mono text-[11px] text-brand-700 dark:text-brand-300">
                            {row.org_code || "No Org ID"}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-rose-500">
                          No organization
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs font-medium text-slate-700 dark:text-slate-200">
                        {row.role || "—"}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {fmtDate(row.created_at)}
                    </td>

                    {/* Email confirmation */}
                    <td className="px-4 py-3">
                      {row.email_confirmed_at ? (
                        <Chip tone="green">
                          Verified
                        </Chip>
                      ) : (
                        <Chip tone="amber">
                          Unverified
                        </Chip>
                      )}
                    </td>

                    {/* Last login */}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {row.last_sign_in_at
                        ? ago(row.last_sign_in_at)
                        : "Never"}
                    </td>

                    {/* State */}
                    <td className="px-4 py-3">
                      {stateChip(row.account_state)}
                    </td>

                    {/* Reason */}
                    <td className="max-w-[260px] px-4 py-3 text-xs leading-5 text-slate-500">
                      {row.state_reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {total} matching account{total === 1 ? "" : "s"}
            {" · "}
            Page {page + 1} of {pages}
            {suspendedCount > 0
              ? ` · ${suspendedCount} suspended on this page`
              : ""}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={page === 0 || loading}
              onClick={() =>
                setPage((current) =>
                  Math.max(0, current - 1)
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              className={btnGhost}
              disabled={page + 1 >= pages || loading}
              onClick={() =>
                setPage((current) => current + 1)
              }
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cleanup notice */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Permanent account deletion is currently locked
        </p>

        <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
          First review the Orphan and Incomplete lists. In the
          next step we will add a protected cleanup action that
          prevents an active organization owner or employee from
          being deleted accidentally.
        </p>
      </div>
    </div>
  );
}
