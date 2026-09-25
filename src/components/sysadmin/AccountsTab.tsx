"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  CheckCircle2,
  AlertTriangle,
  Ban,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  card,
  inputCls,
  btnGhost,
  fmtDate,
  ago,
  Chip,
} from "./shared";

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

type RpcResult = {
  rows?: AccountRow[];
  total?: number;
};

function AccountStateChip({
  state,
}: {
  state: AccountState;
}) {
  if (state === "active") {
    return (
      <Chip tone="green">
        Active
      </Chip>
    );
  }

  if (state === "orphan") {
    return (
      <Chip tone="red">
        Orphan
      </Chip>
    );
  }

  if (state === "incomplete") {
    return (
      <Chip tone="amber">
        Incomplete
      </Chip>
    );
  }

  if (state === "suspended") {
    return (
      <Chip tone="slate">
        Suspended
      </Chip>
    );
  }

  return (
    <Chip tone="slate">
      Unknown
    </Chip>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          {title}
        </span>

        {icon}
      </div>

      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

export default function AccountsTab() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [status, setStatus] = useState("");

  const [page, setPage] = useState(0);

  /*
   * Search debounce
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  /*
   * Load accounts from protected System Admin RPC
   */
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: rpcError } =
        await supabase.rpc(
          "system_admin_account_list",
          {
            p_search: query || null,
            p_status: status || null,
            p_limit: PAGE_SIZE,
            p_offset: page * PAGE_SIZE,
          }
        );

      if (rpcError) {
        throw rpcError;
      }

      const result =
        (data as RpcResult | null) || {};

      setRows(
        Array.isArray(result.rows)
          ? result.rows
          : []
      );

      setTotal(
        Number(result.total || 0)
      );
    } catch (err) {
      console.error(
        "Failed to load System Admin accounts:",
        err
      );

      setRows([]);
      setTotal(0);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load accounts."
      );
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    query,
    status,
    page,
  ]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /*
   * Pagination
   */
  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  const currentPage = page + 1;

  /*
   * Current page counters.
   * These are intentionally labelled as current-page counts.
   */
  const pageStats = useMemo(() => {
    return {
      active: rows.filter(
        (row) =>
          row.account_state === "active"
      ).length,

      orphan: rows.filter(
        (row) =>
          row.account_state === "orphan"
      ).length,

      incomplete: rows.filter(
        (row) =>
          row.account_state === "incomplete"
      ).length,

      suspended: rows.filter(
        (row) =>
          row.account_state === "suspended"
      ).length,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* =====================================================
          SECURITY INFORMATION
      ===================================================== */}

      <section className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-500/20 dark:bg-blue-500/10">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />

          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              SystemMaster Account Control
            </h3>

            <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700 dark:text-blue-200">
              Authentication accounts are compared
              with HRMS profiles and organizations.
              This helps identify active accounts,
              incomplete registrations and orphan
              accounts before cleanup.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard
          title="Matching Accounts"
          value={total}
          subtitle="Across current filter"
          icon={
            <UserCog className="h-4 w-4 text-brand-600" />
          }
        />

        <StatCard
          title="Active"
          value={pageStats.active}
          subtitle="Current page"
          icon={
            <UserCheck className="h-4 w-4 text-emerald-600" />
          }
        />

        <StatCard
          title="Orphan"
          value={pageStats.orphan}
          subtitle="Current page"
          icon={
            <UserX className="h-4 w-4 text-rose-600" />
          }
        />

        <StatCard
          title="Incomplete"
          value={pageStats.incomplete}
          subtitle="Current page"
          icon={
            <Clock3 className="h-4 w-4 text-amber-600" />
          }
        />

        <StatCard
          title="Suspended"
          value={pageStats.suspended}
          subtitle="Current page"
          icon={
            <Ban className="h-4 w-4 text-slate-500" />
          }
        />
      </section>

      {/* =====================================================
          SEARCH + FILTERS
      ===================================================== */}

      <section
        className={`${card} flex flex-col gap-3 p-4 lg:flex-row lg:items-center`}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            className={`${inputCls} pl-9`}
            placeholder="Search email, name, phone, organization or Org ID"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          className={`${inputCls} lg:w-56`}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
        >
          <option value="">
            All accounts
          </option>

          <option value="active">
            Active accounts
          </option>

          <option value="orphan">
            Orphan accounts
          </option>

          <option value="incomplete">
            Incomplete onboarding
          </option>

          <option value="suspended">
            Suspended
          </option>
        </select>

        <button
          type="button"
          onClick={loadAccounts}
          disabled={loading}
          className={btnGhost}
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading
                ? "animate-spin"
                : ""
            }`}
          />

          Refresh
        </button>
      </section>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />

            <div>
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Unable to load accounts
              </p>

              <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                {error}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          ACCOUNT TABLE
      ===================================================== */}

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-sm">
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
                  Account State
                </th>

                <th className="px-4 py-3">
                  System Check
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading &&
              rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-14 text-center"
                  >
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" />

                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Loading accounts...
                    </p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-14 text-center"
                  >
                    <UserCog className="mx-auto h-9 w-9 text-slate-300" />

                    <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                      No accounts found
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Try changing the search
                      or account filter.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  return (
                    <tr
                      key={row.user_id}
                      className="align-top transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      {/* Account */}

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {row.full_name ||
                            "Unnamed account"}
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
                        <div className="space-y-1.5">
                          <p className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />

                            <span className="max-w-[240px] truncate">
                              {row.email ||
                                "No email"}
                            </span>
                          </p>

                          {row.phone && (
                            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Phone className="h-3.5 w-3.5 shrink-0" />

                              {row.phone}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Organization */}

                      <td className="px-4 py-3">
                        {row.company_id ? (
                          <div>
                            <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />

                              <span className="max-w-[220px] truncate">
                                {row.company_name ||
                                  "Unknown organization"}
                              </span>
                            </p>

                            <p className="mt-1 font-mono text-[11px] text-brand-700 dark:text-brand-300">
                              {row.org_code ||
                                "No Org ID"}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                              No organization
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              Company not assigned
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Role */}

                      <td className="px-4 py-3">
                        <span className="text-xs font-medium capitalize text-slate-700 dark:text-slate-200">
                          {row.role || "—"}
                        </span>
                      </td>

                      {/* Created */}

                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {row.created_at
                            ? fmtDate(
                                row.created_at
                              )
                            : "—"}
                        </p>

                        {row.created_at && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {ago(
                              row.created_at
                            )}
                          </p>
                        )}
                      </td>

                      {/* Email verification */}

                      <td className="px-4 py-3">
                        {row.email_confirmed_at ? (
                          <div>
                            <Chip tone="green">
                              Verified
                            </Chip>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {fmtDate(
                                row.email_confirmed_at
                              )}
                            </p>
                          </div>
                        ) : (
                          <Chip tone="amber">
                            Unverified
                          </Chip>
                        )}
                      </td>

                      {/* Last login */}

                      <td className="whitespace-nowrap px-4 py-3">
                        {row.last_sign_in_at ? (
                          <>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {ago(
                                row.last_sign_in_at
                              )}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {fmtDate(
                                row.last_sign_in_at
                              )}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-300">
                            Never
                          </span>
                        )}
                      </td>

                      {/* Account state */}

                      <td className="px-4 py-3">
                        <AccountStateChip
                          state={
                            row.account_state
                          }
                        />
                      </td>

                      {/* Reason */}

                      <td className="max-w-[280px] px-4 py-3">
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {row.state_reason}
                        </p>

                        {row.account_state ===
                          "active" && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />

                            Protected active account
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ===================================================
            PAGINATION
        =================================================== */}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {total}
            </span>{" "}
            matching account
            {total === 1 ? "" : "s"}

            {" · "}

            Page{" "}
            <span className="font-semibold">
              {currentPage}
            </span>{" "}
            of{" "}
            <span className="font-semibold">
              {totalPages}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={
                page === 0 ||
                loading
              }
              onClick={() => {
                setPage((current) =>
                  Math.max(
                    0,
                    current - 1
                  )
                );
              }}
            >
              <ChevronLeft className="h-4 w-4" />

              Previous
            </button>

            <button
              type="button"
              className={btnGhost}
              disabled={
                currentPage >=
                  totalPages ||
                loading
              }
              onClick={() => {
                setPage(
                  (current) =>
                    current + 1
                );
              }}
            >
              Next

              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          CLEANUP STATUS
      ===================================================== */}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Permanent account deletion is
              currently protected
            </p>

            <p className="mt-1 max-w-4xl text-xs leading-5 text-amber-700 dark:text-amber-300">
              First review the Orphan and
              Incomplete account lists. The
              cleanup action will be added with
              server-side protection so an
              active organization owner,
              employee or SystemMaster admin
              cannot be accidentally deleted.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
