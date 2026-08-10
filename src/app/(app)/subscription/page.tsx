"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Crown, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Plan = {
  code: string;
  name: string;
  price_per_user: number | null;
  description: string;
  is_custom: boolean;
};

export default function SubscriptionPage() {
  const supabase = useMemo(() => createClient(), []);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [{ data: p }, { data: auth }] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("active", true).order("display_order"),
      supabase.auth.getUser(),
    ]);
    setPlans((p || []) as Plan[]);
    if (!auth.user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).single();
    if (!profile?.company_id) return;
    const [{ data: s }, { data: f }] = await Promise.all([
      supabase.from("company_subscriptions").select("*").eq("company_id", profile.company_id).single(),
      supabase.from("plan_features").select("*"),
    ]);
    setSub(s || null);
    setFeatures(f || []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const requestCancel = async () => {
    const { error } = await supabase.rpc("customer_set_cancel_at_period_end", { p_cancel: true });
    setMessage(error ? error.message : "Cancellation scheduled for the end of the billing period.");
    if (!error) load();
  };

  const current = plans.find((p) => p.code === sub?.plan_code);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200">
              <WalletCards className="h-3.5 w-3.5" /> Subscription & Billing
            </div>
            <h1 className="mt-3 text-3xl font-bold">Your SM HRMS Plan</h1>
            <p className="mt-2 text-sm text-slate-300">Review your plan, seats and upgrade options.</p>
          </div>
          {sub && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Current plan</div>
              <div className="mt-1 text-2xl font-bold capitalize">{sub.plan_code}</div>
              <div className="mt-1 text-sm text-slate-300">{sub.licensed_users} licensed users · {sub.status}</div>
            </div>
          )}
        </div>
      </section>

      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-4">
        {plans.map((p) => {
          const currentPlan = p.code === sub?.plan_code;
          const keys = features.filter((f) => f.plan_code === p.code && f.enabled).slice(0, 8);
          return (
            <div key={p.code} className={`rounded-3xl border bg-white p-5 ${p.code === "pro" ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{p.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{p.description}</p>
                </div>
                {p.code === "pro" && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase text-brand-700">Popular</span>}
              </div>
              <div className="mt-5">
                <span className="text-3xl font-bold">₹{p.price_per_user ?? 149}</span>
                <span className="text-sm text-slate-500"> / user / month</span>
                {p.is_custom && <div className="mt-1 text-xs text-slate-400">Starting price · custom quote available</div>}
              </div>
              <div className="mt-5 space-y-2">
                {keys.map((f) => (
                  <div key={f.feature_key} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{f.feature_key.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
              <button
                disabled={currentPlan}
                className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold ${currentPlan ? "bg-slate-100 text-slate-500" : "bg-slate-950 text-white"}`}
                onClick={() => !currentPlan && setMessage(p.code === "enterprise" ? "Contact SystemMaster for Enterprise customization." : `Upgrade to ${p.name}: Razorpay checkout will be connected in the next billing phase.`)}
              >
                {currentPlan ? "Current plan" : p.is_custom ? "Contact Sales" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </section>

      {sub && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">Manage subscription</h2>
              <p className="mt-1 text-sm text-slate-500">
                {sub.cancel_at_period_end ? "Cancellation is scheduled for the period end." : "Your subscription remains active until cancelled or changed."}
              </p>
            </div>
            {!sub.cancel_at_period_end && (
              <button onClick={requestCancel} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700">
                Cancel at period end
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
