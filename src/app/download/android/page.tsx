import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AndroidDownloadCard from "@/components/AndroidDownloadCard";

export default function AndroidDownloadPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to SM HRMS
        </Link>
        <AndroidDownloadCard />
        <p className="mt-5 text-center text-xs leading-5 text-slate-400">
          Android controls installation of APK files. For security, installation cannot be completed silently by a website.
        </p>
      </div>
    </main>
  );
}
