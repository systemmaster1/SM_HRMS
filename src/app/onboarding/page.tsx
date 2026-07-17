"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Check } from "lucide-react";
import { LogoFull } from "@/components/Logo";

const industries = [
  "IT / Software", "Manufacturing", "Retail", "Construction",
  "Healthcare", "Education", "Logistics", "Services", "Other",
];
const sizes = ["1-10", "11-50", "51-200", "201-500", "500+"];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10";

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Organization name is required.");
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_company", {
      p_name: name.trim(),
      p_industry: industry,
      p_size: size,
      p_city: city,
      p_phone: phone,
    });

    setLoading(false);
    if (error) return setError(error.message);

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <LogoFull width={170} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-7 flex items-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition ${step >= s ? "bg-brand-700" : "bg-slate-200"}`} />
              </div>
            ))}
          </div>

          {step === 1 && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Set up your organization
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                This will be your company&apos;s HRMS workspace.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Organization name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="SystemMaster Automations"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Industry</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {industries.map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIndustry(i)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          industry === i
                            ? "border-brand-700 bg-brand-50 font-medium text-brand-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Team size</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`rounded-lg border px-3.5 py-1.5 text-sm transition ${
                          size === s
                            ? "border-brand-700 bg-brand-50 font-medium text-brand-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </p>
              )}

              <button
                onClick={() => {
                  if (!name.trim()) return setError("Organization name is required.");
                  setError("");
                  setStep(2);
                }}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                A few more details
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                You can change these later in Settings.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">City</label>
                  <input
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="Delhi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Company phone</label>
                  <input
                    className={`mt-1.5 ${inputCls}`}
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <Check className="h-4 w-4" /> 7-day free trial included
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Then ₹19 per active user per month (launch offer). Cancel anytime.
                </p>
              </div>

              {error && (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </p>
              )}

              <div className="mt-7 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={submit}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {loading ? "Creating…" : "Create organization"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
