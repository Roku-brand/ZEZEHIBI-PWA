/* =========================================
   記録アプリ app.js
   ========================================= */

/* ========= 定数/ユーティリティ ========= */
const STORAGE_KEY = "journal.v1";
const WJP = ["日","月","火","水","木","金","土"];
const toISO = d => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const fmtJP = iso => { const [y,m,d]=iso.split("-").map(Number); const dt=new Date(y,m-1,d); return `${m}月${d}日(${WJP[dt.getDay()]})`; };
const newId = ()=>"id_"+Math.random().toString(36).slice(2,8)+Date.now().toString(36);
const esc = s => (s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

/* ========= ストレージ ========= */
function loadDB(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const base=raw?JSON.parse(raw):{entries:[],schedules:[]};
    if(!Array.isArray(base.entries)) base.entries=[];
    if(!Array.isArray(base.schedules)) base.schedules=[];
    return base;
  }catch(_){ return {entries:[],schedules:[]}; }
}
let db = loadDB();
const save = ()=> localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

/* ========= 画面制御 ========= */
const scrDiary = document.getElementById('screenDiary');
const scrSched = document.getElementById('screenSched');
const scrSearch= document.getElementById('screenSearch');
const scrCoord = document.getElementById('screenCoord');

const tabDiary = document.getElementById('tabDiary');
const tabSched = document.getElementById('tabSched');
const tabSearch= document.getElementById('tabSearch');
const tabCoord = document.getElementById('tabCoord');

function showScreen(which){
  const map = { diary: scrDiary, sched: scrSched, search: scrSearch, coord: scrCoord };
  for(const k in map){
    const el = map[k];
    el.classList.remove('show');
    el.hidden = true;
    const tb = {diary:tabDiary,sched:tabSched,search:tabSearch,coord:tabCoord}[k];
    tb.classList.toggle('active', false);
    tb.setAttribute('aria-selected','false');
  }
  map[which].classList.add('show');
  map[which].hidden = false;
  ({diary:tabDiary,sched:tabSched,search:tabSearch,coord:tabCoord}[which]).classList.add('active');
  ({diary:tabDiary,sched:tabSched,search:tabSearch,coord:tabCoord}[which]).setAttribute('aria-selected','true');
  window.scrollTo(0,0);
}
tabDiary.onclick = ()=> showScreen('diary');
tabSched.onclick  = ()=> showScreen('sched');
tabSearch.onclick = ()=> showScreen('search');
tabCoord.onclick  = ()=> { showScreen('coord'); coord_renderAll(); };

document.getElementById('todayBadge').textContent = (()=> {
  const t=new Date(); return `${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日(${WJP[t.getDay()]})`;
})();

/* ========= 状態 ========= */
let state = {
  selDate: toISO(new Date()),
  monthDiary: (()=>{const d=new Date();d.setDate(1);return d;})(),
  monthSched: (()=>{const d=new Date();d.setDate(1);return d;})(),
  currentEntryId: null
};

/* ========= DOM参照（既存） ========= */
// 日記
const calTitle = document.getElementById('calTitle');
const calGrid  = document.getElementById('calGrid');
const jumpMonth= document.getElementById('jumpMonth');
const selISO   = document.getElementById('selISO');
const selJP    = document.getElementById('selJP');
const dayList  = document.getElementById('dayList');
const newEntryBtn = document.getElementById('newEntry');
const editor   = document.getElementById('editor');
const editISO  = document.getElementById('editISO');
const editJP   = document.getElementById('editJP');
const dateInput= document.getElementById('dateInput');
const titleEl  = document.getElementById('title');
const bodyEl   = document.getElementById('body');
const wakeEl   = document.getElementById('wake');
const breakfastEl = document.getElementById('breakfast');
const lunchEl  = document.getElementById('lunch');
const dinnerEl = document.getElementById('dinner');
const saveBtn  = document.getElementById('saveBtn');
const delBtn   = document.getElementById('delBtn');
const saveState= document.getElementById('saveState');
const autoActsBox = document.getElementById('autoActsBox');
const autoActs    = document.getElementById('autoActs');

// 予定
const schedTitle = document.getElementById('schedTitle');
const schedGrid  = document.getElementById('schedGrid');
const schedISO   = document.getElementById('schedISO');
const schedJP    = document.getElementById('schedJP');
const schedList  = document.getElementById('schedList');
const schedKPI   = document.getElementById('schedMonthKPI');
const newSched   = document.getElementById('newSched');
const monthPending = document.getElementById('monthPending');

// 検索
const q = document.getElementById('q');
const searchDiary = document.getElementById('searchDiary');
const searchSched = document.getElementById('searchSched');

// 予定モーダル（既存）
const dlg     = document.getElementById('dlg');
const mId     = document.getElementById('mId');
const mDate   = document.getElementById('mDate');
const mStart  = document.getElementById('mStart');
const mEnd    = document.getElementById('mEnd');
const mTitle  = document.getElementById('mTitle');
const mNote   = document.getElementById('mNote');
const mDone   = document.getElementById('mDone');
const mCancel = document.getElementById('mCancel');
const mSave   = document.getElementById('mSave');
const mDelete = document.getElementById('mDelete');

/* ========= ヘルパ ========= */
const entriesOn = date => db.entries.filter(e=>e.date===date).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
const schedOn   = date => db.schedules.filter(s=>s.date===date).sort((a,b)=> (a.start||'')<(b.start||'')?-1:1);
const ensureDiary = date => { let e=db.entries.find(x=>x.date===date); if(!e){ e={id:newId(),date,title:'',body:'',wake:'',breakfast:'',lunch:'',dinner:'',createdAt:Date.now(),updatedAt:Date.now()}; db.entries.push(e); save(); } return e; };
function selectDate(iso){
  state.selDate = iso;
  selISO.textContent = iso; selJP.textContent = fmtJP(iso);
  renderDayList();
}

/* ========= 日記：カレンダー描画 ========= */
function renderCalendar(){
  const y=state.monthDiary.getFullYear(), m=state.monthDiary.getMonth();
  calTitle.textContent = `${y}年 ${m+1}月`;
  jumpMonth.value = `${y}-${String(m+1).padStart(2,'0')}`;
  calGrid.innerHTML='';

  const firstDow=new Date(y,m,1).getDay();
  const days=new Date(y,m+1,0).getDate();
  for(let i=0;i<firstDow;i++){
    const d=document.createElement('div'); d.className='day'; d.style.visibility='hidden'; calGrid.appendChild(d);
  }
  const today=toISO(new Date());
  for(let d=1; d<=days; d++){
    const iso=toISO(new Date(y,m,d));
    const b=document.createElement('button');
    b.type='button'; b.className='day'; b.textContent=d; b.dataset.iso=iso;
    const dow=new Date(y,m,d).getDay();
    if(dow===0) b.classList.add('sun'); if(dow===6) b.classList.add('sat');
    if(iso===today) b.classList.add('today');
    if(iso===state.selDate) b.classList.add('sel');
    if(db.entries.some(e=>e.date===iso) || db.schedules.some(s=>s.date===iso)) b.classList.add('has');
    b.onclick=()=>{ document.querySelectorAll('#calGrid .day.sel').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); selectDate(iso); };
    b.ondblclick=()=>{ const e=ensureDiary(iso); state.currentEntryId=e.id; fillEditor(e); showEditor(); };
    let t=null, isTouch = matchMedia('(hover:none) and (pointer:coarse)').matches;
    b.onpointerdown=()=>{ t=setTimeout(()=>{ const e=ensureDiary(iso); state.currentEntryId=e.id; fillEditor(e); showEditor(); t=null; }, isTouch?350:500); };
    ['pointerup','pointerleave','pointercancel'].forEach(ev=> b.addEventListener(ev,()=>{ if(t){clearTimeout(t);t=null;} }));
    calGrid.appendChild(b);
  }
}

/* ========= 日記：達成ログボックス ========= */
function renderAutoActsBox(date){
  const acts = schedOn(date).filter(s=>s.done);
  if(!acts.length){ autoActsBox.style.display='none'; autoActs.innerHTML=''; return; }
  autoActsBox.style.display='block';
  autoActs.innerHTML = acts
    .map(s=>`✅ ${s.start?`${s.start} `:''}${esc(s.title||'(無題)')}${s.note?` — <span style="opacity:.8">${esc(s.note)}</span>`:''}`)
    .join('<br>');
}

/* ========= 日記：リスト＆エディタ ========= */
function renderDayList(){
  const list=entriesOn(state.selDate);
  dayList.innerHTML='';
  if(!list.length){
    dayList.innerHTML=`<div class="small">この日の日記はまだありません。</div>`;
    editor.style.display='none';
  }else{
    list.forEach(e=>{
      const card=document.createElement('div'); card.className='card';
      const meals=[e.breakfast&&`🍳${esc(e.breakfast)}`,e.lunch&&`🍱${esc(e.lunch)}`,e.dinner&&`🍽️${esc(e.dinner)}`].filter(Boolean).join(' / ');
      card.innerHTML=`<strong>${esc(e.title||'(無題)')}</strong><br><small>${e.date}${e.wake?`　☀️${e.wake}`:''}</small>${meals?`<div class="small" style="margin-top:4px">${meals}</div>`:''}`;
      card.onclick=()=>{ state.currentEntryId=e.id; fillEditor(e); showEditor(); };
      dayList.appendChild(card);
    });
  }
  renderAutoActsBox(state.selDate);
}
function showEditor(){ editor.style.display='block'; setTimeout(()=>titleEl.focus(),0); }
function currentEntry(){ return db.entries.find(e=>e.id===state.currentEntryId)||null; }
function fillEditor(e){
  editISO.textContent=e.date; editJP.textContent=fmtJP(e.date);
  dateInput.value=e.date; titleEl.value=e.title||''; bodyEl.value=e.body||'';
  wakeEl.value=e.wake||''; breakfastEl.value=e.breakfast||''; lunchEl.value=e.lunch||''; dinnerEl.value=e.dinner||'';
}
function saveEntry(){
  const cur=currentEntry(); if(!cur) return;
  cur.date=dateInput.value||cur.date;
  cur.title=titleEl.value; cur.body=bodyEl.value;
  cur.wake=wakeEl.value; cur.breakfast=breakfastEl.value; cur.lunch=lunchEl.value; cur.dinner=dinnerEl.value;
  cur.updatedAt=Date.now();
  save();
  state.selDate=cur.date; selISO.textContent=cur.date; selJP.textContent=fmtJP(cur.date);
  renderCalendar(); renderDayList();
  saveState.textContent='保存済み'; setTimeout(()=>saveState.textContent='—',1200);
}

/* ========= イベント：日記 ========= */
document.getElementById('prevM').onclick=()=>{state.monthDiary.setMonth(state.monthDiary.getMonth()-1);renderCalendar();};
document.getElementById('nextM').onclick=()=>{state.monthDiary.setMonth(state.monthDiary.getMonth()+1);renderCalendar();};
jumpMonth.onchange=()=>{const [y,m]=(jumpMonth.value||'').split('-').map(Number); if(y&&m){state.monthDiary=new Date(y,m-1,1);renderCalendar();}};
newEntryBtn.onclick=()=>{ const e=ensureDiary(state.selDate); state.currentEntryId=e.id; fillEditor(e); showEditor(); };
saveBtn.onclick=saveEntry;
delBtn.onclick=()=>{
  const cur=currentEntry(); if(!cur) return;
  if(!confirm('この日記を削除しますか？')) return;
  db.entries=db.entries.filter(x=>x.id!==cur.id); save();
  editor.style.display='none'; renderCalendar(); renderDayList();
};
dateInput.onchange=saveEntry;
[titleEl,bodyEl,wakeEl,breakfastEl,lunchEl,dinnerEl].forEach(el=>{
  el.addEventListener('input',()=>{ const cur=currentEntry(); if(!cur) return; saveState.textContent='保存中…'; setTimeout(saveEntry,300); });
});

/* ========= 予定（月間＆未消化） ========= */
function renderSched(){
  const y=state.monthSched.getFullYear(), m=state.monthSched.getMonth();
  schedTitle.textContent=`${y}年 ${m+1}月`;
  const firstDow=new Date(y,m,1).getDay();
  const days=new Date(y,m+1,0).getDate();
  schedGrid.innerHTML='';
  for(let i=0;i<firstDow;i++){const d=document.createElement('div');d.className='day';d.style.visibility='hidden';schedGrid.appendChild(d);}
  const today=toISO(new Date());
  for(let d=1; d<=days; d++){
    const iso=toISO(new Date(y,m,d));
    const b=document.createElement('button'); b.type='button'; b.className='day'; b.dataset.iso=iso; b.textContent=d;
    const dow=new Date(y,m,d).getDay(); if(dow===0) b.classList.add('sun'); if(dow===6) b.classList.add('sat');
    if(iso===today) b.classList.add('today'); if(iso===state.selDate) b.classList.add('sel');
    if(db.schedules.some(s=>s.date===iso)) b.classList.add('has');
    b.onclick=()=>{document.querySelectorAll('#schedGrid .day.sel').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');state.selDate=iso; schedISO.textContent=iso; schedJP.textContent=fmtJP(iso); renderSchedList(); renderAutoActsBox(iso);};
    b.ondblclick=()=>openSchedModal({date:iso});
    let t=null, isTouch = matchMedia('(hover:none) and (pointer:coarse)').matches;
    b.onpointerdown=()=>{t=setTimeout(()=>{openSchedModal({date:iso});t=null;}, isTouch?350:500)}; ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{if(t){clearTimeout(t);t=null;}}));
    schedGrid.appendChild(b);
  }
  schedISO.textContent=state.selDate; schedJP.textContent=fmtJP(state.selDate);
  const startISO=toISO(new Date(y,m,1)), endISO=toISO(new Date(y,m+1,0));
  const cnt=db.schedules.filter(s=>s.date>=startISO&&s.date<=endISO).length;
  schedKPI.textContent=`今月の予定: ${cnt}`;
  renderSchedList(); renderPending();
}
function renderSchedList(){
  const list=schedOn(state.selDate);
  schedList.innerHTML='';
  if(!list.length){schedList.innerHTML=`<div class="small">この日の予定はまだありません。</div>`; return;}
  list.forEach(s=>{
    const card=document.createElement('div'); card.className='card';
    const time=[s.start||'',s.end?`– ${s.end}`:''].filter(Boolean).join(' ');
    card.innerHTML=`<strong>${esc(s.title||'(無題)')}</strong><br><small>${s.date}${time?`　${time}`:''}</small>${s.note?`<div class="small" style="margin-top:4px">${esc(s.note)}</div>`:''}<div style="margin-top:6px"><label class="small"><input type="checkbox" ${s.done?'checked':''}> 達成</label></div>`;
    card.onclick=(ev)=>{ if(ev.target.type==='checkbox') return; openSchedModal(s); };
    card.querySelector('input[type="checkbox"]').onchange=(ev)=>{
      s.done=ev.target.checked; s.updatedAt=Date.now(); save();
      renderPending(); renderAutoActsBox(state.selDate);
    };
    schedList.appendChild(card);
  });
}
function renderPending(){
  const y=state.monthSched.getFullYear(), m=state.monthSched.getMonth();
  const startISO=toISO(new Date(y,m,1)), endISO=toISO(new Date(y,m+1,0));
  const items=db.schedules.filter(s=>!s.done && s.date>=startISO && s.date<=endISO)
    .sort((a,b)=> (a.date+a.start) < (b.date+b.start) ? -1:1);
  monthPending.innerHTML='';
  if(!items.length){monthPending.innerHTML=`<div class="small">未消化の予定はありません。</div>`; return;}
  items.forEach(s=>{
    const dt=new Date(s.date); const md=`${dt.getMonth()+1}/${dt.getDate()}`, wd=`(${WJP[dt.getDay()]})`;
    const time=[s.start||'',s.end?`– ${s.end}`:''].filter(Boolean).join(' ');
    const row=document.createElement('div'); row.className='card';
    row.innerHTML=`<strong style="font-size:15px">${md} ${wd}</strong><br>
                   <div><strong>${esc(s.title||'(無題)')}</strong><br><small>${s.date}${time?`　${time}`:''}</small>${s.note?`<div class="small" style="margin-top:4px">${esc(s.note)}</div>`:''}</div>`;
    row.onclick=()=>openSchedModal(s);
    monthPending.appendChild(row);
  });
}
document.getElementById('sPrevM').onclick=()=>{state.monthSched.setMonth(state.monthSched.getMonth()-1);renderSched();};
document.getElementById('sNextM').onclick=()=>{state.monthSched.setMonth(state.monthSched.getMonth()+1);renderSched();};
newSched.onclick=()=>openSchedModal({date:state.selDate});

/* ========= 予定モーダル（既存） ========= */
function openSchedModal(s){
  const isNew=!s.id;
  mId.value=s.id||'';
  mDate.value=s.date||state.selDate;
  mStart.value=s.start||''; mEnd.value=s.end||'';
  mTitle.value=s.title||''; mNote.value=s.note||'';
  mDone.checked=!!s.done;
  mDelete.style.display=isNew?'none':'inline-block';
  dlg.showModal(); setTimeout(()=>mTitle.focus(),0);
}
mCancel.onclick=()=>dlg.close();
mSave.onclick=()=>{
  const id=mId.value||newId();
  const s={
    id,
    date:mDate.value||state.selDate,
    start:mStart.value||'',
    end:mEnd.value||'',
    title:mTitle.value.trim(),
    note:mNote.value.trim(),
    done:!!mDone.checked,
    updatedAt:Date.now()
  };
  if(!db.schedules.some(x=>x.id===id)) s.createdAt=Date.now();
  const i=db.schedules.findIndex(x=>x.id===id); if(i>=0) db.schedules[i]={...db.schedules[i], ...s}; else db.schedules.push(s);
  save(); dlg.close();

  state.selDate=s.date;
  renderCalendar(); renderDayList(); renderSched(); coord_renderAll();
};
mDelete.onclick=()=>{
  const id=mId.value; if(!id){dlg.close();return;}
  if(!confirm('この予定を削除しますか？')) return;
  db.schedules=db.schedules.filter(x=>x.id!==id); save(); dlg.close();
  renderSched(); renderAutoActsBox(state.selDate); coord_renderAll();
};

/* ========= 検索 ========= */
q.addEventListener('input', ()=>{
  const key=(q.value||'').toLowerCase().trim();
  searchDiary.innerHTML=''; searchSched.innerHTML='';
  if(!key){ searchDiary.innerHTML='<div class="small">キーワードを入力すると表示します。</div>'; searchSched.innerHTML=searchDiary.innerHTML; return; }
  // 日記
  const dres=db.entries
    .filter(e=>((e.title||'')+' '+(e.body||'')+' '+(e.breakfast||'')+' '+(e.lunch||'')+' '+(e.dinner||'')).toLowerCase().includes(key))
    .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,150);
  if(!dres.length){ searchDiary.innerHTML='<div class="small">該当なし</div>'; }
  else dres.forEach(e=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<strong>${esc(e.title||'(無題)')}</strong><br><small>${fmtJP(e.date)} / ${e.date}</small>`;
    card.onclick=()=>{ showScreen('diary'); state.selDate=e.date; renderCalendar(); renderDayList(); state.currentEntryId=e.id; fillEditor(e); showEditor(); };
    searchDiary.appendChild(card);
  });
  // 予定
  const sres=db.schedules
    .filter(s=>((s.title||'')+' '+(s.note||'')+' '+(s.party||'')).toLowerCase().includes(key))
    .sort((a,b)=> (a.date+a.start) < (b.date+b.start)?-1:1).slice(0,150);
  if(!sres.length){ searchSched.innerHTML='<div class="small">該当なし</div>'; }
  else sres.forEach(s=>{
    const card=document.createElement('div'); card.className='card';
    const time=[s.start||'',s.end?`– ${s.end}`:''].filter(Boolean).join(' ');
    card.innerHTML=`<strong>${esc(s.title||'(無題)')}</strong><br><small>${fmtJP(s.date)} / ${s.date}${time?`　${time}`:''}</small>`;
    card.onclick=()=>{ showScreen('sched'); state.selDate=s.date; renderSched(); openSchedModal(s); };
    searchSched.appendChild(card);
  });
});

/* ========= スケジュール調整（帯カレンダー） ========= */
const coord = {
  weekHead: document.getElementById('cWeekHead'),
  weekGrid: document.getElementById('cWeekGrid'),
  monthHead: document.getElementById('cMonthHead'),
  monthGrid: document.getElementById('cMonthGrid'),
  weekView: document.getElementById('cWeekView'),
  monthView: document.getElementById('cMonthView'),
  weekLabel: document.getElementById('coordWeekLabel'),
  cNewBtn: document.getElementById('cNewBtn'),
  cTabWeek: document.getElementById('cTabWeek'),
  cTabMonth: document.getElementById('cTabMonth'),
  cQ: document.getElementById('cQ'),
  cStatus: document.getElementById('cStatus'),
  cDur: document.getElementById('cDur'),
  cFindSlots: document.getElementById('cFindSlots'),
  cModal: document.getElementById('cModal'),
  cDeleteBtn: document.getElementById('cDeleteBtn'),
  cSaveBtn: document.getElementById('cSaveBtn'),
  cForm: document.getElementById('cForm'),
  cModalTitle: document.getElementById('cModalTitle'),
  cf_id: document.getElementById('cf_id'),
  cf_title: document.getElementById('cf_title'),
  cf_party: document.getElementById('cf_party'),
  cf_date: document.getElementById('cf_date'),
  cf_start: document.getElementById('cf_start'),
  cf_end: document.getElementById('cf_end'),
  cf_color: document.getElementById('cf_color'),
  cf_status: document.getElementById('cf_status'),
  cf_note: document.getElementById('cf_note'),
  cf_workStart: document.getElementById('cf_workStart'),
  cf_workEnd: document.getElementById('cf_workEnd'),
  cSlotsModal: document.getElementById('cSlotsModal'),
  cSlotsBody: document.getElementById('cSlotsBody'),
};

// state
let coord_viewDate = new Date();
let coord_editingId = null;
let coord_work = loadCoordWork() || {start:"09:00", end:"18:00"}; persistCoordWork();

// helpers
const pad = n => String(n).padStart(2,'0');
const parseTime = t => { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m; };
const minutesToTop = (mins, dayHeight=900) => (mins/(24*60))*dayHeight;
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const weekday = ["日","月","火","水","木","金","土"];
function startOfWeek(d){ const x=new Date(d); const day=x.getDay(); const diff=(day===0?-6:1-day); x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtDate(d){ return `${d.getMonth()+1}/${d.getDate()}（${weekday[d.getDay()]}）`; }
function loadCoordWork(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY+".work")||'null')}catch{return null} }
function persistCoordWork(){ localStorage.setItem(STORAGE_KEY+".work", JSON.stringify(coord_work)); }

// render week
function coord_renderWeek(){
  const start = startOfWeek(coord_viewDate);
  const days = [...Array(7)].map((_,i)=> addDays(start,i));
  coord.weekHead.innerHTML = [
    `<div class="c-whcell"><div class="c-whday">時間</div></div>`,
    ...days.map(d=>{
      const dstr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
      return `<div class="c-whcell"><div class="c-whday">${weekday[d.getDay()]}</div><div class="c-whdate">${dstr}</div></div>`;
    })
  ].join('');

  const height = (()=> {
    // モバイル時はCSSでcalc(100dvh - X)にしているため固定値維持
    const m = matchMedia('(max-width: 720px)').matches;
    return m ? document.querySelector('.c-week-grid')?.offsetHeight || 700 : 900;
  })();

  coord.weekGrid.innerHTML='';
  for (let c=0;c<8;c++){
    const col = document.createElement('div');
    col.className='c-col'+(c===0?' c-timecol':'');
    col.style.height = height+'px';
    col.style.position='relative';
    coord.weekGrid.appendChild(col);
  }
  // time labels
  const timecol = coord.weekGrid.children[0];
  for(let h=0; h<24; h++){
    const tl = document.createElement('div');
    tl.style.position='absolute';
    tl.style.left='6px';
    tl.style.top = minutesToTop(h*60,height)-8 + 'px';
    tl.style.fontSize='12px';
    tl.style.color='#617197';
    tl.textContent = `${pad(h)}:00`;
    timecol.appendChild(tl);
  }
  // working band
  if (coord_work.start && coord_work.end){
    const s = parseTime(coord_work.start), e = parseTime(coord_work.end);
    [...Array(7)].forEach((_,i)=>{
      const col = coord.weekGrid.children[i+1];
      const wb = document.createElement('div');
      wb.className='c-workband';
      wb.style.top = minutesToTop(s,height)+'px';
      wb.style.height = clamp(minutesToTop(e-s,height),0,height)+'px';
      col.appendChild(wb);
    });
  }
  // events
  const term = coord.cQ.value.trim().toLowerCase();
  const fStatus = coord.cStatus.value;
  const weekMap = {}; days.forEach((d,i)=> weekMap[toISO(d)] = i);

  db.schedules
    .filter(e=> (!term || `${e.title||''} ${e.party||''} ${e.note||''}`.toLowerCase().includes(term)) &&
                (!fStatus || (e.status||'')===fStatus))
    .forEach(e=>{
      if (!(e.date in weekMap)) return;
      const dayIndex = weekMap[e.date];
      const col = coord.weekGrid.children[dayIndex+1];
      const s = parseTime(e.start), en = parseTime(e.end);
      const top = minutesToTop(s,height);
      const h = Math.max(22, minutesToTop(en - s,height));
      const div = document.createElement('div');
      div.className='c-event';
      div.style.top = top+'px';
      div.style.height = h+'px';
      div.dataset.id = e.id;
      div.dataset.status = e.status||'';
      const color = e.color || '#8C8C8C';
      div.innerHTML = `
        <span class="band" style="background:${color}"></span>
        ${e.status?`<span class="status c-badge">${e.status}</span>`:''}
        <div class="title">${esc(e.title||'(無題)')}</div>
        <div class="meta">🕒 ${e.start||''}${e.end?`–${e.end}`:''}${e.party?`　👤 ${esc(e.party)}`:''}</div>
        ${e.note? `<div class="meta">📝 ${esc(e.note)}</div>`:''}
      `;
      div.addEventListener('click',()=> coord_openEdit(e.id));
      col.appendChild(div);
    });

  const label = `${fmtDate(days[0])} 〜 ${fmtDate(days[6])}`;
  coord.weekLabel.textContent = `週表示：${label}`;
}

// render month
function coord_renderMonth(){
  const ym = new Date(coord_viewDate.getFullYear(), coord_viewDate.getMonth(), 1);
  const first = startOfWeek(new Date(ym.getFullYear(), ym.getMonth(), 1));
  const days = [...Array(42)].map((_,i)=> addDays(first,i));
  coord.monthHead.innerHTML = weekday.map(w=>`<div class="c-whcell"><div class="c-whday">${w}</div></div>`).join('');
  coord.monthGrid.innerHTML = '';
  days.forEach(d=>{
    const cell = document.createElement('div'); cell.className='c-mday';
    const inMonth = d.getMonth()===ym.getMonth();
    const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
    cell.style.opacity = inMonth? '1': '.5';
    cell.innerHTML = `
      <div class="c-mhead">
        <strong>${dateStr}</strong>
        <button class="c-btn" style="padding:4px 8px" data-add="${toISO(d)}">＋</button>
      </div>
      <div class="mbox"></div>
    `;
    const box = cell.querySelector('.mbox');
    db.schedules.filter(e=> e.date===toISO(d)).forEach(e=>{
      const band = document.createElement('div');
      band.className='c-mb';
      band.title = `${e.start||''}-${e.end||''} ${e.title||'(無題)'}`;
      band.style.background = e.color || '#8C8C8C';
      box.appendChild(band);
    });
    coord.monthGrid.appendChild(cell);
  });
  // add
  coord.monthGrid.querySelectorAll('[data-add]').forEach(b=>{
    b.addEventListener('click', ()=> coord_openNew(b.dataset.add));
  });
}
function coord_renderAll(){ coord_renderWeek(); coord_renderMonth(); }

/* —— 空き候補 —— */
function coord_computeFreeSlots(durationMin){
  const start = startOfWeek(coord_viewDate);
  const days = [...Array(7)].map((_,i)=> addDays(start,i));
  const ws = coord_work.start? parseTime(coord_work.start): 9*60;
  const we = coord_work.end? parseTime(coord_work.end): 18*60;

  const slots = [];
  days.forEach((d)=>{
    const dateKey = toISO(d);
    const dayEvents = db.schedules
      .filter(e=>e.date===dateKey && (e.status||'')!=="取消")
      .map(e=>({s:parseTime(e.start), e:parseTime(e.end)}))
      .sort((a,b)=>a.s-b.s);

    // merge
    const merged=[];
    for(const r of dayEvents){
      if (!merged.length || r.s>merged.at(-1).e) merged.push({...r});
      else merged.at(-1).e = Math.max(merged.at(-1).e, r.e);
    }

    // gaps
    let cursor = ws;
    for(const r of merged){
      if (r.s - cursor >= durationMin) slots.push({date:dateKey, s:cursor, e: r.s});
      cursor = Math.max(cursor, r.e);
    }
    if (we - cursor >= durationMin) slots.push({date:dateKey, s:cursor, e:we});
  });

  return slots.map(x=> ({...x, len: x.e - x.s}));
}

/* —— モーダル —— */
function coord_openNew(prefillDate){
  coord_editingId = null;
  coord.cModalTitle.textContent = "新規予定";
  coord.cDeleteBtn.style.display='none';
  coord.cf_id.value = '';
  coord.cf_title.value = '';
  coord.cf_party.value = '';
  coord.cf_date.value = prefillDate || toISO(new Date());
  coord.cf_start.value = '10:00';
  coord.cf_end.value = '11:00';
  coord.cf_color.value = '#0072B2';
  coord.cf_status.value = '仮';
  coord.cf_note.value = '';
  coord.cf_workStart.value = coord_work.start || '';
  coord.cf_workEnd.value = coord_work.end || '';
  coord.cModal.showModal();
}
function coord_openEdit(id){
  coord_editingId = id;
  const e = db.schedules.find(x=>x.id===id); if(!e) return;
  coord.cModalTitle.textContent = "予定を編集";
  coord.cDeleteBtn.style.display='inline-flex';
  coord.cf_id.value = e.id;
  coord.cf_title.value = e.title || '';
  coord.cf_party.value = e.party || '';
  coord.cf_date.value = e.date;
  coord.cf_start.value = e.start || '';
  coord.cf_end.value = e.end || '';
  coord.cf_color.value = e.color || '#8C8C8C';
  coord.cf_status.value = e.status || '確定';
  coord.cf_note.value = e.note || '';
  coord.cf_workStart.value = coord_work.start || '';
  coord.cf_workEnd.value = coord_work.end || '';
  coord.cModal.showModal();
}
function coord_getForm(){
  return {
    title: coord.cf_title.value.trim(),
    party: coord.cf_party.value.trim(),
    date: coord.cf_date.value,
    start: coord.cf_start.value,
    end: coord.cf_end.value,
    color: coord.cf_color.value,
    status: coord.cf_status.value,
    note: coord.cf_note.value.trim(),
  };
}

/* —— イベント配線（スケ調） —— */
coord.cTabWeek.addEventListener('click',()=> coord_setView('week'));
coord.cTabMonth.addEventListener('click',()=> coord_setView('month'));
function coord_setView(v){
  if (v==='week'){ coord.weekView.style.display=''; coord.monthView.style.display='none';
    coord.cTabWeek.classList.add('active'); coord.cTabMonth.classList.remove('active');
  }else{ coord.weekView.style.display='none'; coord.monthView.style.display='';
    coord.cTabWeek.classList.remove('active'); coord.cTabMonth.classList.add('active');
  }
}
document.addEventListener('keydown',(e)=>{
  if (scrCoord.hidden) return;
  if (e.key==='ArrowLeft'){ coord_viewDate = addDays(coord_viewDate,-7); coord_renderAll(); }
  if (e.key==='ArrowRight'){ coord_viewDate = addDays(coord_viewDate,7); coord_renderAll(); }
});
coord.cNewBtn.addEventListener('click', ()=> coord_openNew());
coord.cDeleteBtn.addEventListener('click', ()=>{
  const id = coord.cf_id.value; if(!id) return;
  if(!confirm('この予定を削除しますか？')) return;
  db.schedules = db.schedules.filter(x=>x.id!==id); save(); coord.cModal.close();
  renderSched(); renderAutoActsBox(state.selDate); coord_renderAll();
});
coord.cForm.addEventListener('submit',(ev)=>{
  ev.preventDefault();
  const data = coord_getForm();
  if (!data.title) return alert('タイトルは必須です');
  if (parseTime(data.end) <= parseTime(data.start)) return alert('終了時刻は開始より後にしてください');
  // 保存
  if (coord_editingId){
    const i = db.schedules.findIndex(x=>x.id===coord_editingId);
    db.schedules[i] = {...db.schedules[i], ...data, updatedAt:Date.now()};
  }else{
    db.schedules.push({ ...data, id:newId(), done:false, createdAt:Date.now(), updatedAt:Date.now() });
  }
  // 勤務時間
  const ws = coord.cf_workStart.value, we = coord.cf_workEnd.value;
  if (ws && we){ coord_work = {start:ws, end:we}; persistCoordWork(); }

  save(); coord.cModal.close();
  state.selDate = data.date;
  renderCalendar(); renderDayList(); renderSched(); coord_renderAll();
});
coord.cQ.addEventListener('input', ()=> coord_renderAll());
coord.cStatus.addEventListener('change', ()=> coord_renderAll());
coord.cFindSlots.addEventListener('click', ()=>{
  const dur = Number(coord.cDur.value||60);
  const slots = coord_computeFreeSlots(dur);
  const body = coord.cSlotsBody;
  if (!slots.length){
    body.innerHTML = `<div class="c-badge">今週は${dur}分の連続空きが見つかりませんでした。</div>`;
    coord.cSlotsModal.showModal(); return;
  }
  body.innerHTML = slots.slice(0,40).map(s=>{
    const d = new Date(s.date);
    const fmtHM = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
    return `<button class="c-btn" style="margin:4px 6px" data-slot="${s.date}|${fmtHM(s.s)}|${fmtHM(s.s+dur)}">
      ${d.getMonth()+1}/${d.getDate()}（${weekday[d.getDay()]}） ${fmtHM(s.s)}–${fmtHM(s.s+dur)}
    </button>`;
  }).join('');
  body.querySelectorAll('[data-slot]').forEach(b=>{
    b.addEventListener('click',()=>{
      const [date, st, en] = b.dataset.slot.split('|');
      coord_openNew(date);
      coord.cf_start.value = st; coord.cf_end.value = en;
      coord.cSlotsModal.close();
    });
  });
  coord.cSlotsModal.showModal();
});

/* ========= 初期化 ========= */
(function init(){
  // 初回サンプル
  const today=toISO(new Date());
  state.selDate=today;
  if(!db.entries.length){
    db.entries.push({id:newId(),date:today,title:'はじめての日記',body:'ここにメモできます。',wake:'',breakfast:'',lunch:'',dinner:'',createdAt:Date.now(),updatedAt:Date.now()});
    save();
  }
  renderCalendar(); selectDate(state.selDate); renderDayList();
  renderSched();
  coord_renderAll();
  q.dispatchEvent(new Event('input'));

  // SW登録（存在すれば）— ④sw.js で有効
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
})();
// ===== 設定ダイアログ =====
const settingsBtn = document.getElementById('btnSettings');
const settingsDialog = document.getElementById('settingsDialog');
const settingsClose = document.getElementById('btnSettingsClose');
const importInput = document.getElementById('importFile');
const exportBtn = document.getElementById('btnExport');

if (settingsBtn && settingsDialog) {
  settingsBtn.addEventListener('click', () => settingsDialog.showModal());
}
if (settingsClose && settingsDialog) {
  settingsClose.addEventListener('click', () => settingsDialog.close());
}

// ---- データのエクスポート ----
// ここでは "zz_" または "zezehibi_" で始まる localStorage を対象にする想定。
// 実際に使っているキー名に合わせて調整してOKです。
function collectZezehibiData() {
  const result = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('zz_') || key.startsWith('zezehibi_')) {
      result[key] = localStorage.getItem(key);
    }
  }
  return result;
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const data = collectZezehibiData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `zezehibi-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('バックアップファイルをダウンロードしました。');
  });
}

// ---- データのインポート ----
if (importInput) {
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        let count = 0;
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
            count++;
          }
        }
        alert(`インポート完了：${count} 件のデータを読み込みました。\n画面を再読み込みします。`);
        location.reload();
      } catch (err) {
        console.error(err);
        alert('インポートに失敗しました。JSONファイルを確認してください。');
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

