"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgencyAdmin } from "@/lib/agency-auth";
import { validDate } from "@/lib/commission";

const clean = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function allowedClient(supabase: Awaited<ReturnType<typeof requireAgencyAdmin>>["supabase"], id: string) {
  if (!uuidPattern.test(id)) return false;
  const { data, error } = await supabase.from("clients").select("id").eq("id", id).maybeSingle();
  return !error && Boolean(data);
}

function finish(section: string, ok: boolean, clientId?: string) {
  revalidatePath("/agency", "layout");
  const query = new URLSearchParams({ [ok ? "success" : "error"]: "1" });
  if (clientId) query.set("client", clientId);
  redirect(`/agency/${section}?${query.toString()}`);
}

export async function createAgencyClient(data: FormData) {
  const { supabase } = await requireAgencyAdmin();
  const name = clean(data,"name");
  const slug = clean(data,"slug").toLowerCase();
  if (!name || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) finish("clients",false);
  const { error } = await supabase.from("clients").insert({ name, slug });
  finish("clients",!error);
}

export async function saveAgencyTerms(data: FormData) {
  const { supabase } = await requireAgencyAdmin();
  const clientId = clean(data, "client_id");
  if (!await allowedClient(supabase, clientId)) finish("clients", false);
  const model = clean(data,"commission_model");
  const revenueBasis=clean(data,"revenue_basis");
  if(!["net_sales","total_sales"].includes(revenueBasis)) finish("commissions",false,clientId);

  if (!["tiered_revenue_growth","revenue_growth","manual"].includes(model)) finish("commissions",false,clientId);

  const start = clean(data,"contract_start_date");
  if(start && !validDate(start))
    finish("commissions",false,clientId);
  const number = (name:string,allowBlank=true): number | null => {
    const value=clean(data,name);
    if(!value && allowBlank)return null;
    if(!/^\d+(?:\.\d{1,3})?$/.test(value))return NaN;
    return Number(value);
  };
  const baseline = number("baseline_aud");
  const flatPercent=number("commission_percentage");
  const firstCap=number("tier_1_cap_aud");
  const secondCap=number("tier_2_cap_aud");
  const rate1=number("tier_1_percentage");
  const rate2=number("tier_2_percentage");
  const rate3=number("tier_3_percentage");
  const validAmount=(value:number|null,max=1e12)=>value===null||(Number.isFinite(value)&&value>=0&&value<=max);
  if(!validAmount(baseline)||!validAmount(flatPercent,100)||!validAmount(firstCap)||
     !validAmount(secondCap)||![rate1,rate2,rate3].every(v=>validAmount(v,100)))
    finish("commissions",false,clientId);
  if(model!=="manual"&&(!start||baseline===null)) finish("commissions",false,clientId);
  if(model==="revenue_growth"&&flatPercent===null) finish("commissions",false,clientId);
  if(model==="tiered_revenue_growth"&&(
    firstCap===null||firstCap<=0||secondCap===null||secondCap<=firstCap||
    rate1===null||rate2===null||rate3===null
  ))finish("commissions",false,clientId);

  const { error } = await supabase.from("client_terms").upsert({
    client_id: clientId,
    commission_model: model,
    revenue_basis: revenueBasis,
    contract_start_date: start || null,
    baseline_monthly_aud: baseline,
    commission_rate: flatPercent===null ? null : flatPercent/100,
    tier_1_limit_aud: firstCap,
    tier_2_limit_aud: secondCap,
    tier_1_rate: rate1===null?null:rate1/100,
    tier_2_rate: rate2===null?null:rate2/100,
    tier_3_rate: rate3===null?null:rate3/100,
    updated_at: new Date().toISOString()
  }, { onConflict:"client_id" });
  finish("commissions",!error,clientId);
}

const visibleOverviewKeys = [
  "revenue_after_costs","contract_ad_spend","revenue","total_sales","net_sales","gross_sales","shipping",
  "growth","commission","orders","ad_spend"
] as const;

export async function saveAgencyOverviewPreferences(data: FormData) {
  const { supabase,userId } = await requireAgencyAdmin();
  const mode=clean(data,"overview_mode");
  const selectedClient=clean(data,"selected_client_id");
  const wanted=new Set(data.getAll("visible_cards").map(x=>String(x)));
  const cards=visibleOverviewKeys.filter(key=>wanted.has(key));
  if(!["contract","calendar"].includes(mode) ||
     cards.length<1 || cards.length>8 || wanted.size!==cards.length){
    finish("overview",false,uuidPattern.test(selectedClient)?selectedClient:undefined);
  }
  const { error } = await supabase.from("agency_dashboard_preferences").upsert({
    user_id:userId,
    overview_mode:mode,
    visible_cards:cards,
    updated_at:new Date().toISOString()
  },{onConflict:"user_id"});
  finish("overview",!error,uuidPattern.test(selectedClient)?selectedClient:undefined);
}

export async function assignClientMember(data: FormData) {
  const { supabase } = await requireAgencyAdmin();
  const clientId = clean(data,"client_id");
  const userId = clean(data,"user_id");
  const role = clean(data,"role");
  if (!await allowedClient(supabase,clientId) || !uuidPattern.test(userId) || !["viewer","owner"].includes(role)) finish("clients",false,clientId);
  const { error } = await supabase.from("client_memberships").upsert({
    client_id: clientId, user_id: userId, role
  }, { onConflict: "client_id,user_id" });
  finish("clients",!error,clientId);
}

export async function removeClientMember(data: FormData) {
  const { supabase } = await requireAgencyAdmin();
  const clientId = clean(data,"client_id");
  const userId = clean(data,"user_id");
  if (!await allowedClient(supabase,clientId) || !uuidPattern.test(userId)) finish("clients",false,clientId);
  const { error } = await supabase.from("client_memberships").delete().eq("client_id",clientId).eq("user_id",userId);
  finish("clients",!error,clientId);
}

export async function addAgencyInvoice(data: FormData) {
  const { supabase } = await requireAgencyAdmin();
  const clientId = clean(data,"client_id");
  if (!await allowedClient(supabase,clientId)) finish("invoices",false);
  const number = clean(data,"number");
  const amount = Number(clean(data,"amount_aud"));
  const url = clean(data,"hosted_invoice_url");
  const due = clean(data,"due_on");
  if (!number || number.length > 80 || !Number.isFinite(amount) || amount < 0 || amount > 1e12 ||
      (url && (!url.startsWith("https://") || url.length > 1500)) ||
      (due && !/^\d{4}-\d{2}-\d{2}$/.test(due))) finish("invoices",false,clientId);
  const { error } = await supabase.from("client_invoices").insert({
    client_id: clientId, number, amount_aud: amount,
    status:"issued", issued_on: new Date().toISOString().slice(0,10),
    due_on: due || null, hosted_invoice_url: url || null
  });
  finish("invoices",!error,clientId);
}
