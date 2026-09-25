import { sendGmailMessage } from "@/lib/gmail";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n || 0));
const date = (v?: string | null) => v ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(v)) : "—";
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"\']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","\'":"&#39;" }[c] || c));

function shell(title: string, intro: string, body: string) {
  return "<!doctype html><html><body style=\"margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a\"><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"padding:28px 12px\"><tr><td align=\"center\"><table role=\"presentation\" width=\"620\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:620px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden\"><tr><td style=\"padding:24px 28px;background:#0f2747;color:#fff\"><div style=\"font-size:12px;letter-spacing:1.4px;text-transform:uppercase;opacity:.8\">SystemMaster Automations</div><h1 style=\"margin:7px 0 0;font-size:22px\">"+esc(title)+"</h1></td></tr><tr><td style=\"padding:28px\"><p style=\"margin:0 0 18px;line-height:1.65;color:#475569\">"+esc(intro)+"</p>"+body+"<p style=\"margin:26px 0 0;font-size:12px;line-height:1.6;color:#64748b\">This is an automated billing email from SM HRMS. For billing assistance, contact <b>connect@systemmaster.in</b>.</p></td></tr></table></td></tr></table></body></html>";
}

const row = (label: string, value: string) => "<tr><td style=\"padding:9px 0;color:#64748b\">"+esc(label)+"</td><td align=\"right\" style=\"padding:9px 0;font-weight:600\">"+esc(value)+"</td></tr>";

export async function sendPaymentReceiptEmail(input: { to:string; companyName:string; receiptNumber:string; planCode?:string|null; amount:number; paymentId?:string|null; paidAt?:string|null; billingPeriodEnd?:string|null; }) {
  const body = "<div style=\"border:1px solid #e2e8f0;border-radius:12px;padding:18px\"><table width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">"+row("Organization",input.companyName)+row("Receipt",input.receiptNumber)+row("Plan",String(input.planCode||"SM HRMS").toUpperCase())+row("Amount received",money(input.amount))+row("Payment date",date(input.paidAt))+row("Billing period until",date(input.billingPeriodEnd))+(input.paymentId?row("Razorpay Payment ID",input.paymentId):"")+"</table></div><p style=\"margin:18px 0 0;color:#166534;font-weight:700\">Payment received successfully. Thank you.</p>";
  return sendGmailMessage(input.to, "Payment received · "+input.receiptNumber+" · SM HRMS", shell("Payment Receipt","Hello "+input.companyName+", your SM HRMS payment has been received successfully.",body));
}

export async function sendBillingReminderEmail(input: { to:string; companyName:string; planCode?:string|null; amountDue:number; dueAt:string; kind:"due_10_days"|"due_today"|"past_due"|"payment_failed"; }) {
  const titles={due_10_days:"Payment Reminder",due_today:"Payment Due Today",past_due:"Payment Past Due",payment_failed:"Payment Failed"} as const;
  const intros={due_10_days:"Your SM HRMS subscription is due in 10 days. Please arrange payment to avoid interruption.",due_today:"Your SM HRMS subscription payment is due today.",past_due:"Your SM HRMS subscription payment is overdue. Please complete payment to restore or continue paid access.",payment_failed:"We could not confirm your recent SM HRMS payment. Please retry the payment."} as const;
  const body="<div style=\"border:1px solid #e2e8f0;border-radius:12px;padding:18px\"><table width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">"+row("Organization",input.companyName)+row("Plan",String(input.planCode||"SM HRMS").toUpperCase())+row("Amount due",money(input.amountDue))+row("Due date",date(input.dueAt))+"</table></div>";
  return sendGmailMessage(input.to,titles[input.kind]+" · SM HRMS",shell(titles[input.kind],intros[input.kind],body));
}