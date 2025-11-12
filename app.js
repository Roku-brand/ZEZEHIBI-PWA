/* =========================
   ZEZEHIBI app.js (full)
   ========================= */

/* ---------- Const / Util ---------- */
const STORAGE_KEY = "zezehibi.v1";
const WJP = ["日","月","火","水","木","金","土"];
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const toISO = (d)=> new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const pad = (n)=> String(n).padStart(2,"0");
const esc = (s)=> (s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
const fmtJP = (iso)=>{ const [y,m,d]=iso.split("-").map(Number); const dt=new Date(y,m-1,d); return `${m}月${d}日(${WJP[dt.getDay()]})`; };

/* ---------- DB (localStorage) ---------- */
function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = raw ? JSON.parse(raw) : { entries:[], schedules:[], work:{} };
    if(!Array.isArray(base.entries)) base.entries=[];
    if(!Array.isArray(base.schedules)) base.schedules=[];
    if(typeof base.work!=="object"||!base.work) base.work={};
    return base;
  }catch{ return { entries:[], schedules:[], work:{} }; }
}
let db = loadDB();
const persist = ()=> localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

/* ---------- Global State ---------- */
let state = {
  viewMonth: (()=>{ const d=new Date(); d.setDate(1); return d; })(),
  selDate: toISO(new Date()),
  // ダブルタップ検出
  _lastTapTime: 0,
  _lastTapTarget: null,
};

/* ---------- Elements ---------- */
// Top
const todayBadge = $("#todayBadge");
// Tabs
const tabDiary=$("#tabDiary"), tabSched=$("#tabSched"), tabSearch=$("#tabSearch"), tabCoord=$("#tabCoord");
const screens = {
  diary: $("#screenDiary"),
  sched: $("#screenSched"),
  search: $("#screenSearch"),
  coord: $("#screenCoord"),
  editor: $("#screenEditor"),
};
// Diary screen
const monthLabel = $("#monthLabel");
const calGrid = $("#calGrid");
const prevM = $("#prevM"), nextM = $("#nextM");
const daySummary = $("#daySummary");
const selISO = $("#selISO"), selJP=$("#selJP");
const dayCards = $("#dayCards");
const openEditorBtn = $("#openEditorBtn");

// Schedule mini (簡易)
const sPrevM=$("#sPrevM"), sNextM=$("#sNextM");
const schedMonthLabel=$("#schedMonthLabel");
const schedGrid=$("#schedGrid");
const schedList=$("#schedList");
const schedKPI=$("#schedKPI");

// Search
const q = $("#q");
const searchDiary = $("#searchDiary");
const searchSched = $("#searchSched");

// Editor screen
const backToCalendar = $("#backToCalendar");
const editISO=$("#editISO"), editJP=$("#editJP");
const dateInput=$("#dateInput"), wakeEl=$("#wake");
const breakfastEl=$("#breakfast"), lunchEl=$("#lunch"), dinnerEl=$("#dinner");
const titleEl=$("#title"), bodyEl=$("#body");
const deleteEntry=$("#deleteEntry"), saveEntryBtn=$("#saveEntry"), saveState=$("#saveState");

/* ---------- Helpers ---------- */
const entriesOn = (iso)=> db.entries.filter(e=>e.date===iso).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
const schedOn = (iso)=> db.schedules.filter(s=>s.date===iso).sort((a,b)=> ((a.start||"") < (b.start||""))? -1: 1);
const ensureEntry = (iso)=>{ let e=db.entries.find(x=>x.date===iso); if(!e){ e={
  id: "id_"+Math.random().toString(36).slice(2,8)+Date.now().toString(36),
  date: iso, wake:"", breakfast:"", lunch:"", dinner:"",
  title:"", body:"", createdAt: Date.now(), updatedAt: Date.now()
}; db.entries.push(e); persist(); } return e; };

/* ---------- Screen switch ---------- */
function setActiveTab(id){
  [tabDiary,tabSched,tabSearch,tabCoord].forEach(b=>{
    const active = b.id===id;
    b.classList.toggle("tab-active", active);
    b.setAttribute("aria-selected", active ? "true":"false");
  });
}
function showScreen(name){
  Object.values(screens).forEach(el=> el.classList.remove("active","screen-active"));
  screens[name].classList.add("active","screen-active");
  setActiveTab({screenDiary:"tabDiary",screenSched:"tabSched",screenSearch:"tabSearch",screenCoord:"tabCoord",screenEditor:null}[screens[name].id] || "");
  // 末尾余白が被らないようにスクロール位置調整は不要（余白をHTML側で確保済）
}

/* ---------- Calendar render (7x6) ---------- */
function startOfCalendar(monthDate){
  // 月初の曜日。日曜始まりで、前月末を埋める開始日を返す
  const y = monthDate.getFullYear(), m = monthDate.getMonth();
  const first = new Date(y,m,1);
  const dow = first.getDay(); // 0..6 (Sun..Sat)
  const start = new Date(y,m,1 - dow);
  start.setHours(0,0,0,0);
  return start;
}
function renderCalendar(){
  const y = state.viewMonth.getFullYear(), m = state.viewMonth.getMonth();
  monthLabel.textContent = `${y}年 ${m+1}月`;
  // 42 cells
  calGrid.innerHTML = "";
  const start = startOfCalendar(state.viewMonth);
  for(let i=0; i<42; i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const iso = toISO(d);
    const inMonth = d.getMonth()===m;
    const wd = d.getDay();
    const cell = document.createElement("div");
    cell.className = "day-cell" + (inMonth?"":" out");
    if(wd===0) cell.classList.add("sun");
    if(wd===6) cell.classList.add("sat");
    if(iso===toISO(new Date())) cell.classList.add("today");
    if(iso===state.selDate) cell.classList.add("selected");

    // number
    const num = document.createElement("div");
    num.className="day-num";
    num.textContent = d.getDate();
    cell.appendChild(num);

    // tags (titles of this day)
    const tags = document.createElement("div");
    tags.className="day-tags";
    const titles = entriesOn(iso)
      .map(e=> (e.title || e.body || "").trim())
      .filter(Boolean);
    tags.innerHTML = esc(titles.join("\n"));
    cell.appendChild(tags);

    // selection & double tap to open editor
    cell.dataset.iso = iso;
    cell.addEventListener("click", ()=> selectDate(iso, cell));
    cell.addEventListener("dblclick", ()=> openEditorFor(iso));

    // double-tap (mobile)
    cell.addEventListener("touchend", (ev)=>{
      const now = Date.now();
      if(state._lastTapTarget===cell && (now - state._lastTapTime) < 350){
        state._lastTapTime = 0; state._lastTapTarget = null;
        ev.preventDefault();
        openEditorFor(iso);
      }else{
        state._lastTapTarget = cell; state._lastTapTime = now;
        // クリック扱いで日付選択
        selectDate(iso, cell);
      }
    }, {passive:false});

    calGrid.appendChild(cell);
  }
  renderDaySummary();
  renderDayCards();
}

/* ---------- Select Date ---------- */
function selectDate(iso, cell){
  state.selDate = iso;
  $$(".day-cell.selected", calGrid).forEach(n=> n.classList.remove("selected"));
  if(cell) cell.classList.add("selected");
  selISO.textContent = iso;
  selJP.textContent = fmtJP(iso);
  renderDayCards();
}

/* ---------- Day Summary & Cards ---------- */
function renderDaySummary(){
  selISO.textContent = state.selDate;
  selJP.textContent = fmtJP(state.selDate);
}
function renderDayCards(){
  const list = entriesOn(state.selDate);
  dayCards.innerHTML = "";
  if(!list.length){
    const empty = document.createElement("div");
    empty.className="card";
    empty.innerHTML = `<div class="card-title">この日の記録はまだありません</div>
      <div class="card-sub">ダブルタップ/ダブルクリックで作成できます</div>`;
    dayCards.appendChild(empty);
    return;
  }
  list.forEach(e=>{
    const card = document.createElement("div");
    card.className="card";
    const meals = [
      e.wake && `☀️ ${e.wake}`,
      e.breakfast && `🍳 ${esc(e.breakfast)}`,
      e.lunch && `🍱 ${esc(e.lunch)}`,
      e.dinner && `🍽️ ${esc(e.dinner)}`
    ].filter(Boolean).join(" / ");
    card.innerHTML = `
      <div class="card-title">${esc(e.title || "(無題)")}</div>
      <div class="card-sub">${e.date}${meals ? "　" + meals : ""}</div>
    `;
    card.addEventListener("click", ()=> openEditorWithEntry(e.id));
    dayCards.appendChild(card);
  });
}

/* ---------- Editor ---------- */
let currentEntryId = null;

function fillEditorByEntry(e){
  editISO.textContent = e.date;
  editJP.textContent = fmtJP(e.date);
  dateInput.value = e.date;
  wakeEl.value = e.wake || "";
  breakfastEl.value = e.breakfast || "";
  lunchEl.value = e.lunch || "";
  dinnerEl.value = e.dinner || "";
  titleEl.value = e.title || "";
  bodyEl.value = e.body || "";
  saveState.textContent = "—";
}
function openEditorWithEntry(id){
  const e = db.entries.find(x=>x.id===id);
  if(!e) return;
  currentEntryId = id;
  fillEditorByEntry(e);
  showScreen("editor");
}
function openEditorFor(iso){
  // 新規 or 既存の先頭を開く（既存優先）
  const exist = entriesOn(iso)[0];
  const e = exist || ensureEntry(iso);
  currentEntryId = e.id;
  fillEditorByEntry(e);
  showScreen("editor");
}

function currentEntry(){ return db.entries.find(e=> e.id===currentEntryId) || null; }
function updateCurrentFromForm(){
  const cur = currentEntry(); if(!cur) return;
  cur.date = dateInput.value || cur.date;
  cur.wake = wakeEl.value;
  cur.breakfast = breakfastEl.value;
  cur.lunch = lunchEl.value;
  cur.dinner = dinnerEl.value;
  cur.title = titleEl.value;
  cur.body = bodyEl.value;
  cur.updatedAt = Date.now();
}
function saveCurrent(){
  const cur = currentEntry(); if(!cur) return;
  updateCurrentFromForm();
  persist();
  state.selDate = cur.date;
  saveState.textContent = "保存済み";
  setTimeout(()=> saveState.textContent="—", 1200);
  // カレンダーへ反映
  renderCalendar();
}
function deleteCurrent(){
  const cur = currentEntry(); if(!cur) return;
  if(!confirm("この日記を削除しますか？")) return;
  db.entries = db.entries.filter(e=>e.id!==cur.id);
  persist();
  // カレンダー再描画
  renderCalendar();
  showScreen("diary");
}

/* ---------- Schedule (mini) ---------- */
function renderScheduleMonth(){
  const y = state.viewMonth.getFullYear(), m = state.viewMonth.getMonth();
  schedMonthLabel.textContent = `${y}年 ${m+1}月`;
  // KPI
  const startISO = toISO(new Date(y,m,1));
  const endISO = toISO(new Date(y,m+1,0));
  const cnt = db.schedules.filter(s=> s.date>=startISO && s.date<=endISO).length;
  schedKPI.textContent = `今月の予定: ${cnt}`;

  // mini grid (色帯は省略、件数表示のみ)
  schedGrid.innerHTML = "";
  const start = startOfCalendar(state.viewMonth);
  for(let i=0;i<42;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const iso = toISO(d);
    const cell = document.createElement("div");
    cell.className = "day-cell" + (d.getMonth()===m ? "" : " out");
    const num = document.createElement("div");
    num.className="day-num";
    num.textContent = d.getDate();
    cell.appendChild(num);

    const tags = document.createElement("div");
    tags.className="day-tags";
    const items = schedOn(iso);
    if(items.length){
      tags.textContent = items.slice(0,3).map(s => (s.start? s.start+" ":"") + (s.title||"(無題)")).join("\n");
    }
    cell.appendChild(tags);

    cell.addEventListener("click", ()=> {
      state.selDate = iso;
      renderScheduleList();
    });

    schedGrid.appendChild(cell);
  }
  renderScheduleList();
}
function renderScheduleList(){
  const items = schedOn(state.selDate);
  schedList.innerHTML = "";
  if(!items.length){
    const empty = document.createElement("div");
    empty.className="card";
    empty.innerHTML = `<div class="card-title">${fmtJP(state.selDate)} の予定なし</div>`;
    schedList.appendChild(empty);
    return;
  }
  items.forEach(s=>{
    const card = document.createElement("div");
    card.className="card";
    const time = [s.start||"", s.end? `– ${s.end}`:""].filter(Boolean).join(" ");
    card.innerHTML = `
      <div class="card-title">${esc(s.title||"(無題)")}</div>
      <div class="sched-time">${fmtJP(s.date)}／${s.date}　${time}</div>
      ${s.note? `<div class="card-sub">${esc(s.note)}</div>` : ""}
    `;
    schedList.appendChild(card);
  });
}

/* ---------- Search ---------- */
function doSearch(){
  const key = (q.value||"").toLowerCase().trim();
  searchDiary.innerHTML = "";
  searchSched.innerHTML = "";
  if(!key){
    searchDiary.innerHTML = `<div class="card"><div class="card-title">キーワードを入力</div></div>`;
    searchSched.innerHTML = searchDiary.innerHTML;
    return;
  }
  // diary
  const dres = db.entries
    .filter(e=> ((e.title||"")+" "+(e.body||"")+" "+(e.breakfast||"")+" "+(e.lunch||"")+" "+(e.dinner||"")).toLowerCase().includes(key))
    .sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0))
    .slice(0,120);
  if(!dres.length){
    searchDiary.innerHTML = `<div class="card"><div class="card-title">該当なし</div></div>`;
  }else{
    dres.forEach(e=>{
      const card = document.createElement("div");
      card.className="card";
      card.innerHTML = `
        <div class="card-title">${esc(e.title||"(無題)")}</div>
        <div class="card-sub">${fmtJP(e.date)}／${e.date}</div>
      `;
      card.addEventListener("click", ()=>{
        // その日のエディタを開く
        openEditorWithEntry(e.id);
      });
      searchDiary.appendChild(card);
    });
  }
  // sched
  const sres = db.schedules
    .filter(s=> ((s.title||"")+" "+(s.note||"")+" "+(s.party||"")).toLowerCase().includes(key))
    .sort((a,b)=> (a.date+a.start < b.date+b.start ? -1:1))
    .slice(0,120);
  if(!sres.length){
    searchSched.innerHTML = `<div class="card"><div class="card-title">該当なし</div></div>`;
  }else{
    sres.forEach(s=>{
      const card = document.createElement("div");
      card.className="card";
      const time = [s.start||"", s.end?`– ${s.end}`:""].filter(Boolean).join(" ");
      card.innerHTML = `
        <div class="card-title">${esc(s.title||"(無題)")}</div>
        <div class="card-sub">${fmtJP(s.date)}／${s.date}　${time}</div>
      `;
      card.addEventListener("click", ()=>{
        // 予定タブへ移動して当日の予定を表示
        showScreen("sched");
        setActiveTab("tabSched");
        renderScheduleMonth();
        state.selDate = s.date;
        renderScheduleList();
      });
      searchSched.appendChild(card);
    });
  }
}

/* ---------- Tabs Wiring ---------- */
tabDiary.addEventListener("click", ()=>{ showScreen("diary"); });
tabSched.addEventListener("click", ()=>{ showScreen("sched"); renderScheduleMonth(); });
tabSearch.addEventListener("click", ()=>{ showScreen("search"); });
tabCoord.addEventListener("click", ()=>{ showScreen("coord"); /* 簡易のため詳細描画は省略 */ });

/* ---------- Diary month nav ---------- */
prevM.addEventListener("click", ()=>{ state.viewMonth.setMonth(state.viewMonth.getMonth()-1); renderCalendar(); renderScheduleMonth(); });
nextM.addEventListener("click", ()=>{ state.viewMonth.setMonth(state.viewMonth.getMonth()+1); renderCalendar(); renderScheduleMonth(); });

/* ---------- Sched month nav ---------- */
sPrevM.addEventListener("click", ()=>{ state.viewMonth.setMonth(state.viewMonth.getMonth()-1); renderScheduleMonth(); });
sNextM.addEventListener("click", ()=>{ state.viewMonth.setMonth(state.viewMonth.getMonth()+1); renderScheduleMonth(); });

/* ---------- Editor wiring ---------- */
backToCalendar.addEventListener("click", ()=>{ showScreen("diary"); });
openEditorBtn.addEventListener("click", ()=> openEditorFor(state.selDate));

saveEntryBtn.addEventListener("click", saveCurrent);
deleteEntry.addEventListener("click", deleteCurrent);
// 入力中の自動保存（軽めのデバウンス）
[dateInput,wakeEl,breakfastEl,lunchEl,dinnerEl,titleEl,bodyEl].forEach(el=>{
  let t=null;
  el.addEventListener("input", ()=>{
    saveState.textContent = "保存中…";
    if(t) clearTimeout(t);
    t = setTimeout(()=>{ saveCurrent(); }, 400);
  });
});

/* ---------- Search wiring ---------- */
q.addEventListener("input", doSearch);

/* ---------- PWA: SW registration ---------- */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

/* ---------- Init ---------- */
(function init(){
  const now = new Date();
  todayBadge.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${WJP[now.getDay()]}）`;
  // 初回データ雛形（空でもOK。自動生成はエディタを開いた時にensureEntryで行う）
  if(!db.entries) db.entries=[];
  if(!db.schedules) db.schedules=[];
  persist();

  // 今日を選択してレンダリング
  state.selDate = toISO(new Date());
  renderCalendar();
  renderScheduleMonth();
  doSearch();
})();
