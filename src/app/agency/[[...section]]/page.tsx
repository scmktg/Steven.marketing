import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SignOut } from "@/components/sign-out";
import { requireAgencyAdmin } from "@/lib/agency-auth";
import { contractHistory, sydneyToday, adSpendForPeriod, revenueAfterDeductions, type AgreementTerms, type DailySales, type DailyAdSpend } from "@/lib/commission";
import { createAgencyClient, saveAgencyTerms, assignClientMember, removeClientMember, addAgencyInvoice, saveAgencyOverviewPreferences, saveAgencyAgreementMaster, saveAgencyClientAgreementDraft } from "../actions";
import {saveAgencyAdvertisingSettings,proposeAgencyAdvertisingBudget,withdrawAgencyAdvertisingBudget} from "../budget-actions";

export const dynamic = "force-dynamic";
export const metadata = { title:"Agency dashboard | steven.marketing", robots:{index:false,follow:false} };

type Section = "overview" | "clients" | "sales" | "advertising" | "commissions" | "agreements" | "invoices";
type Client = { id:string; name:string; slug:string };
type Terms = AgreementTerms & {client_id:string};
type Metrics = {client_id:string;month:string;gross_sales_aud:number|null;net_sales_aud:number|null;orders:number|null;ad_spend_aud:number|null;shopify_synced_at:string|null;ads_synced_at:string|null};
type Invoice = {id:string;client_id:string;number:string;amount_aud:number;status:string;issued_on:string|null;due_on:string|null;hosted_invoice_url:string|null};
type Membership = {client_id:string;user_id:string;role:string};
type MasterAgreement = {template_key:string;title:string;body_markdown:string;version:number;updated_at:string};
type ClientAgreementDraft = {client_id:string;body_markdown:string;source_version:number;revision:number;updated_at:string};
type AdvertisingSettings = {client_id:string;initial_testing_budget_aud:number;approved_monthly_limit_aud:number|null;objectives:string;phase:"testing"|"optimising"|"scaling"};
type AdvertisingRequest = {id:string;client_id:string;proposed_monthly_limit_aud:number;previous_monthly_limit_aud:number|null;reason:string;status:"pending"|"approved"|"declined"|"withdrawn";created_at:string;decided_at:string|null};
type OverviewCard = "revenue_after_costs" | "contract_ad_spend" | "revenue" | "total_sales" | "net_sales" | "gross_sales" | "shipping" | "growth" | "commission" | "orders" | "ad_spend";
type OverviewMode = "contract" | "calendar";
const overviewOptions: {key:OverviewCard;label:string}[] = [
  {key:"revenue_after_costs",label:"Revenue after commission, ads & shipping"},
  {key:"contract_ad_spend",label:"Google Ads · contract period"},
  {key:"revenue",label:"Eligible revenue"},{key:"total_sales",label:"Shopify total sales"},
  {key:"net_sales",label:"Net product sales"},{key:"gross_sales",label:"Gross product sales"},
  {key:"shipping",label:"Shipping charges"},{key:"growth",label:"Growth above baseline"},
  {key:"commission",label:"Estimated commission"},{key:"orders",label:"Order count"},
  {key:"ad_spend",label:"Advertising spend (calendar month)"}
];
const initialCards:OverviewCard[]=["revenue_after_costs","revenue","total_sales","shipping","growth","commission","contract_ad_spend","ad_spend"];
const sections: {key:Section;label:string;icon:string}[]=[
  {key:"overview",label:"Overview",icon:"◫"},
  {key:"clients",label:"Clients",icon:"◎"},
  {key:"sales",label:"Sales",icon:"↗"},
  {key:"advertising",label:"Advertising",icon:"◉"},
  {key:"commissions",label:"Commissions",icon:"◇"},
  {key:"agreements",label:"Agreements",icon:"▧"},
  {key:"invoices",label:"Invoices",icon:"▤"}
];
const aud = (n:number|null|undefined)=>n===null||n===undefined?"—":new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(n));
const whole = (n:number|null|undefined)=>n===null||n===undefined?"—":new Intl.NumberFormat("en-AU").format(n);
const shortDate=(s:string|null|undefined)=>s?new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s.slice(0,10)+"T12:00:00Z")):"—";
const monthName=(s:string)=>new Intl.DateTimeFormat("en-AU",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));
const percentage=(n:number|null|undefined)=>n===null||n===undefined?"—":`${(Number(n)*100).toFixed(2)}%`;
const monthNow=()=>sydneyToday().slice(0,7)+"-01";
// Render only allowlisted, public commercial placeholders. Client legal identity,
 // financial scope and third-party permissions still require explicit completion.
function agreementPreview(markdown:string,client?:Client,terms?:Terms,advertising?:AdvertisingSettings){
  const termsMap:Record<string,string>={
    CLIENT_DISPLAY_NAME:client?.name??"[[CLIENT_DISPLAY_NAME]]",
    INITIAL_AD_TEST_BUDGET_AUD:advertising?aud(advertising.initial_testing_budget_aud):"[[INITIAL_AD_TEST_BUDGET_AUD]]",
    APPROVED_AD_SPEND_LIMIT_AUD:advertising?.approved_monthly_limit_aud!==null&&advertising?.approved_monthly_limit_aud!==undefined?aud(advertising.approved_monthly_limit_aud):"[[APPROVED_AD_SPEND_LIMIT_AUD]]",
    ADVERTISING_OBJECTIVES:advertising?.objectives||"[[ADVERTISING_OBJECTIVES]]",
    CONTRACT_START_DATE:terms?.contract_start_date?shortDate(terms.contract_start_date):"[[CONTRACT_START_DATE]]",
    COMMISSION_MODEL:terms?.commission_model==="tiered_revenue_growth"?"Tiered growth above baseline":terms?.commission_model==="revenue_growth"?"Single-rate growth above baseline":terms?.commission_model==="manual"?"Custom / individually reconciled":"[[COMMISSION_MODEL]]",
    MONTHLY_BASELINE_AUD:terms?.baseline_monthly_aud!==null&&terms?.baseline_monthly_aud!==undefined?aud(terms.baseline_monthly_aud):"[[MONTHLY_BASELINE_AUD]]",
    REVENUE_BASIS:terms?.revenue_basis==="total_sales"?"Shopify total sales including shipping":terms?.revenue_basis==="net_sales"?"Shopify net product sales excluding shipping":"[[REVENUE_BASIS]]",
    TIER_1_LIMIT_AUD:terms?.tier_1_limit_aud!==null&&terms?.tier_1_limit_aud!==undefined?aud(terms.tier_1_limit_aud):"[[TIER_1_LIMIT_AUD]]",
    TIER_2_LIMIT_AUD:terms?.tier_2_limit_aud!==null&&terms?.tier_2_limit_aud!==undefined?aud(terms.tier_2_limit_aud):"[[TIER_2_LIMIT_AUD]]",
    TIER_1_RATE:terms?.tier_1_rate!==null&&terms?.tier_1_rate!==undefined?percentage(terms.tier_1_rate):"[[TIER_1_RATE]]",
    TIER_2_RATE:terms?.tier_2_rate!==null&&terms?.tier_2_rate!==undefined?percentage(terms.tier_2_rate):"[[TIER_2_RATE]]",
    TIER_3_RATE:terms?.tier_3_rate!==null&&terms?.tier_3_rate!==undefined?percentage(terms.tier_3_rate):"[[TIER_3_RATE]]"
  };
  return markdown.replace(/\[\[([A-Z0-9_]+)\]\]/g,(original,key:string)=>termsMap[key]??original);
}

function ContractText({value}:{value:string}){
  const parts=value.replace(/\*\*/g,"").split(/(\[\[[A-Z0-9_]+\]\])/g);
  return <>{parts.map((part,i)=>
    /^\[\[[A-Z0-9_]+\]\]$/.test(part)?
      <span key={i} className="agency-contract-blank" title={part.slice(2,-2).toLowerCase().replaceAll("_"," ")}>
        To be completed
      </span>:
      <span key={i}>{part}</span>
  )}</>;
}

function AgreementPreview({body}:{body:string}){
  const lines=body.replace(/\r\n/g,"\n").split("\n").map(line=>line.trim()).filter(Boolean);
  const clean=(line:string)=>line.replace(/^#{1,3}\s+/,"").replace(/\*\*/g,"");
  const sectionB=lines.findIndex(line=>clean(line).startsWith("SCHEDULE B"));
  const sectionA=lines.findIndex(line=>clean(line).startsWith("SCHEDULE A"));
  const signature=lines.findIndex(line=>clean(line)==="Signatures");

  return <article className="agency-contract-paper" aria-label="Marketing Partnership Agreement preview">
    <header className="agency-contract-letterhead">
      <strong>steven.marketing</strong>
      <span>AGREEMENT</span>
    </header>
    <div className="agency-contract-document">
      {lines.map((raw,i)=>{
        const line=clean(raw);
        if(i===0)return <h1 key={i}>{line}</h1>;
        if(/^SCHEDULE [AB]\s*[—-]/.test(line)){
          const pos=line.indexOf("—");
          return <div key={i} className="agency-contract-section">
            <span>{pos===-1?line.split("-")[0].trim():line.slice(0,pos).trim()}</span>
            <h2>{pos===-1?line.split("-").slice(1).join("-").trim():line.slice(pos+1).trim()}</h2>
          </div>;
        }
        if(line==="Signatures")return <div key={i} className="agency-contract-section agency-contract-signatures">
          <span>ACCEPTANCE</span><h2>Signatures</h2>
        </div>;
        if(i>sectionB&&/^\d+\.\s/.test(line))return <h3 key={i}>{line}</h3>;
        if(line.startsWith("• ")||line.startsWith("- "))return <p key={i} className="agency-contract-bullet">
          <span className="agency-contract-bullet-icon" aria-hidden="true">•</span>
          <span><ContractText value={line.slice(2)}/></span>
        </p>;
        if(i>sectionA&&i<sectionB&&line.endsWith(":"))
          return <h3 key={i} className="agency-contract-subhead">{line}</h3>;
        const isDetail=(i>sectionA&&i<sectionB)||(i>signature);
        const colon=isDetail?line.indexOf(":"):-1;
        if(colon>0&&colon<95){
          return <div key={i} className={"agency-contract-detail"+(i>signature?" agency-contract-signature-row":"")}>
            <span className="agency-contract-detail-label">{line.slice(0,colon)}</span>
            <span className="agency-contract-detail-value"><ContractText value={line.slice(colon+1).trim()}/></span>
          </div>;
        }
        return <p key={i} className={i<Math.max(sectionA,1)?"agency-contract-intro":"agency-contract-prose"}>
          <ContractText value={line}/>
        </p>;
      })}
    </div>
    <footer className="agency-contract-letterfoot">
      <span>STEVEN MARKETING</span>
      <span>MARKETING PARTNERSHIP AGREEMENT</span>
    </footer>
  </article>;
}

const path=(section:Section,clientId?:string)=>`/agency${section==="overview"?"":"/"+section}${clientId?"?client="+encodeURIComponent(clientId):""}`;

function Stat({label,value,note,featured=false}:{label:string;value:string;note?:string;featured?:boolean}){
  return <div className={`kpi ${featured?"kpi-accent":""}`}><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong><span className="kpi-detail">{note||"Awaiting data"}</span></div>;
}
function Panel({eyebrow,title,children,aside}:{eyebrow:string;title:string;children:ReactNode;aside?:ReactNode}){
  return <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">{eyebrow}</span><h2>{title}</h2></div>{aside}</div>{children}</section>;
}
function Empty({title,description}:{title:string;description:string}){
  return <div className="empty-state"><span className="empty-symbol">◎</span><strong>{title}</strong><p>{description}</p></div>;
}
function Table({titles,rows}:{titles:string[];rows:ReactNode[][]}){
  return <div className="table-scroll"><table className="data-table"><thead><tr>{titles.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((col,j)=><td key={j}>{col}</td>)}</tr>)}</tbody></table></div>;
}
function ClientSelector({clients,section,selected}:{clients:Client[];section:Section;selected?:string}){
  return <div className="agency-selector"><span>Showing</span><div><Link className={!selected?"selected":""} href={path(section)}>All clients</Link>{clients.map(c=><Link key={c.id} className={selected===c.id?"selected":""} href={path(section,c.id)}>{c.name}</Link>)}</div></div>;
}
function Field({label,name,placeholder,type="text",defaultValue,required=false,min,step}:{label:string;name:string;placeholder?:string;type?:string;defaultValue?:string|number;required?:boolean;min?:string;step?:string}){
  return <label className="agency-field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} min={min} step={step}/></label>;
}

export default async function AgencyPage({params,searchParams}:{
  params:Promise<{section?:string[]}>;
  searchParams:Promise<{client?:string;success?:string;error?:string}>;
}){
  const {section}=await params;
  const area=section?.[0]||"overview";
  if((section?.length||0)>1 || !sections.some(s=>s.key===area))notFound();
  const sectionKey=area as Section;
  const {supabase,userId}=await requireAgencyAdmin();
  const query=await searchParams;

  const [clientsResponse,termsResponse,metricsResponse,invoicesResponse,membershipsResponse,dailyResponse,adsDailyResponse,prefsResponse,agreementMasterResponse,agreementDraftsResponse,budgetSettingsResponse,budgetRequestsResponse]=await Promise.all([
    supabase.from("clients").select("id,name,slug").order("name").limit(200),
    supabase.from("client_terms").select("client_id,commission_model,contract_start_date,revenue_basis,baseline_monthly_aud,commission_rate,tier_1_limit_aud,tier_2_limit_aud,tier_1_rate,tier_2_rate,tier_3_rate").limit(200),
    supabase.from("client_monthly_metrics").select("client_id,month,gross_sales_aud,net_sales_aud,orders,ad_spend_aud,shopify_synced_at,ads_synced_at").order("month",{ascending:false}).limit(1000),
    supabase.from("client_invoices").select("id,client_id,number,amount_aud,status,issued_on,due_on,hosted_invoice_url").order("issued_on",{ascending:false,nullsFirst:false}).limit(200),
    supabase.from("client_memberships").select("client_id,user_id,role").limit(500),
    supabase.from("client_daily_sales").select("client_id,day,net_sales_aud,gross_sales_aud,total_sales_aud,shipping_charges_aud,orders").gte("day", new Date(Date.now()-270*86400000).toISOString().slice(0,10)).order("day",{ascending:false}).limit(1000),
    supabase.from("client_daily_ad_spend").select("client_id,day,ads_account_id,ad_spend_aud").gte("day",new Date(Date.now()-270*86400000).toISOString().slice(0,10)).order("day",{ascending:false}).limit(1000),
    supabase.from("agency_dashboard_preferences").select("overview_mode,visible_cards").eq("user_id",userId).maybeSingle(),
    supabase.from("agency_agreement_templates").select("template_key,title,body_markdown,version,updated_at").eq("template_key","marketing-performance-v1").maybeSingle(),
    supabase.from("client_agreement_drafts").select("client_id,body_markdown,source_version,revision,updated_at").limit(200),
    supabase.from("client_ad_budget_settings").select("client_id,initial_testing_budget_aud,approved_monthly_limit_aud,objectives,phase").limit(200),
    supabase.from("client_ad_budget_requests").select("id,client_id,proposed_monthly_limit_aud,previous_monthly_limit_aud,reason,status,created_at,decided_at").order("created_at",{ascending:false}).limit(300)
  ]);
  const failed=Boolean(clientsResponse.error||termsResponse.error||metricsResponse.error||invoicesResponse.error||membershipsResponse.error||dailyResponse.error||adsDailyResponse.error||prefsResponse.error||agreementMasterResponse.error||agreementDraftsResponse.error||budgetSettingsResponse.error||budgetRequestsResponse.error);
  const clients=(clientsResponse.data||[]) as Client[];
  const terms=(termsResponse.data||[]) as Terms[];
  const allMetrics=(metricsResponse.data||[]) as Metrics[];
  const allInvoices=(invoicesResponse.data||[]) as Invoice[];
  const memberships=(membershipsResponse.data||[]) as Membership[];
  const dailySales=(dailyResponse.data||[]) as DailySales[];
  const dailyAds=(adsDailyResponse.data||[]) as DailyAdSpend[];
  const agreementMaster=agreementMasterResponse.data as MasterAgreement|null;
  const agreementDrafts=(agreementDraftsResponse.data||[]) as ClientAgreementDraft[];
  const advertisingSettings=(budgetSettingsResponse.data||[]) as AdvertisingSettings[];
  const advertisingRequests=(budgetRequestsResponse.data||[]) as AdvertisingRequest[];
  const budgetFor=(id:string)=>advertisingSettings.find(a=>a.client_id===id);
  const pendingBudget=(id:string)=>advertisingRequests.find(a=>a.client_id===id&&a.status==="pending");
  const monthSpend=(id:string)=>{
    const records=dailyAds.filter(a=>a.client_id===id&&a.day>=monthNow()&&a.day<=sydneyToday()&&a.ad_spend_aud!==null);
    if(!records.length)return null;
    const amount=Math.round(records.reduce((total,a)=>total+Math.round(Number(a.ad_spend_aud)*10000),0)/100)/100;
    const days=new Set(records.map(a=>a.day)).size;
    const through=records.map(a=>a.day).sort().at(-1)??"";
    return {amount,days,through,complete:days===Number(sydneyToday().slice(8,10))};
  };
  const overviewMode:OverviewMode=prefsResponse.data?.overview_mode==="calendar"?"calendar":"contract";
  const configuredCards=Array.isArray(prefsResponse.data?.visible_cards)?prefsResponse.data.visible_cards as string[]:initialCards;
  const visibleCards=overviewOptions.map(x=>x.key).filter(x=>configuredCards.includes(x));
  const shownCards=visibleCards.length?visibleCards:initialCards;
  const selected=query.client && clients.some(c=>c.id===query.client)?query.client:undefined;
  if(query.client && !selected) notFound();
  const filteredClients=selected?clients.filter(c=>c.id===selected):clients;
  const clientIds=new Set(filteredClients.map(c=>c.id));
  const month=currentMonthRows(allMetrics,clientIds);
  const salesKnown=month.filter(m=>m.net_sales_aud!==null);
  const spendKnown=month.filter(m=>m.ad_spend_aud!==null);
  const netTotal=salesKnown.length?salesKnown.reduce((n,x)=>n+Number(x.net_sales_aud),0):null;
  const spendTotal=spendKnown.length?spendKnown.reduce((n,x)=>n+Number(x.ad_spend_aud),0):null;
  const today = sydneyToday();
  const histories = new Map(filteredClients.map(client => {
    const agreement = terms.find(t=>t.client_id===client.id) ?? null;
    const clientDays=dailySales.filter(d=>d.client_id===client.id);
    return [client.id, contractHistory(agreement,clientDays,today)] as const;
  }));
  const adPeriods=new Map(filteredClients.map(client=>{
    const p=histories.get(client.id)?.[0];
    return [client.id,p?adSpendForPeriod(p,dailyAds.filter(a=>a.client_id===client.id)):null] as const;
  }));
  const remaining=new Map(filteredClients.map(client=>{
    const p=histories.get(client.id)?.[0];
    const advertising=adPeriods.get(client.id);
    return [client.id,p&&advertising?revenueAfterDeductions(p,advertising):null] as const;
  }));
  const estimates=filteredClients.flatMap(c=>{
    const active=histories.get(c.id)?.[0];
    return active&&active.commission!==null ? [{client_id:c.id,value:active.commission}] : [];
  });
  const estimated=estimates.length?estimates.reduce((n,x)=>n+x.value,0):null;
  const relevantInvoices=allInvoices.filter(i=>clientIds.has(i.client_id));
  const relevantMetrics=allMetrics.filter(m=>clientIds.has(m.client_id));
  const lookup=(id:string)=>clients.find(c=>c.id===id)?.name||"Unknown client";
  const current=monthNow();
  const chosen=filteredClients[0];
  // For portfolio totals each client contributes its OWN anniversary period.
  // We deliberately show no portfolio sum when any configured current period is incomplete.
  const contracted=filteredClients.flatMap(client=>{
    const termsForClient=terms.find(t=>t.client_id===client.id);
    if(!termsForClient?.contract_start_date)return [];
    const active=histories.get(client.id)?.[0];
    return active?[{client,contract:termsForClient,period:active}]:[];
  });
  const allCovered=contracted.length>0&&contracted.length===filteredClients.length&&contracted.every(c=>c.period.coverageComplete);
  type PeriodMetric="revenue"|"netRevenue"|"totalRevenue"|"grossRevenue"|"shipping"|"growth"|"commission"|"orders";
  const summedContract=(metric:PeriodMetric):number|null=>{
    if(!allCovered||contracted.some(c=>c.period[metric]===null))return null;
    return Math.round(contracted.reduce((sum,c)=>sum+Number(c.period[metric]),0)*100)/100;
  };
  const completeAds=contracted.length>0&&contracted.length===filteredClients.length&&contracted.every(c=>adPeriods.get(c.client.id)?.coverageComplete);
  const summedContractAds=completeAds?Math.round(contracted.reduce((sum,c)=>sum+Number(adPeriods.get(c.client.id)?.amount??0),0)*100)/100:null;
  const completeRemaining=contracted.length>0&&contracted.every(c=>remaining.get(c.client.id)!==null&&remaining.get(c.client.id)!==undefined);
  const summedRemaining=completeRemaining?Math.round(contracted.reduce((sum,c)=>sum+Number(remaining.get(c.client.id)),0)*100)/100:null;
  const calendarGrossRows=month.filter(m=>m.gross_sales_aud!==null);
  const calendarGross=calendarGrossRows.length===filteredClients.length&&filteredClients.length>0
    ?calendarGrossRows.reduce((sum,m)=>sum+Number(m.gross_sales_aud),0):null;
  const calendarOrders=month.length===filteredClients.length&&month.every(m=>m.orders!==null)
    ?month.reduce((sum,m)=>sum+Number(m.orders),0):null;
  const calendarStarts=current.slice(0,7)+"-01";
  const calendarShippingParts=filteredClients.map(c=>{
    const through= Math.min(Number(today.slice(8,10)),31);
    const existing=dailySales.filter(d=>d.client_id===c.id&&d.day>=calendarStarts&&d.day<=today&&d.shipping_charges_aud!==null);
    return {complete:existing.length===through,amount:existing.reduce((sum,d)=>sum+Number(d.shipping_charges_aud),0)};
  });
  const calendarShipping=calendarShippingParts.length>0&&calendarShippingParts.every(x=>x.complete)
    ?calendarShippingParts.reduce((sum,x)=>sum+x.amount,0):null;
  const calendarTotalParts=filteredClients.map(c=>{
    const through=Number(today.slice(8,10));
    const records=dailySales.filter(d=>d.client_id===c.id&&d.day>=calendarStarts&&d.day<=today&&d.total_sales_aud!==null&&d.total_sales_aud!==undefined);
    return {complete:records.length===through,amount:records.reduce((sum,d)=>sum+Number(d.total_sales_aud),0)};
  });
  const calendarShopifyTotal=calendarTotalParts.length>0&&calendarTotalParts.every(x=>x.complete)
    ?Math.round(calendarTotalParts.reduce((sum,x)=>sum+x.amount,0)*100)/100:null;
  const cardsForOverview:Record<OverviewCard,{label:string;value:string;note:string}>={
    revenue_after_costs:{
      label:"Revenue after commission, ads & shipping",
      value:aud(summedRemaining),
      note:"Contract periods · before product, courier & other costs"
    },
    contract_ad_spend:{
      label:"Google Ads · contract periods",
      value:aud(summedContractAds),
      note:"Daily Google Ads spend · matched to each contract"
    },
    revenue:{
      label:overviewMode==="contract"?"Contract-period eligible revenue":"Calendar-month net product sales",
      value:aud(overviewMode==="contract"?summedContract("revenue"):netTotal),
      note:overviewMode==="contract"?"Individual client anniversaries · to "+shortDate(today):"Shopify calendar month · "+monthName(current)
    },
    total_sales:{
      label:overviewMode==="contract"?"Shopify total sales · contract periods":"Shopify total sales · calendar month",
      value:aud(overviewMode==="contract"?summedContract("totalRevenue"):calendarShopifyTotal),
      note:"Product net sales + shipping + reported tax"
    },
    net_sales:{
      label:overviewMode==="contract"?"Net product sales · contract periods":"Net product sales · calendar month",
      value:aud(overviewMode==="contract"?summedContract("netRevenue"):netTotal),
      note:"Excludes shipping · after refunds & discounts"
    },
    gross_sales:{
      label:overviewMode==="contract"?"Gross product sales · contract periods":"Gross product sales · calendar month",
      value:aud(overviewMode==="contract"?summedContract("grossRevenue"):calendarGross),
      note:"Before refunds and discounts"
    },
    shipping:{
      label:overviewMode==="contract"?"Shipping · contract periods":"Shipping · calendar month",
      value:aud(overviewMode==="contract"?summedContract("shipping"):calendarShipping),
      note:"Shipping charged to customers · not courier expense"
    },
    growth:{
      label:"Growth above agreed baseline",
      value:aud(summedContract("growth")),
      note:"Always current contract periods · not calendar months"
    },
    commission:{
      label:"Estimated commission",
      value:aud(summedContract("commission")),
      note:"Always contract periods · provisional"
    },
    orders:{
      label:overviewMode==="contract"?"Orders · contract periods":"Orders · calendar month",
      value:whole(overviewMode==="contract"?summedContract("orders"):calendarOrders),
      note:"Shopify orders"
    },
    ad_spend:{
      label:"Google Ads · calendar-month spend",
      value:aud(spendTotal),
      note:"Calendar-month snapshot · contract spend shown separately"
    }
  };


  return <div className="portal-shell agency-shell">
    <aside className="portal-sidebar">
      <Link className="portal-brand" href="/">steven.marketing<span className="brand-dot">.</span></Link>
      <div className="sidebar-caption">AGENCY ADMINISTRATION</div>
      <div className="client-identity"><span className="client-icon">S</span><div><strong>Steven Marketing</strong><small>Administrator</small></div></div>
      <div className="sidebar-caption nav-caption">MANAGE</div>
      <nav className="portal-nav" aria-label="Agency navigation">
        {sections.map(s=><Link href={path(s.key,selected)} key={s.key} className={`portal-nav-item${s.key===sectionKey?" is-active":""}`} aria-current={s.key===sectionKey?"page":undefined}><span className="nav-symbol">{s.icon}</span>{s.label}</Link>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-help">Private administration<br/><a href="mailto:hello@steven.marketing">Agency support ↗</a></div><SignOut/></div>
    </aside>
    <main className="portal-main">
      <header className="portal-topbar"><span>AGENCY DASHBOARD</span><div className="portal-top-right"><span className="privacy-pill"><i/> Administrator</span><span className="portal-avatar">S</span></div></header>
      <div className="portal-body">
        <div className="page-heading"><div><p className="dashboard-eyebrow">STEVEN MARKETING / MANAGEMENT</p><h1>{sections.find(x=>x.key===sectionKey)?.label}<span className="heading-period"> / {["sales","advertising","commissions"].includes(sectionKey)?(selected&&histories.get(selected)?.[0]?shortDate(histories.get(selected)?.[0].start)+" – "+shortDate(histories.get(selected)?.[0].end):"Contract periods"):monthName(current)}</span></h1><p className="dashboard-subtitle">One place to manage your clients, performance and billing.</p></div></div>
        {sectionKey!=="clients"&&<ClientSelector clients={clients} section={sectionKey} selected={selected}/>}
        {query.success==="1"&&<div className="agency-notification" role="status">Changes saved successfully.</div>}
        {query.error==="1"&&<div className="dashboard-alert" role="alert">Could not save changes. Please check the information and account permissions.</div>}
        {failed&&<div className="dashboard-alert" role="alert">Some reporting could not be loaded. Check the Supabase connection or table permissions.</div>}
        {sectionKey==="overview"&&<>
          <details className="agency-overview-settings">
            <summary>Customize overview <span aria-hidden="true">⌄</span></summary>
            <form action={saveAgencyOverviewPreferences} className="agency-overview-config">
              <input type="hidden" name="selected_client_id" value={selected||""}/>
              <label className="agency-field"><span>Default reporting view</span>
                <select name="overview_mode" defaultValue={overviewMode}>
                  <option value="contract">Contract anniversary periods</option>
                  <option value="calendar">Calendar month</option>
                </select>
              </label>
              <fieldset className="agency-overview-card-choices">
                <legend>Show on your overview (select up to 8)</legend>
                <div>{overviewOptions.map(option=><label key={option.key}>
                  <input type="checkbox" name="visible_cards" value={option.key} defaultChecked={shownCards.includes(option.key)}/>
                  <span>{option.label}</span>
                </label>)}</div>
              </fieldset>
              <button className="login-action agency-save" type="submit">Save overview →</button>
              <p className="agency-caption">Saved privately for your agency administrator account. Client selection still works independently. Mixed reporting dates are always labelled.</p>
            </form>
          </details>
          <div className="agency-overview-period">
            <div><span className="panel-kicker">{overviewMode==="contract"?"CONTRACT PERIOD REPORTING":"CALENDAR MONTH REPORTING"}</span>
              <h2>{selected?lookup(selected):"All clients combined"}</h2>
              <p>{overviewMode==="contract"
                ?"Each client contributes its own current contract anniversary period through "+shortDate(today)+"."
                :"Shopify figures use "+monthName(current)+"; contract growth and commissions always use agreement anniversary periods."}</p>
              {overviewMode==="contract"&&contracted.length!==filteredClients.length&&
                <p className="agency-report-warning">{filteredClients.length-contracted.length} client(s) without a current configured contract period are excluded from contract totals.</p>}
              {contracted.length>0&&!completeRemaining&&
                <p className="agency-report-warning">Revenue after deductions is unavailable if any required contract-period sales, commission or daily Google Ads record is missing.</p>}
              {overviewMode==="contract"&&contracted.length>0&&!allCovered&&
                <p className="agency-report-warning">Some contract periods have incomplete daily data. Incomplete financial totals are hidden rather than underestimated.</p>}
            </div>
            <Link className="panel-link" href={path("commissions",selected)}>Commission details →</Link>
          </div>
          <div className="kpi-grid agency-kpi-grid">
            {shownCards.map((key,i)=><Stat key={key} featured={i===0}
              label={cardsForOverview[key].label} value={cardsForOverview[key].value} note={cardsForOverview[key].note}/>)}
          </div>
          <Panel eyebrow="NET OF SELECTED DEDUCTIONS" title="Revenue remaining · contract periods"
            aside={<span className="panel-kicker">NOT ACCOUNTING PROFIT</span>}>
            {filteredClients.length?<Table titles={["Client","Period","Total sales","Less shipping","Less commission","Less Google Ads","Revenue remaining"]} rows={filteredClients.map(c=>{
              const period=histories.get(c.id)?.[0];
              const ads=adPeriods.get(c.id);
              return [
                <Link key={c.id} href={path("overview",c.id)} className="table-link">{c.name} ↗</Link>,
                period?shortDate(period.start)+" – "+shortDate(period.end):"Not configured",
                aud(period?.totalRevenue),
                aud(period?.shipping),
                aud(period?.commission),
                aud(ads?.amount),
                <strong key={c.id}>{aud(remaining.get(c.id))}</strong>
              ];
            })}/>:<Empty title="No clients" description="Add a client to see contract-period deductions."/>}
            <p className="panel-footnote">Shopify total sales − shipping charges collected − estimated agency commission − Google Ads cost, for the same contract dates. Shipping is customer shipping revenue, <strong>not actual courier expense</strong>. This does not deduct cost of goods, courier costs, payment fees, other marketing, overhead or applicable taxes. Values remain provisional, and missing daily source data suppresses the result.</p>
          </Panel>
          <Panel eyebrow="CONTRACT PERIODS" title={selected?"Current client reporting":"All clients · current contract periods"}
            aside={<Link className="panel-link" href={path("commissions",selected)}>Manage agreements →</Link>}>
            {filteredClients.length?<Table titles={["Client","Current contract dates","Commission basis","Eligible revenue","Net products","Shopify total","Growth","Estimated commission","Status"]} rows={filteredClients.map(c=>{
              const agreement=terms.find(t=>t.client_id===c.id);
              const p=histories.get(c.id)?.[0];
              const window=p?shortDate(p.start)+" – "+shortDate(p.end):"Not configured";
              const status=p?(p.coverageComplete?"Through "+shortDate(p.asOf):"Daily data incomplete"):"Set commencement";
              return [
                <Link key={c.id} className="table-link" href={path("overview",c.id)}>{c.name} ↗</Link>,
                window,
                agreement?.revenue_basis==="total_sales"?"Total sales incl. shipping":agreement?"Net product sales":"—",
                aud(p?.revenue),aud(p?.netRevenue),aud(p?.totalRevenue),aud(p?.growth),aud(p?.commission),status
              ];
            })}/>:<Empty title="No clients yet" description="Create your first client to start managing reporting and agreements."/>}
            <p className="panel-footnote">The portfolio combines different contract periods rather than creating an artificial shared date range. All commission values are provisional. Google Ads expenditure is currently available by calendar month only.</p>
          </Panel>
          <Panel eyebrow="BILLING" title="Recent invoices" aside={<Link className="panel-link" href="/agency/invoices">All invoices →</Link>}>
            {relevantInvoices.length?<Table titles={["Client","Invoice","Amount","Status","Issued"]} rows={relevantInvoices.slice(0,5).map(i=>[lookup(i.client_id),i.number,aud(i.amount_aud),i.status,shortDate(i.issued_on)])}/>:<Empty title="No invoices" description="Add verified invoices when billing has been issued."/>}
          </Panel>
        </>}
        {sectionKey==="clients"&&<>
          <Panel eyebrow="ACCOUNT MANAGEMENT" title="Client workspaces">
            {clients.length?<div className="agency-client-list">{clients.map(c=><Link key={c.id} href={path("clients",c.id)} className={`agency-client-item${selected===c.id?" is-selected":""}`}><span className="client-icon">{c.name.slice(0,1)}</span><span><strong>{c.name}</strong><small>{memberships.filter(m=>m.client_id===c.id).length} users · {c.slug}</small></span><span className="client-arrow">↗</span></Link>)}</div>:<Empty title="No client workspaces" description="Create one below."/>}
          </Panel>
          <Panel eyebrow="NEW CLIENT" title="Create a client">
            <form action={createAgencyClient} className="agency-form"><Field name="name" label="Business name" placeholder="e.g. New Client" required/><Field name="slug" label="URL slug" placeholder="e.g. new-client" required/><button type="submit" className="login-action agency-save">Create & configure advertising →</button></form><p className="agency-caption">Next: set the initial testing budget and advertising objectives under Advertising, then propose the agreed spending limit for client approval.</p>
          </Panel>
          {selected&&chosen&&<Panel eyebrow="ACCESS CONTROL" title={`${chosen.name} · Team members`}>
            {memberships.filter(m=>m.client_id===selected).length?<Table titles={["Supabase user ID","Role","Remove access"]} rows={memberships.filter(m=>m.client_id===selected).map(m=>[
              <code key={m.user_id} className="agency-code">{m.user_id}</code>,m.role,
              <form key={m.user_id} action={removeClientMember}><input type="hidden" name="client_id" value={selected}/><input type="hidden" name="user_id" value={m.user_id}/><button type="submit" className="agency-light-button">Remove</button></form>
            ])}/>:<p className="agency-caption">No client users have been assigned yet.</p>}
            <p className="agency-caption">First invite the person from Supabase Authentication → Users, then paste their Supabase User ID below. New invitations are not sent from this form.</p>
            <form action={assignClientMember} className="agency-form"><input type="hidden" name="client_id" value={selected}/><Field label="Supabase user ID" name="user_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required/><label className="agency-field"><span>Access level</span><select name="role" defaultValue="viewer"><option value="viewer">Viewer (read only)</option><option value="owner">Client owner (can approve advertising budget changes)</option></select></label><button className="login-action agency-save" type="submit">Grant client access →</button></form>
          </Panel>}
        </>}
        {sectionKey==="sales"&&<>
          <div className="agency-overview-period">
            <div><span className="panel-kicker">CLIENT CONTRACT PERIODS</span>
              <h2>{selected?lookup(selected):"All clients · current reporting periods"}</h2>
              <p>Each client's reporting runs from their own commencement-date anniversary. Current periods are shown through {shortDate(today)}, not necessarily through their end dates.</p>
            </div>
            <Link className="panel-link" href={path("commissions",selected)}>Commission calculations →</Link>
          </div>
          <div className="kpi-grid agency-kpi-grid">
            <Stat featured label="Net product sales · contract periods" value={aud(summedContract("netRevenue"))} note="After discounts & refunds · excludes customer shipping"/>
            <Stat label="Shopify total sales · contract periods" value={aud(summedContract("totalRevenue"))} note="Includes customer shipping and reported tax"/>
            <Stat label="Orders · contract periods" value={whole(summedContract("orders"))} note="Order counts on the same client anniversary dates"/>
            <Stat label="Shipping charged to customers" value={aud(summedContract("shipping"))} note="Shipping revenue, not the cost of couriers"/>
          </div>
          {!allCovered&&filteredClients.length>0&&
            <p className="agency-report-warning">Some clients have no configured contract or complete daily sales records. Totals are withheld rather than undercounted. Individual available fields are shown below.</p>}
          <Panel eyebrow="CURRENT CONTRACT PERIOD" title="Sales by client">
            {filteredClients.length?<Table titles={["Client","Contract dates","Shopify total sales","Net product sales","Gross sales","Shipping","Orders","Reporting"]} rows={
              filteredClients.map(c=>{
                const p=histories.get(c.id)?.[0];
                return [
                  <Link key={c.id} className="table-link" href={path("sales",c.id)}>{c.name} ↗</Link>,
                  p?shortDate(p.start)+" – "+shortDate(p.end):"Contract not configured",
                  aud(p?.totalRevenue),aud(p?.netRevenue),aud(p?.grossRevenue),aud(p?.shipping),whole(p?.orders),
                  p?(p.recordedDays+" / "+p.expectedDays+" days"+(p.coverageComplete?" · complete":" · incomplete")):"No contract dates"
                ];
              })
            }/>:<Empty title="No clients" description="Create a client and set their commencement date under Commissions."/>}
            <p className="panel-footnote">Shopify daily sales are grouped by the exact contract anniversaries used for commission calculations. Current figures cover the reporting period only through {shortDate(today)}. Any missing daily records prevent unverified totals from appearing.</p>
          </Panel>
          <Panel eyebrow="CONTRACT-ALIGNED HISTORY" title="Sales by reporting period">
            {filteredClients.some(c=>(histories.get(c.id)?.length??0)>0)?
              <Table titles={["Client","Reporting period","Total sales","Net sales","Gross","Shipping","Orders","Coverage"]} rows={
                filteredClients.flatMap(c=>(histories.get(c.id)??[]).map(p=>[
                  lookup(c.id),shortDate(p.start)+" – "+shortDate(p.end),
                  aud(p.totalRevenue),aud(p.netRevenue),aud(p.grossRevenue),aud(p.shipping),whole(p.orders),
                  p.recordedDays+"/"+p.expectedDays+(p.isCurrent?" · ongoing":p.coverageComplete?" · complete":" · missing days")
                ]))
              }/>:<Empty title="No contract-period history" description="Add a commencement date to see anniversary-based sales reporting."/>}
            <p className="panel-footnote">Historical periods use the same dates as Commissions; this report does not substitute calendar-month totals when a contract period crosses two months. Incomplete historical periods remain marked as such.</p>
          </Panel>
        </>}
        {sectionKey==="advertising"&&<>
          <div className="agency-overview-period">
            <div><span className="panel-kicker">CLIENT CONTRACT PERIODS</span>
              <h2>{selected?lookup(selected):"All clients · current advertising periods"}</h2>
              <p>Google Ads spend is grouped by each client's own contract anniversaries through {shortDate(today)}, matching the commission report.</p>
            </div>
            <Link className="panel-link" href={path("sales",selected)}>Compare sales →</Link>
          </div>
          <div className="kpi-grid agency-kpi-grid">
            <Stat featured label="Google Ads spend · contract periods" value={aud(summedContractAds)} note="Same dates as Commissions · daily Google Ads records"/>
            <Stat label="Advertising clients reporting" value={whole(contracted.filter(c=>adPeriods.get(c.client.id)?.coverageComplete).length)} note="Contract periods with complete daily ad records"/>
            <Stat label="Clients with approved limits" value={whole(filteredClients.filter(c=>budgetFor(c.id)?.approved_monthly_limit_aud!==null&&budgetFor(c.id)?.approved_monthly_limit_aud!==undefined).length)} note="Limits remain calendar-month authorisations"/>
            <Stat label="Awaiting budget approval" value={whole(filteredClients.filter(c=>Boolean(pendingBudget(c.id))).length)} note="Proposed limits do not change actual campaign spending"/>
          </div>
          {!completeAds&&filteredClients.length>0&&<p className="agency-report-warning">Advertising totals require complete daily data and a configured contract for every selected client. Missing dates are not treated as $0.</p>}
          <Panel eyebrow="CURRENT CONTRACT PERIOD" title="Google Ads investment by client">
            {filteredClients.length?<Table titles={["Client","Contract dates","Spend","Daily records","Status"]} rows={
              filteredClients.map(c=>{
                const p=histories.get(c.id)?.[0],ads=adPeriods.get(c.id);
                return [
                  <Link key={c.id} href={path("advertising",c.id)} className="table-link">{c.name} ↗</Link>,
                  p?shortDate(p.start)+" – "+shortDate(p.end):"Contract not configured",
                  aud(ads?.amount),
                  ads?ads.recordedDays+" / "+ads.expectedDays:"—",
                  ads?(ads.coverageComplete?"Complete through "+shortDate(p?.asOf):"Missing daily records"):"Add contract dates"
                ];
              })
            }/>:<Empty title="No clients" description="Configure a client and contract start date to report advertising spend."/>}
            <p className="panel-footnote">This report uses account-local daily Google Ads spend. The dates match commission and sales periods; it is not a Google Ads attribution or ROAS calculation.</p>
          </Panel>
          <Panel eyebrow="CONTRACT-ALIGNED HISTORY" title="Google Ads spend by reporting period">
            {filteredClients.some(c=>(histories.get(c.id)?.length??0)>0)?
              <Table titles={["Client","Contract period","Google Ads spend","Coverage","Status"]} rows={
                filteredClients.flatMap(c=>(histories.get(c.id)??[]).map(p=>{
                  const a=adSpendForPeriod(p,dailyAds.filter(x=>x.client_id===c.id));
                  return [lookup(c.id),shortDate(p.start)+" – "+shortDate(p.end),
                    aud(a.amount),a.recordedDays+" / "+a.expectedDays,
                    a.coverageComplete?(p.isCurrent?"Current · through "+shortDate(p.asOf):"Complete"):"Missing daily records"];
                }))
              }/>:<Empty title="No contract-period advertising history" description="Configure a commencement date to report Google Ads spend by agreement."/>}
            <p className="panel-footnote">Google Ads historical periods are grouped using the same contract dates as sales and commission, not calendar months. Incomplete daily data remains unavailable.</p>
          </Panel>
          {filteredClients.map(c=>{
            const budget=budgetFor(c.id),pending=pendingBudget(c.id),spend=monthSpend(c.id);
            const approved=budget?.approved_monthly_limit_aud??null;
            return <Panel key={c.id} eyebrow="CALENDAR-MONTH BUDGET AUTHORITY" title={c.name}
              aside={<Link className="panel-link" href={path("advertising",c.id)}>Client budget →</Link>}>
              <div className="agency-budget-summary">
                <div><span>Approved monthly limit</span><strong>{aud(approved)}</strong></div>
                <div><span>Initial testing plan</span><strong>{aud(budget?.initial_testing_budget_aud)}</strong></div>
                <div><span>Recorded spend this calendar month</span><strong>{spend?.complete?aud(spend.amount):"—"}</strong></div>
                <div><span>Stage</span><strong>{budget?.phase??"Not configured"}</strong></div>
              </div>
              <p className="agency-caption">Calendar-month spending authority · {spend?("Google Ads snapshot through "+shortDate(spend.through)+(spend.complete?" · recorded each day":" · incomplete days")):"No daily Google Ads spending recorded"}. Advertising is not automatically paused or scaled by this dashboard.</p>
              {budget?.objectives&&<p className="agency-caption"><strong>Objectives:</strong> {budget.objectives}</p>}
              <form className="agency-form" action={saveAgencyAdvertisingSettings}>
                <input type="hidden" name="client_id" value={c.id}/>
                <Field name="initial_testing_budget_aud" label="Initial monthly testing budget (AUD)" type="number" min="0" step="0.01" required
                  defaultValue={budget?.initial_testing_budget_aud??""} placeholder="Agreed starting plan"/>
                <label className="agency-field"><span>Stage</span><select name="phase" defaultValue={budget?.phase??"testing"}>
                  <option value="testing">Testing · learn and gather data</option>
                  <option value="optimising">Optimising · improve results</option>
                  <option value="scaling">Scaling · proven campaigns</option>
                </select></label>
                <label className="agency-field"><span>Advertising objectives</span><textarea name="objectives" maxLength={1200}
                  rows={3} defaultValue={budget?.objectives??""} placeholder="e.g. Qualify conversion tracking, test search terms, then target contribution-positive growth"/></label>
                <button type="submit" className="login-action agency-save">Save advertising plan →</button>
              </form>
              <p className="agency-caption">Saving a plan does not grant or increase spending authority. Only the client's owner-level account can approve a proposed monthly limit.</p>
              {budget&&<>
                {pending?<div className="agency-budget-pending">
                  <strong>Awaiting client decision: {aud(pending.proposed_monthly_limit_aud)} / calendar month</strong>
                  <p>{pending.reason}</p>
                  <form action={withdrawAgencyAdvertisingBudget}>
                    <input type="hidden" name="client_id" value={c.id}/><input type="hidden" name="request_id" value={pending.id}/>
                    <button type="submit" className="agency-light-button">Withdraw proposal</button>
                  </form>
                </div>:<form className="agency-form" action={proposeAgencyAdvertisingBudget}>
                  <input type="hidden" name="client_id" value={c.id}/>
                  <Field name="proposed_monthly_limit_aud" label={approved===null?"Propose initial authorised monthly limit (AUD)":"Recommend a new monthly spending limit (AUD)"}
                    placeholder="Amount to approve" min="0" step="0.01" type="number" required/>
                  <label className="agency-field"><span>Reason for client approval</span><textarea name="reason" required minLength={12} maxLength={1200} rows={3}
                    placeholder="Why this amount? Explain the tests, economics, results and what happens if performance falls."/></label>
                  <button type="submit" className="login-action agency-save">Request client approval →</button>
                </form>}
                <p className="agency-caption">Approvals appear in the authorised client's Advertising dashboard. A client can request a pause or reduction at any time; actual Google Ads changes are made separately.</p>
              </>}
              {advertisingRequests.filter(r=>r.client_id===c.id).length>0&&
                <div className="agency-budget-history">
                  <h3>Approval history</h3>
                  <Table titles={["Requested on","Proposed limit","Prior approved limit","Decision","Reason"]} rows={
                    advertisingRequests.filter(r=>r.client_id===c.id).slice(0,10).map(r=>[
                      shortDate(r.created_at),aud(r.proposed_monthly_limit_aud),aud(r.previous_monthly_limit_aud),
                      <span key={r.id} className="status-chip">{r.status}</span>,r.reason
                    ])
                  }/>
                </div>}
            </Panel>;
          })}
          {filteredClients.length===0&&<Empty title="No clients yet" description="Create a client, then agree their initial testing budget."/>}
          <p className="panel-footnote">Approved advertising limits still apply to calendar months, independently of contract-anniversary reporting. These dashboard approvals do not automatically update Google Ads; actual spending data may lag.</p>
        </>}
        {sectionKey==="commissions"&&<>
          <div className="kpi-grid three">
            <Stat featured label="Current contract-period commissions" value={aud(estimated)} note="Provisional · per-client anniversary periods"/>
            <Stat label="Contracts configured" value={whole(filteredClients.filter(c=>terms.some(t=>t.client_id===c.id)).length)}/>
            <Stat label="Pending agreements" value={whole(filteredClients.filter(c=>!terms.some(t=>t.client_id===c.id)).length)}/>
          </div>
          <Panel eyebrow="CONTRACTS" title="Commission agreements">
            {filteredClients.map(c=>{
              const agreement=terms.find(t=>t.client_id===c.id);
              const history=histories.get(c.id)||[];
              const currentPeriod=history[0];
              const isTiered=agreement?.commission_model==="tiered_revenue_growth";
              const defaultTiered=c.slug==="enviro-aqua"&&!agreement;
              return <div className="agency-agreement" key={c.id}>
                <div className="agency-agreement-header">
                  <h3>{c.name}</h3>
                  <p>{currentPeriod ? `Contract period: ${shortDate(currentPeriod.start)} – ${shortDate(currentPeriod.end)} · Revenue: ${aud(currentPeriod.revenue)} · Commission: ${aud(currentPeriod.commission)}` : "Enter the signed commencement date and baseline to activate contract-period reporting."}</p>
                </div>
                <form className="agency-form" action={saveAgencyTerms}>
                  <input type="hidden" name="client_id" value={c.id}/>
                  <label className="agency-field"><span>Calculation model</span>
                    <select name="commission_model" defaultValue={agreement?.commission_model||(defaultTiered?"tiered_revenue_growth":"revenue_growth")}>
                      <option value="tiered_revenue_growth">Tiered growth · marginal percentages</option>
                      <option value="revenue_growth">Growth · single percentage</option>
                      <option value="manual">Custom / manually reconciled</option>
                    </select>
                  </label>
                  <Field type="date" label="Contract commencement date" name="contract_start_date" defaultValue={agreement?.contract_start_date||""}/>
                  <label className="agency-field"><span>Eligible revenue definition</span>
                    <select name="revenue_basis" defaultValue={agreement?.revenue_basis||"net_sales"}>
                      <option value="net_sales">Net product sales · excludes shipping</option>
                      <option value="total_sales">Shopify total sales · includes shipping</option>
                    </select>
                  </label>
                  <Field type="number" label="Fixed monthly baseline (AUD)" name="baseline_aud" min="0" step="0.01" placeholder="Agreed baseline" defaultValue={agreement?.baseline_monthly_aud??""}/>
                  <Field type="number" label="Single rate (%) · flat model only" name="commission_percentage" min="0" step="0.001" placeholder="For single-rate contracts" defaultValue={agreement?.commission_rate===null||agreement?.commission_rate===undefined?"":Number(agreement.commission_rate)*100}/>
                  <Field type="number" label="Tier 1 cap above baseline (AUD)" name="tier_1_cap_aud" min="0.01" step="0.01" defaultValue={agreement?.tier_1_limit_aud??20000}/>
                  <Field type="number" label="Tier 1 rate (%)" name="tier_1_percentage" min="0" step="0.001" defaultValue={agreement?.tier_1_rate===null||agreement?.tier_1_rate===undefined?12:Number(agreement.tier_1_rate)*100}/>
                  <Field type="number" label="Tier 2 cumulative cap (AUD)" name="tier_2_cap_aud" min="0.01" step="0.01" defaultValue={agreement?.tier_2_limit_aud??50000}/>
                  <Field type="number" label="Tier 2 rate (%)" name="tier_2_percentage" min="0" step="0.001" defaultValue={agreement?.tier_2_rate===null||agreement?.tier_2_rate===undefined?10:Number(agreement.tier_2_rate)*100}/>
                  <Field type="number" label="Tier 3 rate (%) · above tier 2" name="tier_3_percentage" min="0" step="0.001" defaultValue={agreement?.tier_3_rate===null||agreement?.tier_3_rate===undefined?8:Number(agreement.tier_3_rate)*100}/>
                  <button className="login-action agency-save" type="submit">Save commission agreement →</button>
                </form>
                <p className="agency-caption">Rates apply marginally to each revenue band, not retrospectively to the entire amount. Monthly periods begin on the contract commencement date; the day before the next anniversary ends each period. No commission is calculated without complete daily sales coverage.</p>
                {currentPeriod&&<>
                  <div className="agency-period-report">
                    <div className="agency-period-summary">
                      <strong>{shortDate(currentPeriod.start)} – {shortDate(currentPeriod.end)}</strong>
                      <span>{currentPeriod.coverageComplete?`As at ${shortDate(currentPeriod.asOf)} · ${currentPeriod.isCurrent?"In progress":"Completed, provisional"}`:`Sales data incomplete (${currentPeriod.recordedDays}/${currentPeriod.expectedDays} days)`}</span>
                    </div>
                    <div className="agreement-list">
                      <div><span>Commission-eligible contract revenue ({agreement?.revenue_basis==="total_sales"?"total sales":"net products"})</span><strong>{aud(currentPeriod.revenue)}</strong></div>
                      <div><span>Net product sales · excludes shipping</span><strong>{aud(currentPeriod.netRevenue)}</strong></div>
                      <div><span>Shopify total sales · incl. shipping</span><strong>{aud(currentPeriod.totalRevenue)}</strong></div>
                      <div><span>Shipping charges</span><strong>{aud(currentPeriod.shipping)}</strong></div>
                      <div><span>Fixed monthly baseline</span><strong>{aud(agreement?.baseline_monthly_aud)}</strong></div>
                      <div><span>Revenue above baseline</span><strong>{aud(currentPeriod.growth)}</strong></div>
                      {isTiered&&currentPeriod.breakdown.map((tier,i)=><div key={i}><span>{tier.label} at {percentage(tier.rate)}</span><strong>{aud(tier.commission)}</strong></div>)}
                      <div className="agreement-total"><span>Estimated commission</span><strong>{aud(currentPeriod.commission)}</strong></div>
                    </div>
                  </div>
                  <div className="agency-period-history"><h4>Contract period history</h4>
                  <Table titles={["Period","Eligible revenue","Net products","Shopify total","Above baseline","Commission","Status"]} rows={history.map(period=>[
                    `${shortDate(period.start)} – ${shortDate(period.end)}`,
                    aud(period.revenue),aud(period.netRevenue),aud(period.totalRevenue), aud(period.growth), aud(period.commission),
                    period.coverageComplete?period.isCurrent?"In progress":"Provisional":"Awaiting daily sales"
                  ])}/></div>
                </>}
              </div>;
            })}
            {!filteredClients.length&&<Empty title="No clients" description="Create a client before configuring commission terms."/>}
            <p className="panel-footnote">Contracts, refunds, GST, adjustments and final settlement govern amounts payable. These are provisional estimates, not automatically issued invoices.</p>
          </Panel>
        </>}
        {sectionKey==="agreements"&&<>
          <div className="agency-legal-warning">
            <strong>AGREEMENT TEMPLATE · NOT SENT</strong>
            <p>Edit your standard agreement or tailor it for a client. Nothing here sends a SignWell request, grants dashboard access or changes a signed agreement.</p>
          </div>
          <Panel eyebrow="MASTER TEMPLATE" title={agreementMaster?.title||"Marketing Partnership Agreement"}>
            {agreementMaster?<>
              <p className="agency-caption">Master version {agreementMaster.version} · last updated {shortDate(agreementMaster.updated_at)}. Editing the master does not overwrite a client's separately saved draft or any future signed agreement.</p>
              <div className="agency-contract-preview-caption">
                <span>DOCUMENT PREVIEW</span>
                <span>Master agreement · read-only view</span>
              </div>
              <AgreementPreview body={agreementMaster.body_markdown}/>
              <details className="agency-contract-edit-toggle">
                <summary><span>Edit master agreement wording</span><span aria-hidden="true">＋</span></summary>
                <form action={saveAgencyAgreementMaster} className="agency-agreement-editor">
                  <input type="hidden" name="expected_version" value={agreementMaster.version}/>
                  <label htmlFor="agency-master-agreement">
                    <strong>Agreement text</strong>
                    <span>Plain text — no Markdown symbols needed. Keep [[PLACEHOLDER_NAMES]] for client-specific details.</span>
                  </label>
                  <textarea id="agency-master-agreement" name="body_markdown" defaultValue={agreementMaster.body_markdown} rows={20} spellCheck/>
                  <button className="login-action agency-save" type="submit">Save master agreement →</button>
                </form>
              </details>
            </>:<Empty title="Master agreement unavailable" description="Check the agreement-template database and authorisation."/>}
          </Panel>
          <Panel eyebrow="CLIENT AGREEMENTS" title={selected?"Customise this client's agreement":"Prepare a client-specific agreement"}>
            {selected&&agreementMaster?(()=>{
              const client=clients.find(c=>c.id===selected);
              const clientTerms=terms.find(t=>t.client_id===selected);
              const existing=agreementDrafts.find(d=>d.client_id===selected);
              const body=existing?.body_markdown??agreementMaster.body_markdown;
              const preview=agreementPreview(body,client,clientTerms,budgetFor(selected));
              const outstanding=(preview.match(/\[\[[A-Z0-9_]+\]\]/g)||[]).length;
              return <div className="agency-client-contract">
                <p className="agency-caption">{client?.name} · {existing?"Private client draft revision "+existing.revision:"Based on master version "+agreementMaster.version}. Commercial values are previewed from the saved commission agreement; unresolved fields remain highlighted.</p>
                <div className="agency-contract-status">Details still to complete: <strong>{outstanding}</strong>. These are shown as “To be completed” in the preview and must be filled in before sending for signature.</div>
                <div className="agency-contract-preview-caption">
                  <span>CLIENT AGREEMENT PREVIEW</span>
                  <span>{client?.name} · using saved commission and advertising settings</span>
                </div>
                <AgreementPreview body={preview}/>
                <details className="agency-contract-edit-toggle">
                  <summary><span>Edit this client's wording</span><span aria-hidden="true">＋</span></summary>
                  <form action={saveAgencyClientAgreementDraft} className="agency-agreement-editor">
                    <input type="hidden" name="client_id" value={selected}/>
                    <input type="hidden" name="expected_revision" value={existing?.revision??0}/>
                    <input type="hidden" name="source_master_version" value={existing?.source_version??agreementMaster.version}/>
                    <label htmlFor="agency-client-agreement">
                      <strong>Client agreement text</strong>
                      <span>Make changes in plain text. Leave [[PLACEHOLDERS]] where saved client settings should be inserted.</span>
                    </label>
                    <textarea id="agency-client-agreement" name="body_markdown" defaultValue={body} rows={20} spellCheck/>
                    <button className="login-action agency-save" type="submit">Save this client's agreement →</button>
                  </form>
                </details>
              </div>;
            })():filteredClients.length?<Table titles={["Client","Draft","Action"]} rows={filteredClients.map(c=>{
              const draft=agreementDrafts.find(d=>d.client_id===c.id);
              return [<strong key={c.id}>{c.name}</strong>,draft?"Revision "+draft.revision+" · unsigned":"Not created",<Link key={c.id} className="table-link" href={path("agreements",c.id)}>Edit client draft →</Link>];
            })}/>:<Empty title="No clients" description="Create a client, then customise its agreement draft."/>}
            <p className="panel-footnote">A saved client draft is independent of the master. In the future, sending through SignWell must freeze the fully rendered terms, require a verified legally authorised signatory and retain the immutable signed PDF and audit certificate. No signing integration is active here yet.</p>
          </Panel>
        </>}
        {sectionKey==="invoices"&&<>
          <div className="kpi-grid three"><Stat featured label="Unpaid invoice value" value={aud(relevantInvoices.filter(i=>["issued","overdue"].includes(i.status)).reduce((n,i)=>n+Number(i.amount_aud),0))}/><Stat label="Issued invoices" value={whole(relevantInvoices.length)}/><Stat label="Paid invoices" value={whole(relevantInvoices.filter(i=>i.status==="paid").length)}/></div>
          <Panel eyebrow="BILLING" title="Client invoices">
            {relevantInvoices.length?<Table titles={["Client","Invoice","Issued","Due","Amount","Status","Link"]} rows={relevantInvoices.map(i=>[lookup(i.client_id),i.number,shortDate(i.issued_on),shortDate(i.due_on),aud(i.amount_aud),i.status,i.hosted_invoice_url?.startsWith("https://")?<a href={i.hosted_invoice_url} key={i.id} target="_blank" rel="noopener noreferrer" className="table-link">Open ↗</a>:"—"])}/>:<Empty title="No invoices recorded" description="Invoices will show here after you add them."/>}
          </Panel>
          <Panel eyebrow="INVOICE MANAGEMENT" title="Record an issued invoice">
            <p className="agency-caption">This saves an invoice record and optionally links to a secure external payment page. It does not generate or email invoices.</p>
            <form action={addAgencyInvoice} className="agency-form"><label className="agency-field"><span>Client</span><select name="client_id" required defaultValue={selected||""}><option value="" disabled>Select a client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="Invoice number" name="number" required placeholder="INV-0001"/><Field label="Amount (AUD)" type="number" step="0.01" min="0" name="amount_aud" required placeholder="0.00"/><Field label="Due date" type="date" name="due_on"/><Field label="Hosted invoice URL (optional)" type="url" name="hosted_invoice_url" placeholder="https://…"/><button className="login-action agency-save" type="submit">Record invoice →</button></form>
          </Panel>
        </>}
        <footer className="portal-footer">© {new Date().getFullYear()} steven.marketing <span>Internal agency administration · AUD</span></footer>
      </div>
    </main>
  </div>;
}

function currentMonthRows(metrics:Metrics[], ids:Set<string>){
  return metrics.filter(row=>row.month===monthNow() && ids.has(row.client_id));
}
