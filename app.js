// ===== Firebase 初期化（モジュラーSDK／CDN） =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAnalytics
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// あなたの Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAXhTD5pg9_PdNH-7qNHVt9SlCHXxXAzSY",
  authDomain: "zezehibi.firebaseapp.com",
  projectId: "zezehibi",
  storageBucket: "zezehibi.firebasestorage.app",
  messagingSenderId: "222553318634",
  appId: "1:222553318634:web:a0454885d44758b085e393",
  measurementId: "G-CGMZN2RB9G"
};

let app, analytics, auth, provider, db;
try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase 初期化に失敗しました:", e);
}

// ===== DOM 取得 =====
const todayLabel = document.getElementById("todayLabel");
const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const daySummary = document.getElementById("daySummary");
const summaryDateBadge = document.getElementById("summaryDateBadge");
const summaryText = document.getElementById("summaryText");

const backToCalendarBtn = document.getElementById("backToCalendarBtn");
const editDateMain = document.getElementById("editDateMain");
const editDateSub = document.getElementById("editDateSub");
const editTitle = document.getElementById("editTitle");
const editBody = document.getElementById("editBody");
const saveEntryBtn = document.getElementById("saveEntryBtn");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

const authStatus = document.getElementById("authStatus");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

const tabButtons = document.querySelectorAll(".tab-btn");

// ===== 状態管理 =====
let currentYearMonth = getYearMonth(new Date());
let selectedDate = toDateKey(new Date()); // "YYYY-MM-DD"
let diaryData = loadLocalData();          // { [dateKey]: {title, body, createdAt, updatedAt} }
let currentUser = null;

// ===== 日付ユーティリティ =====
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getYearMonth(date) {
  return { year: date.getFullYear(), month: date.getMonth() }; // month: 0-11
}

function formatJaDate(dateKey) {
  const date = fromDateKey(dateKey);
  const wnames = ["日", "月", "火", "水", "木", "金", "土"];
  const w = wnames[date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${w}）`;
}

// ===== ローカルストレージ =====
const LS_KEY = "zezehibi_diary";

function loadLocalData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn("ローカルデータ読み込み失敗", e);
    return {};
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(diaryData));
  } catch (e) {
    console.warn("ローカルデータ保存失敗", e);
  }
}

// ===== Firestore 同期 =====
async function syncToCloud() {
  if (!db || !currentUser) return;
  try {
    const colRef = collection(db, "users", currentUser.uid, "entries");
    const allKeys = Object.keys(diaryData);
    for (const key of allKeys) {
      const entry = diaryData[key];
      await setDoc(doc(colRef, key), entry, { merge: true });
    }
  } catch (e) {
    console.warn("クラウド同期失敗", e);
  }
}

async function loadFromCloud() {
  if (!db || !currentUser) return;
  try {
    const colRef = collection(db, "users", currentUser.uid, "entries");
    const snap = await getDocs(colRef);
    const cloudData = {};
    snap.forEach(docSnap => {
      cloudData[docSnap.id] = docSnap.data();
    });
    // ローカルとマージ（クラウド優先）
    diaryData = { ...diaryData, ...cloudData };
    saveLocalData();
    renderCalendar();
  } catch (e) {
    console.warn("クラウド読み込み失敗", e);
  }
}

// ===== 画面切り替え =====
function switchScreen(target) {
  const mapping = {
    calendar: "screen-calendar",
    edit: "screen-edit",
    search: "screen-search",
    settings: "screen-settings"
  };

  document.querySelectorAll(".screen").forEach(sec => {
    sec.classList.remove("screen-active", "active");
  });

  const id = mapping[target];
  const sec = document.getElementById(id);
  if (sec) sec.classList.add("screen-active");

  tabButtons.forEach(btn => btn.classList.remove("tab-active", "active"));
  const tab = Array.from(tabButtons).find(b => b.dataset.target === target);
  if (tab) tab.classList.add("tab-active");

  if (target === "edit") {
    fillEditScreen(selectedDate);
  } else if (target === "search") {
    runSearch(searchInput.value.trim());
  }
}

// ===== カレンダー描画 =====
function renderCalendar() {
  const { year, month } = currentYearMonth;
  const first = new Date(year, month, 1);
  const firstDay = first.getDay(); // 0:日
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  // 月表示
  monthLabel.textContent = `${year}年${month + 1}月`;

  // 今日ラベル
  const today = new Date();
  todayLabel.textContent = formatJaDate(toDateKey(today));

  // グリッド生成
  calendarGrid.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    let dateKey;
    let dayNum;
    let isCurrentMonth = true;

    if (i < firstDay) {
      // 前月
      dayNum = prevMonthDays - (firstDay - 1 - i);
      const d = new Date(year, month - 1, dayNum);
      dateKey = toDateKey(d);
      cell.classList.add("out");
      isCurrentMonth = false;
    } else if (i >= firstDay + daysInMonth) {
      // 次月
      dayNum = i - (firstDay + daysInMonth) + 1;
      const d = new Date(year, month + 1, dayNum);
      dateKey = toDateKey(d);
      cell.classList.add("out");
      isCurrentMonth = false;
    } else {
      // 今月
      dayNum = i - firstDay + 1;
      const d = new Date(year, month, dayNum);
      dateKey = toDateKey(d);
    }

    const date = fromDateKey(dateKey);
    const day = date.getDay();

    const numEl = document.createElement("div");
    numEl.className = "day-num";
    numEl.textContent = dayNum;
    if (day === 0) cell.classList.add("sun");
    if (day === 6) cell.classList.add("sat");

    const tagsEl = document.createElement("div");
    tagsEl.className = "day-tags";
    const entry = diaryData[dateKey];
    if (entry && entry.title) tagsEl.textContent = entry.title;

    cell.dataset.dateKey = dateKey;
    cell.appendChild(numEl);
    cell.appendChild(tagsEl);

    // today / selected
    const todayKey = toDateKey(new Date());
    if (dateKey === todayKey) cell.classList.add("today");
    if (dateKey === selectedDate) cell.classList.add("selected");

    // クリック・ダブルクリック判定
    attachDayCellEvents(cell);

    calendarGrid.appendChild(cell);
  }

  updateSummary();
}

// ダブルタップ判定用
let lastTapTime = 0;
let lastTapDateKey = null;

function attachDayCellEvents(cell) {
  cell.addEventListener("click", (ev) => {
    const now = Date.now();
    const dateKey = cell.dataset.dateKey;

    if (now - lastTapTime < 350 && lastTapDateKey === dateKey) {
      // ダブルタップ
      selectedDate = dateKey;
      highlightSelected();
      updateSummary();
      switchScreen("edit");
    } else {
      // シングルタップ
      selectedDate = dateKey;
      highlightSelected();
      updateSummary();
    }

    lastTapTime = now;
    lastTapDateKey = dateKey;
  });
}

function highlightSelected() {
  document.querySelectorAll(".day-cell").forEach(c => c.classList.remove("selected"));
  const target = Array.from(document.querySelectorAll(".day-cell"))
    .find(c => c.dataset.dateKey === selectedDate);
  if (target) target.classList.add("selected");
}

function updateSummary() {
  summaryDateBadge.textContent = formatJaDate(selectedDate);
  const entry = diaryData[selectedDate];
  if (entry && entry.title) {
    summaryText.textContent = entry.title;
  } else {
    summaryText.textContent = "まだ日記はありません。ダブルタップで作成できます。";
  }
}

// ===== 編集画面 =====
function fillEditScreen(dateKey) {
  const labelMain = formatJaDate(dateKey);
  const date = fromDateKey(dateKey);
  editDateMain.textContent = labelMain;
  editDateSub.textContent =
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2,"0")}`;

  const entry = diaryData[dateKey];
  editTitle.value = entry?.title || "";
  editBody.value = entry?.body || "";
}

saveEntryBtn.addEventListener("click", async () => {
  const title = editTitle.value.trim();
  const body = editBody.value.trim();

  if (!title && !body) {
    // 空なら削除扱い
    if (diaryData[selectedDate]) {
      delete diaryData[selectedDate];
      await deleteCloudEntry(selectedDate);
    }
  } else {
    const now = new Date().toISOString();
    const prev = diaryData[selectedDate] || {};
    diaryData[selectedDate] = {
      title,
      body,
      createdAt: prev.createdAt || now,
      updatedAt: now
    };
    await saveCloudEntry(selectedDate, diaryData[selectedDate]);
  }

  saveLocalData();
  renderCalendar();
  alert("保存しました。");
});

deleteEntryBtn.addEventListener("click", async () => {
  if (!diaryData[selectedDate]) {
    alert("この日に保存された日記はありません。");
    return;
  }
  if (!confirm("この日の日記を削除しますか？")) return;
  delete diaryData[selectedDate];
  saveLocalData();
  await deleteCloudEntry(selectedDate);
  renderCalendar();
  fillEditScreen(selectedDate);
  alert("削除しました。");
});

backToCalendarBtn.addEventListener("click", () => {
  switchScreen("calendar");
});

// Firestore 単一保存/削除
async function saveCloudEntry(dateKey, entry) {
  if (!db || !currentUser) return;
  try {
    const colRef = collection(db, "users", currentUser.uid, "entries");
    await setDoc(doc(colRef, dateKey), entry, { merge: true });
  } catch (e) {
    console.warn("クラウド保存失敗", e);
  }
}
async function deleteCloudEntry(dateKey) {
  if (!db || !currentUser) return;
  try {
    const colRef = collection(db, "users", currentUser.uid, "entries");
    await deleteDoc(doc(colRef, dateKey));
  } catch (e) {
    console.warn("クラウド削除失敗", e);
  }
}

// ===== 検索 =====
function runSearch(keyword) {
  searchResults.innerHTML = "";
  if (!keyword) return;

  const lc = keyword.toLowerCase();
  const keys = Object.keys(diaryData).sort(); // 日付順
  for (const key of keys) {
    const entry = diaryData[key];
    const text = (entry.title || "") + " " + (entry.body || "");
    if (!text.toLowerCase().includes(lc)) continue;

    const card = document.createElement("article");
    card.className = "card";
    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = entry.title || "(タイトルなし)";

    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = formatJaDate(key);

    card.appendChild(titleEl);
    card.appendChild(sub);

    card.addEventListener("click", () => {
      selectedDate = key;
      switchScreen("edit");
    });

    searchResults.appendChild(card);
  }
}

searchInput.addEventListener("input", (e) => {
  runSearch(e.target.value.trim());
});

// ===== 設定：ログイン／ログアウト・バックアップ =====
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (!auth || !provider) {
      alert("Firebase 初期化に失敗しているため、ログインできません。");
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert("ログインに失敗しました。Firebase コンソールで承認済みドメインに GitHub Pages のURLが入っているか確認してください。");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (!auth) return;
    await signOut(auth);
  });
}

// 認証状態監視
if (auth) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      authStatus.textContent = `ログイン中: ${user.displayName || user.email}`;
      await loadFromCloud();
    } else {
      authStatus.textContent = "未ログイン";
    }
  });
}

// エクスポート
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(diaryData, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zezehibi-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

// インポート
importInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (typeof data !== "object") throw new Error("形式不正");
    diaryData = { ...diaryData, ...data };
    saveLocalData();
    renderCalendar();
    alert("インポートしました。");
  } catch (err) {
    console.error(err);
    alert("インポートに失敗しました。ファイルを確認してください。");
  } finally {
    importInput.value = "";
  }
});

// ===== タブ操作 =====
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    if (target === "edit") {
      fillEditScreen(selectedDate);
    }
    switchScreen(target);
  });
});

// 月移動
prevMonthBtn.addEventListener("click", () => {
  const { year, month } = currentYearMonth;
  const d = new Date(year, month - 1, 1);
  currentYearMonth = getYearMonth(d);
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  const { year, month } = currentYearMonth;
  const d = new Date(year, month + 1, 1);
  currentYearMonth = getYearMonth(d);
  renderCalendar();
});

// ===== 初期表示 =====
(function init() {
  currentYearMonth = getYearMonth(new Date());
  selectedDate = toDateKey(new Date());
  renderCalendar();
})();
