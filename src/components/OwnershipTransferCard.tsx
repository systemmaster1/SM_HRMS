"use client";

import { useEffect, useState } from "react";
import { Crown, KeyRound, UserCheck } from "lucide-react";

type Person = { id: string; full_name: string | null; email: string | null };
type Pending = {
  id: string; from_user: string; to_user: string; note: string;
  created_at: string; expires_at: string; from_name?: string; to_name?: string;
};
type State = { me: { id: string; role: string }; owner: Person | null; pending: Pending | null; admins: Person[] };

const label = (p?: Person | null) => p ? (p.full_name || p.email || "Member") : "—";
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function OwnershipTransferCard() {
  const [state, setState] = useState<State | null>(null);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState<null | "initiate" | "accept" | "cancel" | "decline">(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const r = await fetch("/api/team/ownership", { cache: "no-store" });
    if (r.ok) setState(await r.json());
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    if (!confirming || !password) return;
    setBusy(true); setMessage(null);
    const r = await fetch("/api/team/ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: confirming, password, to_user_id: to, note, transfer_id: state?.pending?.id }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setPassword("");
    if (!r.ok) { setMessage({ ok: false, text: j.error || "Something went wrong. Please try again." }); return; }
    const done = confirming;
    setConfirming(null);
    setMessage({
      ok: true,
      text: done === "initiate" ? "Request sent. The new owner must accept within 72 hours."
        : done === "accept" ? "You are now the Owner of this organization."
        : done === "decline" ? "Request declined." : "Request cancelled.",
    });
    if (done === "accept") { window.location.reload(); return; }
    setTo(""); setNote("");
    await load();
  }

  if (!state) return null;
  const { me, owner, pending, admins } = state;
  const isOwner = me.role === "owner";
  const isTarget = pending?.to_user === me.id;
  const isSender = pending?.from_user === me.id;

  const confirmBox = confirming && (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="text-sm text-amber-900 dark:text-amber-200">
        {confirming === "initiate" && "After the new owner accepts, you become an Admin. Only the Owner can manage billing, Admin roles and organization deletion."}
        {confirming === "accept" && "You will become the Owner. The current Owner will become an Admin."}
        {confirming === "cancel" && "The request will be cancelled."}
        {confirming === "decline" && "The request will be declined. The current Owner stays the Owner."}
      </p>
      <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="ownership-password">
        Enter your password to confirm
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input id="ownership-password" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" />
        <button onClick={submit} disabled={busy || !password}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
          {busy ? "Please wait…" : "Confirm"}
        </button>
        <button onClick={() => { setConfirming(null); setPassword(""); }} disabled={busy}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">Back</button>
      </div>
    </div>
  );

  return (
    <section id="ownership" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Crown className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ownership & Administration</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Owner: <span className="font-medium text-slate-800 dark:text-slate-200">{label(owner)}</span>
            {owner?.id === me.id && " (you)"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            The Owner manages billing, grants or removes Admins and can delete the organization. There is always exactly one Owner.
          </p>
        </div>
      </div>

      {pending && (
        <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            <UserCheck className="h-4 w-4" aria-hidden />
            Transfer pending: {pending.from_name || "Owner"} → {pending.to_name || "Admin"}
          </div>
          <p className="mt-1 text-xs text-slate-500">Requested {when(pending.created_at)} · expires {when(pending.expires_at)}</p>
          {pending.note && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">“{pending.note}”</p>}
          {!confirming && (
            <div className="mt-3 flex flex-wrap gap-2">
              {isTarget && (
                <>
                  <button onClick={() => setConfirming("accept")}
                    className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Accept ownership</button>
                  <button onClick={() => setConfirming("decline")}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">Decline</button>
                </>
              )}
              {isSender && (
                <button onClick={() => setConfirming("cancel")}
                  className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:text-rose-300">Cancel request</button>
              )}
              {!isTarget && !isSender && <p className="text-sm text-slate-500">Waiting for the proposed owner to respond.</p>}
            </div>
          )}
          {confirmBox}
        </div>
      )}

      {isOwner && !pending && (
        <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            <KeyRound className="h-4 w-4" aria-hidden /> Transfer ownership
          </div>
          {admins.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Ownership can be transferred only to an active Admin. Make someone an Admin in Team first.
            </p>
          ) : (
            <>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-300" htmlFor="ownership-to">New owner (Admins only)</label>
              <select id="ownership-to" value={to} onChange={(e) => setTo(e.target.value)} disabled={!!confirming}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
                <option value="">Choose an Admin…</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{label(a)}{a.email && a.full_name ? ` · ${a.email}` : ""}</option>)}
              </select>
              <label className="mt-3 block text-sm text-slate-600 dark:text-slate-300" htmlFor="ownership-note">Message (optional)</label>
              <input id="ownership-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} disabled={!!confirming}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
              {!confirming && (
                <button onClick={() => setConfirming("initiate")} disabled={!to}
                  className="mt-4 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  Send transfer request
                </button>
              )}
              {confirmBox}
            </>
          )}
        </div>
      )}

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
