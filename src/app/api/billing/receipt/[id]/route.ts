import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function adminClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error("Supabase server configuration is missing");
 return createAdminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await createClient();
  const {data:{user}}=await session.auth.getUser();
  if(!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  const {id}=await params; const admin=adminClient();
  const {data:profile,error:profileError}=await admin.from("profiles").select("company_id").eq("id",user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile?.company_id)return NextResponse.json({error:"Organization not found."},{status:404});
  const {data:payment,error:paymentError}=await admin.from("billing_payments")
   .select("id,company_id,plan_code,billing_cycle,currency,subtotal,tax_amount,adjustment_amount,total_amount,amount_paid,amount_due,status,receipt_number,razorpay_payment_id,razorpay_order_id,payment_method,source,paid_at,created_at,metadata")
   .eq("id",id).eq("company_id",profile.company_id).maybeSingle();
  if(paymentError)throw paymentError;
  if(!payment)return NextResponse.json({error:"Receipt not found for this organization."},{status:404});
  const [{data:company},{data:subscription}]=await Promise.all([
   admin.from("companies").select("*").eq("id",profile.company_id).maybeSingle(),
   admin.from("company_subscriptions").select("plan_code,licensed_users,current_period_start,current_period_end,next_billing_at,billing_cycle").eq("company_id",profile.company_id).maybeSingle()
  ]);
  return NextResponse.json({payment,company,subscription},{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch(error:any){
  console.error("Customer receipt failed:",error);
  return NextResponse.json({error:String(error?.message||"Unable to load receipt.")},{status:500});
 }
}