import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { SignOut } from "@/components/sign-out";
import { portalConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { contractHistory, sydneyToday, type AgreementTerms, type DailySales } from "@/lib/commission";

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
function currentMonth() { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-01`; }
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
  searchParams: Promise<{ client?: string }>;
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
  let fetchFailed = Boolean(memberError);

  if (client) {
    const [metricsResult, termsResult, invoicesResult, dailyResult] = await Promise.all([
      supabase.from("client_monthly_metrics").select("month,gross_sales_aud,net_sales_aud,orders,ad_spend_aud,shopify_synced_at,ads_synced_at")
        .eq("client_id", client.id).order("month", {ascending:false}).limit(12),
      supabase.from("client_terms").select("commission_model,contract_start_date,revenue_basis,baseline_monthly_aud,commission_rate,tier_1_limit_aud,tier_2_limit_aud,tier_1_rate,tier_2_rate,tier_3_rate")
        .eq("client_id", client.id).maybeSingle(),
      supabase.from("client_invoices").select("id,number,issued_on,due_on,amount_aud,status,hosted_invoice_url")
        .eq("client_id", client.id).order("issued_on", {ascending:false, nullsFirst:false}).limit(30),
      supabase.from("client_daily_sales").select("day,net_sales_aud,gross_sales_aud,total_sales_aud,shipping_charges_aud,orders")
        .eq("client_id",client.id).gte("day",new Date(Date.now()-270*86400000).toISOString().slice(0,10)).order("day",{ascending:false}).limit(1000)
    ]);
    fetchFailed = fetchFailed || Boolean(metricsResult.error || termsResult.error || invoicesResult.error || dailyResult.error);
    months = (metricsResult.data ?? []) as Month[];
    terms = (termsResult.data ?? null) as Terms | null;
    invoices = (invoicesResult.data ?? []) as Invoice[];
    dailySales = (dailyResult.data ?? []) as DailySales[];
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
  const chosenArea = area as Area;

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
          <h1>{chosenArea === "overview" ? "Overview" : nav.find(item=>item.id===chosenArea)?.title}<span className="heading-period"> / {monthLabel(currentMonth())}</span></h1>
          <p className="dashboard-subtitle">{client?.name ?? "Your workspace"} · Performance that matters, without the noise.</p>
        </div>{memberships.length > 1 && <div className="client-switch"><span>Workspace</span><div className="client-links">{memberships.map(item=><Link key={item.id} className={item.id===client?.id?"selected":""} href={href(chosenArea,item.slug)}>{item.name}</Link>)}</div></div>}</div>

        {fetchFailed && <div className="dashboard-alert" role="alert">The dashboard could not load all data. Please try again or contact support.</div>}
        {!client ? <Empty title="Your dashboard is almost ready" detail="Your account is signed in, but it has not been assigned to a client workspace. Please contact steven.marketing to enable access." /> :
        chosenArea === "overview" ? <>
          <section className="kpi-grid" aria-label="Current month key metrics">
            <Metric label="Eligible revenue · contract period" value={money(currentPeriod?.revenue)} detail={currentPeriod?.coverageComplete?periodName+" · "+(terms?.revenue_basis==="total_sales"?"incl. shipping":"excl. shipping"):"Awaiting complete daily sales"} accent />
            <Metric label="Revenue above baseline" value={money(growth)} detail={currentPeriod?periodName:baseline===null?"Baseline not set":"Contract commencement not set"} />
            <Metric label="Google Ads · calendar month" value={money(thisMonth?.ad_spend_aud)} detail={thisMonth?.ads_synced_at ? "Google Ads · "+dateLabel(thisMonth.ads_synced_at.split("T")[0]) : "Awaiting ad data"} />
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
          <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">ACCOUNT</span><h2>Recent invoices</h2></div><Link href={href("invoices",client.slug)} className="panel-link">All invoices →</Link></div>
            {invoices.length ? <Table columns={["Invoice","Issued","Amount","Status"]} rows={invoices.slice(0,3).map(row=>[row.hosted_invoice_url?.startsWith("https://") ? <a key={row.id} href={row.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="table-link">{row.number} ↗</a> : row.number,dateLabel(row.issued_on),money(Number(row.amount_aud)),<span key={row.id} className="status-chip">{row.status}</span>])}/> : <Empty title="No invoices yet" detail="Invoices will be listed here when issued."/>}
          </section>
        </> :
        chosenArea === "sales" ? <>
          <section className="kpi-grid three"><Metric label="Net revenue · this month" value={money(netSales)} detail="Sales minus refunds and discounts"/><Metric label="Orders · this month" value={integer(thisMonth?.orders)} /><Metric label="Contract-period baseline" value={money(baseline)} detail="Not a calendar-month sales target"/></section>
          <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">MONTHLY HISTORY</span><h2>Sales results</h2></div></div>
          {months.length ? <Table columns={["Month","Gross sales","Net sales","Orders","Shopify sync"]} rows={months.map(row=>[monthLabel(row.month),money(row.gross_sales_aud),money(row.net_sales_aud),integer(row.orders),row.shopify_synced_at ? dateLabel(row.shopify_synced_at.split("T")[0]) : "Not synced"])}/> : <Empty title="No sales data yet" detail="Monthly Shopify totals, orders and refund-adjusted net sales will show here when connected."/>}</section>
        </> :
        chosenArea === "advertising" ? <>
          <section className="kpi-grid three"><Metric label="Ad spend · this month" value={money(thisMonth?.ad_spend_aud)} detail="Google Ads spending"/><Metric label="Last updated" value={thisMonth?.ads_synced_at ? dateLabel(thisMonth.ads_synced_at.split("T")[0]) : "—"} /><Metric label="Reporting period" value={monthLabel(currentMonth())} detail="Calendar month · Australia"/></section>
          <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">GOOGLE ADS</span><h2>Advertising investment</h2></div></div>
          {months.some(row=>row.ad_spend_aud !== null) ? <Table columns={["Month","Ad spend","Data last synced"]} rows={months.map(row=>[monthLabel(row.month),money(row.ad_spend_aud),row.ads_synced_at ? dateLabel(row.ads_synced_at.split("T")[0]) : "Not synced"])}/> : <Empty title="Advertising reporting is not connected" detail="Google Ads spend will appear here after the account integration is configured." />}
          <p className="panel-footnote">Ad spend and Shopify sales come from different measurement systems; this portal does not treat one as attributed to the other.</p></section>
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
