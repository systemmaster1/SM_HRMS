export const MINIMUM_BILLING_MONTHS = 3;

export const BASE_MONTHLY_PER_USER: Record<string, number> = {
  starter: 29,
  business: 79,
  pro: 99,
  enterprise: 149,
};

export const BILLING_TERMS = {
  "3_months": { months: 3, discountPercent: 0 },
  "6_months": { months: 6, discountPercent: 10 },
  yearly: { months: 12, discountPercent: 15 },
} as const;

export type BillingTerm = keyof typeof BILLING_TERMS;

export function isPaidPlan(planCode: string) {
  return Object.prototype.hasOwnProperty.call(
    BASE_MONTHLY_PER_USER,
    String(planCode || "").trim().toLowerCase()
  );
}

export function calculatePlanPrice(
  planCode: string,
  users: number,
  term: BillingTerm
) {
  const plan = String(planCode || "").trim().toLowerCase();
  const seats = Math.max(1, Math.floor(Number(users || 0)));
  const config = BILLING_TERMS[term];

  if (!config) throw new Error("Invalid billing term");

  const baseRate = BASE_MONTHLY_PER_USER[plan];
  if (!baseRate) throw new Error("This plan is not configured as a paid plan");

  const effectiveRate = Number(
    (baseRate * (1 - config.discountPercent / 100)).toFixed(2)
  );

  const subtotal = Number((baseRate * seats * config.months).toFixed(2));
  const discountAmount = Number(
    (subtotal * (config.discountPercent / 100)).toFixed(2)
  );
  const total = Number((subtotal - discountAmount).toFixed(2));

  return {
    planCode: plan,
    users: seats,
    months: config.months,
    discountPercent: config.discountPercent,
    baseMonthlyPerUser: baseRate,
    effectiveMonthlyPerUser: effectiveRate,
    subtotal,
    discountAmount,
    total,
    currency: "INR" as const,
  };
}
