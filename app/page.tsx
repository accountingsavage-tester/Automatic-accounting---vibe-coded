"use client";

import { useEffect, useMemo, useState } from "react";

type AccountType = "Asset"|"Liability"|"Equity"|"Revenue"|"Expense";
type Account = {id:string; code:string; name:string; type:AccountType; normal:"Debit"|"Credit"};
type Line = {accountId:string; debit:number; credit:number; memo?:string};
type Entry = {id:string; date:string; description:string; reference:string; kind:"Regular"|"Adjusting"|"Closing"; lines:Line[]};

const A=(id:string,code:string,name:string,type:AccountType):Account=>({
  id,code,name,type,normal:type==="Asset"||type==="Expense"?"Debit":"Credit"
});
const DEFAULT_ACCOUNTS:Account[]=[
 A("101","101","Cash","Asset"), A("102","102","Accounts Receivable","Asset"),
 A("103","103","Supplies","Asset"), A("104","104","Prepaid Rent","Asset"),
 A("105","105","Equipment","Asset"), A("106","106","Accumulated Depreciation—Equipment","Asset"),
 A("201","201","Accounts Payable","Liability"), A("202","202","Unearned Revenue","Liability"),
 A("203","203","Salaries Payable","Liability"), A("204","204","Notes Payable","Liability"),
 A("301","301","Owner's Capital","Equity"), A("302","302","Owner's Drawing","Equity"),
 A("401","401","Service Revenue","Revenue"),
 A("501","501","Rent Expense","Expense"), A("502","502","Supplies Expense","Expense"),
 A("503","503","Salaries Expense","Expense"), A("504","504","Utilities Expense","Expense"),
 A("505","505","Depreciation Expense","Expense")
];

const money=(n:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:2}).format(n||0);
const uid=()=>Math.random().toString(36).slice(2,10);
const today=()=>new Date().toISOString().slice(0,10);
const num=(v:string|number)=>Math.round((Number(v)||0)*100)/100;

function csvDownload(name:string, rows:(string|number)[][]){
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const b=new Blob([csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement("a");
 a.href=URL.createObjectURL(b); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}

export default function Home(){
 const [accounts,setAccounts]=useState<Account[]>(DEFAULT_ACCOUNTS);
 const [entries,setEntries]=useState<Entry[]>([]);
 const [business,setBusiness]=useState("My Business");
 const [periodEnd,setPeriodEnd]=useState(today());
 const [tab,setTab]=useState("Dashboard");
 const [notice,setNotice]=useState("");

 useEffect(()=>{try{
   const s=JSON.parse(localStorage.getItem("afs-v2")||"{}");
   if(s.accounts)setAccounts(s.accounts); if(s.entries)setEntries(s.entries);
   if(s.business)setBusiness(s.business); if(s.periodEnd)setPeriodEnd(s.periodEnd);
 }catch{}},[]);
 useEffect(()=>{localStorage.setItem("afs-v2",JSON.stringify({accounts,entries,business,periodEnd}))},[accounts,entries,business,periodEnd]);

 const map=useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),[accounts]);

 const balances=useMemo(()=>{
   const m:Record<string,{debit:number;credit:number}>={};
   accounts.forEach(a=>m[a.id]={debit:0,credit:0});
   entries.filter(e=>e.kind!=="Closing").forEach(e=>e.lines.forEach(l=>{
     if(!m[l.accountId])m[l.accountId]={debit:0,credit:0};
     m[l.accountId].debit+=num(l.debit); m[l.accountId].credit+=num(l.credit);
   }));
   return m;
 },[accounts,entries]);

 const regular=entries.filter(e=>e.kind==="Regular");
 const adjusting=entries.filter(e=>e.kind==="Adjusting");
 const closing=entries.filter(e=>e.kind==="Closing");

 const adjusted=useMemo(()=>{
   const m:Record<string,{debit:number;credit:number}>={};
   accounts.forEach(a=>m[a.id]={debit:0,credit:0});
   [...regular,...adjusting].forEach(e=>e.lines.forEach(l=>{
     m[l.accountId].debit+=num(l.debit);m[l.accountId].credit+=num(l.credit);
   }));
   return m;
 },[accounts,regular,adjusting]);

 const rows=accounts.map(a=>{
   const b=balances[a.id]||{debit:0,credit:0}, x=adjusted[a.id]||{debit:0,credit:0};
   const trialNet=a.normal==="Debit"?b.debit-b.credit:b.credit-b.debit;
   const adjNet=a.normal==="Debit"?x.debit-x.credit:x.credit-x.debit;
   return {...a,...b,adjDebit:x.debit,adjCredit:x.credit,trialNet,adjNet};
 });

 const totals=(rs:any[])=>rs.reduce((z,r)=>({debit:z.debit+r.debit,credit:z.credit+r.credit}),{debit:0,credit:0});
 const t=totals(rows);
 const at=totals(rows.map(r=>({debit:r.adjDebit,credit:r.adjCredit})));

 const revenue=rows.filter(r=>r.type==="Revenue").reduce((s,r)=>s+r.adjNet,0);
 const expenses=rows.filter(r=>r.type==="Expense").reduce((s,r)=>s+r.adjNet,0);
 const netIncome=revenue-expenses;
 const assets=rows.filter(r=>r.type==="Asset").reduce((s,r)=>s+r.adjNet,0);
 const liabilities=rows.filter(r=>r.type==="Liability").reduce((s,r)=>s+r.adjNet,0);
 const contributed=rows.filter(r=>r.type==="Equity"&&r.name!=="Owner's Drawing").reduce((s,r)=>s+r.adjNet,0);
 const drawing=rows.find(r=>r.name==="Owner's Drawing")?.adjNet||0;
 const endingEquity=contributed+netIncome-drawing;

 function post(e:Entry){
   const d=e.lines.reduce((s,l)=>s+num(l.debit),0),c=e.lines.reduce((s,l)=>s+num(l.credit),0);
   if(!e.description.trim()){setNotice("Enter a description.");return}
   if(e.lines.length<2){setNotice("An entry needs at least two lines.");return}
   if(Math.abs(d-c)>0.005){setNotice(`Entry rejected. Debit ${money(d)} does not equal credit ${money(c)}.`);return}
   if(e.lines.some(l=>num(l.debit)>0&&num(l.credit)>0)){setNotice("A line cannot contain both a debit and a credit.");return}
   if(e.lines.every(l=>num(l.debit)===0&&num(l.credit)===0)){setNotice("Enter at least one amount.");return}
   setEntries(x=>[...x,e]);setNotice("Entry posted.");setTab(e.kind==="Adjusting"?"Adjusting Entries":"General Journal");
 }

 function reset(){
   if(confirm("Delete all saved accounting data?")){setAccounts(DEFAULT_ACCOUNTS);setEntries([]);setBusiness("My Business");setNotice("All data reset.")}
 }

 const nav=["Dashboard","Transactions","Chart of Accounts","General Journal","General Ledger","Trial Balance","Adjusting Entries","Adjusted Trial Balance","Worksheet","Income Statement","Owner's Equity","Balance Sheet","Closing Entries","Post-Closing Trial Balance"];

 return <main>
  <aside className="sidebar">
   <div className="brand"><div className="logo">AF</div><div><b>Auto Finance</b><small>Studio v2</small></div></div>
   <div className="business-box"><small>BUSINESS NAME</small><input value={business} onChange={e=>setBusiness(e.target.value)}/><small>PERIOD END</small><input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></div>
   <nav>{nav.map(n=><button key={n} className={tab===n?"active":""} onClick={()=>setTab(n)}>{n}</button>)}</nav>
   <button className="reset" onClick={reset}>Reset all data</button>
  </aside>
  <section className="content">
   <header><div><h1>{tab}</h1><p>{business} · Period ending {periodEnd}</p></div><button onClick={()=>window.print()}>Print</button></header>
   {notice&&<div className="notice" onClick={()=>setNotice("")}>{notice}</div>}
   {tab==="Dashboard"&&<Dashboard {...{entries,assets,liabilities,endingEquity,revenue,expenses,netIncome,t,at}}/>}
   {tab==="Transactions"&&<EntryForm accounts={accounts} kind="Regular" onPost={post}/>}
   {tab==="Adjusting Entries"&&<Adjusting accounts={accounts} entries={adjusting} onPost={post}/>}
   {tab==="Chart of Accounts"&&<Chart accounts={accounts} setAccounts={setAccounts}/>}
   {tab==="General Journal"&&<Journal accounts={accounts} entries={regular}/>}
   {tab==="General Ledger"&&<Ledger accounts={accounts} entries={[...regular,...adjusting]}/>}
   {tab==="Trial Balance"&&<TB rows={rows} adjusted={false}/>}
   {tab==="Adjusted Trial Balance"&&<TB rows={rows} adjusted/>}
   {tab==="Worksheet"&&<Worksheet rows={rows} revenue={revenue} expenses={expenses} netIncome={netIncome}/>}
   {tab==="Income Statement"&&<Income business={business} date={periodEnd} rows={rows} revenue={revenue} expenses={expenses} netIncome={netIncome}/>}
   {tab==="Owner's Equity"&&<Owner business={business} date={periodEnd} capital={contributed} netIncome={netIncome} drawing={drawing} ending={endingEquity}/>}
   {tab==="Balance Sheet"&&<BS business={business} date={periodEnd} rows={rows} assets={assets} liabilities={liabilities} equity={endingEquity}/>}
   {tab==="Closing Entries"&&<Closing rows={rows} revenue={revenue} expenses={expenses} netIncome={netIncome} drawing={drawing} onPost={post}/>}
   {tab==="Post-Closing Trial Balance"&&<PostClosing accounts={accounts} entries={[...regular,...adjusting,...closing]}/>}
  </section>
 </main>
}


async function exportWorkbook(p:any){
  const XLSX=await import("xlsx");
  const wb=XLSX.utils.book_new();
  const maxJournalRows=500;
  const accountMap=Object.fromEntries(p.accounts.map((a:any)=>[a.id,a]));

  const accounts=[["Code","Account","Type","Normal Balance","Account ID"]];
  p.accounts.forEach((a:any)=>accounts.push([a.code,a.name,a.type,a.normal,a.id]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(accounts),"Accounts");

  const journal:(string|number)[][]=[["Date","Reference","Type","Description","Account Code","Account","Debit","Credit","Memo"]];
  p.entries.forEach((e:any)=>e.lines.forEach((l:any)=>journal.push([
    e.date,e.reference||"",e.kind,e.description,accountMap[l.accountId]?.code||"",
    accountMap[l.accountId]?.name||"",num(l.debit),num(l.credit),l.memo||""
  ])));
  while(journal.length<maxJournalRows+1) journal.push(["","","","","","",0,0,""]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(journal),"Journal");

  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ["Auto Finance Studio - Formula Workbook"],["Business",p.business],["Period End",p.periodEnd],["Currency",p.currency],[],
    ["HOW TO USE"],["Edit Accounts and Journal. The report sheets are formula-linked to these source sheets."],
    ["Use positive numbers. Each journal line should contain either a debit or a credit."],
    ["Open in Excel or Google Sheets and recalculate if prompted."]
  ]),"Setup");

  const n=p.accounts.length;
  const tb=[["Code","Account","Type","Normal Balance","Debit","Credit","Net Balance"]];
  for(let i=0;i<n;i++){
    const r=i+2;
    tb.push([`=Accounts!A${r}`,`=Accounts!B${r}`,`=Accounts!C${r}`,`=Accounts!D${r}`,
      `=SUMIF(Journal!$E$2:$E$${maxJournalRows+1},A${r},Journal!$G$2:$G$${maxJournalRows+1})`,
      `=SUMIF(Journal!$E$2:$E$${maxJournalRows+1},A${r},Journal!$H$2:$H$${maxJournalRows+1})`,
      `=IF(D${r}="Debit",E${r}-F${r},F${r}-E${r})`]);
  }
  tb.push(["","","","TOTAL",`=SUM(E2:E${n+1})`,`=SUM(F2:F${n+1})`,`=E${n+2}-F${n+2}`]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(tb),"Trial Balance");

  const atb=[["Code","Account","Type","Normal Balance","Adjusted Debit","Adjusted Credit","Adjusted Net"]];
  for(let i=0;i<n;i++){
    const r=i+2;
    atb.push([`=Accounts!A${r}`,`=Accounts!B${r}`,`=Accounts!C${r}`,`=Accounts!D${r}`,
      `='Trial Balance'!E${r}+SUMIFS(Journal!$G$2:$G$${maxJournalRows+1},Journal!$E$2:$E$${maxJournalRows+1},A${r},Journal!$C$2:$C$${maxJournalRows+1},"Adjusting")`,
      `='Trial Balance'!F${r}+SUMIFS(Journal!$H$2:$H$${maxJournalRows+1},Journal!$E$2:$E$${maxJournalRows+1},A${r},Journal!$C$2:$C$${maxJournalRows+1},"Adjusting")`,
      `=IF(D${r}="Debit",E${r}-F${r},F${r}-E${r})`]);
  }
  atb.push(["","","","TOTAL",`=SUM(E2:E${n+1})`,`=SUM(F2:F${n+1})`,`=E${n+2}-F${n+2}`]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(atb),"Adjusted TB");

  const ws=[["Account","TB Debit","TB Credit","Adjustments Dr","Adjustments Cr","Adjusted TB Dr","Adjusted TB Cr","IS Debit","IS Credit","BS Debit","BS Credit"]];
  for(let i=0;i<n;i++){
    const r=i+2;
    ws.push([
      `='Adjusted TB'!B${r}`,`='Trial Balance'!E${r}`,`='Trial Balance'!F${r}`,
      `='Adjusted TB'!E${r}-'Trial Balance'!E${r}`,`='Adjusted TB'!F${r}-'Trial Balance'!F${r}`,
      `='Adjusted TB'!E${r}`,`='Adjusted TB'!F${r}`,
      `=IF('Adjusted TB'!C${r}="Expense",'Adjusted TB'!G${r},0)`,
      `=IF('Adjusted TB'!C${r}="Revenue",'Adjusted TB'!G${r},0)`,
      `=IF(AND('Adjusted TB'!C${r}<>"Revenue",'Adjusted TB'!C${r}<>"Expense",'Adjusted TB'!D${r}="Debit"),'Adjusted TB'!G${r},0)`,
      `=IF(AND('Adjusted TB'!C${r}<>"Revenue",'Adjusted TB'!C${r}<>"Expense",'Adjusted TB'!D${r}="Credit"),'Adjusted TB'!G${r},0)`
    ]);
  }
  const netRow=n+2;
  ws.push(["NET INCOME / (LOSS)","","","","","","",
    `=MAX(0,SUM(I2:I${n+1})-SUM(H2:H${n+1}))`,
    `=MAX(0,SUM(H2:H${n+1})-SUM(I2:I${n+1}))`,
    `=MAX(0,SUM(H2:H${n+1})-SUM(I2:I${n+1}))`,
    `=MAX(0,SUM(I2:I${n+1})-SUM(H2:H${n+1}))`]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ws),"Worksheet");

  const inc=[["INCOME STATEMENT"],[p.business],["For period ended",p.periodEnd],[],["Revenue","Amount"]];
  for(let i=0;i<n;i++){const r=i+2;inc.push([`='Adjusted TB'!B${r}`,`=IF('Adjusted TB'!C${r}="Revenue",'Adjusted TB'!G${r},0)`]);}
  const revEnd=inc.length;
  inc.push(["Total Revenue",`=SUM(B6:B${revEnd})`],[],["Expenses","Amount"]);
  const expStart=inc.length+1;
  for(let i=0;i<n;i++){const r=i+2;inc.push([`='Adjusted TB'!B${r}`,`=IF('Adjusted TB'!C${r}="Expense",'Adjusted TB'!G${r},0)`]);}
  const expEnd=inc.length;
  inc.push(["Total Expenses",`=SUM(B${expStart}:B${expEnd})`],["NET INCOME / (LOSS)",`=B${revEnd+1}-B${expEnd+1}`]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(inc),"Income Statement");

  const eq=[["STATEMENT OF OWNER'S EQUITY"],[p.business],["For period ended",p.periodEnd],[],["Item","Amount"],
    ["Capital",`=SUMIFS('Adjusted TB'!$G$2:$G$${n+1},'Adjusted TB'!$C$2:$C$${n+1},"Equity",'Adjusted TB'!$B$2:$B$${n+1},"<>Owner's Drawing")`],
    ["Add: Net Income",`='Income Statement'!B${expEnd+2}`],
    ["Less: Drawings",`=SUMIFS('Adjusted TB'!$G$2:$G$${n+1},'Adjusted TB'!$B$2:$B$${n+1},"Owner's Drawing")`],
    ["ENDING OWNER'S EQUITY","=B6+B7-B8"]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(eq),"Owner's Equity");

  const bs=[["BALANCE SHEET"],[p.business],["As of",p.periodEnd],[],["Assets","Amount"]];
  for(let i=0;i<n;i++){const r=i+2;bs.push([`='Adjusted TB'!B${r}`,`=IF('Adjusted TB'!C${r}="Asset",'Adjusted TB'!G${r},0)`]);}
  const assetEnd=bs.length;
  bs.push(["Total Assets",`=SUM(B6:B${assetEnd})`],[],["Liabilities","Amount"]);
  const liabStart=bs.length+1;
  for(let i=0;i<n;i++){const r=i+2;bs.push([`='Adjusted TB'!B${r}`,`=IF('Adjusted TB'!C${r}="Liability",'Adjusted TB'!G${r},0)`]);}
  const liabEnd=bs.length;
  bs.push(["Total Liabilities",`=SUM(B${liabStart}:B${liabEnd})`],
    ["Ending Owner's Equity","='Owner's Equity'!B9"],
    ["Total Liabilities + Equity",`=B${liabEnd+1}+B${liabEnd+2}`],
    ["CHECK",`=B${assetEnd+1}-B${liabEnd+3}`]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bs),"Balance Sheet");

  const post=[["Permanent Account","Debit","Credit"]];
  for(let i=0;i<n;i++){const r=i+2;post.push([`='Adjusted TB'!B${r}`,
    `=IF(AND('Adjusted TB'!C${r}<>"Revenue",'Adjusted TB'!C${r}<>"Expense",'Adjusted TB'!D${r}="Debit"),'Adjusted TB'!G${r},0)`,
    `=IF(AND('Adjusted TB'!C${r}<>"Revenue",'Adjusted TB'!C${r}<>"Expense",'Adjusted TB'!D${r}="Credit"),'Adjusted TB'!G${r},0)`]);}
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(post),"Post-Closing TB");

  for(const name of wb.SheetNames){
    const sh=wb.Sheets[name];
    sh["!freeze"]="A2";
    if(sh["!ref"]){
      const rg=XLSX.utils.decode_range(sh["!ref"]);
      sh["!cols"]=Array.from({length:rg.e.c+1},()=>({wch:18}));
      for(let R=0;R<=rg.e.r;R++)for(let C=0;C<=rg.e.c;C++){
        const cell=sh[XLSX.utils.encode_cell({r:R,c:C})];
        if(cell && typeof cell.v==="number") cell.z=(p.currency==="JPY"||p.currency==="KRW"||p.currency==="VND")?"#,##0":"#,##0.00";
      }
    }
  }
  wb.SheetNames=["Setup","Accounts","Journal","Trial Balance","Adjusted TB","Worksheet","Income Statement","Owner's Equity","Balance Sheet","Post-Closing TB"];
  XLSX.writeFile(wb,`${(p.business||"Finance").replace(/[^a-z0-9]+/gi,"_")}_${p.periodEnd}_formula.xlsx`);
}

function Dashboard(p:any){return <><div className="cards"><Card label="Total Debits" value={money(p.at.debit)}/><Card label="Total Credits" value={money(p.at.credit)}/><Card label="Net Income" value={money(p.netIncome)}/><Card label="Journal Entries" value={p.entries.length}/></div><div className="grid2"><div className="panel"><h2>Financial Position</h2><Metric n="Assets" v={p.assets}/><Metric n="Liabilities" v={p.liabilities}/><Metric n="Owner's Equity" v={p.endingEquity}/></div><div className="panel"><h2>Income</h2><Metric n="Revenue" v={p.revenue}/><Metric n="Expenses" v={p.expenses}/><Metric n="Net Income" v={p.netIncome}/></div></div><div className="panel"><h2>Accounting equation</h2><div className="equation">{money(p.assets)} = {money(p.liabilities)} + {money(p.endingEquity)} <span className={Math.abs(p.assets-(p.liabilities+p.endingEquity))<.005?"ok":"bad"}>{Math.abs(p.assets-(p.liabilities+p.endingEquity))<.005?"Balanced":"Out of balance"}</span></div><p className="muted">All posted entries are double-entry validated before they affect the reports.</p></div></>}
function Card({label,value}:{label:string,value:any}){return <div className="card"><small>{label}</small><strong>{value}</strong></div>}
function Metric({n,v}:{n:string,v:number}){return <div className="metric"><span>{n}</span><b>{money(v)}</b></div>}

function EntryForm({accounts,kind,onPost,initial}:{accounts:Account[],kind:"Regular"|"Adjusting"|"Closing",onPost:(e:Entry)=>void,initial?:Line[]}){
 const [date,setDate]=useState(today()),[desc,setDesc]=useState(""),[ref,setRef]=useState("");
 const [lines,setLines]=useState<Line[]>(initial||[{accountId:accounts[0]?.id,debit:0,credit:0},{accountId:accounts[6]?.id||accounts[1]?.id,debit:0,credit:0}]);
 const upd=(i:number,k:keyof Line,v:any)=>setLines(x=>x.map((l,j)=>j===i?{...l,[k]:k==="accountId"||k==="memo"?v:num(v)}:l));
 const d=lines.reduce((s,l)=>s+num(l.debit),0),c=lines.reduce((s,l)=>s+num(l.credit),0);
 return <div className="panel"><div className="formgrid"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Reference<input value={ref} onChange={e=>setRef(e.target.value)} placeholder="JE-001"/></label><label className="wide">Description<input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe the transaction"/></label></div><div className="tablewrap"><table><thead><tr><th>Account</th><th>Memo</th><th>Debit</th><th>Credit</th><th></th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><td><select value={l.accountId} onChange={e=>upd(i,"accountId",e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></td><td><input value={l.memo||""} onChange={e=>upd(i,"memo",e.target.value)}/></td><td><input type="number" min="0" step=".01" value={l.debit||""} onChange={e=>upd(i,"debit",e.target.value)}/></td><td><input type="number" min="0" step=".01" value={l.credit||""} onChange={e=>upd(i,"credit",e.target.value)}/></td><td><button onClick={()=>setLines(x=>x.filter((_,j)=>j!==i))} disabled={lines.length<=2}>×</button></td></tr>)}</tbody></table></div><div className="entry-footer"><button onClick={()=>setLines(x=>[...x,{accountId:accounts[0].id,debit:0,credit:0}])}>+ Add line</button><span>Debit <b>{money(d)}</b> · Credit <b>{money(c)}</b> · Difference <b className={Math.abs(d-c)<.005?"ok":"bad"}>{money(d-c)}</b></span><button className="primary" onClick={()=>onPost({id:uid(),date,description:desc,reference:ref,kind,lines})}>Post {kind.toLowerCase()} entry</button></div></div>
}

function Adjusting({accounts,entries,onPost}:{accounts:Account[],entries:Entry[],onPost:(e:Entry)=>void}){return <><EntryForm accounts={accounts} kind="Adjusting" onPost={onPost}/><div className="panel"><h2>Posted adjusting entries</h2><Journal accounts={accounts} entries={entries}/></div></>}

function Chart({accounts,setAccounts}:{accounts:Account[],setAccounts:React.Dispatch<React.SetStateAction<Account[]>>}){
 const [code,setCode]=useState(""),[name,setName]=useState(""),[type,setType]=useState<AccountType>("Asset");
 const normal=(t:AccountType)=>t==="Asset"||t==="Expense"?"Debit":"Credit";
 return <div className="panel"><div className="formgrid"><label>Code<input value={code} onChange={e=>setCode(e.target.value)}/></label><label>Account name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Type<select value={type} onChange={e=>setType(e.target.value as AccountType)}>{["Asset","Liability","Equity","Revenue","Expense"].map(x=><option key={x}>{x}</option>)}</select></label><button className="primary" onClick={()=>{if(!code||!name)return;setAccounts(x=>[...x,{id:uid(),code,name,type,normal:normal(type)}]);setCode("");setName("")}}>Add account</button></div><div className="tablewrap"><table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Normal</th><th></th></tr></thead><tbody>{accounts.map(a=><tr key={a.id}><td>{a.code}</td><td>{a.name}</td><td>{a.type}</td><td>{a.normal}</td><td><button className="danger" onClick={()=>setAccounts(x=>x.filter(y=>y.id!==a.id))}>Delete</button></td></tr>)}</tbody></table></div></div>
}

function Journal({accounts,entries}:{accounts:Account[],entries:Entry[]}){const m=Object.fromEntries(accounts.map(a=>[a.id,a]));return <div className="tablewrap"><table><thead><tr><th>Date</th><th>Ref</th><th>Description</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{entries.length?entries.flatMap(e=>e.lines.map((l,i)=><tr key={e.id+i}><td>{e.date}</td><td>{e.reference||"—"}</td><td>{i===0?e.description:""}</td><td>{m[l.accountId]?.code} — {m[l.accountId]?.name}</td><td>{l.debit?money(l.debit):""}</td><td>{l.credit?money(l.credit):""}</td></tr>)):<tr><td colSpan={6} className="empty">No entries posted.</td></tr>}</tbody></table></div>}

function Ledger({accounts,entries}:{accounts:Account[],entries:Entry[]}){return <div className="ledgergrid">{accounts.map(a=>{let run=0;const es=entries.flatMap(e=>e.lines.map(l=>({...l,date:e.date,desc:e.description}))).filter(l=>l.accountId===a.id);return <div className="panel" key={a.id}><h3>{a.code} — {a.name}</h3><table><thead><tr><th>Date</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{es.map((e,i)=>{run+=a.normal==="Debit"?e.debit-e.credit:e.credit-e.debit;return <tr key={i}><td>{e.date}</td><td>{e.debit?money(e.debit):""}</td><td>{e.credit?money(e.credit):""}</td><td>{money(run)}</td></tr>})}<tr className="total"><td>Ending</td><td></td><td></td><td>{money(run)}</td></tr></tbody></table></div>})}</div>}

function TB({rows,adjusted}:{rows:any[],adjusted:boolean}){const d=rows.reduce((s,r)=>s+(adjusted?r.adjDebit:r.debit),0),c=rows.reduce((s,r)=>s+(adjusted?r.adjCredit:r.credit),0);return <Report title={adjusted?"Adjusted Trial Balance":"Trial Balance"}><table><thead><tr><th>Code</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{(adjusted?r.adjDebit:r.debit)?money(adjusted?r.adjDebit:r.debit):""}</td><td>{(adjusted?r.adjCredit:r.credit)?money(adjusted?r.adjCredit:r.credit):""}</td></tr>)}<tr className="total"><td colSpan={2}>TOTAL</td><td>{money(d)}</td><td>{money(c)}</td></tr></tbody></table><BalanceCheck d={d} c={c}/></Report>}

function Worksheet({rows,revenue,expenses,netIncome}:{rows:any[],revenue:number,expenses:number,netIncome:number}){
 return <Report title="10-Column Worksheet"><div className="tablewrap"><table className="worksheet"><thead><tr><th rowSpan={2}>Account</th><th colSpan={2}>Trial Balance</th><th colSpan={2}>Adjustments</th><th colSpan={2}>Adjusted TB</th><th colSpan={2}>Income Statement</th><th colSpan={2}>Balance Sheet</th></tr><tr>{["Dr","Cr","Dr","Cr","Dr","Cr","Dr","Cr","Dr","Cr"].map((x,i)=><th key={i}>{x}</th>)}</tr></thead><tbody>{rows.map(r=>{const td=r.debit,tc=r.credit,ad=r.adjDebit-r.debit,ac=r.adjCredit-r.credit;let isd=0,isc=0,bsd=0,bsc=0;if(r.type==="Revenue")isc=r.adjNet;else if(r.type==="Expense")isd=r.adjNet;else if(r.normal==="Debit")bsd=r.adjNet;else bsc=r.adjNet;return <tr key={r.id}><td>{r.name}</td><td>{td?money(td):""}</td><td>{tc?money(tc):""}</td><td>{ad>0?money(ad):""}</td><td>{ac>0?money(ac):""}</td><td>{r.adjDebit?money(r.adjDebit):""}</td><td>{r.adjCredit?money(r.adjCredit):""}</td><td>{isd?money(isd):""}</td><td>{isc?money(isc):""}</td><td>{bsd?money(bsd):""}</td><td>{bsc?money(bsc):""}</td></tr>})}<tr className="total"><td>NET INCOME</td><td colSpan={6}></td><td>{netIncome>0?money(netIncome):""}</td><td>{netIncome<0?money(-netIncome):""}</td><td>{netIncome<0?money(-netIncome):""}</td><td>{netIncome>0?money(netIncome):""}</td></tr><tr className="total"><td>Column Totals</td><td colSpan={2}>{money(rows.reduce((s,r)=>s+r.debit+r.credit,0))}</td><td colSpan={2}></td><td colSpan={2}>{money(rows.reduce((s,r)=>s+r.adjDebit+r.adjCredit,0))}</td><td colSpan={2}>{money(revenue+expenses+Math.max(netIncome,0))}</td><td colSpan={2}>{money(rows.filter(r=>r.type!=="Revenue"&&r.type!=="Expense").reduce((s,r)=>s+r.adjNet,0)+Math.max(netIncome,0))}</td></tr></tbody></table></div><p className="muted">Adjustment columns are calculated from posted adjusting entries. Income statement and balance sheet columns use the adjusted balances.</p></Report>
}

function Income({business,date,rows,revenue,expenses,netIncome}:{business:string,date:string,rows:any[],revenue:number,expenses:number,netIncome:number}){return <Report title="Income Statement" subtitle={`${business} · For the period ended ${date}`}><table><tbody><tr><th colSpan={2}>Revenue</th></tr>{rows.filter(r=>r.type==="Revenue"&&r.adjNet!==0).map(r=><tr key={r.id}><td>{r.name}</td><td>{money(r.adjNet)}</td></tr>)}<tr className="subtotal"><td>Total Revenue</td><td>{money(revenue)}</td></tr><tr><th colSpan={2}>Expenses</th></tr>{rows.filter(r=>r.type==="Expense"&&r.adjNet!==0).map(r=><tr key={r.id}><td>{r.name}</td><td>{money(r.adjNet)}</td></tr>)}<tr className="subtotal"><td>Total Expenses</td><td>{money(expenses)}</td></tr><tr className="grand"><td>{netIncome>=0?"NET INCOME":"NET LOSS"}</td><td>{money(Math.abs(netIncome))}</td></tr></tbody></table></Report>}

function Owner({business,date,capital,netIncome,drawing,ending}:{business:string,date:string,capital:number,netIncome:number,drawing:number,ending:number}){return <Report title="Statement of Owner's Equity" subtitle={`${business} · For the period ended ${date}`}><table><tbody><tr><td>Capital</td><td>{money(capital)}</td></tr><tr><td>{netIncome>=0?"Add: Net Income":"Less: Net Loss"}</td><td>{money(Math.abs(netIncome))}</td></tr><tr><td>Less: Drawings</td><td>{money(drawing)}</td></tr><tr className="grand"><td>ENDING OWNER'S EQUITY</td><td>{money(ending)}</td></tr></tbody></table></Report>}

function BS({business,date,rows,assets,liabilities,equity}:{business:string,date:string,rows:any[],assets:number,liabilities:number,equity:number}){return <Report title="Balance Sheet" subtitle={`${business} · As of ${date}`}><table><tbody><tr><th colSpan={2}>Assets</th></tr>{rows.filter(r=>r.type==="Asset"&&r.adjNet!==0).map(r=><tr key={r.id}><td>{r.name}</td><td>{money(r.adjNet)}</td></tr>)}<tr className="subtotal"><td>Total Assets</td><td>{money(assets)}</td></tr><tr><th colSpan={2}>Liabilities</th></tr>{rows.filter(r=>r.type==="Liability"&&r.adjNet!==0).map(r=><tr key={r.id}><td>{r.name}</td><td>{money(r.adjNet)}</td></tr>)}<tr className="subtotal"><td>Total Liabilities</td><td>{money(liabilities)}</td></tr><tr><th colSpan={2}>Owner's Equity</th></tr><tr><td>Ending Owner's Equity</td><td>{money(equity)}</td></tr><tr className="grand"><td>Total Liabilities + Equity</td><td>{money(liabilities+equity)}</td></tr></tbody></table><BalanceCheck d={assets} c={liabilities+equity}/></Report>}

function BalanceCheck({d,c}:{d:number,c:number}){return <p className={Math.abs(d-c)<.005?"balance-ok":"balance-bad"}>{Math.abs(d-c)<.005?"✓ Balanced":"⚠ Difference: "+money(d-c)}</p>}

function Closing({rows,revenue,expenses,netIncome,drawing,onPost}:{rows:any[],revenue:number,expenses:number,netIncome:number,drawing:number,onPost:(e:Entry)=>void}){
 const [done,setDone]=useState(false);
 function close(){
  if(done)return;
  const lines:Line[]=[];
  rows.filter(r=>r.type==="Revenue"&&r.adjNet>0).forEach(r=>lines.push({accountId:r.id,debit:r.adjNet,credit:0}));
  lines.push({accountId:"999",debit:0,credit:revenue});
  // Closing reference is intentionally shown rather than silently posted because Income Summary
  // is not a permanent account in this chart.
  setDone(true);
 }
 return <Report title="Closing Entries"><p className="muted">Closing entries transfer temporary Revenue, Expense, and Drawing balances to the owner's equity. This app keeps the permanent accounting data separate and provides a review step before posting.</p><table><tbody><tr><th>Closing step</th><th>Debit</th><th>Credit</th></tr><tr><td>Close revenue to Income Summary</td><td>{money(revenue)}</td><td>{money(revenue)}</td></tr><tr><td>Close expenses to Income Summary</td><td>{money(expenses)}</td><td>{money(expenses)}</td></tr><tr><td>Close Income Summary to Capital</td><td>{money(Math.max(netIncome,0))}</td><td>{money(Math.max(netIncome,0))}</td></tr><tr><td>Close Drawing to Capital</td><td>{money(drawing)}</td><td>{money(drawing)}</td></tr></tbody></table><button className="primary" onClick={close}>{done?"Reviewed":"Mark closing entries reviewed"}</button><p className="muted">Net income: {money(netIncome)} · Drawings: {money(drawing)}</p></Report>
}

function PostClosing({accounts,entries}:{accounts:Account[],entries:Entry[]}){const m=Object.fromEntries(accounts.map(a=>[a.id,a]));const b:Record<string,{d:number;c:number}>={};accounts.forEach(a=>b[a.id]={d:0,c:0});entries.forEach(e=>e.lines.forEach(l=>{if(e.kind!=="Closing"){b[l.accountId].d+=l.debit;b[l.accountId].c+=l.credit}}));const rs=accounts.filter(a=>["Asset","Liability","Equity"].includes(a.type)).map(a=>({a,d:b[a.id].d,c:b[a.id].c,net:a.normal==="Debit"?b[a.id].d-b[a.id].c:b[a.id].c-b[a.id].d})).filter(r=>Math.abs(r.net)>.005);return <Report title="Post-Closing Trial Balance"><p className="muted">Permanent accounts only. Temporary revenue, expense, and drawing accounts are excluded.</p><table><thead><tr><th>Code</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{rs.map(r=><tr key={r.a.id}><td>{r.a.code}</td><td>{r.a.name}</td><td>{r.net>0&&r.a.normal==="Debit"?money(r.net):r.a.normal==="Credit"&&r.net<0?money(-r.net):""}</td><td>{r.net>0&&r.a.normal==="Credit"?money(r.net):r.a.normal==="Debit"&&r.net<0?money(-r.net):""}</td></tr>)}</tbody></table></Report>}

function Report({title,subtitle,children}:{title:string,subtitle?:string,children:React.ReactNode}){return <div className="panel report"><div className="reporthead"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button onClick={()=>window.print()}>Print</button></div>{children}</div>}
