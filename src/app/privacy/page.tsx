import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy · SM HRMS",
  description: "How SM HRMS collects, uses and protects your data.",
};

const LAST_UPDATED = "10 August 2026";

/* A small helper for consistent section headings */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700">
              <LogoMark size={34} />
            </div>
            <span className="text-[16px] font-bold tracking-tight">SM HRMS</span>
          </Link>
          <Link href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <ShieldCheck className="h-3 w-3" /> Your data, protected
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          SM HRMS (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the app&rdquo;) is a human-resource
          management platform operated by SystemMaster Automations. This policy explains what
          information we collect, why we collect it, how it is used, and the choices you have.
          SM HRMS is provided to organizations for their employees; your employer is the owner
          of your workspace data, and we process it on their behalf.
        </p>

        <Section title="1. Information we collect">
          <p>We collect only the information needed to run your organization&rsquo;s HR operations:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li><strong>Account details</strong> — your name, email address, mobile number, role and department.</li>
            <li><strong>Location data</strong> — GPS coordinates used for attendance, field visits and, where your organization enables field tracking for your role, duty-time location visibility. Field tracking is bounded by attendance: it can begin only after Attendance IN and stops after Attendance OUT.</li>
            <li><strong>Photos</strong> — a selfie taken at check-in when your organization enables photo verification.</li>
            <li><strong>Employment records</strong> — attendance, leave, tasks, payroll figures, documents and KYC information added by you or your administrator.</li>
            <li><strong>Device &amp; usage data</strong> — basic technical information such as your IP address and app interactions, used for security and to keep the service working.</li>
          </ul>
        </Section>

        <Section title="2. How we use your information">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>To record and verify attendance, including location and optional selfie checks.</li>
            <li>To manage leave, tasks, payroll, field visits and other HR functions.</li>
            <li>To send you notifications about approvals, tasks and account activity.</li>
            <li>To secure the platform and prevent misuse.</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal data, and we do not use it for advertising.</p>
        </Section>

        <Section title="3. Location &amp; camera permissions">
          <p>
            The app requests <strong>location</strong> and <strong>camera</strong> permissions because attendance and field work may depend on them. If your organization enables field tracking for your role, location may be collected at configured intervals <strong>only while you are on duty</strong> (after Attendance IN and before Attendance OUT), or only during an active field visit if your organization chooses that narrower mode. After Attendance OUT the tracking service records an <strong>Employee Off Duty</strong> state and does not store new GPS coordinates.
          </p>
          <p>
            GPS permission denied/unavailable states, silent tracking gaps and later restoration may be recorded for audit and operational reporting. Silent gaps are marked as <strong>inferred</strong> when the server does not receive an expected heartbeat. The camera is used only for user-initiated photo capture such as attendance verification.
          </p>
        </Section>

        <Section title="4. Trusted timestamps &amp; attendance integrity">
          <p>
            Attendance IN/OUT, field-visit action times and tracking audit events use timestamps generated or validated by our server infrastructure. The employee device clock is not accepted as the authoritative punch time. This helps prevent backdating by changing the date or time on a phone or computer.
          </p>
        </Section>

        <Section title="5. Data sharing">
          <p>Your information is visible to:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>The administrators and authorized managers of your own organization&rsquo;s workspace.</li>
            <li>Our infrastructure providers who host the service on our behalf (for example, our cloud database and hosting providers), under confidentiality obligations.</li>
          </ul>
          <p>
            We do not share your personal data with third parties outside your organization,
            except where required by law.
          </p>
        </Section>

        <Section title="6. Google Workspace / Drive backup">
          <p>
            If your organization chooses to enable the backup integration, HR data can be exported
            or backed up to <strong>your organization&rsquo;s own Google Drive or Google Sheets</strong>.
            In that case the data resides in your organization&rsquo;s Google account under Google&rsquo;s
            terms, and your organization controls it. We only facilitate the export you initiate.
          </p>
        </Section>

        <Section title="7. Data security">
          <p>
            Data is transmitted over encrypted HTTPS connections and stored with access controls so
            that only authorized users in your workspace can view it. No method of transmission or
            storage is completely secure, but we take reasonable measures to protect your information.
          </p>
        </Section>

        <Section title="8. Data retention">
          <p>
            We retain your data for as long as your organization maintains an active account, or as
            needed to provide the service and meet legal obligations. When an employee is offboarded,
            their historical records are retained for the organization&rsquo;s records unless the
            organization requests deletion.
          </p>
        </Section>

        <Section title="9. Your rights &amp; data deletion">
          <p>
            You may request access to, correction of, or deletion of your personal data. Because your
            employer owns the workspace, such requests are usually handled through your organization&rsquo;s
            administrator. You may also contact us directly using the details below, and we will
            respond in coordination with your organization.
          </p>
        </Section>

        <Section title="10. Children">
          <p>SM HRMS is intended for use by employees and is not directed at anyone under 18.</p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be reflected by the
            &ldquo;Last updated&rdquo; date at the top of this page.
          </p>
        </Section>

        <Section title="12. Contact us">
          <p>
            For any privacy question or request, contact:
          </p>
          <ul className="ml-5 list-none space-y-1">
            <li><strong>SystemMaster Automations</strong></li>
            <li>Email: <a href="mailto:Connect@systemmaster.in" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">Connect@systemmaster.in</a></li>
            <li>Phone: <a href="tel:+919027965956" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">+91 90279 65956</a></li>
            <li>Web: <a href="https://www.systemmaster.in" target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">www.systemmaster.in</a></li>
          </ul>
        </Section>

        <div className="mt-12 border-t border-slate-100 pt-6 dark:border-slate-800">
          <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
            ← Back to SM HRMS
          </Link>
        </div>
      </main>
    </div>
  );
}
