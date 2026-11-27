(() => {
  'use strict';

  const STORAGE_KEY = 'taxiLedger.accounts.v2';
  const SESSION_KEY = 'taxiLedger.session.v2';
  const APP_VERSION = '2.7.0';
  const shiftRules = window.TAXI_SHIFT_RULES;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = localISO();
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);
  const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const revenueShiftOptions = ['Mattina 1','Mattina 2','Intermedio','Pomeriggio 1','Pomeriggio 2','Seminotte','Notte','Mattina fissa','Pomeriggio fissa','Turno rosa','Turno spezzato','Mattina','Pomeriggio','Altro'];
  const revenueMethods = {
    card:{label:'Carta',fee:0,cardLike:true}, cash:{label:'Contanti',fee:0,cardLike:false},
    uber:{label:'Uber',fee:7,cardLike:true}, freenow:{label:'FreeNow',fee:10,cardLike:true}, ittaxi:{label:'ITTaxi',fee:0,cardLike:true}
  };
  const revenueMethod = method => revenueMethods[method] || revenueMethods.cash;
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
  let selectedSecondDriverYear = currentYear;
  let shiftCalendarMonth = currentMonth;
  let holidayCalendarMonth = currentMonth;
  let recentMovementFilter = 'all';

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {accounts:{}}; }
    catch { return {accounts:{}}; }
  }
  function persistStore() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
  function defaultData(name = '') {
    return {
      version: APP_VERSION,
      revenues: [], expenses: [], holidays: [],
      settings: {name, business:'', currency:'EUR', license:'', licenseType:'ordinary', shiftMode:'official', secondDriver:false, secondDriverAmount:0, secondDriverCashAmount:0, secondDriverAssignments:{}, startYear:Number(currentYear), taxRateFirst:5, taxRateAfter:10, profitability:67, inpsRate:24, inpsFixed:0, cardOnly:true}
    };
  }
  function normalizeRevenue(item) {
    const r={...item};
    if(r.shift) return r;
    const legacy=String(r.note||'').trim(), legacyMap={'Turno mattina':'Mattina','Turno pomeriggio':'Pomeriggio'};
    if(legacyMap[legacy]) return {...r,shift:legacyMap[legacy],note:''};
    if(revenueShiftOptions.includes(legacy)) return {...r,shift:legacy,note:''};
    return {...r,shift:'',note:legacy};
  }
  function normalizeData(data, name = '') {
    const base = defaultData(name);
    const incomingSettings=data?.settings||{};
    const assignments=incomingSettings.secondDriverAssignments && typeof incomingSettings.secondDriverAssignments==='object' && !Array.isArray(incomingSettings.secondDriverAssignments) ? incomingSettings.secondDriverAssignments : {};
    return {
      ...base, ...data,
      revenues: Array.isArray(data?.revenues) ? data.revenues.map(normalizeRevenue) : [],
      expenses: Array.isArray(data?.expenses) ? data.expenses : [],
      holidays: Array.isArray(data?.holidays) ? data.holidays : [],
      settings: {...base.settings, ...incomingSettings, secondDriverAssignments:assignments, name: incomingSettings.name || name || base.settings.name}
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
  function syncMandatoryHolidays() {
    if (!state || !shiftRules) return;
    const personal = state.holidays.filter(h => h.source !== 'QG/2926/2025');
    const automatic = shiftRules.mandatoryRestPeriods(state.settings.license, state.settings.licenseType).map(h => ({
      id:`system-${h.key}`, ...h, source:'QG/2926/2025', locked:true
    }));
    state.holidays = [...personal, ...automatic];
  }
  function shiftForDate(dateISO) {
    if (!shiftRules || !state) return null;
    return shiftRules.getShift(dateISO, state.settings.license, state.settings.shiftMode);
  }
  function suggestedRevenueShift(dateISO) {
    const shift=shiftForDate(dateISO);
    return shift ? shift.name : '';
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
    syncMandatoryHolidays();
    save();
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
    holidays:['CALENDARIO','Ferie'], shifts:['PROGRAMMAZIONE','Turni'], report:['PIANIFICAZIONE','Consuntivo'], settings:['PROFILO','Impostazioni']
  };
  function navigate(view) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#pageKicker').textContent = viewInfo[view][0]; $('#pageTitle').textContent = viewInfo[view][1];
    window.scrollTo({top:0, behavior:'smooth'});
    if (view === 'report') renderReport();
    if (view === 'shifts') renderShifts();
    $('.sidebar').classList.remove('open');
  }
  $$('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  $$('[data-view-link]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.viewLink)));
  $('#menuBtn').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));

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
    const uber = revenues.filter(r => r.method === 'uber').reduce((s,r) => s + Number(r.amount), 0);
    const freenow = revenues.filter(r => r.method === 'freenow').reduce((s,r) => s + Number(r.amount), 0);
    const ittaxi = revenues.filter(r => r.method === 'ittaxi').reduce((s,r) => s + Number(r.amount), 0);
    const cardLike = card + uber + freenow + ittaxi;
    const platformFees = uber*.07 + freenow*.10;
    const expenseTotal = expenses.reduce((s,r) => s + Number(r.amount), 0);
    const revenueTotal = cash + cardLike;
    const netRevenue = revenueTotal-platformFees;
    const margin = netRevenue - expenseTotal;
    return {revenues, expenses, cash, card, uber, freenow, ittaxi, cardLike, platformFees, revenueTotal, netRevenue, expenseTotal, margin};
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
    const totalDays=countWorkingDays(start,end);
    if (start > today) return {revenue:0,currentRevenue:0,averageRevenue:0,remainingRevenue:0,revenueDays:0,totalDays,remaining:totalDays,status:'future'};
    const cutoff=today<end?today:end;
    const actualRevenues=data.revenues.filter(r=>r.date>=start&&r.date<=cutoff);
    const currentRevenue=actualRevenues.reduce((sum,r)=>sum+Number(r.amount),0);
    const revenueDays=new Set(actualRevenues.map(r=>r.date)).size;
    const averageRevenue=revenueDays?currentRevenue/revenueDays:0;
    if (end < today) return {revenue:currentRevenue,currentRevenue,averageRevenue,remainingRevenue:0,revenueDays,totalDays,remaining:0,status:'closed'};
    const tomorrowDate=parseDate(today); tomorrowDate.setDate(tomorrowDate.getDate()+1);
    const tomorrow=localISO(tomorrowDate);
    const remaining=tomorrow<=end?countWorkingDays(tomorrow,end):0;
    const remainingRevenue=averageRevenue*remaining;
    return {revenue:currentRevenue+remainingRevenue,currentRevenue,averageRevenue,remainingRevenue,revenueDays,totalDays,remaining,status:'live'};
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
    const secondDriver = dashPeriod==='day' ? {count:0,income:0} : secondDriverForReport(dashPeriod==='month'?{type:'month',value}:{type:'year',value:String(value)});
    const cardShare = d.revenueTotal ? d.cardLike/d.revenueTotal*100 : 0, cashShare = d.revenueTotal ? d.cash/d.revenueTotal*100 : 0;
    const marginShare = d.revenueTotal ? d.margin/d.revenueTotal*100 : 0;
    let cards = kpi('↗','INCASSI',money(d.revenueTotal),`${d.revenues.length} movimenti`,'accent');
    cards += kpi('▣','TRACCIATI',money(d.cardLike),`${pct(cardShare)} · carta e piattaforme`);
    cards += kpi('●','CONTANTI',money(d.cash),`${pct(cashShare)} degli incassi`);
    cards += kpi('◇','MARGINE',money(d.margin),`${pct(marginShare)} dopo costi e fee`);
    if (dashPeriod!=='day') cards += kpi('♙','INTROITO SECONDA GUIDA',money(secondDriver.income),secondDriver.count?`${secondDriver.count} ${secondDriver.count===1?'mese':'mesi'} · imponibile ${money(secondDriver.taxableIncome)} · contanti ${money(secondDriver.cashIncome)}`:(state.settings.secondDriver?'Nessun mese assegnato':'Seconda guida non attiva'));
    if (p) cards += kpi('⌁','PROIEZIONE TOTALE INCASSI',money(p.revenue),p.status==='live'?`Media ${money(p.averageRevenue)} × ${p.remaining} ${p.remaining===1?'giorno restante':'giorni restanti'}`:p.status==='closed'?`${p.revenueDays} ${p.revenueDays===1?'giorno':'giorni'} di incasso nel periodo`:'In attesa dei primi incassi');
    $('#dashboardKpis').innerHTML = cards;
    const proj = $('#projectionNote');
    if (!p) proj.innerHTML = '<strong>Vista giornaliera.</strong> Seleziona una data per consultare o correggere lo storico.';
    else if (p.status === 'live' && p.revenueDays) proj.innerHTML = `<strong>Proiezione totale incassi ${money(p.revenue)}:</strong> ${money(p.currentRevenue)} incassati ÷ ${p.revenueDays} ${p.revenueDays===1?'giorno':'giorni'} di incasso = ${money(p.averageRevenue)} medi al giorno; ${money(p.averageRevenue)} × ${p.remaining} ${p.remaining===1?'giorno lavorativo restante':'giorni lavorativi restanti'} = ${money(p.remainingRevenue)} previsti. Weekend e ferie sono esclusi.`;
    else if (p.status === 'live') proj.innerHTML = `<strong>Proiezione totale incassi non disponibile:</strong> non risultano ancora giorni con incassi nel periodo selezionato. Giorni lavorativi restanti: ${p.remaining}.`;
    else if (p.status === 'closed') proj.innerHTML = `<strong>Totale definitivo ${money(p.revenue)}:</strong> ${p.revenueDays} ${p.revenueDays===1?'giorno distinto':'giorni distinti'} con incassi nel periodo concluso.`;
    else proj.innerHTML = `<strong>Periodo futuro:</strong> totale non ancora disponibile; sono previsti ${p.totalDays} giorni lavorativi al netto delle ferie.`;
    $('#revenueTotalBadge').textContent = money(d.revenueTotal);
    const revenueTypes=[['Carta',d.card,0],['Contanti',d.cash,0],['Uber',d.uber,7],['FreeNow',d.freenow,10],['ITTaxi',d.ittaxi,0]].filter(x=>x[1]>0);
    const revenueTypeRows=revenueTypes.map(([label,amount,fee],index)=>{const share=d.revenueTotal?amount/d.revenueTotal*100:0;return `<div class="type-row"><i class="type-dot type-color-${index%8}"></i><span>${label}${fee?` <small>fee ${fee}%</small>`:''}</span><div class="type-track"><i class="type-fill type-color-${index%8}" style="width:${share}%"></i></div><strong>${pct(share)}</strong><b>${money(amount)}</b></div>`;}).join('');
    const expenseTypes=new Map(); d.expenses.forEach(x=>expenseTypes.set(x.category||'Altro',(expenseTypes.get(x.category||'Altro')||0)+Number(x.amount)));
    const expenseRows=[...expenseTypes.entries()].sort((a,b)=>b[1]-a[1]).map(([label,amount],index)=>{const share=d.expenseTotal?amount/d.expenseTotal*100:0;return `<div class="type-row"><i class="type-dot expense-color-${index%6}"></i><span>${esc(label)}</span><div class="type-track"><i class="type-fill expense-color-${index%6}" style="width:${share}%"></i></div><strong>${pct(share)}</strong><b>${money(amount)}</b></div>`;}).join('');
    $('#revenueMix').innerHTML = `<div class="mix-section"><span class="mix-section-title">Tipologie di incasso</span>${revenueTypeRows||'<div class="mix-empty">Nessun incasso nel periodo selezionato.</div>'}${d.platformFees?`<div class="fee-summary"><span>Fee piattaforme</span><strong>− ${money(d.platformFees)}</strong></div>`:''}</div><div class="mix-section shift-type-mix"><span class="mix-section-title">Tipologie di spesa</span>${expenseRows||'<div class="mix-empty">Nessuna spesa pagata nel periodo selezionato.</div>'}</div>`;
    let movements = [...d.revenues.map(x=>({...x,kind:'revenue'})), ...d.expenses.map(x=>({...x,kind:'expense'}))].sort((a,b)=>b.date.localeCompare(a.date));
    if(recentMovementFilter!=='all') movements=movements.filter(x=>x.kind===recentMovementFilter);
    movements=movements.slice(0,6);
    $('#recentMovementFilter').value=recentMovementFilter;
    $('#recentMovements').innerHTML = movements.length ? movements.map(x=>`<div class="movement ${x.kind}"><span class="movement-icon">${x.kind==='revenue'?'↗':'↘'}</span><div class="movement-main"><strong>${esc(x.kind==='revenue'?(x.shift||'Incasso'):(x.note||x.category||'Spesa'))}</strong><span>${dateLabel(x.date)} · ${x.kind==='revenue'?revenueMethod(x.method).label:(x.method==='card'?'Carta':'Contanti')}${x.kind==='revenue'&&x.note?` · ${esc(x.note)}`:''}</span></div><span class="movement-amount">${x.kind==='expense'?'−':'+'}${money(x.amount)}</span></div>`).join('') : `<div class="empty"><strong>Nessun movimento</strong>Non ci sono dati per il filtro selezionato.</div>`;
  }
  $('#recentMovementFilter').addEventListener('change',e=>{recentMovementFilter=e.target.value;renderDashboard();});

  function summaryCards(total, card, cash, noun='incassi') {
    const cp = total ? card/total*100 : 0, hp = total ? cash/total*100 : 0;
    return `<div class="mini-card"><span>Totale ${noun}</span><strong>${money(total)}</strong><small>${noun==='spese'?'sostenute nel periodo':'complessivi'}</small></div><div class="mini-card"><span>Carta</span><strong>${money(card)}</strong><small>${pct(cp)} del totale</small></div><div class="mini-card"><span>Contanti</span><strong>${money(cash)}</strong><small>${pct(hp)} del totale</small></div>`;
  }
  function renderRevenues() {
    const dateFilter=$('#revenueDayFilter'); if(!dateFilter.value)dateFilter.value=today;
    const q = $('#revenueSearch').value.trim().toLowerCase(), day = dateFilter.value;
    const rows = state.revenues.filter(r => r.date===day && (!q || `${r.shift} ${r.note} ${revenueMethod(r.method).label} ${r.amount}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
    const cash = rows.filter(r=>r.method==='cash').reduce((s,r)=>s+Number(r.amount),0), traced = rows.filter(r=>revenueMethod(r.method).cardLike).reduce((s,r)=>s+Number(r.amount),0);
    const fees=rows.reduce((s,r)=>s+Number(r.amount)*revenueMethod(r.method).fee/100,0);
    $('#revenueSummary').innerHTML = summaryCards(traced+cash,traced,cash).replace('Carta</span>','Tracciati</span>')+(fees?`<div class="mini-card fee-card"><span>Fee piattaforme</span><strong>− ${money(fees)}</strong><small>Uber 7% · FreeNow 10%</small></div>`:'');
    $('#revenueTable').innerHTML = rows.map(r=>{const method=revenueMethod(r.method),fee=Number(r.amount)*method.fee/100;return `<tr><td><button class="edit-btn" data-edit="revenue" data-id="${r.id}" aria-label="Modifica incasso">✎</button></td><td>${dateLabel(r.date)}</td><td><strong>${esc(r.shift || 'Non indicato')}</strong></td><td>${esc(r.note || '—')}</td><td><span class="method ${r.method}">${method.label}</span>${fee?`<br><small class="fee-note">Fee − ${money(fee)}</small>`:''}</td><td class="num"><strong>${money(r.amount)}</strong>${fee?`<br><small class="fee-note">Netto ${money(Number(r.amount)-fee)}</small>`:''}</td></tr>`;}).join('');
    $('#revenueEmpty').classList.toggle('hidden', rows.length>0); $('#revenueEmpty').innerHTML=`<strong>Nessun incasso il ${dateLabel(day)}</strong>Seleziona un altro giorno o aggiungi il primo movimento.`;
  }
  function renderExpenses() {
    const dateFilter=$('#expenseDayFilter'); if(!dateFilter.value)dateFilter.value=today;
    const q = $('#expenseSearch').value.trim().toLowerCase(), day = dateFilter.value;
    const rows = state.expenses.filter(r => r.date===day && (!q || `${r.note} ${r.category} ${r.amount}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
    const card = rows.filter(r=>r.method==='card').reduce((s,r)=>s+Number(r.amount),0), cash = rows.filter(r=>r.method==='cash').reduce((s,r)=>s+Number(r.amount),0);
    $('#expenseSummary').innerHTML = summaryCards(card+cash,card,cash,'spese');
    $('#expenseTable').innerHTML = rows.map(r=>`<tr><td><button class="edit-btn" data-edit="expense" data-id="${r.id}" aria-label="Modifica spesa">✎</button></td><td>${dateLabel(r.date)}</td><td><strong>${esc(r.category)}</strong><br><small class="muted">${esc(r.note||'')}</small></td><td><span class="state ${r.status}">${r.status==='planned'?'Pianificata':'Pagata'}</span></td><td><span class="method ${r.method}">${r.method==='card'?'Carta':'Contanti'}</span></td><td class="num"><strong>${money(r.amount)}</strong></td></tr>`).join('');
    $('#expenseEmpty').classList.toggle('hidden', rows.length>0); $('#expenseEmpty').innerHTML=`<strong>Nessuna spesa il ${dateLabel(day)}</strong>Seleziona un altro giorno o aggiungi il primo costo.`;
  }
  ['revenueSearch','revenueDayFilter'].forEach(id=>$('#'+id).addEventListener('input',renderRevenues));
  ['expenseSearch','expenseDayFilter'].forEach(id=>$('#'+id).addEventListener('input',renderExpenses));

  function shiftDateLabel(start,end) {
    const a=parseDate(start), b=parseDate(end);
    return `${a.toLocaleDateString('it-IT',{day:'2-digit',month:'short'})} - ${b.toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})}`;
  }
  function holidaysForDate(dateISO) {
    return state.holidays.filter(h=>h.start<=dateISO&&h.end>=dateISO);
  }
  function renderShiftCalendar() {
    const [year,month]=shiftCalendarMonth.split('-').map(Number), first=new Date(year,month-1,1,12), days=new Date(year,month,0,12).getDate();
    const offset=(first.getDay()+6)%7, total=42, cells=[];
    $('#shiftCalendarMonth').value=shiftCalendarMonth;
    const title=monthLabel(shiftCalendarMonth); $('#shiftCalendarTitle').textContent=title.charAt(0).toUpperCase()+title.slice(1);
    for(let index=0;index<total;index++) {
      const day=index-offset+1;
      if(day<1||day>days) { cells.push('<div class="calendar-day outside" aria-hidden="true"></div>'); continue; }
      const dateISO=`${year}-${pad(month)}-${pad(day)}`, holidays=holidaysForDate(dateISO), shift=shiftForDate(dateISO);
      const mandatory=holidays.some(h=>h.locked), personal=holidays.some(h=>!h.locked), classes=['calendar-day'];
      if(dateISO===today) classes.push('today'); if(mandatory) classes.push('has-mandatory'); if(personal) classes.push('has-personal');
      const holidayChips=holidays.slice(0,2).map(h=>`<span class="calendar-event ${h.locked?'mandatory':'personal'}" title="${esc(h.name)}">${h.locked?'Riposo imposto':esc(h.name)}</span>`).join('');
      const extra=holidays.length>2?`<span class="calendar-more">+${holidays.length-2}</span>`:'';
      const shiftChip=shift?`<span class="calendar-shift" title="${esc(shift.name)} · ${esc(shift.hours)}">${shift.turn?`T${shift.turn} · `:''}${esc(shift.name)}</span>`:'';
      cells.push(`<button class="${classes.join(' ')}" type="button" data-calendar-date="${dateISO}" aria-label="${dateLabel(dateISO)}${holidays.length?`, ${holidays.map(h=>h.name).join(', ')}`:''}"><span class="calendar-day-number">${day}</span><div class="calendar-events">${holidayChips}${extra}${shiftChip}</div></button>`);
    }
    $('#shiftCalendarGrid').innerHTML=cells.join('');
  }
  function moveShiftCalendar(delta) {
    const [year,month]=shiftCalendarMonth.split('-').map(Number), date=new Date(year,month-1+delta,1,12);
    shiftCalendarMonth=`${date.getFullYear()}-${pad(date.getMonth()+1)}`; renderShiftCalendar();
  }
  $('#calendarPrev').addEventListener('click',()=>moveShiftCalendar(-1));
  $('#calendarNext').addEventListener('click',()=>moveShiftCalendar(1));
  $('#shiftCalendarMonth').addEventListener('change',e=>{if(e.target.value){shiftCalendarMonth=e.target.value;renderShiftCalendar();}});
  $('#shiftCalendarGrid').addEventListener('click',e=>{
    const cell=e.target.closest('[data-calendar-date]'); if(!cell)return;
    const date=cell.dataset.calendarDate;
    if(date>=shiftRules.SCHEDULE_START&&date<=shiftRules.SCHEDULE_END){$('#shiftDate').value=date;renderShifts();$('#shiftCurrent').scrollIntoView({behavior:'smooth',block:'center'});}
  });
  function renderShifts() {
    const s=state.settings;
    $('.shift-table-card').classList.toggle('bypass',s.shiftMode!=='official');
    renderShiftCalendar();
    $('#shiftLicenseInput').value=s.license||'';
    $('#shiftLicenseType').value=s.licenseType||'ordinary';
    const dateInput=$('#shiftDate');
    if(!dateInput.value) dateInput.value=today<shiftRules.SCHEDULE_START?shiftRules.SCHEDULE_START:today>shiftRules.SCHEDULE_END?shiftRules.SCHEDULE_END:today;
    const selected=dateInput.value;
    const shift=shiftRules.getShift(selected,s.license,s.shiftMode);
    if(!s.license) {
      $('#shiftCurrent').innerHTML='<div class="empty card"><strong>Inserisci il numero di licenza</strong>Salvalo qui o nelle Impostazioni per calcolare gruppo, turno e riposi obbligatori.</div>';
      $('#shiftGroupBadge').textContent='Licenza non impostata'; $('#shiftSchedule').innerHTML=''; return;
    }
    if(!shift) {
      $('#shiftCurrent').innerHTML=`<div class="empty card"><strong>Nessun turno calcolabile</strong>La data deve essere compresa tra ${dateLabel(shiftRules.SCHEDULE_START)} e ${dateLabel(shiftRules.SCHEDULE_END)}.</div>`;
      $('#shiftGroupBadge').textContent=`Licenza ${s.license}`; $('#shiftSchedule').innerHTML=''; return;
    }
    const turnText=shift.turn?`T${shift.turn} · ${shift.name}`:shift.name;
    $('#shiftCurrent').innerHTML=`<article class="shift-hero-card"><div><p class="eyebrow">TURNO DEL ${dateLabel(selected).toUpperCase()}</p><h3>${esc(turnText)}</h3><p>${shift.mode==='official'?`Gruppo ${pad(shift.group)} · settimana ${dateLabel(shift.weekStart)} - ${dateLabel(shift.weekEnd)}`:'Bypass della turnazione ufficiale attivo'}</p></div><aside><span>Fascia turno</span><strong>${esc(shift.broad)}</strong><small>${esc(shift.hours)}</small></aside></article>`;
    $('#shiftGroupBadge').textContent=`Licenza ${s.license} · Gruppo ${pad(shift.group)}`;
    if(s.shiftMode!=='official') {
      $('#shiftSchedule').innerHTML=`<tr><td colspan="5"><div class="empty"><strong>Turnazione bypassata</strong>Le note dei nuovi incassi saranno proposte come “Turno ${shift.broad.toLowerCase()}”.</div></td></tr>`; return;
    }
    const selectedWeek=shiftRules.saturdayFor(selected), selectedOffset=Math.round((parseDate(selected)-parseDate(selectedWeek))/86400000);
    const rows=[];
    for(let i=-1;i<=5;i++) {
      const weekStart=shiftRules.addDays(selectedWeek,i*7), rowDate=shiftRules.addDays(weekStart,selectedOffset);
      if(rowDate<shiftRules.SCHEDULE_START||rowDate>shiftRules.SCHEDULE_END) continue;
      const item=shiftRules.getShift(rowDate,s.license,'official');
      rows.push(`<tr class="${i===0?'current-week':''}"><td>${shiftDateLabel(item.weekStart,item.weekEnd)}</td><td>${pad(item.group)}</td><td><strong>T${item.turn}</strong> · ${esc(item.name)}</td><td><span class="shift-band ${item.broad.toLowerCase()}">${esc(item.broad)}</span></td><td>${esc(item.hours)}</td></tr>`);
    }
    $('#shiftSchedule').innerHTML=rows.join('');
  }
  $('#shiftDate').addEventListener('change',renderShifts);
  $('#saveShiftLicense').addEventListener('click',()=>{
    const license=Number.parseInt($('#shiftLicenseInput').value,10);
    if(!license||license<1) return toast('Inserisci un numero di licenza valido.');
    state.settings.license=license; state.settings.licenseType=$('#shiftLicenseType').value;
    syncMandatoryHolidays(); save(); renderAll(); toast('Licenza e riposi obbligatori aggiornati.');
  });

  function renderHolidays() {
    const rows = [...state.holidays].sort((a,b)=>a.start.localeCompare(b.start));
    const yearRows = rows.filter(h=>h.end>=`${currentYear}-01-01`&&h.start<=`${currentYear}-12-31`);
    const plannedDays=holidaySet(`${currentYear}-01-01`,`${currentYear}-12-31`);
    const netDays=[...plannedDays].filter(x=>{const d=parseDate(x).getDay(); return d!==0&&d!==6;}).length;
    const imposed=yearRows.filter(h=>h.locked).length;
    const next = rows.find(h=>h.end>=today);
    $('#holidaySummary').innerHTML = `<div class="mini-card featured"><span>Totale giorni pianificati ${currentYear}</span><strong>${plannedDays.size}</strong><small>giorni unici, inclusi i riposi imposti</small></div><div class="mini-card"><span>Giorni feriali esclusi</span><strong>${netDays}</strong><small>non usati nelle proiezioni</small></div><div class="mini-card"><span>Riposi imposti</span><strong>${imposed}</strong><small>periodi da QG/2926/2025</small></div><div class="mini-card"><span>Prossimo periodo</span><strong>${next?dateLabel(next.start):'—'}</strong><small>${next?esc(next.name):'Nessuna ferie programmata'}</small></div>`;
    $('#holidayList').innerHTML = rows.map(h=>`<div class="holiday-item ${h.locked?'mandatory':''}"><span class="holiday-icon">${h.locked?'◆':'☀'}</span><div><h4>${esc(h.name)} ${h.locked?'<span class="mandatory-badge">Imposta</span>':''}</h4><p>${dateLabel(h.start)} → ${dateLabel(h.end)}${h.note?` · ${esc(h.note)}`:''}</p></div><span class="days-badge">${daysInclusive(h.start,h.end)} giorni</span>${h.locked?'<span class="lock-mark" title="Periodo automatico">🔒</span>':`<button class="edit-btn" data-edit="holiday" data-id="${h.id}" aria-label="Modifica ferie">✎</button>`}</div>`).join('');
    $('#holidayEmpty').classList.toggle('hidden', rows.length>0); $('#holidayEmpty').innerHTML='<strong>Nessun periodo di ferie</strong>Aggiungilo per rendere più accurate le proiezioni.';
    renderHolidayCalendar();
  }

  function renderHolidayCalendar() {
    const [year,month]=holidayCalendarMonth.split('-').map(Number), first=new Date(year,month-1,1,12), days=new Date(year,month,0,12).getDate();
    const offset=(first.getDay()+6)%7, cells=[];
    $('#holidayCalendarMonth').value=holidayCalendarMonth;
    const title=monthLabel(holidayCalendarMonth); $('#holidayCalendarTitle').textContent=title.charAt(0).toUpperCase()+title.slice(1);
    for(let index=0;index<42;index++) {
      const day=index-offset+1;
      if(day<1||day>days){cells.push('<div class="calendar-day outside" aria-hidden="true"></div>');continue;}
      const dateISO=`${year}-${pad(month)}-${pad(day)}`, holidays=holidaysForDate(dateISO), mandatory=holidays.some(h=>h.locked), personal=holidays.some(h=>!h.locked);
      const classes=['calendar-day']; if(dateISO===today)classes.push('today'); if(mandatory)classes.push('has-mandatory'); if(personal)classes.push('has-personal');
      const events=holidays.slice(0,3).map(h=>`<span class="calendar-event ${h.locked?'mandatory':'personal'}" title="${esc(h.name)}">${h.locked?'Riposo imposto':esc(h.name)}</span>`).join('');
      const extra=holidays.length>3?`<span class="calendar-more">+${holidays.length-3}</span>`:'';
      cells.push(`<button class="${classes.join(' ')}" type="button" data-holiday-date="${dateISO}" aria-label="${dateLabel(dateISO)}${holidays.length?`, ${holidays.map(h=>h.name).join(', ')}`:''}"><span class="calendar-day-number">${day}</span><div class="calendar-events">${events}${extra}</div></button>`);
    }
    $('#holidayCalendarGrid').innerHTML=cells.join('');
  }
  function moveHolidayCalendar(delta) {
    const [year,month]=holidayCalendarMonth.split('-').map(Number), date=new Date(year,month-1+delta,1,12);
    holidayCalendarMonth=`${date.getFullYear()}-${pad(date.getMonth()+1)}`; renderHolidayCalendar();
  }
  $('#holidayCalendarPrev').addEventListener('click',()=>moveHolidayCalendar(-1));
  $('#holidayCalendarNext').addEventListener('click',()=>moveHolidayCalendar(1));
  $('#holidayCalendarMonth').addEventListener('change',e=>{if(e.target.value){holidayCalendarMonth=e.target.value;renderHolidayCalendar();}});
  $('#holidayCalendarGrid').addEventListener('click',e=>{
    const cell=e.target.closest('[data-holiday-date]'); if(!cell)return;
    const date=cell.dataset.holidayDate, personal=holidaysForDate(date).find(h=>!h.locked);
    if(personal) return openEntry('holiday',personal.id);
    openEntry('holiday');
    $('#entryFields [name="start"]').value=date; $('#entryFields [name="end"]').value=date;
  });

  function reportFilter() {
    const year=$('#reportYear').value||currentYear, month=$('#reportMonth').value;
    return month==='all' ? {type:'year',value:year,label:year,months:12} : {type:'month',value:`${year}-${month}`,label:monthLabel(`${year}-${month}`),months:1};
  }
  function assignedSecondDriverMonths(year) {
    const raw=state.settings.secondDriverAssignments?.[String(year)];
    if(!Array.isArray(raw)) return [];
    return [...new Set(raw.map(x=>String(x).padStart(2,'0')).filter(x=>/^(0[1-9]|1[0-2])$/.test(x)))].sort();
  }
  function secondDriverForReport(filter) {
    const year=String(filter.value).slice(0,4), assigned=assignedSecondDriverMonths(year);
    const included=filter.type==='year'?assigned:assigned.filter(month=>month===filter.value.slice(5,7));
    const active=!!state.settings.secondDriver;
    const count=active?included.length:0, taxableIncome=count*Number(state.settings.secondDriverAmount||0), cashIncome=count*Number(state.settings.secondDriverCashAmount||0);
    return {year,assigned,included,count,taxableIncome,cashIncome,income:taxableIncome+cashIncome};
  }
  function populateReportYears() {
    const years = new Set([currentYear]);
    state.revenues.forEach(x=>years.add(x.date.slice(0,4))); state.expenses.forEach(x=>years.add(x.date.slice(0,4)));
    Object.keys(state.settings.secondDriverAssignments||{}).forEach(y=>years.add(String(y)));
    for(let y=Number(currentYear)-3;y<=Number(currentYear);y++) years.add(String(y));
    const current=$('#reportYear').value||currentYear;
    $('#reportYear').innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option ${y===current?'selected':''}>${y}</option>`).join('');
  }
  function renderReport() {
    const f=reportFilter(), d=totals(f.type,f.value), s=state.settings;
    const reportYear=Number(f.value.slice(0,4)), activityYear=Math.max(1,reportYear-Number(s.startYear||reportYear)+1);
    const effectiveTaxRate=activityYear<=5?Number(s.taxRateFirst??s.taxRate??5):Number(s.taxRateAfter??10);
    const secondDriver=secondDriverForReport(f), secondDriverIncome=secondDriver.income;
    const totalIncome=d.netRevenue+secondDriverIncome;
    const grossBase = (s.cardOnly ? d.cardLike : d.revenueTotal) + secondDriver.taxableIncome;
    const taxableBase = grossBase * Number(s.profitability)/100;
    const variableInps = taxableBase * Number(s.inpsRate)/100;
    const fixedInps = Number(s.inpsFixed||0) * f.months/12;
    const inps = variableInps + fixedInps;
    const afterInps = Math.max(0,taxableBase-inps);
    const tax = afterInps * effectiveTaxRate/100;
    const reserve = inps+tax;
    const net = totalIncome-d.expenseTotal-reserve;
    $('#reportHero').innerHTML=`<div><p class="eyebrow">ACCANTONAMENTO STIMATO · ${esc(f.label).toUpperCase()}</p><h3>${money(reserve)}</h3><p>INPS e imposta sostitutiva calcolati sulla sola base imponibile. Disponibile stimato dopo fee, costi e accantonamento: <strong>${money(net)}</strong>.</p></div><aside><div><span>Incassi taxi lordi</span><strong>${money(d.revenueTotal)}</strong></div>${d.platformFees?`<div><span>Fee piattaforme</span><strong>− ${money(d.platformFees)}</strong></div>`:''}${s.secondDriver?`<div><span>Seconda guida imponibile</span><strong>+ ${money(secondDriver.taxableIncome)}</strong></div><div><span>Seconda guida contanti</span><strong>+ ${money(secondDriver.cashIncome)}</strong></div>`:''}<div><span>Spese pagate</span><strong>− ${money(d.expenseTotal)}</strong></div><div><span>Accantonamento</span><strong>− ${money(reserve)}</strong></div></aside>`;
    const assignmentText=!s.secondDriver?'Non attiva nelle impostazioni':secondDriver.count?`${secondDriver.count} ${secondDriver.count===1?'mese assegnato':'mesi assegnati'}`:f.type==='month'?'Mese non assegnato':'Nessun mese assegnato nell’anno';
    $('#reportBreakdown').innerHTML=`<div class="report-card"><span>Ricavi tracciati</span><strong>${money(d.cardLike)}</strong><small>Carta, Uber, FreeNow e ITTaxi · inclusi nella base</small></div><div class="report-card"><span>Ricavi contanti</span><strong>${money(d.cash)}</strong><small>${s.cardOnly?'Esclusi':'Inclusi'} dalla base</small></div><div class="report-card"><span>Fee piattaforme</span><strong>− ${money(d.platformFees)}</strong><small>Uber 7% · FreeNow 10%</small></div><div class="report-card"><span>Seconda guida imponibile</span><strong>${money(secondDriver.taxableIncome)}</strong><small>${assignmentText}${secondDriver.count?' · incluso nella base':''}</small></div><div class="report-card"><span>Seconda guida contanti</span><strong>${money(secondDriver.cashIncome)}</strong><small>${assignmentText} · sempre escluso dalla base</small></div><div class="report-card"><span>Costo INPS</span><strong>${money(inps)}</strong><small>${pct(s.inpsRate)} sulla base + quota fissa</small></div><div class="report-card"><span>Imposta sostitutiva</span><strong>${money(tax)}</strong><small>${pct(effectiveTaxRate)} · anno ${activityYear} di attività</small></div>`;
    $('#formulaSteps').innerHTML=`<div class="formula-step"><i>1</i><span>Ricavi imponibili (${s.cardOnly?'tracciati':'tutti'} + seconda guida imponibile)</span><strong>${money(grossBase)}</strong></div><div class="formula-step"><i>2</i><span>Base imponibile × coefficiente ${pct(s.profitability)}</span><strong>${money(taxableBase)}</strong></div><div class="formula-step"><i>3</i><span>INPS variabile ${pct(s.inpsRate)} + quota fissa ${money(fixedInps)}</span><strong>− ${money(inps)}</strong></div><div class="formula-step"><i>4</i><span>Base dopo deduzione INPS</span><strong>${money(afterInps)}</strong></div><div class="formula-step"><i>5</i><span>Imposta sostitutiva ${pct(effectiveTaxRate)} (anno ${activityYear})</span><strong>${money(tax)}</strong></div>`;
    renderReportDetail(f,d,secondDriver,reserve,net);
  }
  function renderReportDetail(filter,data,secondDriver,reserve,net) {
    const revenues=[...data.revenues].sort((a,b)=>a.date.localeCompare(b.date));
    const expenses=[...data.expenses].sort((a,b)=>a.date.localeCompare(b.date));
    $('#reportDetailTitle').textContent=filter.type==='month'?`Movimenti di ${filter.label}`:'Seleziona un mese per l’esportazione dettagliata';
    $('#reportDetailCount').textContent=`${revenues.length+expenses.length} movimenti`;
    const revenueRows=revenues.length?revenues.map(r=>{const method=revenueMethod(r.method),fee=Number(r.amount)*method.fee/100;return `<tr><td>${dateLabel(r.date)}</td><td>${esc(r.shift||'Non indicato')}</td><td>${esc(r.note||'—')}</td><td>${method.label}${fee?` · fee ${money(fee)}`:''}</td><td class="num">${money(r.amount)}</td></tr>`;}).join(''):'<tr><td colspan="5" class="muted">Nessun incasso nel mese.</td></tr>';
    const expenseRows=expenses.length?expenses.map(x=>`<tr><td>${dateLabel(x.date)}</td><td>${esc(x.category||'Spesa')}</td><td>${esc(x.note||'—')}</td><td>${x.status==='planned'?'Pianificata':'Pagata'} · ${x.method==='card'?'Carta':'Contanti'}</td><td class="num">${money(x.amount)}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">Nessuna spesa pagata nel mese.</td></tr>';
    $('#reportDetailBody').innerHTML=`<div class="detail-summary"><div><span>Incassi taxi lordi</span><strong>${money(data.revenueTotal)}</strong><small>Fee ${money(data.platformFees)}</small></div><div><span>Seconda guida imponibile</span><strong>${money(secondDriver.taxableIncome)}</strong></div><div><span>Seconda guida contanti</span><strong>${money(secondDriver.cashIncome)}</strong><small>Non imponibile</small></div><div><span>Spese pagate</span><strong>${money(data.expenseTotal)}</strong></div><div><span>Accantonamento</span><strong>${money(reserve)}</strong></div><div><span>Disponibile stimato</span><strong>${money(net)}</strong></div></div><div class="detail-table-block"><h4>Incassi</h4><div class="table-wrap"><table><thead><tr><th>Data</th><th>Turno</th><th>Note</th><th>Tipologia</th><th class="num">Importo lordo</th></tr></thead><tbody>${revenueRows}</tbody></table></div></div><div class="detail-table-block"><h4>Spese pagate</h4><div class="table-wrap"><table><thead><tr><th>Data</th><th>Categoria</th><th>Note</th><th>Stato e metodo</th><th class="num">Importo</th></tr></thead><tbody>${expenseRows}</tbody></table></div></div>`;
  }
  $('#reportYear').addEventListener('change',renderReport); $('#reportMonth').addEventListener('change',renderReport);
  function printMonthlyReport(mode) {
    const filter=reportFilter();
    if(filter.type!=='month') return toast('Seleziona un mese prima di esportare il consuntivo.');
    const old=document.title; document.title=`Taxi Ledger - Consuntivo ${mode==='detail'?'dettagliato':'sintetico'} - ${filter.label}`;
    document.body.classList.remove('print-summary','print-detail'); document.body.classList.add(mode==='detail'?'print-detail':'print-summary');
    window.print();
    setTimeout(()=>{document.title=old;document.body.classList.remove('print-summary','print-detail');},700);
  }
  $('#printSummaryReport').addEventListener('click',()=>printMonthlyReport('summary'));
  $('#printDetailedReport').addEventListener('click',()=>printMonthlyReport('detail'));

  function populateSecondDriverYears() {
    const years=new Set([currentYear,selectedSecondDriverYear]);
    Object.keys(state.settings.secondDriverAssignments||{}).forEach(y=>years.add(String(y)));
    state.revenues.forEach(x=>years.add(x.date.slice(0,4))); state.expenses.forEach(x=>years.add(x.date.slice(0,4)));
    for(let y=Number(currentYear)-3;y<=Number(currentYear)+3;y++) years.add(String(y));
    if(!years.has(selectedSecondDriverYear)) selectedSecondDriverYear=currentYear;
    $('#settingsSecondDriverYear').innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}" ${y===selectedSecondDriverYear?'selected':''}>${y}</option>`).join('');
  }
  function renderSecondDriverAssignments() {
    const assigned=assignedSecondDriverMonths(selectedSecondDriverYear), amount=Number($('#settingsSecondDriverAmount').value)||0, cashAmount=Number($('#settingsSecondDriverCashAmount').value)||0;
    $('#secondDriverMonthGrid').innerHTML=monthNames.map((name,index)=>{
      const month=pad(index+1), checked=assigned.includes(month);
      return `<label class="month-assignment ${checked?'selected':''}"><input type="checkbox" value="${month}" ${checked?'checked':''}><span>${name.slice(0,3)}</span></label>`;
    }).join('');
    $('#secondDriverAssignmentSummary').innerHTML=`<strong>${assigned.length} ${assigned.length===1?'mese assegnato':'mesi assegnati'} nel ${selectedSecondDriverYear}</strong><span>Imponibile ${money(assigned.length*amount)} · Contanti non imponibili ${money(assigned.length*cashAmount)} · Totale ${money(assigned.length*(amount+cashAmount))}</span>`;
  }
  $('#settingsSecondDriverYear').addEventListener('change',e=>{selectedSecondDriverYear=e.target.value; renderSecondDriverAssignments();});
  $('#settingsSecondDriverAmount').addEventListener('input',renderSecondDriverAssignments);
  $('#settingsSecondDriverCashAmount').addEventListener('input',renderSecondDriverAssignments);
  $('#secondDriverMonthGrid').addEventListener('change',e=>{
    if(!e.target.matches('input[type="checkbox"]')) return;
    const month=e.target.value, assigned=new Set(assignedSecondDriverMonths(selectedSecondDriverYear));
    e.target.checked?assigned.add(month):assigned.delete(month);
    state.settings.secondDriverAssignments={...(state.settings.secondDriverAssignments||{}),[selectedSecondDriverYear]:[...assigned].sort()};
    renderSecondDriverAssignments();
  });

  function settingsToForm() {
    const s=state.settings;
    $('#settingsName').value=s.name||''; $('#settingsBusiness').value=s.business||''; $('#settingsCurrency').value=s.currency||'EUR';
    $('#settingsLicense').value=s.license||''; $('#settingsLicenseType').value=s.licenseType||'ordinary'; $('#settingsShiftMode').value=s.shiftMode||'official';
    $('#settingsSecondDriver').checked=!!s.secondDriver; $('#settingsSecondDriverAmount').value=s.secondDriverAmount||0; $('#settingsSecondDriverCashAmount').value=s.secondDriverCashAmount||0;
    $('#settingsStartYear').value=s.startYear||currentYear; $('#settingsTaxRateFirst').value=s.taxRateFirst??s.taxRate??5; $('#settingsTaxRateAfter').value=s.taxRateAfter??10; $('#settingsProfitability').value=s.profitability; $('#settingsInpsRate').value=s.inpsRate; $('#settingsInpsFixed').value=s.inpsFixed; $('#settingsCardOnly').checked=!!s.cardOnly;
    populateSecondDriverYears(); renderSecondDriverAssignments();
  }
  $('#saveSettings').addEventListener('click',()=>{
    const name=$('#settingsName').value.trim(); if(!name) return toast('Inserisci un nome visualizzato.');
    const license=Number.parseInt($('#settingsLicense').value,10)||'';
    state.settings={...state.settings,name,business:$('#settingsBusiness').value.trim(),currency:$('#settingsCurrency').value,license,licenseType:$('#settingsLicenseType').value,shiftMode:$('#settingsShiftMode').value,secondDriver:$('#settingsSecondDriver').checked,secondDriverAmount:Number($('#settingsSecondDriverAmount').value)||0,secondDriverCashAmount:Number($('#settingsSecondDriverCashAmount').value)||0,startYear:Number($('#settingsStartYear').value),taxRateFirst:Number($('#settingsTaxRateFirst').value),taxRateAfter:Number($('#settingsTaxRateAfter').value),profitability:Number($('#settingsProfitability').value),inpsRate:Number($('#settingsInpsRate').value),inpsFixed:Number($('#settingsInpsFixed').value),cardOnly:$('#settingsCardOnly').checked};
    syncMandatoryHolidays();
    save(); syncIdentity(); renderAll(); toast('Impostazioni aggiornate.');
  });
  $('#exportData').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({app:'Taxi Ledger',version:APP_VERSION,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`taxi-ledger-backup-${today}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#importData').addEventListener('change', async e=>{
    const file=e.target.files[0]; if(!file)return;
    try { const parsed=JSON.parse(await file.text()); const incoming=parsed.data||parsed; if(!Array.isArray(incoming.revenues)||!Array.isArray(incoming.expenses)) throw new Error(); if(!confirm('Sostituire i dati di questo profilo con il backup selezionato?')) return; state=normalizeData(incoming,state.settings.name); syncMandatoryHolidays(); save(); populateReportYears(); renderAll(); toast('Backup importato.'); }
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
    state.revenues.push({id:uuid(),date:day(0),amount:145,method:'card',shift:'Mattina 1',note:'Servizi in città'},{id:uuid(),date:day(0),amount:82,method:'cash',shift:'Pomeriggio 1',note:''},{id:uuid(),date:day(1),amount:196,method:'card',shift:'Mattina 2',note:'Servizi aeroporto'},{id:uuid(),date:day(2),amount:114,method:'cash',shift:'Intermedio',note:''});
    state.expenses.push({id:uuid(),date:day(1),amount:48,category:'Carburante',status:'paid',method:'card',note:'Rifornimento'},{id:uuid(),date:day(5),amount:220,category:'Manutenzione',status:'planned',method:'card',note:'Tagliando'});
    save(); populateReportYears(); renderAll(); toast('Dati dimostrativi caricati.');
  });

  const fieldTemplates={
    revenue:item=>{const suggested=item.id?(item.shift||''):suggestedRevenueShift(item.date||today),method=item.method||'card'; return `<label>Data<input name="date" type="date" required value="${item.date||today}"></label><label>Importo lordo (€)<input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${item.amount||''}"></label><label>Tipologia incasso<select name="method">${Object.entries(revenueMethods).map(([key,meta])=>`<option value="${key}" ${method===key?'selected':''}>${meta.label}${meta.fee?` - fee ${meta.fee}%`:''}</option>`).join('')}</select><small id="revenueMethodHint" class="field-hint"></small></label><label>Turno<select name="shift" required><option value="">Seleziona turno</option>${revenueShiftOptions.map(x=>`<option value="${esc(x)}" ${suggested===x?'selected':''}>${esc(x)}</option>`).join('')}</select><small id="revenueShiftHint" class="field-hint"></small></label><label class="full">Note<textarea name="note" maxlength="250" placeholder="Dettagli facoltativi sull'incasso">${esc(item.note||'')}</textarea></label>`;},
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
    if(type==='revenue') {
      const dateField=$('#entryFields [name="date"]'), shiftField=$('#entryFields [name="shift"]'), methodField=$('#entryFields [name="method"]'), amountField=$('#entryFields [name="amount"]');
      let autoShift=id?'':suggestedRevenueShift(dateField.value);
      const updateHint=()=>{
        const shift=shiftForDate(dateField.value), hint=$('#revenueShiftHint');
        hint.textContent=shift?(shift.turn?`Proposta da turnazione: T${shift.turn} ${shift.name}, gruppo ${pad(shift.group)}. Puoi scegliere un altro turno.`:`Proposta: ${shift.name}. Puoi scegliere un altro turno.`):'Nessun turno ufficiale disponibile: seleziona il turno dalla lista.';
      };
      dateField.addEventListener('change',()=>{const next=suggestedRevenueShift(dateField.value); if(!id&&(shiftField.value===''||shiftField.value===autoShift)) shiftField.value=next; autoShift=next; updateHint();});
      const updateMethodHint=()=>{const meta=revenueMethod(methodField.value),amount=Number(amountField.value)||0,fee=amount*meta.fee/100;$('#revenueMethodHint').textContent=meta.fee?`Fee ${meta.fee}%: ${money(fee)} · netto previsto ${money(amount-fee)}.`:meta.cardLike?'Considerato come carta ai fini dell’imponibile.':'Contante escluso dall’imponibile se l’opzione fiscale è attiva.';};
      methodField.addEventListener('change',updateMethodHint); amountField.addEventListener('input',updateMethodHint);
      updateHint();
      updateMethodHint();
    }
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
    if(type==='revenue')$('#revenueDayFilter').value=fd.date;
    if(type==='expense')$('#expenseDayFilter').value=fd.date;
    save(); populateReportYears(); renderAll(); $('#entryDialog').close(); toast(id?'Modifica salvata.':'Elemento aggiunto.');
  });
  $('#deleteEntry').addEventListener('click',()=>{
    const type=$('#entryType').value,id=$('#entryId').value; if(!confirm('Eliminare definitivamente questo elemento?'))return;
    const key=type==='revenue'?'revenues':type==='expense'?'expenses':'holidays'; state[key]=state[key].filter(x=>x.id!==id); save(); renderAll(); $('#entryDialog').close(); toast('Elemento eliminato.');
  });

  function renderAll() { setupDashboardPicker(); renderDashboard(); renderRevenues(); renderExpenses(); renderHolidays(); renderShifts(); renderReport(); settingsToForm(); }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
  if (userEmail && store.accounts[userEmail]) enterApp(); else showAuth();
})();
