import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { SignOut } from "@/components/sign-out";
import { portalConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { contractHistory, sydneyToday, adSpendForPeriod, type AgreementTerms, type DailySales, type DailyAdSpend } from "@/lib/commission";
import {decideAdvertisingBudget} from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client dashboard | steven.marketing", robots: { index: false, follow: false } };

type Area = "overview" | "sales" | "advertising" | "commissions" | "invoices";
type Client = { id: string; name: string; slug: string };
type Membership = { client_id: string; role: string; clients: Client | Client[] | null };
type Month = {
  month: string; gross_sales_aud: number | null; net_sales_aud: number | null;
  orders: number | null; ad_spend_aud: number | null;
  shopify_synced_at: string | null; ads_synced_at: string | null;
};
type Terms = AgreementTerms;
type Invoice = { id: string; number: string; issued_on: string | null; due_on: string | null; amount_aud: number; status: string; hosted_invoice_url: string | null };
type AdvertisingSettings = {initial_testing_budget_aud:number;approved_monthly_limit_aud:number|null;objectives:string;phase:"testing"|"optimising"|"scaling"};
type AdvertisingRequest = {id:string;proposed_monthly_limit_aud:number;previous_monthly_limit_aud:number|null;reason:string;status:string;created_at:string;decided_at:string|null};
type AdvertisingDay = DailyAdSpend;
const nav: { id: Area; title: string; symbol: string }[] = [
  { id: "overview", title: "Overview", symbol: "◫" },
  { id: "sales", title: "Sales", symbol: "↗" },
  { id: "advertising", title: "Advertising", symbol: "◎" },
  { id: "commissions", title: "Commissions", symbol: "◇" },
  { id: "invoices", title: "Invoices", symbol: "▤" }
];

const money = (n: number | null | undefined) => n === null || n === undefined ? "—" : new Intl.NumberFormat("en-AU", {style: "currency", currency: "AUD", maximumFractionDigits: 2}).format(n);
const integer = (n: number | null | undefined) => n === null || n === undefined ? "—" : new Intl.NumberFormat("en-AU").format(n);
const monthLabel = (date: string) => new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("en-AU", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date + "T12:00:00Z")) : "—";
const pct = (n: number | null | undefined) => n === null || n === undefined ? "—" : `${(n * 100).toFixed(1)}%`;
function href(area: Area, slug: string) { return `/dashboard${area === "overview" ? "" : "/" + area}?client=${encodeURIComponent(slug)}`; }
function currentMonth() { return sydneyToday().slice(0,7)+"-01"; }
function Metric({ label, value, detail, accent = false }: {label:string;value:string;detail?:string;accent?:boolean}) {
  return <article className={`kpi${accent ? " kpi-accent" : ""}`}><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong><span className="kpi-detail">{detail || "Not connected"}</span></article>;
}
function Empty({ title, detail }: {title:string;detail:string}) {
  return <div className="empty-state"><span className="empty-symbol">◎</span><strong>{title}</strong><p>{detail}</p></div>;
}
function Table({ columns, rows }: {columns:string[];rows:ReactNode[][]}) {
  return <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((item,i)=><td key={i}>{item}</td>)}</tr>)}</tbody></table></div>;
}
function BarChart({ records, baseline }: {records:Month[];baseline:number|null}) {
  const rows = [...records].reverse().slice(-6);
  const max = Math.max(1,baseline||0,...rows.map(row=>Number(row.net_sales_aud)||0));
  return <div className="bars" role="img" aria-label="Monthly net sales chart. Exact values in the sales table.">
    {rows.map(row => <div className="bar-column" key={row.month}>
      <div className="bar-value">{money(row.net_sales_aud)}</div>
      <div className="bar-track">{baseline !== null && <span className="bar-baseline" style={{bottom:`${Math.min(100,baseline/max*100)}%`}} />}
        <div className="bar-fill" style={{height:`${Math.max(0,Number(row.net_sales_aud)||0)/max*100}%`}} />
      </div>
      <span className="bar-label">{monthLabel(row.month).split(" ")[0]}</span>
    </div>)}
  </div>;
}

export default async function Dashboard({ params, searchParams }: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ client?: string;error?:string;success?:string }>;
}) {
  const { section } = await params;
  const area = section?.[0] ?? "overview";
  if ((section?.length ?? 0) > 1 || !nav.some(item=>item.id===area)) notFound();
  if (!portalConfigured()) redirect("/login");

  const supabase = await createClient();
  const { data: verified, error: authError } = await supabase.auth.getClaims();
  if (authError || !verified?.claims?.sub) redirect("/login");
  const { data: admin } = await supabase.from("agency_admins")
    .select("user_id").eq("user_id",verified.claims.sub).maybeSingle();
  if (admin) redirect("/agency");

  const { data: membershipRows, error: memberError } = await supabase.from("client_memberships")
    .select("client_id, role, clients (id, name, slug)")
    .eq("user_id", verified.claims.sub);
  const memberships = ((membershipRows ?? []) as Membership[]).flatMap(row => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return client ? [{ ...client, role: row.role }] : [];
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const query = await searchParams;
  const client = query.client ? memberships.find(item=>item.slug===query.client) : memberships[0];
  if (query.client && !client) notFound();

  let months: Month[] = [];
  let terms: Terms | null = null;
  let invoices: Invoice[] = [];
  let dailySales: DailySales[] = [];
  let advertising: AdvertisingSettings|null=null;
  let budgetRequests:AdvertisingRequest[]=[];
  let dailyAdSpend:AdvertisingDay[]=[];
  let fetchFailed = Boolean(memberError);

  if (client) {
    const [metricsResult, termsResult, invoicesResult, dailyResult, adSettingsResult, adRequestsResult, adDailyResult] = await Promise.all([
      supabase.from("client_monthly_metrics").select("month,gross_sales_aud,net_sales_aud,orders,ad_spend_aud,shopify_synced_at,ads_synced_at")
        .eq("client_id", client.id).order("month", {ascending:false}).limit(12),
      supabase.from("client_terms").select("commission_model,contract_start_date,revenue_basis,baseline_monthly_aud,commission_rate,tier_1_limit_aud,tier_2_limit_aud,tier_1_rate,tier_2_rate,tier_3_rate")
        .eq("client_id", client.id).maybeSingle(),
      supabase.from("client_invoices").select("id,number,issued_on,due_on,amount_aud,status,hosted_invoice_url")
        .eq("client_id", client.id).order("issued_on", {ascending:false, nullsFirst:false}).limit(30),
      supabase.from("client_daily_sales").select("day,net_sales_aud,gross_sales_aud,total_sales_aud,shipping_charges_aud,orders")
        .eq("client_id",client.id).gte("day",new Date(Date.now()-270*86400000).toISOString().slice(0,10)).order("day",{ascending:false}).limit(1000),
      supabase.from("client_ad_budget_settings").select("initial_testing_budget_aud,approved_monthly_limit_aud,objectives,phase")
        .eq("client_id",client.id).maybeSingle(),
      supabase.from("client_ad_budget_requests").select("id,proposed_monthly_limit_aud,previous_monthly_limit_aud,reason,status,created_at,decided_at")
        .eq("client_id",client.id).order("created_at",{ascending:false}).limit(50),
      supabase.from("client_daily_ad_spend").select("day,ads_account_id,ad_spend_aud")
        .eq("client_id",client.id).gte("day",new Date(Date.now()-270*86400000).toISOString().slice(0,10))
        .lte("day",sydneyToday()).order("day",{ascending:false}).limit(1000)
    ]);
    fetchFailed = fetchFailed || Boolean(metricsResult.error || termsResult.error || invoicesResult.error || dailyResult.error || adSettingsResult.error || adRequestsResult.error || adDailyResult.error);
    months = (metricsResult.data ?? []) as Month[];
    terms = (termsResult.data ?? null) as Terms | null;
    invoices = (invoicesResult.data ?? []) as Invoice[];
    dailySales = (dailyResult.data ?? []) as DailySales[];
    advertising=(adSettingsResult.data??null) as AdvertisingSettings|null;
    budgetRequests=(adRequestsResult.data??[]) as AdvertisingRequest[];
    dailyAdSpend=(adDailyResult.data??[]) as AdvertisingDay[];
  }

  const thisMonth = months.find(row=>row.month===currentMonth()) || null;
  const baseline = terms?.baseline_monthly_aud === null || terms?.baseline_monthly_aud === undefined ? null : Number(terms.baseline_monthly_aud);
  const netSales = thisMonth?.net_sales_aud === null || thisMonth?.net_sales_aud === undefined ? null : Number(thisMonth.net_sales_aud);
  const hasGrowthModel=terms?.commission_model==="revenue_growth"||terms?.commission_model==="tiered_revenue_growth";
  const tiered=terms?.commission_model==="tiered_revenue_growth";
  const history=contractHistory(terms,dailySales,sydneyToday());
  const currentPeriod=history[0]??null;
  const growth=currentPeriod?.growth??null;
  const commission=currentPeriod?.commission??null;
  const rate=terms?.commission_rate===null||terms?.commission_rate===undefined?null:Number(terms.commission_rate);
  const periodName=currentPeriod?[dateLabel(currentPeriod.start),dateLabel(currentPeriod.end)].join(" – "):"Contract dates not configured";
  const modelName=tiered?"Tiered revenue growth":hasGrowthModel?"Revenue growth":"Manually reconciled";
  const adHistory=history.map(period=>({period,ads:adSpendForPeriod(period,dailyAdSpend)}));
  const contractAds=adHistory[0]?.ads??null;
  const contractDays=currentPeriod?currentPeriod.recordedDays+"/"+currentPeriod.expectedDays+" days":"No contract date";
  const adDays=contractAds?contractAds.recordedDays+"/"+contractAds.expectedDays+" days":"No contract date";
  const chosenArea = area as Area;
  const pendingBudget=budgetRequests.find(r=>r.status==="pending");
  const monthAdRows=dailyAdSpend.filter(r=>r.day>=currentMonth()&&r.day<=sydneyToday());
  const hasSpendDays=monthAdRows.length>0;
  const spentThisMonth=hasSpendDays?
    Math.round(monthAdRows.reduce((sum,row)=>sum+Math.round(Number(row.ad_spend_aud)*10000),0)/100)/100:null;
  const spendDays=new Set(monthAdRows.map(r=>r.day)).size;
  const spendSnapshotComplete=hasSpendDays&&spendDays===Number(sydneyToday().slice(8,10));
  const latestSpendDay=monthAdRows.map(r=>r.day).sort().at(-1)||null;
  const approvedLimit=advertising?.approved_monthly_limit_aud??null;
  const remainingBudget=approvedLimit!==null&&spentThisMonth!==null&&spendSnapshotComplete?Math.round((approvedLimit-spentThisMonth)*100)/100:null;

  return <div className="portal-shell">
    <aside className="portal-sidebar">
      <Link href="/" className="portal-brand">steven.marketing<span className="brand-dot">.</span></Link>
      <div className="sidebar-caption">CLIENT PORTAL</div>
      {client ? <div className="client-identity"><span className="client-icon">{client.name.slice(0,1).toUpperCase()}</span><div><strong>{client.name}</strong><small>Client workspace</small></div></div> : <div className="client-identity"><span className="client-icon">—</span><div><strong>No workspace</strong><small>Access pending</small></div></div>}
      <div className="sidebar-caption nav-caption">WORKSPACE</div>
      <nav className="portal-nav" aria-label="Dashboard">
        {nav.map(item => <Link key={item.id} href={client ? href(item.id,client.slug) : "#"} className={`portal-nav-item${chosenArea===item.id?" is-active":""}`} aria-current={chosenArea===item.id ? "page" : undefined}>
          <span className="nav-symbol">{item.symbol}</span>{item.title}
        </Link>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-help">Need assistance?<br /><a href="mailto:hello@steven.marketing">hello@steven.marketing ↗</a></div><SignOut /></div>
    </aside>
    <main className="portal-main">
      <header className="portal-topbar"><span>CLIENT DASHBOARD</span><div className="portal-top-right"><span className="privacy-pill"><i /> Private workspace</span><span className="portal-avatar">{client?.name.slice(0,1).toUpperCase()||"?"}</span></div></header>
      <div className="portal-body">
        <div className="page-heading"><div>
          <p className="dashboard-eyebrow">YOUR BUSINESS AT A GLANCE</p>
          <h1>{chosenArea === "overview" ? "Overview" : nav.find(item=>item.id===chosenArea)?.title}<span className="heading-period"> / {["sales","advertising","commissions"].includes(chosenArea)&&currentPeriod?periodName:monthLabel(currentMonth())}</span></h1>
          <p className="dashboard-subtitle">{client?.name ?? "Your workspace"} · Performance that matters, without the noise.</p>
        </div>{memberships.length > 1 && <div className="client-switch"><span>Workspace</span><div className="client-links">{memberships.map(item=><Link key={item.id} className={item.id===client?.id?"selected":""} href={href(chosenArea,item.slug)}>{item.name}</Link>)}</div></div>}</div>

        {fetchFailed && <div className="dashboard-alert" role="alert">The dashboard could not load all data. Please try again or contact support.</div>}
        {query.success==="1"&&<div className="agency-notification" role="status">Your advertising budget decision has been recorded.</div>}
        {query.error==="1"&&<div className="dashboard-alert" role="alert">Unable to record that decision. It may already have been decided, or your account may not have approval permissions.</div>}
        {!client ? <Empty title="Your dashboard is almost ready" detail="Your account is signed in, but it has not been assigned to a client workspace. Please contact steven.marketing to enable access." /> :
        chosenArea === "overview" ? <>
          <section className="kpi-grid" aria-label="Current month key metrics">
            <Metric label="Eligible revenue · contract period" value={money(currentPeriod?.revenue)} detail={currentPeriod?.coverageComplete?periodName+" · "+(terms?.revenue_basis==="total_sales"?"incl. shipping":"excl. shipping"):"Awaiting complete daily sales"} accent />
            <Metric label="Revenue above baseline" value={money(growth)} detail={currentPeriod?periodName:baseline===null?"Baseline not set":"Contract commencement not set"} />
            <Metric label="Google Ads · contract period" value={money(contractAds?.amount)} detail={contractAds?.coverageComplete?periodName+" · through "+dateLabel(currentPeriod?.asOf??null):"Awaiting complete daily ad spend"} />
            <Metric label="Estimated commission" value={money(commission)} detail={currentPeriod?.coverageComplete?periodName+" · Provisional":"Awaiting complete contract-period data"} />
          </section>
          <div className="dashboard-columns">
            <section className="panel panel-wide"><div className="panel-heading"><div><span className="panel-kicker">REVENUE TREND</span><h2>Sales performance</h2></div><Link href={href("sales",client.slug)} className="panel-link">View sales →</Link></div>
              {months.some(row=>row.net_sales_aud !== null) ? <><BarChart records={months.filter(row=>row.net_sales_aud !== null)} baseline={terms?.contract_start_date?null:baseline}/><div className="chart-key"><span><i className="chart-key-bar"/> Net revenue</span>{baseline !== null && !terms?.contract_start_date && <span><i className="chart-key-line"/> Baseline</span>}</div></> : <Empty title="Sales reporting is not connected" detail="Monthly sales data will appear here after the Shopify integration is configured."/>}
            </section>
            <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">YOUR AGREEMENT</span><h2>Commission model</h2></div></div>
              {terms ? <div className="agreement-list">
                <div><span>Model</span><strong>{modelName}</strong></div>
                <div><span>Contract starts</span><strong>{dateLabel(terms.contract_start_date)}</strong></div>
                <div><span>Current contract period</span><strong>{periodName}</strong></div>
                <div><span>Eligible revenue basis</span><strong>{terms.revenue_basis==="total_sales"?"Shopify total sales · includes shipping":"Net product sales · excludes shipping"}</strong></div>
                <div><span>Eligible revenue to date</span><strong>{money(currentPeriod?.revenue)}</strong></div>
                <div><span>Fixed monthly baseline</span><strong>{money(baseline)}</strong></div>
                <div><span>Commission rate</span><strong>{tiered?[pct(terms.tier_1_rate),pct(terms.tier_2_rate),pct(terms.tier_3_rate)].join(" / "):hasGrowthModel?pct(rate):"Custom"}</strong></div>
                <div><span>Estimated commission</span><strong>{money(commission)}</strong></div>
              </div> : <Empty title="Agreement not added" detail="Your individual commission terms will appear when configured." />}
              <p className="panel-footnote">Figures are provisional. Invoices and your signed agreement determine amounts payable.</p>
            </section>
          </div>
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">ADVERTISING BUDGET</span><h2>Monthly spending approval</h2></div>
              <Link href={href("advertising",client.slug)} className="panel-link">View budget →</Link>
            </div>
            <div className="agency-budget-summary">
              <div><span>Approved monthly limit</span><strong>{money(approvedLimit)}</strong></div>
              <div><span>Recorded Google Ads spend</span><strong>{money(spentThisMonth)}</strong></div>
              <div><span>Pending change</span><strong>{pendingBudget?money(pendingBudget.proposed_monthly_limit_aud):"None"}</strong></div>
            </div>
            <p className="panel-footnote">Calendar-month approval and recorded spending are separate from your commission reporting periods. {spendSnapshotComplete?"Daily spending records cover the month so far.":"Spend data may be incomplete or delayed."} Nothing automatically changes your Google Ads budget.</p>
          </section>
          <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">ACCOUNT</span><h2>Recent invoices</h2></div><Link href={href("invoices",client.slug)} className="panel-link">All invoices →</Link></div>
            {invoices.length ? <Table columns={["Invoice","Issued","Amount","Status"]} rows={invoices.slice(0,3).map(row=>[row.hosted_invoice_url?.startsWith("https://") ? <a key={row.id} href={row.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="table-link">{row.number} ↗</a> : row.number,dateLabel(row.issued_on),money(Number(row.amount_aud)),<span key={row.id} className="status-chip">{row.status}</span>])}/> : <Empty title="No invoices yet" detail="Invoices will be listed here when issued."/>}
          </section>
        </> :
        chosenArea === "sales" ? <>
          <section className="panel agency-period-banner">
            <span className="panel-kicker">SALES · CONTRACT PERIOD</span>
            <h2>{periodName}</h2>
            <p className="agency-caption">This is the same anniversary-based reporting period used to calculate your commission. Current values are measured through {dateLabel(currentPeriod?.asOf??null)}, with missing reporting dates shown explicitly.</p>
          </section>
          <section className="kpi-grid">
            <Metric label="Net product sales · contract period" value={money(currentPeriod?.netRevenue)} detail="After refunds and discounts · excluding customer shipping" accent/>
            <Metric label="Shopify total sales · contract period" value={money(currentPeriod?.totalRevenue)} detail="Includes customer shipping and any reported tax"/>
            <Metric label="Orders · contract period" value={integer(currentPeriod?.orders)} detail={contractDays}/>
            <Metric label="Shipping charged to customers" value={money(currentPeriod?.shipping)} detail="Shipping revenue, not courier expense"/>
          </section>
          {!currentPeriod?<section className="panel"><Empty title="Agreement start date not configured" detail="Once your contract commencement date is set, sales appear in the same reporting periods as your commission."/></section>:
            !currentPeriod.coverageComplete&&<p className="dashboard-alert">Some daily sales records are unavailable ({contractDays}). Incomplete figures are withheld rather than underreported.</p>}
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">CURRENT CONTRACT PERIOD</span><h2>Sales and revenue breakdown</h2></div>
              <Link href={href("commissions",client.slug)} className="panel-link">Commission calculation →</Link></div>
            {currentPeriod?<div className="agreement-list">
              <div><span>Current period</span><strong>{periodName}</strong></div>
              <div><span>Shopify total sales</span><strong>{money(currentPeriod.totalRevenue)}</strong></div>
              <div><span>Net product sales</span><strong>{money(currentPeriod.netRevenue)}</strong></div>
              <div><span>Gross product sales</span><strong>{money(currentPeriod.grossRevenue)}</strong></div>
              <div><span>Customer shipping charges</span><strong>{money(currentPeriod.shipping)}</strong></div>
              <div><span>Orders</span><strong>{integer(currentPeriod.orders)}</strong></div>
              <div><span>Eligible revenue for commission</span><strong>{money(currentPeriod.revenue)}</strong></div>
              <div><span>Daily data coverage</span><strong>{contractDays}</strong></div>
            </div>:<Empty title="No contract period yet" detail="The agreement commencement date is needed to show accurate figures."/>}
            <p className="panel-footnote">Figures are based on daily Shopify records, not calendar-month totals. Sales data is a reporting snapshot, not a continuous background feed.</p>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">CONTRACT ANNIVERSARY HISTORY</span><h2>Sales reporting periods</h2></div></div>
            {history.length?<Table columns={["Contract period","Total sales","Net sales","Gross sales","Shipping","Orders","Coverage"]} rows={
              history.map(p=>[
                dateLabel(p.start)+" – "+dateLabel(p.end),money(p.totalRevenue),money(p.netRevenue),money(p.grossRevenue),
                money(p.shipping),integer(p.orders),p.recordedDays+"/"+p.expectedDays+(p.isCurrent?" · ongoing":p.coverageComplete?" · complete":" · incomplete")
              ])
            }/>:<Empty title="No contract-period history" detail="Add a commencement date to display anniversary-based sales history."/>}
            <p className="panel-footnote">Historical periods use precisely the same start and end dates as your commission calculations. Missing daily records remain unavailable, not assumed to be zero.</p>
          </section>
        </> :
        chosenArea === "advertising" ? <>
          <section className="panel agency-period-banner">
            <span className="panel-kicker">GOOGLE ADS · CONTRACT PERIOD</span>
            <h2>{periodName}</h2>
            <p className="agency-caption">Advertising performance matches your contract's anniversary dates and commission period through {dateLabel(currentPeriod?.asOf??null)}. Budget approvals further down remain calendar-month limits.</p>
          </section>
          <section className="kpi-grid three">
            <Metric label="Google Ads spend · contract period" value={money(contractAds?.amount)} detail={contractAds?.coverageComplete?"Complete daily records through "+dateLabel(currentPeriod?.asOf??null):"Requires complete daily Google Ads data"} accent/>
            <Metric label="Daily Google Ads coverage" value={adDays} detail={contractAds?.coverageComplete?"All contract-period days recorded":"Missing ad spend dates are not treated as $0"}/>
            <Metric label="Net product sales · same period" value={money(currentPeriod?.netRevenue)} detail="Shopify sales · not attributed solely to Google Ads"/>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">CURRENT CONTRACT PERIOD</span><h2>Advertising investment</h2></div>
              <Link href={href("sales",client.slug)} className="panel-link">Compare sales →</Link></div>
            {currentPeriod?<div className="agreement-list">
              <div><span>Reporting period</span><strong>{periodName}</strong></div>
              <div><span>Google Ads spend</span><strong>{money(contractAds?.amount)}</strong></div>
              <div><span>Daily ad records</span><strong>{adDays}</strong></div>
              <div><span>Shopify net product sales</span><strong>{money(currentPeriod.netRevenue)}</strong></div>
              <div><span>Shopify total sales</span><strong>{money(currentPeriod.totalRevenue)}</strong></div>
            </div>:<Empty title="Contract dates not configured" detail="Configure a contract commencement date to align Google Ads spend to commission periods."/>}
            <p className="panel-footnote">Google Ads spending and Shopify sales use different reporting systems; revenue here is not necessarily attributed to Google Ads. Missing daily ad spend suppresses the total.</p>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">CONTRACT ANNIVERSARY HISTORY</span><h2>Google Ads spending by contract month</h2></div></div>
            {adHistory.length?<Table columns={["Contract period","Ad spend","Daily coverage","Status"]} rows={
              adHistory.map(({period:p,ads:a})=>[
                dateLabel(p.start)+" – "+dateLabel(p.end),money(a.amount),
                a.recordedDays+"/"+a.expectedDays,
                a.coverageComplete?(p.isCurrent?"Current · to "+dateLabel(p.asOf):"Complete"):"Incomplete daily data"
              ])
            }/>:<Empty title="No contract-period spending history" detail="The contract commencement date is needed to group Google Ads daily spend."/>}
            <p className="panel-footnote">Exactly the same dates as Sales and Commissions, including periods crossing two calendar months. Advertising data is a snapshot and may require a fresh sync.</p>
          </section>
          <div className="agency-period-banner budget-calendar-divider">
            <span className="panel-kicker">SEPARATE CALENDAR-MONTH CONTROLS</span>
            <h2>Advertising budget approvals</h2>
            <p className="agency-caption">The client's approved spending limit remains a calendar-month control. It does not automatically change campaign budgets in Google Ads.</p>
          </div>
          <section className="kpi-grid three">
            <Metric label="Approved monthly spending limit" value={money(approvedLimit)} detail="Calendar-month authority · not an automatic spending control"/>
            <Metric label="Recorded spend this calendar month" value={spendSnapshotComplete?money(spentThisMonth):"—"} detail={latestSpendDay?"Daily Google Ads records through "+dateLabel(latestSpendDay):"No daily records yet"}/>
            <Metric label="Limit less recorded spend" value={money(remainingBudget)} detail={spendSnapshotComplete?"Based on recorded daily spend":"Unavailable · spending data incomplete"}/>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">HOW WE INVEST</span><h2>Your advertising plan</h2></div></div>
            {advertising?<div className="agreement-list">
              <div><span>Initial monthly testing budget</span><strong>{money(advertising.initial_testing_budget_aud)}</strong></div>
              <div><span>Current approved monthly limit</span><strong>{money(approvedLimit)}</strong></div>
              <div><span>Current stage</span><strong>{advertising.phase[0].toUpperCase()+advertising.phase.slice(1)}</strong></div>
              <div><span>Advertising objectives</span><strong className="agency-wrap-text">{advertising.objectives||"Not set yet"}</strong></div>
            </div>:<Empty title="Advertising plan not configured" detail="Steven will share an initial testing plan and budget for your approval."/>}
            <p className="panel-footnote">The initial phase may involve testing and learning before results become consistent. Steven can redistribute spending within your approved monthly limit and may recommend scaling proven campaigns. Any change to the overall limit requires your approval. Ad spend is paid to the advertising platform separately from Steven's commission.</p>
          </section>
          {pendingBudget&&<section className="panel agency-budget-request">
            <div className="panel-heading"><div><span className="panel-kicker">YOUR DECISION</span><h2>Advertising budget proposal</h2></div>
              <span className="status-chip">Awaiting approval</span>
            </div>
            <div className="agency-budget-summary">
              <div><span>Currently approved</span><strong>{money(pendingBudget.previous_monthly_limit_aud)}</strong></div>
              <div><span>Proposed monthly limit</span><strong>{money(pendingBudget.proposed_monthly_limit_aud)}</strong></div>
            </div>
            <p className="agency-budget-reason">{pendingBudget.reason}</p>
            {client.role==="owner"?<div className="agency-budget-decisions">
              <form action={decideAdvertisingBudget}>
                <input type="hidden" name="client_id" value={client.id}/>
                <input type="hidden" name="request_id" value={pendingBudget.id}/>
                <input type="hidden" name="decision" value="approve"/>
                <button className="login-action agency-save" type="submit">Approve monthly limit →</button>
              </form>
              <form action={decideAdvertisingBudget}>
                <input type="hidden" name="client_id" value={client.id}/>
                <input type="hidden" name="request_id" value={pendingBudget.id}/>
                <input type="hidden" name="decision" value="decline"/>
                <button className="agency-light-button" type="submit">Decline</button>
              </form>
            </div>:<p className="agency-caption">Only the authorised owner of your business workspace can approve or decline budget changes.</p>}
            <p className="panel-footnote">Approving updates Steven's spending authorisation only. It does not itself change Google Ads campaign budgets or create a charge.</p>
          </section>}
          <section className="panel">
            <div className="panel-heading"><div><span className="panel-kicker">APPROVAL HISTORY</span><h2>Your budget decisions</h2></div></div>
            {budgetRequests.length?<Table columns={["Proposed","Previous limit","New limit","Status","Reason"]} rows={budgetRequests.map(r=>[
              dateLabel(r.created_at.slice(0,10)),money(r.previous_monthly_limit_aud),money(r.proposed_monthly_limit_aud),
              <span key={r.id} className="status-chip">{r.status}</span>,r.reason
            ])}/>:<Empty title="No budget requests yet" detail="Any increases or changes Steven proposes will appear here for review."/>}
            <p className="panel-footnote">You can request a reduction or pause at any time by contacting <a href="mailto:hello@steven.marketing?subject=Advertising%20budget%20change">Steven directly ↗</a>. A dashboard approval is not proof that Google Ads has been updated; campaign adjustments are performed separately.</p>
          </section>
          <p className="panel-footnote">Spending controls and client approvals use calendar months, while advertising reports above use your contract dates. Neither this dashboard nor its reports automatically enforce live Google Ads spending limits.</p>
        </> :
        chosenArea === "commissions" ? <>
          <section className="kpi-grid three">
            <Metric label="Estimated commission" value={money(commission)} detail={currentPeriod?periodName+" · provisional":"Commencement date not configured"} accent/>
            <Metric label="Revenue above baseline" value={money(growth)} detail="Current contract period"/>
            <Metric label="Commission model" value={tiered?"Tiered":hasGrowthModel?"Fixed rate":"Custom"} detail={tiered?"Marginal percentage bands":"See your agreement below"}/>
          </section>
          <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">AGREEMENT & CALCULATION</span><h2>How commission is calculated</h2></div></div>
            {terms ? <>
              <div className="agreement-list">
                <div><span>Commission model</span><strong>{modelName}</strong></div>
                <div><span>Contract commencement</span><strong>{dateLabel(terms.contract_start_date)}</strong></div>
                <div><span>Current period</span><strong>{periodName}</strong></div>
                <div><span>Commission-eligible contract revenue</span><strong>{money(currentPeriod?.revenue)}</strong></div>
                <div><span>Revenue definition</span><strong>{terms.revenue_basis==="total_sales"?"Shopify total sales incl. shipping":"Net product sales excl. shipping"}</strong></div>
                <div><span>Net product sales</span><strong>{money(currentPeriod?.netRevenue)}</strong></div>
                <div><span>Shopify total sales</span><strong>{money(currentPeriod?.totalRevenue)}</strong></div>
                <div><span>Shipping charges</span><strong>{money(currentPeriod?.shipping)}</strong></div>
                <div><span>Agreed fixed monthly baseline</span><strong>{money(baseline)}</strong></div>
                <div><span>Eligible growth above baseline</span><strong>{money(growth)}</strong></div>
                {tiered&&currentPeriod?.breakdown.map((t,i)=><div key={i}><span>{t.label} at {pct(t.rate)}</span><strong>{money(t.commission)}</strong></div>)}
                {hasGrowthModel&&!tiered&&<div><span>Single commission rate</span><strong>{pct(rate)}</strong></div>}
                <div className="agreement-total"><span>Estimated commission</span><strong>{money(commission)}</strong></div>
              </div>
              <p className="panel-footnote">{currentPeriod?.coverageComplete
                ? "Reported through "+dateLabel(currentPeriod.asOf)+". "+(currentPeriod.isCurrent?"Period in progress.":"Completed period; pending verification.")+" Values are provisional and subject to your signed agreement."
                : currentPeriod?"Only "+currentPeriod.recordedDays+" of "+currentPeriod.expectedDays+" daily sales records are available. Commission will appear when reporting is complete.":"Enter the agreed commencement date and baseline to enable period calculations."}</p>
              {history.length>0&&<>
                <div className="panel-heading" style={{marginTop:32}}><div><span className="panel-kicker">HISTORICAL PERIODS</span><h2>Contract month history</h2></div></div>
                <Table columns={["Contract period","Eligible revenue","Net product sales","Shopify total sales","Growth above baseline","Estimated commission","Reporting"]} rows={history.map(p=>[
                  dateLabel(p.start)+" – "+dateLabel(p.end),
                  money(p.revenue),money(p.netRevenue),money(p.totalRevenue),money(p.growth),money(p.commission),
                  p.coverageComplete?p.isCurrent?"In progress":"Provisional":"Incomplete daily data"
                ])}/>
              </>}
            </> : <Empty title="Commission agreement not configured" detail="Your contract commencement and commission calculation will appear after agreement setup."/>}
          </section>
        </> :
        <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">BILLING</span><h2>Invoices & payments</h2></div></div>
          {invoices.length ? <Table columns={["Invoice","Issued","Due","Total","Status","Payment"]} rows={invoices.map(row=>[row.number,dateLabel(row.issued_on),dateLabel(row.due_on),money(Number(row.amount_aud)),<span key={row.id} className="status-chip">{row.status}</span>,row.hosted_invoice_url?.startsWith("https://") ? <a className="table-link" key={row.id} href={row.hosted_invoice_url} target="_blank" rel="noopener noreferrer">View invoice ↗</a> : "—"])}/> : <Empty title="No invoices issued" detail="Your invoices and secure payment links will appear here once issued."/>}
          <p className="panel-footnote">Only payments through verified invoice links are supported. This portal never collects card details.</p>
        </section>}
        <footer className="portal-footer">© {new Date().getFullYear()} steven.marketing <span>Private client reporting · AUD</span></footer>
      </div>
    </main>
  </div>;
}
