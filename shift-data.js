(() => {
  'use strict';

  /* Dati trascritti dagli allegati alla D.D. Roma Capitale QG/2926/2025.
     Le 53 tabelle settimanali del PDF ripetono questa matrice di 20 settimane. */

  const SCHEDULE_START = '2026-01-10';
  const SCHEDULE_END = '2027-01-15';
  const ROTATION = [[7,5,1,5,3,6,1,5,1,5,7,4,2,4,2,6,2,4,2,4],[5,2,5,2,5,7,5,2,6,2,4,1,4,3,4,7,4,1,6,1],[2,4,2,6,2,4,2,4,7,4,1,5,3,6,1,5,1,5,7,5],[4,1,4,7,4,3,6,1,4,1,5,2,5,7,5,2,6,2,5,2],[3,6,1,5,1,5,7,5,1,5,2,6,2,4,2,4,7,4,2,4],[5,7,5,2,6,2,5,2,5,2,4,7,4,1,6,1,4,3,4,1],[2,4,2,4,7,4,2,4,2,6,1,5,1,5,7,5,3,5,1,6],[4,1,6,3,4,1,4,1,4,7,5,2,6,2,5,2,5,2,5,7],[1,5,7,5,1,5,1,6,3,5,2,4,7,4,2,4,2,6,2,4],[6,2,5,2,5,2,5,7,5,2,6,1,4,1,4,3,4,7,4,1],[7,4,2,4,2,6,2,4,2,4,7,5,1,5,3,6,1,5,1,5],[4,1,4,1,4,7,4,3,6,1,5,2,5,2,5,7,5,2,6,2],[1,5,1,6,1,5,3,5,7,5,2,4,2,6,2,4,2,4,7,4],[5,2,5,7,5,2,6,2,5,2,4,1,4,7,4,1,6,1,4,3],[2,6,2,4,2,4,7,4,2,4,1,6,1,5,1,5,7,5,3,5],[4,7,4,1,6,1,4,1,4,3,5,7,5,2,6,2,5,2,5,2],[1,5,3,5,7,5,1,5,1,6,2,4,2,4,7,4,2,4,2,6],[5,2,6,2,5,2,5,2,5,7,4,3,6,1,4,1,4,1,4,7],[2,4,7,4,2,4,2,6,2,4,3,5,7,5,1,5,1,6,1,5],[6,3,4,1,4,1,4,7,4,1,6,2,5,2,5,2,5,7,5,2]];
  const SHIFT_NAMES = ['Mattina 1','Mattina 2','Intermedio','Pomeriggio 1','Pomeriggio 2','Seminotte','Notte'];
  const WEEKDAY_HOURS = ['06:00-15:00','07:00-16:00','08:30-17:30','14:00-23:00','15:00-24:00','17:00-02:00','20:00-06:00'];
  const WEEKEND_HOURS = ['06:00-16:00','07:00-17:00','10:00-20:00','14:00-24:00','15:00-01:00','17:00-03:00','20:00-06:00'];
  const REDUCTION_HOURS = ['06:00-16:00','06:00-16:00','10:00-20:00','14:00-24:00','14:00-24:00','17:00-03:00','20:00-06:00'];

  const parse = iso => new Date(`${iso}T12:00:00`);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dayNumber = value => Math.floor(Date.UTC(parse(value).getFullYear(), parse(value).getMonth(), parse(value).getDate()) / 86400000);
  const addDays = (value, days) => { const d = parse(value); d.setDate(d.getDate()+days); return iso(d); };
  const groupForLicense = license => { const n = Number.parseInt(license,10); return Number.isFinite(n) && n > 0 ? ((n-1)%20)+1 : null; };
  const saturdayFor = dateISO => { const d=parse(dateISO); d.setDate(d.getDate()-((d.getDay()+1)%7)); return iso(d); };
  const isReductionPeriod = dateISO => (dateISO >= '2026-08-01' && dateISO <= '2026-08-28') || (dateISO >= '2026-12-24' && dateISO <= '2027-01-12');

  function getShift(dateISO, license, mode='official') {
    if (mode === 'morning') return {mode, broad:'Mattina', name:'Mattina fissa', turn:null, group:groupForLicense(license), hours:'Personalizzato'};
    if (mode === 'afternoon') return {mode, broad:'Pomeriggio', name:'Pomeriggio fisso', turn:null, group:groupForLicense(license), hours:'Personalizzato'};
    const group=groupForLicense(license);
    if (!group || dateISO < SCHEDULE_START || dateISO > SCHEDULE_END) return null;
    const weekStart=saturdayFor(dateISO);
    const weekIndex=Math.floor((dayNumber(weekStart)-dayNumber(SCHEDULE_START))/7);
    if (weekIndex < 0 || weekIndex > 52) return null;
    const turn=ROTATION[weekIndex%ROTATION.length][group-1];
    const day=parse(dateISO).getDay();
    const hours=(isReductionPeriod(dateISO)?REDUCTION_HOURS:(day===0||day===6?WEEKEND_HOURS:WEEKDAY_HOURS))[turn-1];
    /* Il PDF stabilisce per il T6 17:00-02:00 lun-gio e 17:00-03:00 il venerdì e nel fine settimana. */
    const adjustedHours=turn===6&&day===5&&!isReductionPeriod(dateISO)?'17:00-03:00':hours;
    return {mode, turn, group, weekIndex, weekStart, weekEnd:addDays(weekStart,6), name:SHIFT_NAMES[turn-1], broad:turn<=3?'Mattina':'Pomeriggio', hours:adjustedHours};
  }

  function mandatoryRestPeriods(license, type='ordinary') {
    const n=Number.parseInt(license,10); if (!Number.isFinite(n) || n<=0) return [];
    let period=null;
    if (type==='mu') {
      if (n<=50) period='A'; else if(n<=100) period='B'; else if(n<=150) period='C'; else if(n<=200) period='D';
    } else {
      if(n<=2162) period='A'; else if(n<=4326) period='B'; else if(n<=6488) period='C'; else period='D';
    }
    if(!period) return [];
    const august={A:['2026-08-01','2026-08-07'],B:['2026-08-08','2026-08-14'],C:['2026-08-15','2026-08-21'],D:['2026-08-22','2026-08-28']}[period];
    const winter={A:['2026-12-24','2026-12-28'],B:['2026-12-29','2027-01-02'],C:['2027-01-03','2027-01-07'],D:['2027-01-08','2027-01-12']}[period];
    return [
      {key:`qg2926-aug-${period}`,name:`Riduzione organico agosto - periodo ${period}`,start:august[0],end:august[1],note:'Riposo obbligatorio - D.D. QG/2926/2025'},
      {key:`qg2926-winter-${period}`,name:`Riduzione organico dicembre/gennaio - periodo ${period}`,start:winter[0],end:winter[1],note:'Riposo obbligatorio - D.D. QG/2926/2025'}
    ];
  }

  window.TAXI_SHIFT_RULES={SCHEDULE_START,SCHEDULE_END,ROTATION,SHIFT_NAMES,WEEKDAY_HOURS,WEEKEND_HOURS,groupForLicense,getShift,mandatoryRestPeriods,addDays,saturdayFor};
})();
