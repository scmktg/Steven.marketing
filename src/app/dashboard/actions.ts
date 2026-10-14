"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function decideAdvertisingBudget(form:FormData){
  const supabase=await createClient();
  const {data:verified,error:authError}=await supabase.auth.getClaims();
  if(authError||!verified?.claims?.sub)redirect("/login");
  const clientId=String(form.get("client_id")??"");
  const requestId=String(form.get("request_id")??"");
  const decision=String(form.get("decision")??"");
  if(!uuid.test(clientId)||!uuid.test(requestId)||!["approve","decline"].includes(decision))
    redirect("/dashboard/advertising?error=1");
  const {data:membership,error:memberError}=await supabase.from("client_memberships")
    .select("role, clients(id,slug)").eq("client_id",clientId)
    .eq("user_id",verified.claims.sub).maybeSingle();
  const row=membership?.clients;
  const client=Array.isArray(row)?row[0]:row;
  if(memberError||membership?.role!=="owner"||!client)
    redirect("/dashboard/advertising?error=1");
  const {data:request,error:readError}=await supabase.from("client_ad_budget_requests")
    .select("client_id,status").eq("id",requestId).maybeSingle();
  const q=new URLSearchParams({client:client.slug});
  if(readError||request?.client_id!==clientId||request.status!=="pending"){
    q.set("error","1");
    redirect("/dashboard/advertising?"+q);
  }
  const {error}=await supabase.rpc("decide_ad_budget_request",{
    p_request_id:requestId,p_approve:decision==="approve"
  });
  q.set(error?"error":"success","1");
  revalidatePath("/dashboard","layout");
  redirect("/dashboard/advertising?"+q);
}
