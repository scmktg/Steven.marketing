"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgencyAdmin } from "@/lib/agency-auth";

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
  const clientId = clean(data,"client_id");
  if (!await allowedClient(supabase,clientId)) finish("clients",false);
  const model = clean(data,"commission_model");
  if (model !== "revenue_growth" && model !== "manual") finish("commissions",false,clientId);
  const baselineInput = clean(data,"baseline_aud");
  const rateInput = clean(data,"commission_percentage");
  const baseline = baselineInput === "" ? null : Number(baselineInput);
  const percent = rateInput === "" ? null : Number(rateInput);
  if (baseline !== null && (!Number.isFinite(baseline) || baseline < 0 || baseline > 1e12)) finish("commissions",false,clientId);
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) finish("commissions",false,clientId);
  if (model === "revenue_growth" && (baseline === null || percent === null)) finish("commissions",false,clientId);
  const { error } = await supabase.from("client_terms").upsert({
    client_id: clientId, commission_model: model,
    baseline_monthly_aud: baseline,
    commission_rate: percent === null ? null : percent / 100,
    updated_at: new Date().toISOString()
  }, { onConflict:"client_id" });
  finish("commissions",!error,clientId);
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
