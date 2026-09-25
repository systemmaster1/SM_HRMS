import { calculatePlanPrice, type BillingTerm } from "@/lib/billing-pricing";

const DAY_MS = 86_400_000;

export function calculateUpgradeProration(input: {
  oldPlanCode: string;
  newPlanCode: string;
  users: number;
  newTerm: BillingTerm;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  previousAmountPaid?: number | null;
  now?: Date;
}) {
  const now = input.now || new Date();
  const newQuote = calculatePlanPrice(input.newPlanCode, input.users, input.newTerm);
  const start = input.currentPeriodStart ? new Date(input.currentPeriodStart) : null;
  const end = input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null;
  const previousPaid = Math.max(0, Number(input.previousAmountPaid || 0));

  let unusedCredit = 0;
  let remainingRatio = 0;

  if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) &&
      end.getTime() > start.getTime() && now.getTime() < end.getTime()) {
    const totalMs = end.getTime() - start.getTime();
    const remainingMs = Math.max(0, end.getTime() - Math.max(now.getTime(), start.getTime()));
    remainingRatio = Math.min(1, remainingMs / totalMs);
    unusedCredit = Number((previousPaid * remainingRatio).toFixed(2));
  }

  const payableNow = Number(Math.max(0, newQuote.total - unusedCredit).toFixed(2));

  return {
    ...newQuote,
    oldPlanCode: input.oldPlanCode,
    previousAmountPaid: previousPaid,
    remainingRatio,
    unusedCredit,
    payableNow,
    calculatedAt: now.toISOString(),
    remainingDays: end && end.getTime() > now.getTime()
      ? Math.ceil((end.getTime() - now.getTime()) / DAY_MS)
      : 0,
  };
}
