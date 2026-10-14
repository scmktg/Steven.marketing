import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SignOut } from "@/components/sign-out";
import { requireAgencyAdmin } from "@/lib/agency-auth";
import { contractHistory, sydneyToday, adSpendForPeriod, revenueAfterDeductions, type AgreementTerms, type DailySales, type DailyAdSpend } from "@/lib/commission";
import { createAgencyClient, saveAgencyTerms, assignClientMember, removeClientMember, addAgencyInvoice, saveAgencyOverviewPreferences } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title:"Agency dashboard | steven.marketing", robots:{index:false,follow:false} };

type Section = "overview" | "clients" | "sales" | "advertising" | "commissions" | "invoices";
type Client = { id:string; name:string; slug:string };
type Terms = AgreementTerms & {client_id:string};
type Metrics = {client_id:string;month:string;gross_sales_aud:number|null;net_sales_aud:number|null;orders:number|null;ad_spend_aud:number|null;shopify_synced_at:string|null;ads_synced_at:string|null};
type Invoice = {id:string;client_id:string;number:string;amount_aud:number;status:string;issued_on:string|null;due_on:string|null;hosted_invoice_url:string|null};
type Membership = {client_id:string;user_id:string;role:string};
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
  {key:"invoices",label:"Invoices",icon:"▤"}
];
const aud = (n:number|null|undefined)=>n===null||n===undefined?"—":new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(n));
const whole = (n:number|null|undefined)=>n===null||n===undefined?"—":new Intl.NumberFormat("en-AU").format(n);
const shortDate=(s:string|null|undefined)=>s?new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s.slice(0,10)+"T12:00:00Z")):"—";
const monthName=(s:string)=>new Intl.DateTimeFormat("en-AU",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));
const percentage=(n:number|null|undefined)=>n===null||n===undefined?"—":`${(Number(n)*100).toFixed(2)}%`;
const monthNow=()=>sydneyToday().slice(0,7)+"-01";
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

  const [clientsResponse,termsResponse,metricsResponse,invoicesResponse,membershipsResponse,dailyResponse,adsDailyResponse,prefsResponse]=await Promise.all([
    supabase.from("clients").select("id,name,slug").order("name").limit(200),
    supabase.from("client_terms").select("client_id,commission_model,contract_start_date,revenue_basis,baseline_monthly_aud,commission_rate,tier_1_limit_aud,tier_2_limit_aud,tier_1_rate,tier_2_rate,tier_3_rate").limit(200),
    supabase.from("client_monthly_metrics").select("client_id,month,gross_sales_aud,net_sales_aud,orders,ad_spend_aud,shopify_synced_at,ads_synced_at").order("month",{ascending:false}).limit(1000),
    supabase.from("client_invoices").select("id,client_id,number,amount_aud,status,issued_on,due_on,hosted_invoice_url").order("issued_on",{ascending:false,nullsFirst:false}).limit(200),
    supabase.from("client_memberships").select("client_id,user_id,role").limit(500),
    supabase.from("client_daily_sales").select("client_id,day,net_sales_aud,gross_sales_aud,total_sales_aud,shipping_charges_aud,orders").gte("day", new Date(Date.now()-270*86400000).toISOString().slice(0,10)).order("day",{ascending:false}).limit(1000),
    supabase.from("client_daily_ad_spend").select("client_id,day,ads_account_id,ad_spend_aud").gte("day",new Date(Date.now()-270*86400000).toISOString().slice(0,10)).order("day",{ascending:false}).limit(1000),
    supabase.from("agency_dashboard_preferences").select("overview_mode,visible_cards").eq("user_id",userId).maybeSingle()
  ]);
  const failed=Boolean(clientsResponse.error||termsResponse.error||metricsResponse.error||invoicesResponse.error||membershipsResponse.error||dailyResponse.error||adsDailyResponse.error||prefsResponse.error);
  const clients=(clientsResponse.data||[]) as Client[];
  const terms=(termsResponse.data||[]) as Terms[];
  const allMetrics=(metricsResponse.data||[]) as Metrics[];
  const allInvoices=(invoicesResponse.data||[]) as Invoice[];
  const memberships=(membershipsResponse.data||[]) as Membership[];
  const dailySales=(dailyResponse.data||[]) as DailySales[];
  const dailyAds=(adsDailyResponse.data||[]) as DailyAdSpend[];
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
  const allCovered=contracted.length>0&&contracted.every(c=>c.period.coverageComplete);
  type PeriodMetric="revenue"|"netRevenue"|"totalRevenue"|"grossRevenue"|"shipping"|"growth"|"commission"|"orders";
  const summedContract=(metric:PeriodMetric):number|null=>{
    if(!allCovered||contracted.some(c=>c.period[metric]===null))return null;
    return Math.round(contracted.reduce((sum,c)=>sum+Number(c.period[metric]),0)*100)/100;
  };
  const completeAds=contracted.length>0&&contracted.every(c=>adPeriods.get(c.client.id)?.coverageComplete);
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
        <div className="page-heading"><div><p className="dashboard-eyebrow">STEVEN MARKETING / MANAGEMENT</p><h1>{sections.find(x=>x.key===sectionKey)?.label}<span className="heading-period"> / {monthName(current)}</span></h1><p className="dashboard-subtitle">One place to manage your clients, performance and billing.</p></div></div>
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
            <form action={createAgencyClient} className="agency-form"><Field name="name" label="Business name" placeholder="e.g. New Client" required/><Field name="slug" label="URL slug" placeholder="e.g. new-client" required/><button type="submit" className="login-action agency-save">Create workspace →</button></form>
          </Panel>
          {selected&&chosen&&<Panel eyebrow="ACCESS CONTROL" title={`${chosen.name} · Team members`}>
            {memberships.filter(m=>m.client_id===selected).length?<Table titles={["Supabase user ID","Role","Remove access"]} rows={memberships.filter(m=>m.client_id===selected).map(m=>[
              <code key={m.user_id} className="agency-code">{m.user_id}</code>,m.role,
              <form key={m.user_id} action={removeClientMember}><input type="hidden" name="client_id" value={selected}/><input type="hidden" name="user_id" value={m.user_id}/><button type="submit" className="agency-light-button">Remove</button></form>
            ])}/>:<p className="agency-caption">No client users have been assigned yet.</p>}
            <p className="agency-caption">First invite the person from Supabase Authentication → Users, then paste their Supabase User ID below. New invitations are not sent from this form.</p>
            <form action={assignClientMember} className="agency-form"><input type="hidden" name="client_id" value={selected}/><Field label="Supabase user ID" name="user_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required/><label className="agency-field"><span>Access level</span><select name="role" defaultValue="viewer"><option value="viewer">Viewer (read only)</option><option value="owner">Client owner (read only)</option></select></label><button className="login-action agency-save" type="submit">Grant client access →</button></form>
          </Panel>}
        </>}
        {sectionKey==="sales"&&<>
          <div className="kpi-grid three"><Stat featured label="Net sales this month" value={aud(netTotal)}/><Stat label="Reporting clients" value={whole(salesKnown.length)}/><Stat label="Total orders" value={month.some(m=>m.orders!==null)?whole(month.reduce((sum,m)=>sum+Number(m.orders||0),0)):"—"}/></div>
          <Panel eyebrow="REVENUE" title="Monthly sales reporting">{relevantMetrics.some(m=>m.net_sales_aud!==null)?<Table titles={["Client","Month","Gross sales","Net sales","Orders","Last synced"]} rows={relevantMetrics.filter(m=>m.net_sales_aud!==null).map(m=>[lookup(m.client_id),monthName(m.month),aud(m.gross_sales_aud),aud(m.net_sales_aud),whole(m.orders),shortDate(m.shopify_synced_at)])}/>:<Empty title="No connected sales data" description="Shopify sales will appear once each client’s integration is authorised and running."/>}</Panel>
        </>}
        {sectionKey==="advertising"&&<>
          <div className="kpi-grid three"><Stat featured label="Total advertising spend" value={aud(spendTotal)}/><Stat label="Reporting clients" value={whole(spendKnown.length)}/><Stat label="Period" value={monthName(current)}/></div>
          <Panel eyebrow="CAMPAIGNS" title="Google Ads reporting">{relevantMetrics.some(m=>m.ad_spend_aud!==null)?<Table titles={["Client","Month","Ad spend","Last synced"]} rows={relevantMetrics.filter(m=>m.ad_spend_aud!==null).map(m=>[lookup(m.client_id),monthName(m.month),aud(m.ad_spend_aud),shortDate(m.ads_synced_at)])}/>:<Empty title="No advertising data yet" description="Authorise advertising account syncs before reporting real spending."/>}<p className="panel-footnote">Spend is not automatically attributed to Shopify revenue. Report attribution separately.</p></Panel>
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
