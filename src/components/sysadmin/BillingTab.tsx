"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CreditCard,
  RefreshCw,
  Search,
  IndianRupee,
  AlertTriangle,
  CalendarClock,
  Download,
  ReceiptText,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import {
  Chip,
  card,
  inputCls,
  btnGhost,
  fmtDate,
  fmtDateTime,
} from "./shared";

type BillingRow = {
  company_id: string;
  org_code?: string | null;
  name: string;
  email?: string | null;

  plan_code?: string | null;
  status?: string | null;

  licensed_users?: number | null;

  custom_price_per_user?: number | null;
  discount_percent?: number | null;

  billing_cycle?: string | null;

  current_period_end?: string | null;
  trial_ends_at?: string | null;
  next_billing_at?: string | null;

  billing_email?: string | null;

  razorpay_customer_id?: string | null;
  razorpay_subscription_id?: string | null;

  total_paid?: number | null;
  total_due?: number | null;

  latest_paid_at?: string | null;
};

type PaymentRow = {
  id: string;

  receipt_number?: string | null;

  plan_code?: string | null;
  billing_cycle?: string | null;

  currency?: string | null;

  subtotal?: number | null;
  tax_amount?: number | null;
  adjustment_amount?: number | null;

  total_amount?: number | null;
  amount_paid?: number | null;
  amount_due?: number | null;

  status?: string | null;

  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_invoice_id?: string | null;
  razorpay_subscription_id?: string | null;

  payment_method?: string | null;
  source?: string | null;

  paid_at?: string | null;
  created_at?: string | null;

  metadata?: any;
};

type Overview = {
  total_organizations?: number;

  paid_organizations?: number;
  trial_organizations?: number;
  past_due_organizations?: number;

  expiring_10_days?: number;

  received_total?: number;
  outstanding_total?: number;
  payments_30d?: number;
};

const money = (
  value?: number | string | null
) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function billingStatus(
  status?: string | null
) {
  const normalized = String(
    status || ""
  ).toLowerCase();

  if (
    normalized === "active" ||
    normalized === "captured" ||
    normalized === "paid"
  ) {
    return (
      <Chip tone="green">
        {normalized === "active"
          ? "Active"
          : "Paid"}
      </Chip>
    );
  }

  if (
    normalized === "past_due" ||
    normalized === "failed"
  ) {
    return (
      <Chip tone="red">
        {normalized === "failed"
          ? "Failed"
          : "Past due"}
      </Chip>
    );
  }

  if (normalized === "trial") {
    return (
      <Chip tone="blue">
        Trial
      </Chip>
    );
  }

  if (
    normalized === "paused" ||
    normalized === "created" ||
    normalized === "authorized" ||
    normalized === "pending"
  ) {
    return (
      <Chip tone="amber">
        {normalized
          ? normalized.replaceAll(
              "_",
              " "
            )
          : "Pending"}
      </Chip>
    );
  }

  if (
    normalized === "cancelled" ||
    normalized === "refunded"
  ) {
    return (
      <Chip tone="slate">
        {normalized.replaceAll(
          "_",
          " "
        )}
      </Chip>
    );
  }

  return (
    <Chip>
      {status || "Not configured"}
    </Chip>
  );
}

function termLabel(
  term?: string | null
) {
  if (!term) return "—";

  if (term === "3_months") {
    return "3 months";
  }

  if (term === "6_months") {
    return "6 months";
  }

  if (term === "yearly") {
    return "12 months";
  }

  if (term === "monthly") {
    return "Monthly";
  }

  return term.replaceAll("_", " ");
}

export default function BillingTab({
  onOpenOrg,
}: {
  onOpenOrg?: (
    companyId: string
  ) => void;
}) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [overview, setOverview] =
    useState<Overview>({});

  const [rows, setRows] =
    useState<BillingRow[]>([]);

  const [total, setTotal] =
    useState(0);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * ======================================================
   * PAYMENT HISTORY DRAWER
   * ======================================================
   */

  const [
    historyOrg,
    setHistoryOrg,
  ] =
    useState<BillingRow | null>(
      null
    );

  const [
    payments,
    setPayments,
  ] =
    useState<PaymentRow[]>([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const [
    historyError,
    setHistoryError,
  ] =
    useState("");

  /*
   * ======================================================
   * LOAD BILLING
   * ======================================================
   */

  const load =
    useCallback(async () => {
      setLoading(true);
      setError("");

      const [
        overviewResult,
        listResult,
      ] = await Promise.all([
        supabase.rpc(
          "system_admin_billing_overview"
        ),

        supabase.rpc(
          "system_admin_billing_list",
          {
            p_search:
              search.trim() ||
              null,

            p_status:
              status || null,

            p_limit: 100,
            p_offset: 0,
          }
        ),
      ]);

      if (
        overviewResult.error ||
        listResult.error
      ) {
        setError(
          overviewResult.error
            ?.message ||
            listResult.error
              ?.message ||
            "Unable to load billing data."
        );

        setLoading(false);

        return;
      }

      setOverview(
        (overviewResult.data ||
          {}) as Overview
      );

      const payload =
        (listResult.data ||
          {}) as {
          rows?: BillingRow[];
          total?: number;
        };

      setRows(
        payload.rows || []
      );

      setTotal(
        Number(
          payload.total || 0
        )
      );

      setLoading(false);
    }, [
      supabase,
      search,
      status,
    ]);

  useEffect(() => {
    const timer =
      window.setTimeout(
        load,
        250
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [load]);

  /*
   * ======================================================
   * OPEN PAYMENT HISTORY
   * ======================================================
   */

  const openPaymentHistory =
    async (
      org: BillingRow
    ) => {
      setHistoryOrg(org);

      setPayments([]);

      setHistoryError("");

      setHistoryLoading(true);

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "system_admin_payment_history",
            {
              p_company_id:
                org.company_id,

              p_limit: 100,
            }
          );

        if (error) {
          throw error;
        }

        /*
         * RPC may return either:
         *
         * [
         *   {...}
         * ]
         *
         * OR
         *
         * {
         *   rows: [...]
         * }
         */

        if (
          Array.isArray(data)
        ) {
          setPayments(
            data as PaymentRow[]
          );
        } else {
          setPayments(
            ((data as any)
              ?.rows ||
              []) as PaymentRow[]
          );
        }
      } catch (err: any) {
        setHistoryError(
          err?.message ||
            "Unable to load payment history."
        );
      } finally {
        setHistoryLoading(
          false
        );
      }
    };

  /*
   * ======================================================
   * CSV
   * ======================================================
   */

  const exportCsv = () => {
    const headers = [
      "Organization",
      "Org Code",
      "Plan",
      "Status",
      "Licensed Users",
      "Billing Term",
      "Total Paid",
      "Total Due",
      "Last Paid",
      "Next Billing",
      "Razorpay Subscription",
    ];

    const values =
      rows.map((r) => [
        r.name,

        r.org_code || "",

        r.plan_code || "",

        r.status || "",

        r.licensed_users ||
          "",

        termLabel(
          r.billing_cycle
        ),

        Number(
          r.total_paid || 0
        ).toFixed(2),

        Number(
          r.total_due || 0
        ).toFixed(2),

        r.latest_paid_at ||
          "",

        r.next_billing_at ||
          r.current_period_end ||
          r.trial_ends_at ||
          "",

        r.razorpay_subscription_id ||
          "",
      ]);

    const csv = [
      headers,
      ...values,
    ]
      .map((line) =>
        line
          .map(
            (v) =>
              `"${String(
                v
              ).replaceAll(
                '"',
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob =
      new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download =
      `sm-hrms-billing-${
        new Date()
          .toISOString()
          .slice(0, 10)
      }.csv`;

    a.click();

    URL.revokeObjectURL(
      url
    );
  };

  /*
   * ======================================================
   * KPIs
   * ======================================================
   */

  const stats = [
    [
      "Received (30d)",
      money(
        overview.payments_30d
      ),
      IndianRupee,
    ],

    [
      "Outstanding",
      money(
        overview.outstanding_total
      ),
      AlertTriangle,
    ],

    [
      "Paid organizations",
      String(
        overview.paid_organizations ||
          0
      ),
      CreditCard,
    ],

    [
      "Expiring in 10 days",
      String(
        overview.expiring_10_days ||
          0
      ),
      CalendarClock,
    ],
  ] as const;

  /*
   * ======================================================
   * UI
   * ======================================================
   */

  return (
    <div className="space-y-4">
      {/* =================================================
          KPIs
      ================================================= */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(
          ([
            label,
            value,
            Icon,
          ]) => (
            <div
              key={label}
              className={`${card} p-4 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>

                <Icon className="h-4 w-4 text-brand-600" />
              </div>

              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {value}
              </p>
            </div>
          )
        )}
      </div>

      {/* =================================================
          ORGANIZATION BILLING
      ================================================= */}

      <section
        className={`${card} overflow-hidden shadow-sm`}
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Organization billing
            </h3>

            <p className="mt-0.5 text-xs text-slate-500">
              {total} organization
              {total === 1
                ? ""
                : "s"}{" "}
              · Payment, renewal
              and subscription
              records
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

              <input
                className={`${inputCls} min-w-64 pl-9`}
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search organization, code, email"
              />
            </label>

            <select
              className={
                inputCls
              }
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
            >
              <option value="">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="past_due">
                Past due
              </option>

              <option value="trial">
                Trial
              </option>

              <option value="paused">
                Paused
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

            <button
              type="button"
              className={
                btnGhost
              }
              onClick={load}
              disabled={
                loading
              }
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

            <button
              type="button"
              className={
                btnGhost
              }
              onClick={
                exportCsv
              }
              disabled={
                !rows.length
              }
            >
              <Download className="h-4 w-4" />

              CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3">
                  Organization
                </th>

                <th className="px-4 py-3">
                  Plan
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3">
                  Users
                </th>

                <th className="px-4 py-3">
                  Paid
                </th>

                <th className="px-4 py-3">
                  Due
                </th>

                <th className="px-4 py-3">
                  Next billing
                </th>

                <th className="px-4 py-3">
                  Razorpay
                </th>

                <th className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading &&
              !rows.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Loading billing
                    data…
                  </td>
                </tr>
              ) : rows.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No billing
                    records found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={
                      r.company_id
                    }
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {r.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {r.org_code ||
                          r.email ||
                          "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium capitalize">
                        {r.plan_code ||
                          "—"}
                      </p>

                      <p className="text-xs text-slate-500">
                        {termLabel(
                          r.billing_cycle
                        )}

                        {r.discount_percent
                          ? ` · ${r.discount_percent}% off`
                          : ""}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {billingStatus(
                        r.status
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.licensed_users ||
                        "—"}
                    </td>

                    <td className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-300">
                      {money(
                        r.total_paid
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium text-rose-700 dark:text-rose-300">
                      {money(
                        r.total_due
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <p>
                        {fmtDate(
                          r.next_billing_at ||
                            r.current_period_end ||
                            r.trial_ends_at
                        )}
                      </p>

                      {r.latest_paid_at && (
                        <p className="text-xs text-slate-500">
                          Last paid{" "}
                          {fmtDateTime(
                            r.latest_paid_at
                          )}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.razorpay_subscription_id ? (
                        <Chip tone="violet">
                          Linked
                        </Chip>
                      ) : r.latest_paid_at ? (
                        <Chip tone="green">
                          Payment linked
                        </Chip>
                      ) : (
                        <Chip>
                          Not linked
                        </Chip>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className={
                            btnGhost
                          }
                          onClick={() =>
                            openPaymentHistory(
                              r
                            )
                          }
                        >
                          <ReceiptText className="h-4 w-4" />

                          Payments
                        </button>

                        {onOpenOrg && (
                          <button
                            type="button"
                            className={
                              btnGhost
                            }
                            onClick={() =>
                              onOpenOrg(
                                r.company_id
                              )
                            }
                          >
                            Manage
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================
          PAYMENT HISTORY DRAWER
      ================================================= */}

      {historyOrg && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Close payment history"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() =>
              setHistoryOrg(
                null
              )
            }
          />

          <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-900">
            {/* HEADER */}

            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-brand-600" />

                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Payment history
                  </h2>
                </div>

                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {historyOrg.name}
                </p>

                <p className="text-xs text-slate-500">
                  {historyOrg.org_code ||
                    historyOrg.email ||
                    "Organization"}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHistoryOrg(
                    null
                  )
                }
                aria-label="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* SUMMARY */}

            <div className="grid gap-3 border-b border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                <p className="text-xs text-slate-500">
                  Total paid
                </p>

                <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {money(
                    historyOrg.total_paid
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                <p className="text-xs text-slate-500">
                  Outstanding
                </p>

                <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">
                  {money(
                    historyOrg.total_due
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                <p className="text-xs text-slate-500">
                  Next renewal
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {fmtDate(
                    historyOrg.next_billing_at ||
                      historyOrg.current_period_end
                  )}
                </p>
              </div>
            </div>

            {/* CONTENT */}

            <div className="flex-1 overflow-y-auto p-5">
              {historyError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {historyError}
                </div>
              )}

              {historyLoading ? (
                <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              ) : payments.length ===
                0 ? (
                <div
                  className={`${card} p-8 text-center`}
                >
                  <ReceiptText className="mx-auto h-8 w-8 text-slate-400" />

                  <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                    No payment
                    records found.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map(
                    (payment) => (
                      <article
                        key={
                          payment.id
                        }
                        className={`${card} overflow-hidden shadow-sm`}
                      >
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {payment.receipt_number ||
                                  "Receipt pending"}
                              </p>

                              {billingStatus(
                                payment.status
                              )}
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {payment.paid_at
                                ? `Paid ${fmtDateTime(
                                    payment.paid_at
                                  )}`
                                : `Created ${fmtDateTime(
                                    payment.created_at
                                  )}`}
                            </p>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                              {money(
                                payment.amount_paid ||
                                  payment.total_amount
                              )}
                            </p>

                            <p className="text-xs uppercase text-slate-500">
                              {payment.currency ||
                                "INR"}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 p-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">
                              Plan
                            </p>

                            <p className="mt-1 font-medium capitalize text-slate-900 dark:text-white">
                              {payment.plan_code ||
                                "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Billing term
                            </p>

                            <p className="mt-1 font-medium text-slate-900 dark:text-white">
                              {termLabel(
                                payment.billing_cycle
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Payment method
                            </p>

                            <p className="mt-1 font-medium uppercase text-slate-900 dark:text-white">
                              {payment.payment_method ||
                                "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Source
                            </p>

                            <p className="mt-1 font-medium capitalize text-slate-900 dark:text-white">
                              {payment.source ||
                                "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Total amount
                            </p>

                            <p className="mt-1 font-medium text-slate-900 dark:text-white">
                              {money(
                                payment.total_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Outstanding
                            </p>

                            <p className="mt-1 font-medium text-slate-900 dark:text-white">
                              {money(
                                payment.amount_due
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                          <dl className="space-y-3 text-xs">
                            <div>
                              <dt className="text-slate-500">
                                Razorpay
                                Payment ID
                              </dt>

                              <dd className="mt-1 break-all font-mono text-slate-800 dark:text-slate-200">
                                {payment.razorpay_payment_id ||
                                  "—"}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-slate-500">
                                Razorpay
                                Order ID
                              </dt>

                              <dd className="mt-1 break-all font-mono text-slate-800 dark:text-slate-200">
                                {payment.razorpay_order_id ||
                                  "—"}
                              </dd>
                            </div>

                            {payment.razorpay_subscription_id && (
                              <div>
                                <dt className="text-slate-500">
                                  Razorpay
                                  Subscription
                                  ID
                                </dt>

                                <dd className="mt-1 break-all font-mono text-slate-800 dark:text-slate-200">
                                  {
                                    payment.razorpay_subscription_id
                                  }
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
