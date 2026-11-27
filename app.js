(() => {
  'use strict';

  const STORAGE_KEY = 'taxiLedger.accounts.v2';
  const SESSION_KEY = 'taxiLedger.session.v2';
  const APP_VERSION = '2.1.0';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = localISO();
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = value => new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'}).format(Number(value) || 0);
  const pct = value => `${(Number(value) || 0).toLocaleString('it-IT', {maximumFractionDigits:1})}%`;
  const parseDate = iso => new Date(`${iso}T12:00:00`);
  const dateLabel = iso => iso ? parseDate(iso).toLocaleDateString('it-IT', {day:'2-digit', month:'short', year:'numeric'}) : '—';
  const monthLabel = ym => parseDate(`${ym}-01`).toLocaleDateString('it-IT', {month:'long', year:'numeric'});
  const daysInclusive = (start, end, weekdaysOnly = false) => {
    let count = 0;
    for (let d = parseDate(start), last = parseDate(end); d <= last; d.setDate(d.getDate() + 1)) {
      if (!weekdaysOnly || (d.getDay() !== 0 && d.getDay() !== 6)) count++;
    }
    return count;
  };

  let store = loadStore();
  let userEmail = localStorage.getItem(SESSION_KEY) || '';
  let state = null;
  let dashPeriod = 'day';
  const dashValues = {day: today, month: currentMonth, year: currentYear};

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {accounts:{}}; }
    catch { return {accounts:{}}; }
  }
  function persistStore() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  function defaultData(name = '') {
    return {
      version: APP_VERSION,
      revenues: [], expenses: [], holidays: [],
      settings: {name, business:'', currency:'EUR', startYear:Number(currentYear), taxRateFirst:5, taxRateAfter:10, profitability:67, inpsRate:24, inpsFixed:0, cardOnly:true}
    };
  }
  function normalizeData(data, name = '') {
    const base = defaultData(name);
    return {
      ...base, ...data,
      revenues: Array.isArray(data?.revenues) ? data.revenues : [],
      expenses: Array.isArray(data?.expenses) ? data.expenses : [],
      holidays: Array.isArray(data?.holidays) ? data.holidays : [],
      settings: {...base.settings, ...(data?.settings || {}), name: data?.settings?.name || name || base.settings.name}
    };
  }
  function save() {
    if (!userEmail || !state || !store.accounts[userEmail]) return;
    state.version = APP_VERSION;
    store.accounts[userEmail].data = state;
    store.accounts[userEmail].name = state.settings.name;
    persistStore();
    $('#syncBadge').textContent = '● Salvato sul dispositivo';
  }
  async function hashPassword(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function showAuth() {
    $('#authView').classList.remove('hidden'); $('#appView').classList.add('hidden');
  }
  function enterApp() {
    const account = store.accounts[userEmail];
    if (!account) { localStorage.removeItem(SESSION_KEY); showAuth(); return; }
    state = normalizeData(account.data, account.name);
    $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    syncIdentity(); populateReportYears(); renderAll();
  }
  function syncIdentity() {
    const name = state.settings.name || store.accounts[userEmail].name || 'Utente';
    $('#sidebarUserName').textContent = name;
    $('#sidebarUserEmail').textContent = userEmail;
    $('#userInitial').textContent = name.charAt(0).toUpperCase();
    $('#welcomeTitle').textContent = `Buon lavoro, ${name.split(' ')[0]}`;
    $('#todayChip').textContent = parseDate(today).toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'});
  }

  $$('.auth-tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.auth-tab').forEach(x => x.classList.toggle('active', x === btn));
    $('#loginForm').classList.toggle('hidden', btn.dataset.authTab !== 'login');
    $('#registerForm').classList.toggle('hidden', btn.dataset.authTab !== 'register');
  }));
  $('#registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#registerName').value.trim();
    const email = $('#registerEmail').value.trim().toLowerCase();
    const password = $('#registerPassword').value;
    if (store.accounts[email]) return toast('Esiste già un profilo con questa email.');
    const salt = uuid();
    store.accounts[email] = {name, salt, hash:await hashPassword(password, salt), createdAt:new Date().toISOString(), data:defaultData(name)};
    persistStore(); userEmail = email; localStorage.setItem(SESSION_KEY, email); enterApp(); toast('Profilo creato. Benvenuto!');
  });
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim().toLowerCase();
    const account = store.accounts[email];
    if (!account || account.hash !== await hashPassword($('#loginPassword').value, account.salt)) return toast('Email o password non corretti.');
    userEmail = email; localStorage.setItem(SESSION_KEY, email); enterApp();
  });
  $('#logoutBtn').addEventListener('click', () => { save(); localStorage.removeItem(SESSION_KEY); userEmail=''; state=null; showAuth(); });

  const viewInfo = {
    dashboard:['PANORAMICA','Cruscotto'], revenues:['MOVIMENTI','Incassi'], expenses:['COSTI','Spese'],
    holidays:['CALENDARIO','Ferie'], report:['PIANIFICAZIONE','Consuntivo'], settings:['PROFILO','Impostazioni']
  };
  function navigate(view) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#pageKicker').textContent = viewInfo[view][0]; $('#pageTitle').textContent = viewInfo[view][1];
    window.scrollTo({top:0, behavior:'smooth'});
    if (view === 'report') renderReport();
  }
  $$('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  $$('[data-view-link]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.viewLink)));

  function inPeriod(date, type, value) {
    if (type === 'day') return date === value;
    if (type === 'month') return date.startsWith(value);
    return date.startsWith(String(value));
  }
  function totals(type, value) {
    const revenues = state.revenues.filter(r => inPeriod(r.date, type, value));
    const expenses = state.expenses.filter(r => r.status !== 'planned' && inPeriod(r.date, type, value));
    const cash = revenues.filter(r => r.method === 'cash').reduce((s,r) => s + Number(r.amount), 0);
    const card = revenues.filter(r => r.method === 'card').reduce((s,r) => s + Number(r.amount), 0);
    const expenseTotal = expenses.reduce((s,r) => s + Number(r.amount), 0);
    const revenueTotal = cash + card;
    const margin = revenueTotal - expenseTotal;
    return {revenues, expenses, cash, card, revenueTotal, expenseTotal, margin};
  }
  function holidaySet(start, end) {
    const set = new Set();
    state.holidays.forEach(h => {
      const a = parseDate(h.start > start ? h.start : start), b = parseDate(h.end < end ? h.end : end);
      for (let d = a; d <= b; d.setDate(d.getDate()+1)) set.add(localISO(d));
    });
    return set;
  }
  function countWorkingDays(start, end) {
    if (end < start) return 0;
    const off = holidaySet(start, end); let n = 0;
    for (let d = parseDate(start), last = parseDate(end); d <= last; d.setDate(d.getDate()+1)) {
      const iso = localISO(d); if (d.getDay() !== 0 && d.getDay() !== 6 && !off.has(iso)) n++;
    }
    return n;
  }
  function periodBounds(type, value) {
    if (type === 'day') return {start:value,end:value};
    if (type === 'month') {
      const [y,m] = value.split('-').map(Number); return {start:`${value}-01`, end:localISO(new Date(y,m,0,12))};
    }
    return {start:`${value}-01-01`, end:`${value}-12-31`};
  }
  function projection(type, value, data) {
    const {start,end} = periodBounds(type,value);
    if (type === 'day') return null;
    if (start > today) return {revenue:0,margin:0,currentRevenue:0,currentMargin:0,remainingRevenue:0,remainingMargin:0,totalDays:countWorkingDays(start,end),elapsed:0,remaining:countWorkingDays(start,end),status:'future'};
    if (end < today) return {revenue:data.revenueTotal,margin:data.margin,currentRevenue:data.revenueTotal,currentMargin:data.margin,remainingRevenue:0,remainingMargin:0,totalDays:countWorkingDays(start,end),elapsed:countWorkingDays(start,end),remaining:0,status:'closed'};
    const cutoff = today < end ? today : end;
    const elapsed = countWorkingDays(start,cutoff), totalDays = countWorkingDays(start,end);
    const remaining = Math.max(0,totalDays-elapsed);
    const dailyRevenue = elapsed ? data.revenueTotal/elapsed : 0, dailyMargin = elapsed ? data.margin/elapsed : 0;
    const remainingRevenue=dailyRevenue*remaining, remainingMargin=dailyMargin*remaining;
    return {revenue:data.revenueTotal+remainingRevenue, margin:data.margin+remainingMargin, currentRevenue:data.revenueTotal,currentMargin:data.margin,remainingRevenue,remainingMargin,totalDays,elapsed,remaining,status:'live'};
  }

  $$('.period-tab').forEach(btn => btn.addEventListener('click', () => {
    dashValues[dashPeriod] = $('#dashboardPicker').value;
    dashPeriod = btn.dataset.period;
    $$('.period-tab').forEach(x => x.classList.toggle('active', x === btn));
    setupDashboardPicker(); renderDashboard();
  }));
  function setupDashboardPicker() {
    const picker = $('#dashboardPicker');
    if (dashPeriod === 'day') { picker.type='date'; picker.min=''; picker.max=''; $('#dashPickerLabel').childNodes[0].textContent='Data'; }
    else if (dashPeriod === 'month') { picker.type='month'; picker.min=''; picker.max=currentMonth; $('#dashPickerLabel').childNodes[0].textContent='Mese'; }
    else { picker.type='number'; picker.min='2000'; picker.max=currentYear; picker.step='1'; $('#dashPickerLabel').childNodes[0].textContent='Anno'; }
    picker.value = dashValues[dashPeriod];
  }
  $('#dashboardPicker').addEventListener('change', e => { dashValues[dashPeriod] = e.target.value; renderDashboard(); });
  function kpi(icon,label,value,sub,accent='') { return `<article class="kpi-card ${accent}"><div class="kpi-icon">${icon}</div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></article>`; }
  function renderDashboard() {
    const value = dashValues[dashPeriod] || (dashPeriod==='day'?today:dashPeriod==='month'?currentMonth:currentYear);
    const d = totals(dashPeriod,value), p = projection(dashPeriod,value,d);
    const cardShare = d.revenueTotal ? d.card/d.revenueTotal*100 : 0, cashShare = d.revenueTotal ? d.cash/d.revenueTotal*100 : 0;
    const marginShare = d.revenueTotal ? d.margin/d.revenueTotal*100 : 0;
    let cards = kpi('↗','INCASSI',money(d.revenueTotal),`${d.revenues.length} movimenti`,'accent');
    cards += kpi('▣','CARTA',money(d.card),`${pct(cardShare)} degli incassi`);
    cards += kpi('●','CONTANTI',money(d.cash),`${pct(cashShare)} degli incassi`);
    cards += kpi('◇','MARGINE',money(d.margin),`${pct(marginShare)} sugli incassi`);
    if (p) cards += kpi('⌁', dashPeriod==='month'?'TOTALE PROIETTATO FINE MESE':'TOTALE PROIETTATO FINE ANNO', money(p.revenue), `Margine totale proiettato ${money(p.margin)}`);
    $('#dashboardKpis').innerHTML = cards;
    const proj = $('#projectionNote');
    if (!p) proj.innerHTML = '<strong>Vista giornaliera.</strong> Seleziona una data per consultare o correggere lo storico.';
    else if (p.status === 'live') proj.innerHTML = `<strong>Totale proiettato ${money(p.revenue)}:</strong> ${money(p.currentRevenue)} già incassati + ${money(p.remainingRevenue)} previsti nei ${p.remaining} giorni lavorativi restanti. Weekend e ferie sono esclusi.`;
    else if (p.status === 'closed') proj.innerHTML = `<strong>Totale definitivo ${money(p.revenue)}:</strong> il periodo è concluso e comprende ${p.totalDays} giorni lavorativi netti.`;
    else proj.innerHTML = `<strong>Periodo futuro:</strong> totale non ancora disponibile; sono previsti ${p.totalDays} giorni lavorativi al netto delle ferie.`;
    $('#revenueTotalBadge').textContent = money(d.revenueTotal);
    $('#revenueMix').innerHTML = `<div class="mix-bar" aria-label="Carta ${pct(cardShare)}, contanti ${pct(cashShare)}"><span class="mix-card" style="width:${cardShare}%"></span><span class="mix-cash" style="width:${cashShare}%"></span></div><div class="mix-legend"><div class="legend-item"><i class="legend-dot mix-card"></i><small>Carta<br><strong>${pct(cardShare)}</strong></small><strong>${money(d.card)}</strong></div><div class="legend-item"><i class="legend-dot mix-cash"></i><small>Contanti<br><strong>${pct(cashShare)}</strong></small><strong>${money(d.cash)}</strong></div></div>`;
    const movements = [...d.revenues.map(x=>({...x,kind:'revenue'})), ...d.expenses.map(x=>({...x,kind:'expense'}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
    $('#recentMovements').innerHTML = movements.length ? movements.map(x=>`<div class="movement ${x.kind}"><span class="movement-icon">${x.kind==='revenue'?'↗':'↘'}</span><div class="movement-main"><strong>${esc(x.note || x.category || (x.kind==='revenue'?'Incasso':'Spesa'))}</strong><span>${dateLabel(x.date)} · ${x.method==='card'?'Carta':'Contanti'}</span></div><span class="movement-amount">${x.kind==='expense'?'−':'+'}${money(x.amount)}</span></div>`).join('') : `<div class="empty"><strong>Nessun movimento</strong>Non ci sono dati nel periodo selezionato.</div>`;
  }

  function summaryCards(total, card, cash, noun='incassi') {
    const cp = total ? card/total*100 : 0, hp = total ? cash/total*100 : 0;
    return `<div class="mini-card"><span>Totale ${noun}</span><strong>${money(total)}</strong><small>${noun==='spese'?'sostenute nel periodo':'complessivi'}</small></div><div class="mini-card"><span>Carta</span><strong>${money(card)}</strong><small>${pct(cp)} del totale</small></div><div class="mini-card"><span>Contanti</span><strong>${money(cash)}</strong><small>${pct(hp)} del totale</small></div>`;
  }
  function renderRevenues() {
    const q = $('#revenueSearch').value.trim().toLowerCase(), period = $('#revenueMonthFilter').value;
    const rows = state.revenues.filter(r => (!period || r.date.startsWith(period)) && (!q || `${r.note} ${r.amount}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
    const card = rows.filter(r=>r.method==='card').reduce((s,r)=>s+Number(r.amount),0), cash = rows.filter(r=>r.method==='cash').reduce((s,r)=>s+Number(r.amount),0);
    $('#revenueSummary').innerHTML = summaryCards(card+cash,card,cash);
    $('#revenueTable').innerHTML = rows.map(r=>`<tr><td><button class="edit-btn" data-edit="revenue" data-id="${r.id}" aria-label="Modifica incasso">✎</button></td><td>${dateLabel(r.date)}</td><td>${esc(r.note || 'Incasso')}</td><td><span class="method ${r.method}">${r.method==='card'?'Carta':'Contanti'}</span></td><td class="num"><strong>${money(r.amount)}</strong></td></tr>`).join('');
    $('#revenueEmpty').classList.toggle('hidden', rows.length>0); $('#revenueEmpty').innerHTML='<strong>Nessun incasso</strong>Prova a cambiare periodo o aggiungi il primo movimento.';
  }
  function renderExpenses() {
    const q = $('#expenseSearch').value.trim().toLowerCase(), period = $('#expenseMonthFilter').value;
    const rows = state.expenses.filter(r => (!period || r.date.startsWith(period)) && (!q || `${r.note} ${r.category} ${r.amount}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
    const card = rows.filter(r=>r.method==='card').reduce((s,r)=>s+Number(r.amount),0), cash = rows.filter(r=>r.method==='cash').reduce((s,r)=>s+Number(r.amount),0);
    $('#expenseSummary').innerHTML = summaryCards(card+cash,card,cash,'spese');
    $('#expenseTable').innerHTML = rows.map(r=>`<tr><td><button class="edit-btn" data-edit="expense" data-id="${r.id}" aria-label="Modifica spesa">✎</button></td><td>${dateLabel(r.date)}</td><td><strong>${esc(r.category)}</strong><br><small class="muted">${esc(r.note||'')}</small></td><td><span class="state ${r.status}">${r.status==='planned'?'Pianificata':'Pagata'}</span></td><td><span class="method ${r.method}">${r.method==='card'?'Carta':'Contanti'}</span></td><td class="num"><strong>${money(r.amount)}</strong></td></tr>`).join('');
    $('#expenseEmpty').classList.toggle('hidden', rows.length>0); $('#expenseEmpty').innerHTML='<strong>Nessuna spesa</strong>Prova a cambiare periodo o aggiungi il primo costo.';
  }
  ['revenueSearch','revenueMonthFilter'].forEach(id=>$('#'+id).addEventListener('input',renderRevenues));
  ['expenseSearch','expenseMonthFilter'].forEach(id=>$('#'+id).addEventListener('input',renderExpenses));

  function renderHolidays() {
    const rows = [...state.holidays].sort((a,b)=>a.start.localeCompare(b.start));
    const yearRows = rows.filter(h=>h.end>=`${currentYear}-01-01`&&h.start<=`${currentYear}-12-31`);
    const netDays = yearRows.reduce((s,h)=>s+daysInclusive(h.start<`${currentYear}-01-01`?`${currentYear}-01-01`:h.start,h.end>`${currentYear}-12-31`?`${currentYear}-12-31`:h.end,true),0);
    const next = rows.find(h=>h.end>=today);
    $('#holidaySummary').innerHTML = `<div class="mini-card"><span>Periodi ${currentYear}</span><strong>${yearRows.length}</strong><small>programmati</small></div><div class="mini-card"><span>Giorni feriali di ferie</span><strong>${netDays}</strong><small>esclusi dalle proiezioni</small></div><div class="mini-card"><span>Prossimo periodo</span><strong>${next?dateLabel(next.start):'—'}</strong><small>${next?esc(next.name):'Nessuna ferie programmata'}</small></div>`;
    $('#holidayList').innerHTML = rows.map(h=>`<div class="holiday-item"><span class="holiday-icon">☀</span><div><h4>${esc(h.name)}</h4><p>${dateLabel(h.start)} → ${dateLabel(h.end)}${h.note?` · ${esc(h.note)}`:''}</p></div><span class="days-badge">${daysInclusive(h.start,h.end)} giorni</span><button class="edit-btn" data-edit="holiday" data-id="${h.id}" aria-label="Modifica ferie">✎</button></div>`).join('');
    $('#holidayEmpty').classList.toggle('hidden', rows.length>0); $('#holidayEmpty').innerHTML='<strong>Nessun periodo di ferie</strong>Aggiungilo per rendere più accurate le proiezioni.';
  }

  function reportFilter() {
    const year=$('#reportYear').value||currentYear, month=$('#reportMonth').value;
    return month==='all' ? {type:'year',value:year,label:year,months:12} : {type:'month',value:`${year}-${month}`,label:monthLabel(`${year}-${month}`),months:1};
  }
  function populateReportYears() {
    const years = new Set([currentYear]);
    state.revenues.forEach(x=>years.add(x.date.slice(0,4))); state.expenses.forEach(x=>years.add(x.date.slice(0,4)));
    for(let y=Number(currentYear)-3;y<=Number(currentYear);y++) years.add(String(y));
    const current=$('#reportYear').value||currentYear;
    $('#reportYear').innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option ${y===current?'selected':''}>${y}</option>`).join('');
  }
  function renderReport() {
    const f=reportFilter(), d=totals(f.type,f.value), s=state.settings;
    const reportYear=Number(f.value.slice(0,4)), activityYear=Math.max(1,reportYear-Number(s.startYear||reportYear)+1);
    const effectiveTaxRate=activityYear<=5?Number(s.taxRateFirst??s.taxRate??5):Number(s.taxRateAfter??10);
    const grossBase = s.cardOnly ? d.card : d.revenueTotal;
    const taxableBase = grossBase * Number(s.profitability)/100;
    const variableInps = taxableBase * Number(s.inpsRate)/100;
    const fixedInps = Number(s.inpsFixed||0) * f.months/12;
    const inps = variableInps + fixedInps;
    const afterInps = Math.max(0,taxableBase-inps);
    const tax = afterInps * effectiveTaxRate/100;
    const reserve = inps+tax;
    const net = d.revenueTotal-d.expenseTotal-reserve;
    $('#reportHero').innerHTML=`<div><p class="eyebrow">ACCANTONAMENTO STIMATO · ${esc(f.label).toUpperCase()}</p><h3>${money(reserve)}</h3><p>INPS e imposta sostitutiva calcolati sulla base configurata. Disponibile stimato dopo costi e accantonamento: <strong>${money(net)}</strong>.</p></div><aside><div><span>Incassi totali</span><strong>${money(d.revenueTotal)}</strong></div><div><span>Spese pagate</span><strong>− ${money(d.expenseTotal)}</strong></div><div><span>Accantonamento</span><strong>− ${money(reserve)}</strong></div></aside>`;
    $('#reportBreakdown').innerHTML=`<div class="report-card"><span>Ricavi carta</span><strong>${money(d.card)}</strong><small>${pct(d.revenueTotal?d.card/d.revenueTotal*100:0)} del totale · inclusi nella base</small></div><div class="report-card"><span>Ricavi contanti</span><strong>${money(d.cash)}</strong><small>${pct(d.revenueTotal?d.cash/d.revenueTotal*100:0)} del totale · ${s.cardOnly?'esclusi':'inclusi'} dalla base</small></div><div class="report-card"><span>Costo INPS</span><strong>${money(inps)}</strong><small>${pct(s.inpsRate)} sulla base + quota fissa</small></div><div class="report-card"><span>Imposta sostitutiva</span><strong>${money(tax)}</strong><small>${pct(effectiveTaxRate)} · anno ${activityYear} di attività</small></div>`;
    $('#formulaSteps').innerHTML=`<div class="formula-step"><i>1</i><span>Ricavi di riferimento (${s.cardOnly?'solo carta':'carta + contanti'})</span><strong>${money(grossBase)}</strong></div><div class="formula-step"><i>2</i><span>Base imponibile × coefficiente ${pct(s.profitability)}</span><strong>${money(taxableBase)}</strong></div><div class="formula-step"><i>3</i><span>INPS variabile ${pct(s.inpsRate)} + quota fissa ${money(fixedInps)}</span><strong>− ${money(inps)}</strong></div><div class="formula-step"><i>4</i><span>Base dopo deduzione INPS</span><strong>${money(afterInps)}</strong></div><div class="formula-step"><i>5</i><span>Imposta sostitutiva ${pct(effectiveTaxRate)} (anno ${activityYear})</span><strong>${money(tax)}</strong></div>`;
  }
  $('#reportYear').addEventListener('change',renderReport); $('#reportMonth').addEventListener('change',renderReport);
  $('#printReport').addEventListener('click',()=>{const old=document.title; document.title=`Taxi Ledger - Consuntivo ${reportFilter().label}`; window.print(); setTimeout(()=>document.title=old,500);});

  function settingsToForm() {
    const s=state.settings;
    $('#settingsName').value=s.name||''; $('#settingsBusiness').value=s.business||''; $('#settingsCurrency').value=s.currency||'EUR';
    $('#settingsStartYear').value=s.startYear||currentYear; $('#settingsTaxRateFirst').value=s.taxRateFirst??s.taxRate??5; $('#settingsTaxRateAfter').value=s.taxRateAfter??10; $('#settingsProfitability').value=s.profitability; $('#settingsInpsRate').value=s.inpsRate; $('#settingsInpsFixed').value=s.inpsFixed; $('#settingsCardOnly').checked=!!s.cardOnly;
  }
  $('#saveSettings').addEventListener('click',()=>{
    const name=$('#settingsName').value.trim(); if(!name) return toast('Inserisci un nome visualizzato.');
    state.settings={...state.settings,name,business:$('#settingsBusiness').value.trim(),currency:$('#settingsCurrency').value,startYear:Number($('#settingsStartYear').value),taxRateFirst:Number($('#settingsTaxRateFirst').value),taxRateAfter:Number($('#settingsTaxRateAfter').value),profitability:Number($('#settingsProfitability').value),inpsRate:Number($('#settingsInpsRate').value),inpsFixed:Number($('#settingsInpsFixed').value),cardOnly:$('#settingsCardOnly').checked};
    save(); syncIdentity(); renderAll(); toast('Impostazioni aggiornate.');
  });
  $('#exportData').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({app:'Taxi Ledger',version:APP_VERSION,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`taxi-ledger-backup-${today}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#importData').addEventListener('change', async e=>{
    const file=e.target.files[0]; if(!file)return;
    try { const parsed=JSON.parse(await file.text()); const incoming=parsed.data||parsed; if(!Array.isArray(incoming.revenues)||!Array.isArray(incoming.expenses)) throw new Error(); if(!confirm('Sostituire i dati di questo profilo con il backup selezionato?')) return; state=normalizeData(incoming,state.settings.name); save(); populateReportYears(); renderAll(); toast('Backup importato.'); }
    catch { toast('Il file non è un backup Taxi Ledger valido.'); }
    e.target.value='';
  });
  $('#deleteProfile').addEventListener('click',()=>{
    if(!confirm(`Eliminare definitivamente il profilo ${userEmail} e tutti i suoi dati?`)) return;
    delete store.accounts[userEmail]; persistStore(); localStorage.removeItem(SESSION_KEY); userEmail=''; state=null; showAuth(); toast('Profilo eliminato.');
  });
  $('#loadDemo').addEventListener('click',()=>{
    if((state.revenues.length||state.expenses.length) && !confirm('Aggiungere i dati dimostrativi a quelli esistenti?')) return;
    const day=n=>{const d=new Date(); d.setDate(d.getDate()-n); return localISO(d)};
    state.revenues.push({id:uuid(),date:day(0),amount:145,method:'card',note:'Turno mattina'},{id:uuid(),date:day(0),amount:82,method:'cash',note:'Turno pomeriggio'},{id:uuid(),date:day(1),amount:196,method:'card',note:'Servizi aeroporto'},{id:uuid(),date:day(2),amount:114,method:'cash',note:'Turno città'});
    state.expenses.push({id:uuid(),date:day(1),amount:48,category:'Carburante',status:'paid',method:'card',note:'Rifornimento'},{id:uuid(),date:day(5),amount:220,category:'Manutenzione',status:'planned',method:'card',note:'Tagliando'});
    save(); populateReportYears(); renderAll(); toast('Dati dimostrativi caricati.');
  });

  const fieldTemplates={
    revenue:item=>`<label>Data<input name="date" type="date" required value="${item.date||today}"></label><label>Importo (€)<input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${item.amount||''}"></label><label>Metodo<select name="method"><option value="card" ${item.method==='card'?'selected':''}>Carta</option><option value="cash" ${item.method==='cash'?'selected':''}>Contanti</option></select></label><label class="full">Descrizione<input name="note" maxlength="100" value="${esc(item.note||'')}" placeholder="Es. turno mattina"></label>`,
    expense:item=>`<label>Data<input name="date" type="date" required value="${item.date||today}"></label><label>Importo (€)<input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${item.amount||''}"></label><label>Categoria<select name="category">${['Carburante','Canone','Manutenzione','Gomme','Assicurazione','Lavaggio','Pedaggi','Altro'].map(x=>`<option ${item.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Stato<select name="status"><option value="paid" ${item.status!=='planned'?'selected':''}>Pagata</option><option value="planned" ${item.status==='planned'?'selected':''}>Pianificata</option></select></label><label>Metodo<select name="method"><option value="card" ${item.method==='card'?'selected':''}>Carta</option><option value="cash" ${item.method==='cash'?'selected':''}>Contanti</option></select></label><label class="full">Nota<input name="note" maxlength="100" value="${esc(item.note||'')}" placeholder="Dettaglio facoltativo"></label>`,
    holiday:item=>`<label>Dal<input name="start" type="date" required value="${item.start||today}"></label><label>Al<input name="end" type="date" required value="${item.end||today}"></label><label class="full">Nome periodo<input name="name" required maxlength="80" value="${esc(item.name||'Ferie')}" placeholder="Es. Ferie estive"></label><label class="full">Nota<input name="note" maxlength="120" value="${esc(item.note||'')}" placeholder="Facoltativa"></label>`
  };
  function openEntry(type,id='') {
    const list=type==='revenue'?state.revenues:type==='expense'?state.expenses:state.holidays;
    const item=id?list.find(x=>x.id===id)||{}:{};
    $('#entryType').value=type; $('#entryId').value=id; $('#entryFields').innerHTML=fieldTemplates[type](item);
    $('#modalKicker').textContent=type==='holiday'?'CALENDARIO':'MOVIMENTO';
    const names={revenue:'incasso',expense:'spesa',holiday:'periodo di ferie'};
    const newLabels={revenue:'Nuovo incasso',expense:'Nuova spesa',holiday:'Nuovo periodo di ferie'};
    $('#modalTitle').textContent=id?`Modifica ${names[type]}`:newLabels[type];
    $('#deleteEntry').classList.toggle('hidden',!id); $('#entryDialog').showModal();
  }
  $('#quickRevenue').addEventListener('click',()=>openEntry('revenue')); $('#quickExpense').addEventListener('click',()=>openEntry('expense')); $('#mobileQuick').addEventListener('click',()=>openEntry('revenue')); $('#addHoliday').addEventListener('click',()=>openEntry('holiday'));
  $('#closeModal').addEventListener('click',()=>$('#entryDialog').close()); $('#cancelModal').addEventListener('click',()=>$('#entryDialog').close());
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-edit]'); if(btn) openEntry(btn.dataset.edit,btn.dataset.id);});
  $('#entryForm').addEventListener('submit',e=>{
    e.preventDefault(); const type=$('#entryType').value,id=$('#entryId').value; const fd=Object.fromEntries(new FormData(e.currentTarget));
    if(type==='holiday'&&fd.end<fd.start) return toast('La data finale deve essere successiva a quella iniziale.');
    const list=type==='revenue'?state.revenues:type==='expense'?state.expenses:state.holidays;
    const obj={id:id||uuid(),...fd}; if(fd.amount)obj.amount=Number(fd.amount);
    const index=list.findIndex(x=>x.id===id); if(index>=0)list[index]=obj; else list.push(obj);
    save(); populateReportYears(); renderAll(); $('#entryDialog').close(); toast(id?'Modifica salvata.':'Elemento aggiunto.');
  });
  $('#deleteEntry').addEventListener('click',()=>{
    const type=$('#entryType').value,id=$('#entryId').value; if(!confirm('Eliminare definitivamente questo elemento?'))return;
    const key=type==='revenue'?'revenues':type==='expense'?'expenses':'holidays'; state[key]=state[key].filter(x=>x.id!==id); save(); renderAll(); $('#entryDialog').close(); toast('Elemento eliminato.');
  });

  function renderAll() { setupDashboardPicker(); renderDashboard(); renderRevenues(); renderExpenses(); renderHolidays(); renderReport(); settingsToForm(); }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
  if (userEmail && store.accounts[userEmail]) enterApp(); else showAuth();
})();
