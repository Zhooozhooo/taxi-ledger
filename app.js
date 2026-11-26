(() => {
  'use strict';

  const STORAGE_KEY = 'taxiLedgerWeb.v1';
  const categories = [
    ['fuel','Benzina','⛽'],['annualFee','Canone 3570','▣'],['service','Tagliando','🔧'],
    ['tires','Gomme auto','◉'],['insurance','Assicurazione','🛡'],['maintenance','Manutenzione','🚕'],
    ['posFees','Commissioni POS','▰'],['cleaning','Lavaggio','✦'],['other','Altro','…']
  ];
  const defaultState = () => ({
    revenues: [], expenses: [],
    settings: {businessStartDate: `${new Date().getFullYear()}-01-01`, taxRegime:'flat', startupRate:5, standardRate:15, profitability:67, contributions:0, safetyRate:5}
  });
  let state = loadState();
  let currentView = 'dashboard', dashboardScope = 'day', expenseStatus = 'paid';
  const el = id => document.getElementById(id);
  const euro = value => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(value)||0);
  const number = value => new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(Number(value)||0);
  const dateFmt = value => new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));
  const dateTimeFmt = value => new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sum = (items, field='amount') => items.reduce((a,b)=>a+(Number(b[field])||0),0);
  const pad = n => String(n).padStart(2,'0');
  const toLocalDateTime = value => { const d=value?new Date(value):new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const todayDate = () => {const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const cat = id => categories.find(c=>c[0]===id) || categories.at(-1);
  const escapeHtml = value => String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function loadState(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(!raw || !Array.isArray(raw.revenues) || !Array.isArray(raw.expenses)) return defaultState();
      return {...defaultState(),...raw,settings:{...defaultState().settings,...raw.settings}};
    }catch{return defaultState()}
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); renderAll(); }
  function toast(message){ const t=el('toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600); }
  function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200)}
  function inYear(value,year){return new Date(value).getFullYear()===Number(year)}
  function inScope(value,scope){
    const d=new Date(value),now=new Date();
    if(scope==='day') return d.toDateString()===now.toDateString();
    if(scope==='month') return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
    return d.getFullYear()===now.getFullYear();
  }

  function showView(view){
    currentView=view;
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    document.querySelector('.sidebar').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
    if(view==='report') renderReport();
  }

  function renderAll(){ renderDashboard();renderRevenues();renderExpenses();renderYearOptions();renderReport();loadSettingsForm(); }
  function renderDashboard(){
    el('todayLabel').textContent=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
    const rs=state.revenues.filter(x=>inScope(x.date,dashboardScope));
    const es=state.expenses.filter(x=>x.status==='paid'&&inScope(x.date,dashboardScope));
    const total=sum(rs),cash=sum(rs.filter(x=>x.method==='cash')),card=sum(rs.filter(x=>x.method==='card')),expenses=sum(es);
    el('dashTotal').textContent=euro(total);el('dashCash').textContent=euro(cash);el('dashCard').textContent=euro(card);el('dashExpenses').textContent=euro(expenses);el('dashMargin').textContent=euro(total-expenses);
    const movements=[...state.revenues.map(x=>({...x,type:'revenue'})),...state.expenses.filter(x=>x.status==='paid').map(x=>({...x,type:'expense'}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
    el('recentMovements').innerHTML=movements.length?movements.map(x=>x.type==='revenue'?
      `<div class="movement"><span class="bubble">${x.method==='cash'?'▤':'▰'}</span><div class="details"><b>${x.method==='cash'?'Incasso contanti':'Incasso carta'}</b><small>${dateTimeFmt(x.date)}${x.note?' · '+escapeHtml(x.note):''}</small></div><span class="amount" style="color:var(--green)">+ ${euro(x.amount)}</span></div>`:
      `<div class="movement"><span class="bubble">${cat(x.category)[2]}</span><div class="details"><b>${cat(x.category)[1]}</b><small>${dateFmt(x.date)}${x.note?' · '+escapeHtml(x.note):''}</small></div><span class="amount" style="color:var(--red)">− ${euro(x.amount)}</span></div>`).join(''):'<div class="empty-mini">Nessun movimento registrato.</div>';
    const upcoming=state.expenses.filter(x=>x.status==='planned').sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);
    el('upcomingExpenses').innerHTML=upcoming.length?upcoming.map(x=>`<div class="movement"><span class="bubble">${cat(x.category)[2]}</span><div class="details"><b>${cat(x.category)[1]}</b><small>${dateFmt(x.date)}${x.note?' · '+escapeHtml(x.note):''}</small></div><span class="amount">${euro(x.amount)}</span></div>`).join(''):'<div class="empty-mini">Nessuna spesa pianificata.</div>';
  }

  function filteredRevenues(){
    const q=el('revenueSearch').value.trim().toLowerCase(),method=el('revenueMethodFilter').value,month=el('revenueMonthFilter').value;
    return state.revenues.filter(x=>(!q||(x.note||'').toLowerCase().includes(q))&&(method==='all'||x.method===method)&&(!month||String(x.date).slice(0,7)===month)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  }
  function renderRevenues(){
    const items=filteredRevenues(); el('revenueFilteredTotal').textContent=euro(sum(items));el('revenueCashTotal').textContent=euro(sum(items.filter(x=>x.method==='cash')));el('revenueCardTotal').textContent=euro(sum(items.filter(x=>x.method==='card')));
    el('revenuesTable').innerHTML=items.map(x=>`<tr><td>${dateTimeFmt(x.date)}</td><td>${x.method==='cash'?'▤ Contanti':'▰ Carta'}</td><td>${escapeHtml(x.note)||'<span class="muted">—</span>'}</td><td class="number"><b>${euro(x.amount)}</b></td><td><div class="row-actions"><button data-edit-revenue="${x.id}" title="Modifica">✎</button><button data-delete-revenue="${x.id}" title="Elimina">⌫</button></div></td></tr>`).join('');
    el('revenuesEmpty').classList.toggle('hidden',items.length>0);
  }

  function filteredExpenses(){
    const q=el('expenseSearch').value.trim().toLowerCase(),category=el('expenseCategoryFilter').value,month=el('expenseMonthFilter').value;
    return state.expenses.filter(x=>(expenseStatus==='all'||x.status===expenseStatus)&&(category==='all'||x.category===category)&&(!month||String(x.date).slice(0,7)===month)&&(!q||cat(x.category)[1].toLowerCase().includes(q)||(x.note||'').toLowerCase().includes(q))).sort((a,b)=>new Date(b.date)-new Date(a.date));
  }
  function renderExpenses(){
    const items=filteredExpenses();el('expenseFilteredTotal').textContent=euro(sum(items));el('expensePaidTotal').textContent=euro(sum(state.expenses.filter(x=>x.status==='paid')));el('expensePlannedTotal').textContent=euro(sum(state.expenses.filter(x=>x.status==='planned')));
    el('expensesTable').innerHTML=items.map(x=>`<tr><td>${dateFmt(x.date)}</td><td>${cat(x.category)[2]} ${cat(x.category)[1]}</td><td><span class="status ${x.status}">${x.status==='paid'?'Sostenuta':'Pianificata'}</span></td><td>${escapeHtml(x.note)||'<span class="muted">—</span>'}</td><td class="number"><b>${euro(x.amount)}</b></td><td><div class="row-actions">${x.status==='planned'?`<button data-pay-expense="${x.id}" title="Segna come pagata">✓</button>`:''}<button data-edit-expense="${x.id}" title="Modifica">✎</button><button data-delete-expense="${x.id}" title="Elimina">⌫</button></div></td></tr>`).join('');
    el('expensesEmpty').classList.toggle('hidden',items.length>0);
  }

  function taxEstimate(year){
    const revenues=state.revenues.filter(x=>inYear(x.date,year)),expenses=state.expenses.filter(x=>inYear(x.date,year)),gross=sum(revenues),paid=sum(expenses.filter(x=>x.status==='paid'));
    let taxable=0,tax=0,label='';
    if(state.settings.taxRegime==='flat'){
      taxable=Math.max(0,gross*Number(state.settings.profitability)/100-Number(state.settings.contributions));
      const startYear=new Date(state.settings.businessStartDate).getFullYear(),rate=Number(year)>=startYear&&Number(year)<startYear+5?Number(state.settings.startupRate):Number(state.settings.standardRate);
      tax=taxable*rate/100;label=`Imposta sostitutiva (${number(rate)}%)`;
    }else{
      taxable=Math.max(0,gross-paid-Number(state.settings.contributions));
      tax=Math.min(taxable,28000)*.23+Math.max(0,Math.min(taxable,50000)-28000)*.33+Math.max(0,taxable-50000)*.43;label='IRPEF lorda stimata';
    }
    const safety=gross*Number(state.settings.safetyRate)/100;
    return {year:Number(year),revenues,expenses,gross,paid,taxable,tax,label,safety,totalReserve:tax+safety,net:gross-paid-tax-safety,effective:taxable?tax/taxable*100:0};
  }
  function getReportYear(){return Number(el('reportYear').value||new Date().getFullYear())}
  function renderYearOptions(){
    const current=new Date().getFullYear(),existing=Number(el('reportYear').value)||current,years=[...new Set([current,...state.revenues.map(x=>new Date(x.date).getFullYear()),...state.expenses.map(x=>new Date(x.date).getFullYear())])].sort((a,b)=>b-a);
    el('reportYear').innerHTML=years.map(y=>`<option value="${y}" ${y===existing?'selected':''}>${y}</option>`).join('');
  }
  function renderReport(){
    const r=taxEstimate(getReportYear()),cash=sum(r.revenues.filter(x=>x.method==='cash')),card=sum(r.revenues.filter(x=>x.method==='card'));
    el('reportRevenue').textContent=euro(r.gross);el('reportExpenses').textContent=euro(r.paid);el('reportTaxable').textContent=euro(r.taxable);el('reportReserve').textContent=euro(r.totalReserve);el('mainTaxLabel').textContent=r.label;el('reportMainTax').textContent=euro(r.tax);el('reportEffectiveRate').textContent=`${number(r.effective)}%`;el('reportSafety').textContent=euro(r.safety);el('reportNet').textContent=euro(r.net);el('reportRegime').textContent=state.settings.taxRegime==='flat'?'Regime forfettario':'Regime ordinario';
    el('reportNote').textContent=state.settings.taxRegime==='flat'?'L’imposta sostitutiva rimpiazza l’IRPEF ordinaria per questo reddito. Le spese sono mostrate per la gestione di cassa ma non riducono automaticamente la base forfettaria.':'La stima usa gli scaglioni nazionali IRPEF 2026 (23%, 33%, 43%) e non include detrazioni, addizionali o altri redditi.';
    const pct=v=>r.gross?Math.min(100,v/r.gross*100):0;
    el('reportCashText').textContent=euro(cash);el('reportCardText').textContent=euro(card);el('reportCostText').textContent=`${number(pct(r.paid))}%`;el('reportCashBar').style.width=`${pct(cash)}%`;el('reportCardBar').style.width=`${pct(card)}%`;el('reportCostBar').style.width=`${pct(r.paid)}%`;
    const months=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    el('monthlyTable').innerHTML=months.map((m,i)=>{const rs=r.revenues.filter(x=>new Date(x.date).getMonth()===i),es=r.expenses.filter(x=>x.status==='paid'&&new Date(x.date).getMonth()===i),c=sum(rs.filter(x=>x.method==='cash')),d=sum(rs.filter(x=>x.method==='card')),t=c+d,s=sum(es);return `<tr><td>${m}</td><td class="number">${euro(c)}</td><td class="number">${euro(d)}</td><td class="number"><b>${euro(t)}</b></td><td class="number">${euro(s)}</td><td class="number"><b>${euro(t-s)}</b></td></tr>`}).join('');
  }

  function openEntry(type,item=null){
    el('entryType').value=type;el('entryId').value=item?.id||'';el('revenueFields').classList.toggle('hidden',type!=='revenue');el('expenseFields').classList.toggle('hidden',type!=='expense');el('deleteEntry').classList.toggle('hidden',!item);el('entryEyebrow').textContent=type==='revenue'?'INCASSO':'SPESA';el('entryTitle').textContent=`${item?'Modifica':'Nuov'}${type==='revenue'?'o incasso':'a spesa'}`;
    if(type==='revenue'){el('revenueAmount').value=item?.amount||'';el('revenueMethod').value=item?.method||'cash';el('revenueDate').value=toLocalDateTime(item?.date);el('revenueNote').value=item?.note||'';}
    else{el('expenseAmount').value=item?.amount||'';el('expenseCategory').value=item?.category||'fuel';el('expenseStatus').value=item?.status||'paid';el('expenseDate').value=item?.date?String(item.date).slice(0,10):todayDate();el('expenseNote').value=item?.note||'';}
    el('entryDialog').showModal();setTimeout(()=>el(type==='revenue'?'revenueAmount':'expenseAmount').focus(),80);
  }
  function closeEntry(){el('entryDialog').close()}
  function submitEntry(event){
    event.preventDefault();const type=el('entryType').value,id=el('entryId').value||uid();
    if(type==='revenue'){
      const amount=Number(el('revenueAmount').value);if(!(amount>0)){toast('Inserisci un importo valido.');return}
      const item={id,amount,method:el('revenueMethod').value,date:new Date(el('revenueDate').value).toISOString(),note:el('revenueNote').value.trim()};
      const index=state.revenues.findIndex(x=>x.id===id);index>=0?state.revenues[index]=item:state.revenues.push(item);
    }else{
      const amount=Number(el('expenseAmount').value);if(!(amount>0)){toast('Inserisci un importo valido.');return}
      const item={id,amount,category:el('expenseCategory').value,status:el('expenseStatus').value,date:`${el('expenseDate').value}T12:00:00`,note:el('expenseNote').value.trim()};
      const index=state.expenses.findIndex(x=>x.id===id);index>=0?state.expenses[index]=item:state.expenses.push(item);
    }
    saveState();closeEntry();toast('Registrazione salvata.');
  }

  function askConfirm(title,message,okText='Conferma'){
    return new Promise(resolve=>{el('confirmTitle').textContent=title;el('confirmMessage').textContent=message;el('confirmOk').textContent=okText;el('confirmOverlay').classList.remove('hidden');const done=v=>{el('confirmOverlay').classList.add('hidden');el('confirmOk').onclick=null;el('confirmCancel').onclick=null;resolve(v)};el('confirmOk').onclick=()=>done(true);el('confirmCancel').onclick=()=>done(false)});
  }
  async function remove(type,id){
    if(!await askConfirm('Eliminare la registrazione?','Questa operazione non può essere annullata.','Elimina'))return;
    state[type]=state[type].filter(x=>x.id!==id);saveState();closeEntry();toast('Registrazione eliminata.');
  }

  function loadSettingsForm(){
    const s=state.settings;el('businessStartDate').value=s.businessStartDate;el('taxRegime').value=s.taxRegime;el('startupRate').value=s.startupRate;el('standardRate').value=s.standardRate;el('profitability').value=s.profitability;el('contributions').value=s.contributions;el('safetyRate').value=s.safetyRate;el('flatSettings').classList.toggle('hidden',s.taxRegime!=='flat');
  }
  function saveSettings(event){
    event?.preventDefault();state.settings={businessStartDate:el('businessStartDate').value,taxRegime:el('taxRegime').value,startupRate:Number(el('startupRate').value),standardRate:Number(el('standardRate').value),profitability:Number(el('profitability').value),contributions:Number(el('contributions').value),safetyRate:Number(el('safetyRate').value)};saveState();toast('Impostazioni salvate.');
  }

  function exportBackup(){download(`TaxiLedger_Backup_${todayDate()}.json`,new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));toast('Backup esportato.');}
  async function importBackup(file){
    if(!file)return;
    try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.revenues)||!Array.isArray(parsed.expenses)||!parsed.settings)throw new Error();if(!await askConfirm('Importare il backup?','I dati attuali saranno sostituiti dal contenuto del file.','Importa'))return;state={...defaultState(),...parsed,settings:{...defaultState().settings,...parsed.settings}};saveState();toast('Backup importato.');}catch{toast('File di backup non valido.')}finally{el('importBackup').value=''}
  }
  function exportCsv(){
    const y=getReportYear(),r=taxEstimate(y),rows=[['Data','Tipo','Metodo/Categoria','Stato','Nota','Importo']];
    r.revenues.forEach(x=>rows.push([String(x.date).slice(0,10),'Incasso',x.method==='cash'?'Contanti':'Carta','',x.note,x.amount]));r.expenses.forEach(x=>rows.push([String(x.date).slice(0,10),'Spesa',cat(x.category)[1],x.status==='paid'?'Sostenuta':'Pianificata',x.note,x.amount]));
    const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\r\n');download(`TaxiLedger_${y}.csv`,new Blob([csv],{type:'text/csv;charset=utf-8'}));toast('CSV esportato.');
  }

  function makePDF(){
    const y=getReportYear(),r=taxEstimate(y),lines=[];
    const add=(left,right='',style='normal')=>lines.push({left,right,style});
    add(`TAXI LEDGER — CONSUNTIVO ${y}`,'','title');add(`Generato il ${dateTimeFmt(new Date())}`,'','muted');add('','','space');add('RIEPILOGO','','section');add('Ricavi totali',euro(r.gross),'bold');add('Contanti',euro(sum(r.revenues.filter(x=>x.method==='cash'))));add('Carta',euro(sum(r.revenues.filter(x=>x.method==='card'))));add('Spese sostenute',euro(r.paid));add('Spese pianificate',euro(sum(r.expenses.filter(x=>x.status==='planned'))));add('','','space');add('STIMA FISCALE','','section');add('Regime',state.settings.taxRegime==='flat'?'Regime forfettario':'Regime ordinario');add('Base imponibile stimata',euro(r.taxable));add(r.label,euro(r.tax));add(`Fondo prudenziale (${number(state.settings.safetyRate)}%)`,euro(r.safety));add('Accantonamento totale',euro(r.totalReserve),'bold');add('Disponibile stimato',euro(r.net),'bold');add('','','space');add('INCASSI','','section');
    if(!r.revenues.length)add('Nessun incasso','—');r.revenues.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(x=>add(`${dateTimeFmt(x.date)} · ${x.method==='cash'?'Contanti':'Carta'}${x.note?' · '+x.note:''}`,euro(x.amount)));
    add('','','space');add('SPESE','','section');if(!r.expenses.length)add('Nessuna spesa','—');r.expenses.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(x=>add(`${dateFmt(x.date)} · ${cat(x.category)[1]} · ${x.status==='paid'?'Sostenuta':'Pianificata'}${x.note?' · '+x.note:''}`,euro(x.amount)));
    add('','','space');add('Stima gestionale: verificare regime, coefficiente, contributi, detrazioni e addizionali con il commercialista.','','muted');
    const pages=[];let page=[];for(const line of lines){if(page.length>=37||line.style==='title'&&page.length){pages.push(page);page=[]}page.push(line)}if(page.length)pages.push(page);
    const blob=buildSimplePdf(pages,y);download(`TaxiLedger_Consuntivo_${y}.pdf`,blob);toast('PDF esportato.');
  }

  function buildSimplePdf(pages,year){
    const cpMap={'€':128,'’':146,'“':147,'”':148,'–':150,'—':151,'…':133};
    const hex=s=>Array.from(String(s)).map(ch=>{let n=cpMap[ch]??ch.charCodeAt(0);if(n>255)n=63;return n.toString(16).padStart(2,'0')}).join('');
    const objects=[''];const add=o=>(objects.push(o),objects.length-1);const catalog=add(''),pagesRef=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');const pageRefs=[];
    pages.forEach((lines,index)=>{let y=785,stream='';const text=(s,x,size,isBold=false)=>{stream+=`BT /F${isBold?2:1} ${size} Tf ${x} ${y} Td <${hex(s)}> Tj ET\n`};text('TAXI LEDGER',42,9,true);text(`Pagina ${index+1} / ${pages.length}`,493,8,false);y-=26;lines.forEach(line=>{if(line.style==='space'){y-=10;return}const size=line.style==='title'?20:line.style==='section'?10:line.style==='muted'?8:10;const isBold=['title','section','bold'].includes(line.style);let left=String(line.left).replace(/[\r\n]/g,' ').slice(0,line.right?72:95);text(left,42,size,isBold);if(line.right){const x=Math.max(390,548-String(line.right).length*5.4);text(line.right,x,size,true)}y-=line.style==='title'?28:line.style==='section'?21:17});const content=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);const p=add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`);pageRefs.push(p)});
    objects[pagesRef]=`<< /Type /Pages /Kids [${pageRefs.map(x=>`${x} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;objects[catalog]=`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
    let pdf='%PDF-1.4\n%âãÏÓ\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R /Info << /Title <${hex(`Taxi Ledger Consuntivo ${year}`)}> >> >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([Uint8Array.from(pdf, c=>c.charCodeAt(0)&255)],{type:'application/pdf'});
  }

  function wireEvents(){
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));document.querySelectorAll('[data-view-link]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.viewLink)));document.querySelectorAll('[data-action="new-revenue"]').forEach(b=>b.addEventListener('click',()=>openEntry('revenue')));document.querySelectorAll('[data-action="new-expense"]').forEach(b=>b.addEventListener('click',()=>openEntry('expense')));
    el('menuButton').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');document.addEventListener('click',e=>{if(innerWidth<=760&&document.querySelector('.sidebar').classList.contains('open')&&!e.target.closest('.sidebar')&&!e.target.closest('#menuButton'))document.querySelector('.sidebar').classList.remove('open')});
    el('dashboardScope').onclick=e=>{const b=e.target.closest('button[data-scope]');if(!b)return;dashboardScope=b.dataset.scope;el('dashboardScope').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderDashboard()};
    ['revenueSearch','revenueMethodFilter','revenueMonthFilter'].forEach(id=>el(id).addEventListener('input',renderRevenues));el('clearRevenueFilters').onclick=()=>{el('revenueSearch').value='';el('revenueMethodFilter').value='all';el('revenueMonthFilter').value='';renderRevenues()};
    ['expenseSearch','expenseCategoryFilter','expenseMonthFilter'].forEach(id=>el(id).addEventListener('input',renderExpenses));el('clearExpenseFilters').onclick=()=>{el('expenseSearch').value='';el('expenseCategoryFilter').value='all';el('expenseMonthFilter').value='';renderExpenses()};el('expenseStatusFilter').onclick=e=>{const b=e.target.closest('button[data-status]');if(!b)return;expenseStatus=b.dataset.status;el('expenseStatusFilter').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderExpenses()};
    document.addEventListener('click',async e=>{let b;if(b=e.target.closest('[data-edit-revenue]'))openEntry('revenue',state.revenues.find(x=>x.id===b.dataset.editRevenue));if(b=e.target.closest('[data-delete-revenue]'))remove('revenues',b.dataset.deleteRevenue);if(b=e.target.closest('[data-edit-expense]'))openEntry('expense',state.expenses.find(x=>x.id===b.dataset.editExpense));if(b=e.target.closest('[data-delete-expense]'))remove('expenses',b.dataset.deleteExpense);if(b=e.target.closest('[data-pay-expense]')){const x=state.expenses.find(x=>x.id===b.dataset.payExpense);if(x){x.status='paid';x.date=`${todayDate()}T12:00:00`;saveState();toast('Spesa segnata come sostenuta.')}}});
    el('entryForm').addEventListener('submit',submitEntry);document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=closeEntry);el('deleteEntry').onclick=()=>remove(el('entryType').value==='revenue'?'revenues':'expenses',el('entryId').value);
    el('reportYear').onchange=renderReport;el('exportPdf').onclick=makePDF;el('exportCsv').onclick=exportCsv;el('settingsForm').onsubmit=saveSettings;el('saveSettings').onclick=saveSettings;el('taxRegime').onchange=()=>el('flatSettings').classList.toggle('hidden',el('taxRegime').value!=='flat');el('exportBackup').onclick=exportBackup;el('importBackup').onchange=e=>importBackup(e.target.files[0]);el('deleteAllData').onclick=async()=>{if(await askConfirm('Eliminare tutti i dati?','Incassi, spese e impostazioni saranno cancellati definitivamente da questo browser. Esporta prima un backup se vuoi conservarli.','Elimina tutto')){state=defaultState();saveState();toast('Tutti i dati sono stati eliminati.')}};
  }

  function init(){
    const opts=categories.map(c=>`<option value="${c[0]}">${c[2]} ${c[1]}</option>`).join('');el('expenseCategory').innerHTML=opts;el('expenseCategoryFilter').innerHTML='<option value="all">Tutte le categorie</option>'+opts;wireEvents();renderAll();showView(currentView);
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  document.addEventListener('DOMContentLoaded',init);
})();
