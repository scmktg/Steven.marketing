import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SignOut } from "@/components/sign-out";
import { requireAgencyAdmin } from "@/lib/agency-auth";
import { createAgencyClient, saveAgencyTerms, assignClientMember, removeClientMember, addAgencyInvoice } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title:"Agency dashboard | steven.marketing", robots:{index:false,follow:false} };

type Section = "overview" | "clients" | "sales" | "advertising" | "commissions" | "invoices";
type Client = { id:string; name:string; slug:string };
type Terms = {client_id:string;commission_model:"revenue_growth"|"manual";baseline_monthly_aud:number|null;commission_rate:number|null};
type Metrics = {client_id:string;month:string;gross_sales_aud:number|null;net_sales_aud:number|null;orders:number|null;ad_spend_aud:number|null;shopify_synced_at:string|null;ads_synced_at:string|null};
type Invoice = {id:string;client_id:string;number:string;amount_aud:number;status:string;issued_on:string|null;due_on:string|null;hosted_invoice_url:string|null};
type Membership = {client_id:string;user_id:string;role:string};
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
const monthNow=()=>{const now=new Date();return `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-01`;};
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
  const {supabase}=await requireAgencyAdmin();
  const query=await searchParams;

  const [clientsResponse,termsResponse,metricsResponse,invoicesResponse,membershipsResponse]=await Promise.all([
    supabase.from("clients").select("id,name,slug").order("name").limit(200),
    supabase.from("client_terms").select("client_id,commission_model,baseline_monthly_aud,commission_rate").limit(200),
    supabase.from("client_monthly_metrics").select("client_id,month,gross_sales_aud,net_sales_aud,orders,ad_spend_aud,shopify_synced_at,ads_synced_at").order("month",{ascending:false}).limit(1000),
    supabase.from("client_invoices").select("id,client_id,number,amount_aud,status,issued_on,due_on,hosted_invoice_url").order("issued_on",{ascending:false,nullsFirst:false}).limit(200),
    supabase.from("client_memberships").select("client_id,user_id,role").limit(500)
  ]);
  const failed=Boolean(clientsResponse.error||termsResponse.error||metricsResponse.error||invoicesResponse.error||membershipsResponse.error);
  const clients=(clientsResponse.data||[]) as Client[];
  const terms=(termsResponse.data||[]) as Terms[];
  const allMetrics=(metricsResponse.data||[]) as Metrics[];
  const allInvoices=(invoicesResponse.data||[]) as Invoice[];
  const memberships=(membershipsResponse.data||[]) as Membership[];
  const selected=query.client && clients.some(c=>c.id===query.client)?query.client:undefined;
  if(query.client && !selected) notFound();
  const filteredClients=selected?clients.filter(c=>c.id===selected):clients;
  const clientIds=new Set(filteredClients.map(c=>c.id));
  const month=currentMonthRows(allMetrics,clientIds);
  const salesKnown=month.filter(m=>m.net_sales_aud!==null);
  const spendKnown=month.filter(m=>m.ad_spend_aud!==null);
  const netTotal=salesKnown.length?salesKnown.reduce((n,x)=>n+Number(x.net_sales_aud),0):null;
  const spendTotal=spendKnown.length?spendKnown.reduce((n,x)=>n+Number(x.ad_spend_aud),0):null;
  const estimates=month.map(row=>{
    const contract=terms.find(t=>t.client_id===row.client_id);
    if(!contract||contract.commission_model!=="revenue_growth"||row.net_sales_aud===null||contract.baseline_monthly_aud===null||contract.commission_rate===null) return null;
    return {client_id:row.client_id,value:Math.max(0,Number(row.net_sales_aud)-Number(contract.baseline_monthly_aud))*Number(contract.commission_rate)};
  }).filter((x):x is {client_id:string;value:number}=>x!==null);
  const estimated=estimates.length?estimates.reduce((n,x)=>n+x.value,0):null;
  const relevantInvoices=allInvoices.filter(i=>clientIds.has(i.client_id));
  const relevantMetrics=allMetrics.filter(m=>clientIds.has(m.client_id));
  const lookup=(id:string)=>clients.find(c=>c.id===id)?.name||"Unknown client";
  const current=monthNow();
  const chosen=filteredClients[0];

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
          <div className="kpi-grid"><Stat featured label="Net client revenue" value={aud(netTotal)} note={salesKnown.length? `${salesKnown.length} clients reporting · ${monthName(current)}`:"Shopify data not connected"}/><Stat label="Advertising spend" value={aud(spendTotal)} note={spendKnown.length?`${spendKnown.length} clients reporting`:"Google Ads data not connected"}/><Stat label="Estimated commission" value={aud(estimated)} note="Provisional · subject to agreements"/><Stat label="Active clients" value={whole(filteredClients.length)} note="Authorised client workspaces"/></div>
          <Panel eyebrow="PORTFOLIO" title="Your clients" aside={<Link className="panel-link" href="/agency/clients">Manage clients →</Link>}>
            {filteredClients.length?<Table titles={["Client","Current net sales","Advertising","Estimated commission","Workspace"]} rows={filteredClients.map(c=>{
              const report=month.find(m=>m.client_id===c.id);
              return [<strong key={c.id}>{c.name}</strong>,aud(report?.net_sales_aud),aud(report?.ad_spend_aud),aud(estimates.find(x=>x.client_id===c.id)?.value),<Link key={c.id} className="table-link" href={path("clients",c.id)}>Manage →</Link>];
            })}/>:<Empty title="No clients yet" description="Create your first client to start managing reporting and agreements."/>}
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
          <div className="kpi-grid three"><Stat featured label="Provisional portfolio commission" value={aud(estimated)}/><Stat label="Contracts configured" value={whole(filteredClients.filter(c=>terms.some(t=>t.client_id===c.id)).length)}/><Stat label="Pending agreements" value={whole(filteredClients.filter(c=>!terms.some(t=>t.client_id===c.id)).length)}/></div>
          <Panel eyebrow="CONTRACTS" title="Commission agreements">
            {filteredClients.map(c=>{
              const agreement=terms.find(t=>t.client_id===c.id);
              const m=month.find(row=>row.client_id===c.id);
              return <div className="agency-agreement" key={c.id}><div className="agency-agreement-header"><h3>{c.name}</h3><p>Net revenue: {aud(m?.net_sales_aud)} · Estimated commission: {aud(estimates.find(e=>e.client_id===c.id)?.value)}</p></div>
                <form className="agency-form" action={saveAgencyTerms}><input type="hidden" name="client_id" value={c.id}/>
                  <label className="agency-field"><span>Calculation model</span><select name="commission_model" defaultValue={agreement?.commission_model||"revenue_growth"}><option value="revenue_growth">Growth above monthly baseline</option><option value="manual">Custom / manually reconciled</option></select></label>
                  <Field type="number" label="Monthly baseline (AUD)" name="baseline_aud" min="0" step="0.01" placeholder="0.00" defaultValue={agreement?.baseline_monthly_aud??""}/>
                  <Field type="number" label="Commission rate (%)" name="commission_percentage" min="0" step="0.001" placeholder="e.g. 15" defaultValue={agreement?.commission_rate===null||agreement?.commission_rate===undefined?"":Number(agreement.commission_rate)*100}/>
                  <button className="login-action agency-save" type="submit">Save agreement →</button>
                </form></div>;
            })}
            {!filteredClients.length&&<Empty title="No clients" description="Create a client before configuring commission terms."/>}
            <p className="panel-footnote">These are estimated terms. A signed agreement defines all billing exclusions, GST treatment, refunds, adjustments and final commission liability.</p>
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
