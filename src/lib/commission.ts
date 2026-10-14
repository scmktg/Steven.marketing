// Commission periods are calendar-month anniversaries of the contract start date,
// NOT calendar months. Dates are Sydney-local YYYY-MM-DD (never UTC timestamps).
export type AgreementTerms = {
  client_id?: string;
  commission_model: "revenue_growth" | "tiered_revenue_growth" | "manual";
  contract_start_date: string | null;
  revenue_basis: "net_sales" | "total_sales";
  baseline_monthly_aud: number | null;
  commission_rate: number | null;
  tier_1_limit_aud: number | null;
  tier_2_limit_aud: number | null;
  tier_1_rate: number | null;
  tier_2_rate: number | null;
  tier_3_rate: number | null;
};
export type DailySales = {
  client_id?: string;
  day: string;
  net_sales_aud: number | null;
  total_sales_aud?: number | null;
  shipping_charges_aud?: number | null;
  gross_sales_aud?: number | null;
  orders?: number | null;
};
export type TierResult = { label: string; rate: number; revenue: number; commission: number };
export type PeriodResult = {
  start: string;
  end: string;
  endExclusive: string;
  isCurrent: boolean;
  coverageComplete: boolean;
  expectedDays: number;
  recordedDays: number;
  revenue: number | null;
  netRevenue: number | null;
  totalRevenue: number | null;
  shipping: number | null;
  orders: number | null;
  grossRevenue: number | null;
  growth: number | null;
  commission: number | null;
  breakdown: TierResult[];
  asOf: string;
};

// Determine Sydney's calendar date without assuming UTC is Australia's local day.
export function sydneyToday(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (type: string) => parts.find(item=>item.type===type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(value: string): boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(value+"T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
const utc = (d:string) => new Date(d+"T00:00:00Z");
const iso = (d:Date) => d.toISOString().slice(0,10);
const moveDay=(d:string,n:number)=>{const t=utc(d);t.setUTCDate(t.getUTCDate()+n);return iso(t);};
export function anniversary(start:string,monthOffset:number):string {
  if(!validDate(start)||!Number.isInteger(monthOffset)||monthOffset<0||monthOffset>2400) throw Error("Invalid contract anniversary");
  const d=utc(start);
  const desiredDay=d.getUTCDate();
  const monthStart=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+monthOffset,1));
  const maxDay=new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,0)).getUTCDate();
  monthStart.setUTCDate(Math.min(desiredDay,maxDay));
  return iso(monthStart);
}
export function contractPeriod(start:string,today:string):{start:string;endExclusive:string}|null {
  if(!validDate(start)||!validDate(today)||today<start)return null;
  const d=utc(today),s=utc(start);
  let offset=Math.max(0,(d.getUTCFullYear()-s.getUTCFullYear())*12+d.getUTCMonth()-s.getUTCMonth());
  while(offset>0&&anniversary(start,offset)>today)offset--;
  while(offset<2400&&anniversary(start,offset+1)<=today)offset++;
  return {start:anniversary(start,offset),endExclusive:anniversary(start,offset+1)};
}
const cents=(n:number)=>Math.round(n*100);
const aud=(n:number)=>Math.round(n)/100;
export function marginalTiers(growthCents:number,terms:AgreementTerms):TierResult[] {
  const first=cents(Number(terms.tier_1_limit_aud));
  const second=cents(Number(terms.tier_2_limit_aud));
  const r1=Number(terms.tier_1_rate),r2=Number(terms.tier_2_rate),r3=Number(terms.tier_3_rate);
  if(!Number.isFinite(growthCents)||first<=0||second<=first||
    ![r1,r2,r3].every(v=>Number.isFinite(v)&&v>=0&&v<=1)) return [];
  const limits=[
    {label:`First ${aud(first).toLocaleString("en-AU")} AUD`,amount:Math.min(growthCents,first),rate:r1},
    {label:`Next ${aud(second-first).toLocaleString("en-AU")} AUD`,amount:Math.min(Math.max(0,growthCents-first),second-first),rate:r2},
    {label:`Above ${aud(second).toLocaleString("en-AU")} AUD`,amount:Math.max(0,growthCents-second),rate:r3}
  ];
  return limits.map(x=>({label:x.label,rate:x.rate,revenue:aud(x.amount),commission:aud(Math.round(x.amount*x.rate))}));
}
function report(start:string,endExclusive:string,term:AgreementTerms,rows:DailySales[],today:string):PeriodResult {
  const asOf=today<moveDay(endExclusive,-1)?today:moveDay(endExclusive,-1);
  const lookup=new Map(rows.map(row=>[row.day,row]));
  const requiresTotal=term.revenue_basis==="total_sales";
  let expectedDays=0,recordedDays=0,netDays=0,totalDays=0,grossDays=0,shippingDays=0,ordersDays=0;
  let netCents=0,totalCents=0,grossCents=0,shippingCents=0,orders=0;
  for(let day=start;day<=asOf;day=moveDay(day,1)){
    expectedDays++;
    const record=lookup.get(day);
    if(!record)continue;
    const isValid=(x:number|null|undefined):x is number=>x!==null&&x!==undefined&&Number.isFinite(Number(x));
    if(isValid(record.net_sales_aud)){netDays++;netCents+=cents(Number(record.net_sales_aud));}
    if(isValid(record.total_sales_aud)){totalDays++;totalCents+=cents(Number(record.total_sales_aud));}
    if(isValid(record.shipping_charges_aud)){shippingDays++;shippingCents+=cents(Number(record.shipping_charges_aud));}
    if(isValid(record.gross_sales_aud)){grossDays++;grossCents+=cents(Number(record.gross_sales_aud));}
    if(isValid(record.orders)){ordersDays++;orders+=Number(record.orders);}
    if(isValid(record.net_sales_aud)&&(!requiresTotal||isValid(record.total_sales_aud)))recordedDays++;
  }
  const coverageComplete=expectedDays>0&&expectedDays===recordedDays;
  const netRevenue=netDays===expectedDays&&expectedDays>0?aud(netCents):null;
  const totalRevenue=totalDays===expectedDays&&expectedDays>0?aud(totalCents):null;
  const shipping=shippingDays===expectedDays&&expectedDays>0?aud(shippingCents):null;
  const grossRevenue=grossDays===expectedDays&&expectedDays>0?aud(grossCents):null;
  const orderCount=ordersDays===expectedDays&&expectedDays>0?orders:null;
  const revenue=coverageComplete?(requiresTotal?totalRevenue:netRevenue):null;
  const baseline=term.baseline_monthly_aud===null?null:Number(term.baseline_monthly_aud);
  const growth=baseline!==null&&revenue!==null&&Number.isFinite(baseline)?aud(Math.max(0,cents(revenue)-cents(baseline))):null;
  let commission:number|null=null;
  let breakdown:TierResult[]=[];
  if(growth!==null&&term.commission_model==="tiered_revenue_growth"){
    breakdown=marginalTiers(cents(growth),term);
    if(breakdown.length===3)commission=aud(breakdown.reduce((acc,x)=>acc+cents(x.commission),0));
  }else if(growth!==null&&term.commission_model==="revenue_growth"){
    const rate=Number(term.commission_rate);
    if(term.commission_rate!==null&&Number.isFinite(rate)&&rate>=0&&rate<=1)
      commission=aud(Math.round(cents(growth)*rate));
  }
  return {start,end:moveDay(endExclusive,-1),endExclusive,isCurrent:today<endExclusive,
    coverageComplete,expectedDays,recordedDays,revenue,netRevenue,totalRevenue,
    shipping,orders:orderCount,grossRevenue,growth,commission,breakdown,asOf};
}
export function contractHistory(term:AgreementTerms|null,rows:DailySales[],today=sydneyToday(),limit=6):PeriodResult[] {
  if(!term?.contract_start_date||!validDate(term.contract_start_date)||!validDate(today)||today<term.contract_start_date)return [];
  const p=contractPeriod(term.contract_start_date,today);
  if(!p)return [];
  const anchor=p.start;
  const startDate=utc(term.contract_start_date), currentDate=utc(anchor);
  let offset=(currentDate.getUTCFullYear()-startDate.getUTCFullYear())*12+currentDate.getUTCMonth()-startDate.getUTCMonth();
  // Clamped anniversary days may be in the same or next month as the intended month.
  while(offset>0&&anniversary(term.contract_start_date,offset)>anchor)offset--;
  const results:PeriodResult[]=[];
  for(let n=offset;n>=0&&results.length<limit;n--){
    const s=anniversary(term.contract_start_date,n),e=anniversary(term.contract_start_date,n+1);
    results.push(report(s,e,term,rows,today));
  }
  return results;
}
