"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgencyAdmin } from "@/lib/agency-auth";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean=(form:FormData,key:string)=>String(form.get(key)??"").trim();
const money=(value:string):number|null => {
  if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value))return null;
  const amount=Number(value);
  return Number.isFinite(amount)&&amount<=10000000?amount:null;
};
function done(ok:boolean,clientId:string){
  revalidatePath("/agency","layout");
  const q=new URLSearchParams({[ok?"success":"error"]:"1"});
  if(uuid.test(clientId))q.set("client",clientId);
  redirect("/agency/advertising?"+q);
}

export async function saveAgencyAdvertisingSettings(form:FormData){
  const {supabase,userId}=await requireAgencyAdmin();
  const clientId=clean(form,"client_id");
  const amount=money(clean(form,"initial_testing_budget_aud"));
  const objectives=clean(form,"objectives");
  const phase=clean(form,"phase");
  if(!uuid.test(clientId)||amount===null||objectives.length>1200||
     !["testing","optimising","scaling"].includes(phase))done(false,clientId);
  const {data:client,error:clientError}=await supabase.from("clients").select("id")
    .eq("id",clientId).maybeSingle();
  if(clientError||!client)done(false,clientId);
  const {data:existing,error:existingError}=await supabase.from("client_ad_budget_settings")
    .select("client_id").eq("client_id",clientId).maybeSingle();
  if(existingError)done(false,clientId);
  const values={initial_testing_budget_aud:amount,objectives,phase,
    updated_by:userId,updated_at:new Date().toISOString()};
  const result=existing
    ? await supabase.from("client_ad_budget_settings").update(values).eq("client_id",clientId)
    : await supabase.from("client_ad_budget_settings").insert({client_id:clientId,...values});
  done(!result.error,clientId);
}

export async function proposeAgencyAdvertisingBudget(form:FormData){
  const {supabase}=await requireAgencyAdmin();
  const clientId=clean(form,"client_id");
  const limit=money(clean(form,"proposed_monthly_limit_aud"));
  const reason=clean(form,"reason");
  if(!uuid.test(clientId)||limit===null||reason.length<12||reason.length>1200)
    done(false,clientId);
  const {error}=await supabase.rpc("propose_ad_budget",{
    p_client_id:clientId,p_limit:limit,p_reason:reason
  });
  done(!error,clientId);
}

export async function withdrawAgencyAdvertisingBudget(form:FormData){
  const {supabase}=await requireAgencyAdmin();
  const clientId=clean(form,"client_id"),requestId=clean(form,"request_id");
  if(!uuid.test(clientId)||!uuid.test(requestId))done(false,clientId);
  const {data:row,error:readError}=await supabase.from("client_ad_budget_requests")
    .select("client_id").eq("id",requestId).maybeSingle();
  if(readError||row?.client_id!==clientId)done(false,clientId);
  const {data,error}=await supabase.rpc("withdraw_ad_budget_proposal",{p_request_id:requestId});
  done(!error&&data===true,clientId);
}
