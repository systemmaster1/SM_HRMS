"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, ArrowLeft, Check, Building2, UserRound, LayoutGrid, ClipboardCheck, ImagePlus, Copy } from "lucide-react";
import { LogoFull } from "@/components/Logo";
import ModulePicker, { defaultSelection, type CatalogItem } from "@/components/ModulePicker";
import { FEATURES, type FeatureKey } from "@/lib/features/registry";

const industries = [
  "IT / Software", "Manufacturing", "Retail", "Construction", "Healthcare",
  "Education", "Logistics", "Pharma", "FMCG / Distribution", "Services", "Other",
];
const sizes = ["1-10", "11-50", "51-200", "201-500", "500+"];
const timezones: [string, string][] = [
  ["Asia/Kolkata", "India (IST, UTC+5:30)"],
  ["Asia/Dubai", "UAE (UTC+4)"],
  ["Asia/Kathmandu", "Nepal (UTC+5:45)"],
  ["Asia/Dhaka", "Bangladesh (UTC+6)"],
  ["Asia/Colombo", "Sri Lanka (UTC+5:30)"],
  ["Asia/Singapore", "Singapore (UTC+8)"],
  ["Europe/London", "United Kingdom"],
  ["America/New_York", "US Eastern"],
  ["UTC", "UTC"],
];

/** Fallback if the feature catalogue cannot be read (Phase A not installed). */
const FALLBACK_CATALOG: CatalogItem[] = [
  { key: "attendance", parent: null, name: "Attendance", availability: "free" },
  { key: "leave", parent: null, name: "Leave Management", availability: "free" },
  { key: "tasks", parent: null, name: "Task Management", availability: "free" },
  { key: "tasks.delegation", parent: "tasks", name: "Delegation", availability: "free" },
  { key: "tasks.checklist", parent: "tasks", name: "Checklist", availability: "free" },
  { key: "field", parent: null, name: "Field Employee Management", availability: "paid" },
  { key: "field.tracking", parent: "field", name: "Field Tracking", availability: "paid" },
  { key: "field.visits", parent: "field", name: "Visit Management", availability: "paid" },
  { key: "payroll", parent: null, name: "Payroll", availability: "paid" },
];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200";

const STEPS = [
  { n: 1, title: "Organization", icon: Building2 },
  { n: 2, title: "Admin & contact", icon: UserRound },
  { n: 3, title: "Modules", icon: LayoutGrid },
  { n: 4, title: "Review", icon: ClipboardCheck },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  // Step 2
  const [adminName, setAdminName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  // Step 3
  const [catalog, setCatalog] = useState<CatalogItem[]>(FALLBACK_CATALOG);
  const [modules, setModules] = useState<string[]>(defaultSelection(FALLBACK_CATALOG));
  // Step 4
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  // Result
  const [done, setDone] = useState<{ orgCode: string | null; requested: string[]; warning?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      setEmail(auth.user.email || "");
      setAdminName(String(auth.user.user_metadata?.full_name || ""));

      // Already registered? Go to the dashboard.
      const { data: p } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
      if (p?.company_id) {
        const { data: c } = await supabase.from("companies").select("onboarding_completed_at").eq("id", p.company_id).maybeSingle();
        // Registered earlier (or registration finished) → dashboard.
        // Only a registration interrupted half-way stays here to finish.
        if (!c || (c as any).onboarding_completed_at) {
          router.replace("/dashboard");
          return;
        }
      }

      const { data: feats } = await supabase.from("features")
        .select("key, parent_key, name, availability").order("sort_order");
      if (feats && feats.length) {
        const cat = feats.map((f: any) => ({ key: f.key, parent: f.parent_key, name: f.name, availability: f.availability })) as CatalogItem[];
        setCatalog(cat);
        setModules(defaultSelection(cat));
      }
    })();
  }, [supabase, router]);

  /* ---------- validation per step ---------- */
  const validate = (s: number): string => {
    if (s === 1) {
      if (!name.trim()) return "Organization name is required.";
      if (name.trim().length < 2) return "Please enter the full organization name.";
    }
    if (s === 2) {
      if (!adminName.trim()) return "Admin name is required.";
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 13) return "Please enter a valid mobile number.";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
      if (pincode && !/^\d{6}$/.test(pincode.trim())) return "PIN code should be 6 digits.";
    }
    if (s === 3) {
      if (!modules.some((m) => !FEATURES[m as FeatureKey]?.parent)) return "Please choose at least one module.";
      if (modules.includes("tasks") && !modules.includes("tasks.delegation") && !modules.includes("tasks.checklist"))
        return "For Task Management, choose Delegation, Checklist or Both.";
      if (modules.includes("field") && !modules.includes("field.tracking") && !modules.includes("field.visits"))
        return "For Field Employee Management, choose Tracking, Visits or Both.";
    }
    return "";
  };

  const next = () => {
    const v = validate(step);
    if (v) return setError(v);
    setError("");
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickLogo = (f: File | null) => {
    if (!f) { setLogo(null); setLogoPreview(null); return; }
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.type)) return setError("Logo must be a PNG, JPG, WEBP or SVG image.");
    if (f.size > 2 * 1024 * 1024) return setError("Logo must be smaller than 2 MB.");
    setError("");
    setLogo(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  /* ---------- create ---------- */
  const looksLikeClockError = (msg?: string) =>
    !!msg && /issued at future|jwt|token|expired|not yet valid|clock/i.test(msg);

  const submit = async () => {
    for (const s of [1, 2, 3]) {
      const v = validate(s);
      if (v) { setError(v); setStep(s); return; }
    }
    setLoading(true);
    setError("");

    const { data: auth } = await supabase.auth.getUser();
    let { data: prof } = await supabase.from("profiles").select("company_id").eq("id", auth.user!.id).maybeSingle();

    // 1) Create the organization (skipped if a previous attempt already did).
    if (!prof?.company_id) {
      const runCreate = () => supabase.rpc("create_company", {
        p_name: name.trim(), p_industry: industry, p_size: size, p_city: city.trim(), p_phone: phone.trim(),
      });
      let { error: e } = await runCreate();
      if (e && looksLikeClockError(e.message)) {
        await supabase.auth.refreshSession();
        e = (await runCreate()).error;
      }
      if (e) {
        setLoading(false);
        setError(looksLikeClockError(e.message)
          ? "Your device clock looks slightly ahead of the correct time, so sign-in was rejected. Set date & time to automatic, then try again."
          : e.message);
        return;
      }
      prof = (await supabase.from("profiles").select("company_id").eq("id", auth.user!.id).maybeSingle()).data;
    }

    // 2) Organization details + module selection.
    const { data: res, error: setupErr } = await supabase.rpc("complete_organization_setup", {
      p: {
        admin_name: adminName.trim(), phone: phone.trim(), email: email.trim(),
        address: address.trim(), city: city.trim(), state: stateName.trim(), pincode: pincode.trim(),
        industry, size, timezone, modules,
      },
    });

    // 3) Logo (optional).
    let warning: string | undefined;
    if (logo && prof?.company_id) {
      const ext = (logo.name.split(".").pop() || "png").toLowerCase();
      const path = `${prof.company_id}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("company-logos").upload(path, logo, { upsert: true, contentType: logo.type });
      if (up.error) {
        warning = "Your logo could not be uploaded. You can add it later in Settings.";
      } else {
        const url = supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
        await supabase.from("companies").update({ logo_url: url }).eq("id", prof.company_id);
      }
    }

    setLoading(false);

    if (setupErr) {
      // The organization exists; details can be completed in Settings.
      setDone({
        orgCode: null, requested: [],
        warning: /complete_organization_setup/.test(setupErr.message)
          ? "Your organization was created. Module selection will be available once the latest update is installed; you can finish details in Settings."
          : `Your organization was created, but some details were not saved: ${setupErr.message}. You can complete them in Settings.`,
      });
      return;
    }

    const r = res as any;
    setDone({ orgCode: r?.org_code || null, requested: r?.modules?.requested || [], warning });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const tzLabel = timezones.find(([v]) => v === timezone)?.[1] || timezone;
  const chosenTop = modules.filter((m) => !FEATURES[m as FeatureKey]?.parent) as FeatureKey[];
  const avail = (k: string) => catalog.find((c) => c.key === k)?.availability;

  /* ---------- success ---------- */
  if (done) {
    const paidRequested = done.requested.filter((k) => !FEATURES[k as FeatureKey]?.parent || !done.requested.includes(FEATURES[k as FeatureKey].parent!));
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Your organization is ready</h1>
          {done.orgCode && (
            <div className="mx-auto mt-5 max-w-xs rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Organization ID</p>
              <button onClick={() => { navigator.clipboard?.writeText(done.orgCode!); setCopied(true); }}
                className="mt-1 inline-flex items-center gap-2 font-mono text-2xl font-bold text-brand-700 dark:text-brand-300">
                {done.orgCode} {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
              </button>
              <p className="mt-1 text-xs text-slate-500">Quote this ID whenever you contact support.</p>
            </div>
          )}
          {paidRequested.length > 0 && (
            <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <b>Activation requested:</b> {paidRequested.map((k) => FEATURES[k as FeatureKey]?.label || k).join(", ")}.
              {" "}Our team will contact you to activate these. Your free modules are ready to use now.
            </p>
          )}
          {done.warning && (
            <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-left text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">{done.warning}</p>
          )}
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
            Next: add your team from <b>Team → Add employee</b>. You can change modules any time in <b>Settings → Plan &amp; Features</b>.
          </p>
          <button onClick={() => { router.push("/dashboard"); router.refresh(); }}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800">
            Go to dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  /* ---------- wizard ---------- */
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <LogoFull width={150} />
          <button onClick={signOut}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600">
            <ArrowLeft className="h-4 w-4" /> Sign out
          </button>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Set up your organization</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Takes about two minutes. You can change everything later in Settings.</p>

        {/* Progress */}
        <ol className="my-6 grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const state = step > s.n ? "done" : step === s.n ? "current" : "todo";
            return (
              <li key={s.n}>
                <div className={`h-1.5 rounded-full ${state === "todo" ? "bg-slate-200 dark:bg-slate-700" : "bg-brand-700"}`} />
                <p className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold sm:text-xs ${state === "todo" ? "text-slate-400" : "text-brand-700 dark:text-brand-300"}`}>
                  {state === "done" ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="truncate">{s.title}</span>
                </p>
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-7">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Organization name *</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Industries Pvt Ltd" autoFocus />
                <p className="mt-1 text-xs text-slate-500">Your Organization ID (e.g. ORG-00125) is created automatically.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Industry</label>
                  <select className={inputCls} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                    <option value="">Select industry</option>
                    {industries.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Number of employees</label>
                  <select className={inputCls} value={size} onChange={(e) => setSize(e.target.value)}>
                    <option value="">Select range</option>
                    {sizes.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Time zone</label>
                <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {timezones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Saved with your organization. Attendance and reminders currently run on Indian Standard Time.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Admin name *</label>
                  <input className={inputCls} value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className={labelCls}>Mobile *</label>
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Organization email</label>
                <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hr@company.com" inputMode="email" />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, street, area" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input className={inputCls} value={stateName} onChange={(e) => setStateName(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>PIN code</label>
                  <input className={inputCls} value={pincode} onChange={(e) => setPincode(e.target.value)} inputMode="numeric" maxLength={6} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                Choose the modules your organization will use. <b>Free</b> modules start immediately.
                For <b>paid</b> modules we&apos;ll send an activation request to our team.
              </p>
              <ModulePicker catalog={catalog} selected={modules} onChange={setModules} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className={labelCls}>Company logo (optional)</p>
                <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-300 p-4 transition hover:border-brand-500 dark:border-slate-600">
                  <span className="keep-light grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                    {logoPreview
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={logoPreview} alt="" className="h-full w-full object-contain" />
                      : <ImagePlus className="h-6 w-6 text-slate-400" />}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {logo ? logo.name : "Upload PNG, JPG or SVG, up to 2 MB"}
                    <span className="block text-xs text-slate-400">Shown on reports and the PDF visit log.</span>
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                    onChange={(e) => pickLogo(e.target.files?.[0] || null)} />
                </label>
              </div>

              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-700 dark:border-slate-700">
                {[
                  ["Organization", name],
                  ["Industry / size", [industry, size && `${size} employees`].filter(Boolean).join(" · ") || "—"],
                  ["Time zone", tzLabel],
                  ["Admin", `${adminName} · ${phone}`],
                  ["Email", email || "—"],
                  ["Address", [address, city, stateName, pincode].filter(Boolean).join(", ") || "—"],
                  ["Registration date", new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 px-4 py-2.5">
                    <dt className="w-36 shrink-0 text-slate-500">{k}</dt>
                    <dd className="min-w-0 flex-1 text-slate-900 dark:text-slate-100">{v}</dd>
                  </div>
                ))}
                <div className="flex gap-3 px-4 py-2.5">
                  <dt className="w-36 shrink-0 text-slate-500">Modules</dt>
                  <dd className="min-w-0 flex-1 space-y-1">
                    {chosenTop.map((k) => {
                      const subs = modules.filter((m) => FEATURES[m as FeatureKey]?.parent === k).map((m) => FEATURES[m as FeatureKey].label);
                      const paid = avail(k) === "paid";
                      return (
                        <p key={k} className="text-slate-900 dark:text-slate-100">
                          {FEATURES[k].label}{subs.length ? ` (${subs.join(" + ")})` : ""}
                          <span className={`ml-2 text-xs font-semibold ${paid ? "text-accent-700 dark:text-accent-300" : "text-emerald-600"}`}>
                            {paid ? "activation on request" : "free"}
                          </span>
                        </p>
                      );
                    })}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button onClick={() => { setError(""); setStep(step - 1); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <span />}
            {step < 4 ? (
              <button onClick={next}
                className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60">
                {loading ? "Creating organization…" : <>Create organization <Check className="h-4 w-4" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
