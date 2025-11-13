/* =========================================================
   ZEZEHIBI app.js — Calendar-first, Editor as separate screen
   ========================================================= */

/* ---------- Utilities ---------- */
const WJP = ["日","月","火","水","木","金","土"];
const toISO = d => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0, 10);
const fmtJP = iso => {
  const [y,m,dd] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, dd);
  return `${m}月${dd}日(${WJP[dt.getDay()]})`;
};
const esc = s => (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const newId = () => "id_" + Math.random().toString(36).slice(2,8) + Date.now().toString(36);

/* ---------- Storage ---------- */
const STORAGE_KEY = "zezehibi.v3";

function loadDB(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (!Array.isArray(obj.entries)) obj.entries = [];
      return obj;
    }
  } catch(_) {}
  return { entries: [] };
}

let db = loadDB();
const saveDB = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

/* ---------- State ---------- */
const state = {
  screen: "diary",
  month: (()=>{const d=new Date(); d.setDate(1); return d;})(),
  selDate: toISO(new Date()),
  currentEntryId: null
};

/* ---------- DOM ---------- */
const screenDiary  = document.getElementById("screenDiary");
const screenSched  = document.getElementById("screenSched");
const screenSearch = document.getElementById("screenSearch");
const screenCoord  = document.getElementById("screenCoord");
const screenEditor = document.getElementById("screenEditor");

const tabDiary  = document.getElementById("tabDiary");
const tabSched  = document.getElementById("tabSched");
const tabSearch = document.getElementById("tabSearch");
const tabCoord  = document.getElementById("tabCoord");

const todayBadge = document.getElementById("todayBadge");

const prevM = document.getElementById("prevM");
const nextM = document.getElementById("nextM");
const monthLabel = document.getElementById("monthLabel");
const calGrid = document.getElementById("calGrid");

const selISO = document.getElementById("selISO");
const selJP  = document.getElementById("selJP");

const dateInput = document.getElementById("dateInput");
const wakeEl = document.getElementById("wake");
const breakfastEl = document.getElementById("breakfast");
const lunchEl = document.getElementById("lunch");
const dinnerEl = document.getElementById("dinner");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const editISO = document.getElementById("editISO");
const editJP = document.getElementById("editJP");
const saveState = document.getElementById("saveState");
const deleteEntryBtn = document.getElementById("deleteEntry");
const saveEntryBtn = document.getElementById("saveEntry");
const backToCalendar = document.getElementById("backToCalendar");

/* ---------- Screen switching ---------- */
function showScreen(name){
  state.screen = name;

  // disable all
  [screenDiary, screenSched, screenSearch, screenCoord, screenEditor]
    .forEach(s => s.hidden = true);

  // deactivate tabs
  [tabDiary, tabSched, tabSearch, tabCoord]
    .forEach(t => t.classList.remove("active","tab-active"));

  // show
  if (name === "diary") {
    screenDiary.hidden = false;
    tabDiary.classList.add("tab-active","active");
    renderDiary();
  }
  if (name === "sched") {
    screenSched.hidden = false;
    tabSched.classList.add("tab-active","active");
  }
  if (name === "search") {
    screenSearch.hidden = false;
    tabSearch.classList.add("tab-active","active");
  }
  if (name === "coord") {
    screenCoord.hidden = false;
    tabCoord.classList.add("tab-active","active");
  }
  if (name === "editor") {
    screenEditor.hidden = false;
  }
}

/* ---------- Entry helpers ---------- */
function entryOn(iso){
  return db.entries.find(e => e.date === iso) || null;
}

function ensureEntry(iso){
  let e = entryOn(iso);
  if (!e) {
    e = {
      id: newId(),
      date: iso,
      title: "",
      body: "",
      wake: "",
      breakfast: "",
      lunch: "",
      dinner: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.entries.push(e);
    saveDB();
  }
  return e;
}

/* ---------- Calendar rendering ---------- */
function startOfCalendarGrid(firstDate){
  const dow = firstDate.getDay();
  const start = new Date(firstDate);
  start.setDate(1 - dow);
  return start;
}

function renderDiary(){
  /* Today */
  const t = new Date();
  todayBadge.textContent = `${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日(${WJP[t.getDay()]})`;

  /* Month label */
  const y = state.month.getFullYear();
  const m = state.month.getMonth();
  monthLabel.textContent = `${y}年 ${m+1}月`;

  /* Calendar */
  calGrid.innerHTML = "";
  const gridStart = startOfCalendarGrid(state.month);
  const todayISO = toISO(new Date());

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = toISO(d);

    const cell = document.createElement("div");
    cell.className = "day-cell";
    const inMonth = d.getMonth() === m;
    if (!inMonth) cell.classList.add("out");

    const dow = d.getDay();
    if (dow === 0) cell.classList.add("sun");
    if (dow === 6) cell.classList.add("sat");
    if (iso === todayISO) cell.classList.add("today");
    if (iso === state.selDate) cell.classList.add("selected");

    /* Number */
    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = d.getDate();

    /* Tags (title preview) */
    const tags = document.createElement("div");
    tags.className = "day-tags";
    const e = entryOn(iso);
    if (e && (e.title || e.body)) {
      const tag = e.title || (e.body || "").split(/\r?\n/)[0];
      tags.innerHTML = esc(tag);
    }

    cell.appendChild(num);
    cell.appendChild(tags);

    /* Click = select day */
    cell.addEventListener("click", () => {
      state.selDate = iso;
      renderDiary();
    });

    /* Double tap */
    let lastTap = 0;
    cell.addEventListener("touchend", ()=> {
      const now = Date.now();
      if (now - lastTap < 300) {
        openEditorFor(iso);
      }
      lastTap = now;
    }, { passive: true });

    /* Double click */
    cell.addEventListener("dblclick", ()=> openEditorFor(iso));

    calGrid.appendChild(cell);
  }

  /* Selected date header */
  selISO.textContent = state.selDate;
  selJP.textContent  = fmtJP(state.selDate);
}

/* ---------- Editor ---------- */
function openEditorFor(iso){
  const e = ensureEntry(iso);
  state.currentEntryId = e.id;

  dateInput.value = e.date;
  wakeEl.value = e.wake;
  breakfastEl.value = e.breakfast;
  lunchEl.value = e.lunch;
  dinnerEl.value = e.dinner;
  titleEl.value = e.title;
  bodyEl.value = e.body;

  editISO.textContent = e.date;
  editJP.textContent  = fmtJP(e.date);

  showScreen("editor");
}

function currentEntry(){
  return db.entries.find(e => e.id === state.currentEntryId) || null;
}

function saveEntry(){
  const e = currentEntry(); if (!e) return;

  e.date = dateInput.value;
  e.wake = wakeEl.value;
  e.breakfast = breakfastEl.value;
  e.lunch = lunchEl.value;
  e.dinner = dinnerEl.value;
  e.title = titleEl.value.trim();
  e.body  = bodyEl.value;
  e.updatedAt = Date.now();

  saveDB();
  state.selDate = e.date;
  saveState.textContent = "保存済み";
  setTimeout(()=> saveState.textContent = "—", 1200);
}

function deleteEntry(){
  const e = currentEntry();
  if (!e) return;
  if (!confirm("この日記を削除しますか？")) return;
  db.entries = db.entries.filter(x => x.id !== e.id);
  saveDB();
  showScreen("diary");
  renderDiary();
}

/* ---------- Events ---------- */

/* Tabs */
tabDiary.addEventListener("click", ()=> showScreen("diary"));
tabSched.addEventListener("click", ()=> showScreen("sched"));
tabSearch.addEventListener("click",()=> showScreen("search"));
tabCoord.addEventListener("click", ()=> showScreen("coord"));

/* Month navigation */
prevM.addEventListener("click", ()=>{
  state.month.setMonth(state.month.getMonth()-1);
  renderDiary();
});
nextM.addEventListener("click", ()=>{
  state.month.setMonth(state.month.getMonth()+1);
  renderDiary();
});

/* Editor buttons */
backToCalendar.addEventListener("click", ()=>{
  showScreen("diary");
  renderDiary();
});
saveEntryBtn.addEventListener("click", saveEntry);
deleteEntryBtn.addEventListener("click", deleteEntry);

/* Auto-save (typing) */
let typingTimer = null;
[dateInput, wakeEl, breakfastEl, lunchEl, dinnerEl, titleEl, bodyEl].forEach(el => {
  el.addEventListener("input", ()=>{
    saveState.textContent = "保存中…";
    clearTimeout(typingTimer);
    typingTimer = setTimeout(saveEntry, 400);
  });
});

/* Init */
(function init(){
  if (!db.entries.length){
    const today = toISO(new Date());
    db.entries.push({
      id: newId(),
      date: today,
      title: "はじめての日記",
      body: "ここにメモできます。",
      wake: "",
      breakfast: "",
      lunch: "",
      dinner: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    saveDB();
  }
  state.selDate = toISO(new Date());
  showScreen("diary");
  renderDiary();
})();

/* PWA */
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
