// =========================
// ユーティリティ
// =========================
const WJP = ["日", "月", "火", "水", "木", "金", "土"];
const STORAGE_KEY = "zezehibi.diary.v1";

const toISO = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const fmtJP = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日（${WJP[dt.getDay()]}）`;
};

const esc = (s) =>
  (s || "").replace(/[&<>"']/g, (c) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c];
  });

// =========================
// ストレージ
// =========================
function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) return data;
    }
  } catch (_) {}

  // 初期化
  return { entries: [] };
}

function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

let db = loadDB();

// =========================
// 状態
// =========================
let state = {
  currentDate: toISO(new Date()),
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(), // 0-based
  editingId: null,
};

// =========================
// DOM
// =========================
const todayLabel = document.getElementById("todayLabel");
const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const summaryDate = document.getElementById("summaryDate");
const summaryText = document.getElementById("summaryText");

const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");

// エディタ
const screenCalendar = document.getElementById("screen-calendar");
const screenEdit = document.getElementById("screen-edit");
const screenSearch = document.getElementById("screen-search");
const screenSettings = document.getElementById("screen-settings");

const editDate = document.getElementById("editDate");
const editTitle = document.getElementById("editTitle");
const editBody = document.getElementById("editBody");
const editWake = document.getElementById("editWake");
const editBreakfast = document.getElementById("editBreakfast");
const btnBackToCalendar = document.getElementById("btnBackToCalendar");
const btnSaveEntry = document.getElementById("btnSaveEntry");
const btnDeleteEntry = document.getElementById("btnDeleteEntry");
const saveStatus = document.getElementById("saveStatus");

// 検索
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// 設定
const btnMockLogin = document.getElementById("btnMockLogin");
const btnExport = document.getElementById("btnExport");
const importFile = document.getElementById("importFile");

// タブ
const tabButtons = document.querySelectorAll(".tab-btn");

// =========================
// 画面切り替え
// =========================
function showScreen(name) {
  screenCalendar.classList.remove("screen-active");
  screenEdit.classList.remove("screen-active");
  screenSearch.classList.remove("screen-active");
  screenSettings.classList.remove("screen-active");

  if (name === "calendar") screenCalendar.classList.add("screen-active");
  if (name === "edit") screenEdit.classList.add("screen-active");
  if (name === "search") screenSearch.classList.add("screen-active");
  if (name === "settings") screenSettings.classList.add("screen-active");

  tabButtons.forEach((btn) => {
    btn.classList.toggle("tab-active", btn.dataset.screen === name);
  });
}

// =========================
// 日記エントリ操作
// =========================
function findEntryByDate(date) {
  return db.entries.find((e) => e.date === date) || null;
}

function findEntryById(id) {
  return db.entries.find((e) => e.id === id) || null;
}

function ensureEntry(date) {
  let e = findEntryByDate(date);
  if (!e) {
    e = {
      id: "di_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      date,
      title: "",
      body: "",
      wake: "",
      breakfast: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.entries.push(e);
    saveDB();
  }
  return e;
}

// =========================
// カレンダー描画
// =========================
function renderCalendar() {
  const y = state.viewYear;
  const m = state.viewMonth; // 0-based
  monthLabel.textContent = `${y}年 ${m + 1}月`;

  calendarGrid.innerHTML = "";

  // 月初と日数
  const first = new Date(y, m, 1);
  const firstDay = first.getDay(); // 0:日
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  // グリッドは 6×7 = 42 マス
  let startDate = new Date(y, m, 1 - firstDay); // 日曜は1, 月曜は前月
  for (let i = 0; i < 42; i++) {
    const iso = toISO(startDate);
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const inMonth = startDate.getMonth() === m;
    if (!inMonth) cell.classList.add("out");

    const dow = startDate.getDay();
    if (dow === 0) cell.classList.add("sun");
    if (dow === 6) cell.classList.add("sat");

    const todayIso = toISO(new Date());
    if (iso === todayIso) cell.classList.add("today");
    if (iso === state.currentDate) cell.classList.add("selected");

    // 日付番号
    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = startDate.getDate();
    cell.appendChild(num);

    // タイトル（あれば）
    const e = findEntryByDate(iso);
    if (e && (e.title || e.body)) {
      const tag = document.createElement("div");
      tag.className = "day-tags";
      tag.textContent = e.title || e.body.slice(0, 40);
      cell.appendChild(tag);
    }

    // クリック → 選択のみ
    cell.addEventListener("click", () => {
      state.currentDate = iso;
      renderCalendar();
      updateDaySummary();
    });

    // ダブルクリック → 編集画面へ
    cell.addEventListener("dblclick", () => {
      openEditorForDate(iso);
    });

    calendarGrid.appendChild(cell);
    // 次の日
    startDate.setDate(startDate.getDate() + 1);
  }
}

// =========================
// サマリ更新
// =========================
function updateDaySummary() {
  const iso = state.currentDate;
  summaryDate.textContent = iso ? fmtJP(iso) : "—";
  const e = findEntryByDate(iso);
  if (!e) {
    summaryText.textContent = "まだ日記はありません。ダブルタップで作成できます。";
  } else {
    const t = e.title || "（無題）";
    const b = e.body ? e.body.slice(0, 60) : "";
    summaryText.textContent = b ? `${t}｜${b}` : t;
  }
}

// =========================
// エディタ
// =========================
function openEditorForDate(date) {
  const e = ensureEntry(date);
  state.editingId = e.id;

  editDate.value = e.date;
  editTitle.value = e.title || "";
  editBody.value = e.body || "";
  editWake.value = e.wake || "";
  editBreakfast.value = e.breakfast || "";
  saveStatus.textContent = "　";

  showScreen("edit");
}

function openEditorNewToday() {
  const today = toISO(new Date());
  openEditorForDate(today);
}

function saveCurrentEntry() {
  if (!state.editingId) return;
  const e = findEntryById(state.editingId);
  if (!e) return;

  const newDate = editDate.value || e.date;
  const changedDate = newDate !== e.date;

  e.date = newDate;
  e.title = editTitle.value.trim();
  e.body = editBody.value;
  e.wake = editWake.value;
  e.breakfast = editBreakfast.value;
  e.updatedAt = Date.now();

  // 日付変更に備えて他と重複しないように（同日1件だけ想定）
  // 重複は単純に後勝ち
  const dedup = {};
  db.entries.forEach((item) => {
    dedup[item.date] = item;
  });
  db.entries = Object.values(dedup);

  saveDB();

  state.currentDate = e.date;
  state.viewYear = new Date(e.date).getFullYear();
  state.viewMonth = new Date(e.date).getMonth();

  renderCalendar();
  updateDaySummary();

  saveStatus.textContent = "保存しました";
  setTimeout(() => {
    saveStatus.textContent = "　";
  }, 1200);
}

function deleteCurrentEntry() {
  if (!state.editingId) return;
  const e = findEntryById(state.editingId);
  if (!e) return;

  if (!confirm("この日記を削除しますか？")) return;

  db.entries = db.entries.filter((x) => x.id !== e.id);
  saveDB();

  state.editingId = null;

  renderCalendar();
  updateDaySummary();
  showScreen("calendar");
}

// =========================
// 検索
// =========================
function doSearch() {
  const key = (searchInput.value || "").trim().toLowerCase();
  searchResults.innerHTML = "";

  if (!key) {
    const p = document.createElement("p");
    p.className = "settings-text";
    p.textContent = "キーワードを入力すると、ここに結果が表示されます。";
    searchResults.appendChild(p);
    return;
  }

  const hits = db.entries
    .filter((e) => {
      const text = `${e.title || ""} ${e.body || ""} ${e.breakfast || ""}`.toLowerCase();
      return text.includes(key);
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!hits.length) {
    const p = document.createElement("p");
    p.className = "settings-text";
    p.textContent = "該当する日記はありませんでした。";
    searchResults.appendChild(p);
    return;
  }

  hits.forEach((e) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-title">${esc(e.title || "（無題）")}</div>
      <div class="result-meta">${fmtJP(e.date)} / ${e.date}</div>
    `;
    card.addEventListener("click", () => {
      openEditorForDate(e.date);
    });
    searchResults.appendChild(card);
  });
}

// =========================
// 設定：エクスポート / インポート
// =========================
btnExport.addEventListener("click", () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: db.entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zezehibi_export_${toISO(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.entries || !Array.isArray(data.entries)) {
        alert("このファイルは日記データではなさそうです。");
        return;
      }

      // ②C: 同じ日付は上書き、それ以外は残す
      const imported = data.entries;
      const map = {};
      db.entries.forEach((e) => {
        map[e.date] = e;
      });
      imported.forEach((e) => {
        map[e.date] = e; // 上書き
      });
      db.entries = Object.values(map);
      saveDB();

      renderCalendar();
      updateDaySummary();
      alert("インポートが完了しました。");
    } catch (err) {
      console.error(err);
      alert("インポート中にエラーが発生しました。");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
});

// Googleログイン（今はダミー）
btnMockLogin.addEventListener("click", () => {
  alert("今はローカル専用です。将来 Firebase 認証と接続して同期できます。");
});

// =========================
// タブ操作
// =========================
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const screen = btn.dataset.screen;
    if (screen === "calendar") showScreen("calendar");
    if (screen === "edit") {
      openEditorNewToday();
    }
    if (screen === "search") {
      showScreen("search");
      doSearch();
    }
    if (screen === "settings") {
      showScreen("settings");
    }
  });
});

// カレンダー上下
btnPrevMonth.addEventListener("click", () => {
  state.viewMonth -= 1;
  if (state.viewMonth < 0) {
    state.viewMonth = 11;
    state.viewYear -= 1;
  }
  renderCalendar();
  updateDaySummary();
});

btnNextMonth.addEventListener("click", () => {
  state.viewMonth += 1;
  if (state.viewMonth > 11) {
    state.viewMonth = 0;
    state.viewYear += 1;
  }
  renderCalendar();
  updateDaySummary();
});

// エディタボタン
btnBackToCalendar.addEventListener("click", () => {
  showScreen("calendar");
});

btnSaveEntry.addEventListener("click", () => {
  saveCurrentEntry();
});

btnDeleteEntry.addEventListener("click", () => {
  deleteCurrentEntry();
});

// 検索入力
searchInput.addEventListener("input", () => {
  doSearch();
});

// =========================
// 初期化
// =========================
(function init() {
  const now = new Date();
  todayLabel.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${
    now.getDate()
  }日（${WJP[now.getDay()]}）`;

  state.currentDate = toISO(now);
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();

  renderCalendar();
  updateDaySummary();
})();
