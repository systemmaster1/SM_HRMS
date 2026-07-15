"use client";

import { useEffect, useState } from "react";

export default function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <div className={`h-8 ${className}`} />;

  const date = now.toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className={`flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-300 ${className}`}>
      <span className="font-medium">{date}</span>
      <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-500" />
      <span className="tabular-nums text-slate-700 dark:text-white">{time}</span>
    </div>
  );
}
