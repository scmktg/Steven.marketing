"use client";

import { useMemo, useState } from "react";

type Client = {id:string;name:string};
type Line = {id:number;description:string;quantity:string;rate:string};
const money=(value:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(value);
const today=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Australia/Melbourne"});
const validNumber=(v:string)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0};
const freshLine=():Line=>({id:Date.now()+Math.random(),description:"",quantity:"1",rate:"0"});
const displayDate=(s:string)=>s?new Date(s+"T12:00:00Z").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}):"—";

export function InvoiceBuilder({clients,selectedClient}:{clients:Client[];selectedClient?:string}){
  const [client,setClient]=useState(selectedClient||"");
  const [recipient,setRecipient]=useState("");
  const [recipientEmail,setRecipientEmail]=useState("");
  const [recipientAddress,setRecipientAddress]=useState("");
  const [number,setNumber]=useState("INV-");
  const [issued,setIssued]=useState(today);
  const [due,setDue]=useState("");
  const [lines,setLines]=useState<Line[]>([{id:1,description:"Marketing services",quantity:"1",rate:"0"}]);
  const [gst,setGst]=useState(true);
  const [notes,setNotes]=useState("Thank you for your business.");
  const [businessName,setBusinessName]=useState("steven.marketing");
  const [abn,setAbn]=useState("");
  const [businessAddress,setBusinessAddress]=useState("");
  const [paymentDetails,setPaymentDetails]=useState("");
  const selectedName=clients.find(c=>c.id===client)?.name||"";
  const recipientName=recipient.trim()||selectedName;
  const subtotal=useMemo(()=>Math.round(lines.reduce((sum,row)=>sum+validNumber(row.quantity)*validNumber(row.rate),0)*100)/100,[lines]);
  const tax=Math.round(subtotal*(gst?0.1:0)*100)/100;
  const total=subtotal+tax;
  const update=(id:number,field:keyof Line,value:string)=>setLines(rows=>rows.map(row=>row.id===id?{...row,[field]:value}:row));
  const canPrint=Boolean(recipientName.trim()&&number.trim()&&issued&&lines.some(l=>l.description.trim()&&validNumber(l.quantity)>0)&&subtotal>0);
  return <div className="invoice-workspace">
    <section className="invoice-editor panel">
      <div className="panel-heading"><div><span className="panel-kicker">CREATE / INVOICE</span><h2>New invoice</h2></div><span className="invoice-pill">Draft · not saved</span></div>
      <p className="agency-caption">Compose an invoice and export it using your browser’s Print / Save as PDF. Nothing is sent or recorded automatically.</p>
      <div className="invoice-section-label">01 / INVOICE DETAILS</div>
      <div className="invoice-grid">
        <label className="agency-field"><span>Existing client</span><select value={client} onChange={e=>setClient(e.target.value)}><option value="">Select a client (optional)</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="agency-field"><span>Invoice number</span><input value={number} maxLength={80} onChange={e=>setNumber(e.target.value)}/></label>
        <label className="agency-field"><span>Issue date</span><input type="date" value={issued} onChange={e=>setIssued(e.target.value)}/></label>
        <label className="agency-field"><span>Due date</span><input type="date" min={issued} value={due} onChange={e=>setDue(e.target.value)}/></label>
      </div>
      <div className="invoice-section-label">02 / BILL TO</div>
      <div className="invoice-grid">
        <label className="agency-field"><span>Client / legal business name</span><input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder={selectedName||"Client business name"}/></label>
        <label className="agency-field"><span>Email (shown on invoice)</span><input type="email" value={recipientEmail} onChange={e=>setRecipientEmail(e.target.value)} placeholder="accounts@client.com.au"/></label>
        <label className="agency-field invoice-span"><span>Billing address</span><textarea rows={2} value={recipientAddress} onChange={e=>setRecipientAddress(e.target.value)} placeholder="Street address, suburb, state, postcode"/></label>
      </div>
      <div className="invoice-section-label">03 / SERVICES</div>
      <div className="invoice-items">
        {lines.map((row,index)=><div className="invoice-item" key={row.id}>
          <label className="agency-field invoice-desc"><span>{index===0?"Description":"Service"}</span><input value={row.description} maxLength={250} onChange={e=>update(row.id,"description",e.target.value)} placeholder="Service or deliverable"/></label>
          <label className="agency-field"><span>Qty</span><input type="number" min="0" max="1000000" step=".01" value={row.quantity} onChange={e=>update(row.id,"quantity",e.target.value)}/></label>
          <label className="agency-field"><span>Rate (AUD)</span><input type="number" min="0" max="1000000000" step=".01" value={row.rate} onChange={e=>update(row.id,"rate",e.target.value)}/></label>
          <button type="button" className="invoice-remove" aria-label={"Remove service "+(index+1)} disabled={lines.length===1} onClick={()=>setLines(rows=>rows.filter(l=>l.id!==row.id))}>×</button>
        </div>)}
      </div>
      <button type="button" className="invoice-add" onClick={()=>setLines(rows=>[...rows,freshLine()])}>＋ Add line item</button>
      <label className="invoice-tax-switch"><input type="checkbox" checked={gst} onChange={e=>setGst(e.target.checked)}/><span>Apply 10% GST</span><small>Only enable if registered for GST; enter prices excluding GST.</small></label>
      <div className="invoice-section-label">04 / SENDER & PAYMENT DETAILS</div>
      <div className="invoice-grid">
        <label className="agency-field"><span>Business / legal name</span><input value={businessName} onChange={e=>setBusinessName(e.target.value)}/></label>
        <label className="agency-field"><span>ABN (if applicable)</span><input value={abn} onChange={e=>setAbn(e.target.value)} placeholder="XX XXX XXX XXX"/></label>
        <label className="agency-field invoice-span"><span>Your business address / contact</span><textarea rows={2} value={businessAddress} onChange={e=>setBusinessAddress(e.target.value)} placeholder="Business address and contact email"/></label>
        <label className="agency-field invoice-span"><span>Payment instructions</span><textarea rows={3} value={paymentDetails} onChange={e=>setPaymentDetails(e.target.value)} placeholder="Bank name, BSB, account number, reference"/></label>
        <label className="agency-field invoice-span"><span>Notes</span><textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      </div>
      <div className="invoice-actions"><button type="button" disabled={!canPrint} onClick={()=>window.print()} className="action action-primary invoice-print">Print / Save PDF ↗</button><span>Review all legal and payment details before issuing.</span></div>
    </section>
    <section className="invoice-preview-wrap" aria-label="Invoice preview">
      <div className="invoice-preview-heading"><span className="panel-kicker">LIVE PREVIEW</span><span>AUSTRALIAN DOLLARS · AUD</span></div>
      <article className="invoice-paper">
        <header className="invoice-paper-head"><strong>{businessName||"Your business"}</strong><span>{gst?"TAX INVOICE":"INVOICE"}</span></header>
        <div className="invoice-paper-intro"><div><h2>Invoice<span>.</span></h2><p>{number||"—"}</p></div><div className="invoice-dates"><p><span>Issued</span><strong>{displayDate(issued)}</strong></p><p><span>Due</span><strong>{displayDate(due)}</strong></p></div></div>
        <div className="invoice-party-grid"><div><span className="invoice-paper-kicker">BILL TO</span><strong>{recipientName||"Client name"}</strong>{recipientEmail&&<p>{recipientEmail}</p>}{recipientAddress&&<p className="invoice-multiline">{recipientAddress}</p>}</div><div><span className="invoice-paper-kicker">FROM</span><strong>{businessName||"Your business"}</strong>{abn&&<p>ABN {abn}</p>}{businessAddress&&<p className="invoice-multiline">{businessAddress}</p>}</div></div>
        <table className="invoice-paper-table"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>{lines.map(l=><tr key={l.id}><td>{l.description||"Service description"}</td><td>{l.quantity||"0"}</td><td>{money(validNumber(l.rate))}</td><td>{money(validNumber(l.quantity)*validNumber(l.rate))}</td></tr>)}</tbody></table>
        <div className="invoice-total-block"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>GST {gst?"(10%)":"(not charged)"}</span><strong>{money(tax)}</strong></div><div className="invoice-grand-total"><span>Total due</span><strong>{money(total)}</strong></div></div>
        {paymentDetails&&<div className="invoice-paper-note"><span className="invoice-paper-kicker">PAYMENT DETAILS</span><p className="invoice-multiline">{paymentDetails}</p></div>}
        {notes&&<div className="invoice-paper-note"><span className="invoice-paper-kicker">NOTES</span><p className="invoice-multiline">{notes}</p></div>}
        <footer className="invoice-paper-foot"><span>{businessName||"Your business"}</span><span>INVOICE {number}</span></footer>
      </article>
    </section>
  </div>;
}
