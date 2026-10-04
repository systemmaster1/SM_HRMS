"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

/**
 * Shown after sign-in when an Owner/Admin created the account or reset the
 * password (profiles.must_change_password). The employee must choose their
 * own password before using the app, so the admin no longer knows it.
 */
export default function ChangePasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return setError("Use letters and numbers.");
    if (pw !== pw2) return setError("The two passwords do not match.");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const { error: e1 } = await supabase.auth.updateUser({ password: pw });
    if (e1) {
      setBusy(false);
      return setError(/same|different/i.test(e1.message)
        ? "Choose a password different from the one you were given."
        : friendlyError(e1, "change your password"));
    }
    const { error: e2 } = await supabase.from("profiles").update({ must_change_password: false }).eq("id", auth.user.id);
    setBusy(false);
    if (e2) return setError(friendlyError(e2, "finish the password change"));
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5 dark:bg-slate-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Set your own password</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your administrator gave you a temporary password. Choose a new one that only you know.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="pw">New password</label>
        <div className="relative mt-1.5">
          <input id="pw" type={show ? "text" : "password"} autoComplete="new-password" value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">At least 8 characters, with letters and numbers.</p>

        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="pw2">Confirm new password</label>
        <input id="pw2" type={show ? "text" : "password"} autoComplete="new-password" value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" />

        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <button type="submit" disabled={busy}
          className="mt-6 w-full rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60">
          {busy ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </main>
  );
}
