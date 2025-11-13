// ===============================
// 是々日々 app.js（Firebase同期版）
// ===============================

// ---- ユーティリティ ----
const LS_KEY = "zezehibi_diary_v1";
const WJP = ["日", "月", "火", "水", "木", "金", "土"];

const toISO = (d) => {
  if (!(d instanceof Date)) d = new Date(d);
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};

const fmtJP = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日(${WJP[dt.getDay()]})`;
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (typeof obj !== "object" || !obj) return {};
    return obj;
  } catch (e) {
    console.warn("loadLocal error", e);
    return {};
  }
}

function saveLocal(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("saveLocal error", e);
  }
}

// ---- 状態 ----
let currentUser = null;
let diaryMap = loadLocal(); // { "2025-11-13": {...}, ... }
let currentMonth = (() => {
  const d = new Date();
  d.setDate(1);
  return d;
})();
let selectedDateISO = toISO(new Date());
let editingDateISO = null;

// ---- DOM 取得 ----
const screenLogin = document.getElementById("screenLogin");
const screenHome = document.getElementById("screenHome");
const screenEditor = document.getElementById("screenEditor");

const loginEmail = document.getElementById("loginEmail");
const loginPass = document.getElementById("loginPass");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const topToday = document.getElementById("topToday");
const monthLabel = document.getElementById("monthLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const calendarGrid = document.getElementById("calendarGrid");

const backHomeBtn = document.getElementById("backHome");
const editDateLabel = document.getElementById("editDateLabel");
const wakeInput = document.getElementById("wakeInput");
const breakfastInput = document.getElementById("breakfastInput");
const lunchInput = document.getElementById("lunchInput");
const dinnerInput = document.getElementById("dinnerInput");
const titleInput = document.getElementById("titleInput");
const bodyInput = document.getElementById("bodyInput");
const saveDiaryBtn = document.getElementById("saveDiaryBtn");

const tabButtons = document.querySelectorAll(".tab-btn");

// ---- 画面切り替え ----
function showScreen(name) {
  screenLogin.classList.remove("screen-active");
  screenHome.classList.remove("screen-active");
  screenEditor.classList.remove("screen-active");

  if (name === "login") screenLogin.classList.add("screen-active");
  if (name === "home") screenHome.classList.add("screen-active");
  if (name === "editor") screenEditor.classList.add("screen-active");
}

// ---- Auth 関連 ----
auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  if (user) {
    // ログイン時
    console.log("Logged in as", user.uid);
    showScreen("home");
    updateTopToday();
    await syncFromFirestore();
    renderCalendar();
  } else {
    // ログアウト時
    console.log("Logged out");
    showScreen("login");
  }
});

loginBtn.addEventListener("click", async () => {
  const email = (loginEmail.value || "").trim();
  const pass = loginPass.value || "";
  if (!email || !pass) {
    alert("メールアドレスとパスワードを入力してください。");
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    console.error(e);
    alert("ログインに失敗しました: " + (e.message || e.code));
  }
});

registerBtn.addEventListener("click", async () => {
  const email = (loginEmail.value || "").trim();
  const pass = loginPass.value || "";
  if (!email || !pass) {
    alert("メールアドレスとパスワードを入力してください。");
    return;
  }
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    alert("アカウントを作成しました。");
  } catch (e) {
    console.error(e);
    alert("登録に失敗しました: " + (e.message || e.code));
  }
});

// ---- Firestore 同期 ----
async function syncFromFirestore() {
  if (!currentUser) return;
  try {
    const snap = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("entries")
      .get();

    const newMap = {};
    snap.forEach((doc) => {
      const data = doc.data();
      if (data && data.date) {
        newMap[data.date] = data;
      }
    });

    // ローカルとマージ（ローカルにだけある日記は一応残す）
    diaryMap = { ...diaryMap, ...newMap };
    saveLocal(diaryMap);
  } catch (e) {
    console.error("syncFromFirestore error", e);
  }
}

async function saveEntryToFirestore(entry) {
  if (!currentUser) return;
  try {
    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("entries")
      .doc(entry.date)
      .set(entry);
  } catch (e) {
    console.error("saveEntryToFirestore error", e);
  }
}

// ---- トップ日付表示 ----
function updateTopToday() {
  const t = new Date();
  const iso = toISO(t);
  topToday.textContent = `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日(${WJP[t.getDay()]}) / ${iso}`;
}

// ---- カレンダー描画 ----
function renderCalendar() {
  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth(); // 0-based

  monthLabel.textContent = `${y}年 ${m + 1}月`;

  calendarGrid.innerHTML = "";

  const firstOfMonth = new Date(y, m, 1);
  const firstDay = firstOfMonth.getDay(); // 0:日〜6:土
  const startOffset = firstDay; // 日曜始まり
  const firstCellDate = new Date(y, m, 1 - startOffset);

  const todayISO = toISO(new Date());

  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCellDate);
    d.setDate(firstCellDate.getDate() + i);
    const iso = toISO(d);
    const inMonth = d.getMonth() === m;
    const dow = d.getDay();

    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (!inMonth) cell.classList.add("out");
    if (dow === 0) cell.classList.add("sun");
    if (dow === 6) cell.classList.add("sat");
    if (iso === todayISO) cell.classList.add("today");
    if (iso === selectedDateISO) cell.classList.add("selected");

    cell.dataset.iso = iso;

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = d.getDate();

    const tags = document.createElement("div");
    tags.className = "day-tags";

    const entry = diaryMap[iso];
    if (entry) {
      const base =
        (entry.title && entry.title.trim()) ||
        (entry.body && entry.body.trim().split("\n")[0]) ||
        "";
      tags.textContent = base;
    } else {
      tags.textContent = "";
    }

    cell.appendChild(num);
    cell.appendChild(tags);

    // クリック → 選択のみ
    cell.addEventListener("click", () => {
      selectedDateISO = iso;
      renderCalendar();
    });

    // ダブルクリック / ダブルタップでエディタへ
    cell.addEventListener("dblclick", () => {
      openEditor(iso);
    });

    let lastTap = 0;
    cell.addEventListener("touchend", (ev) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        ev.preventDefault();
        openEditor(iso);
      }
      lastTap = now;
    });

    calendarGrid.appendChild(cell);
  }
}

// ---- エディタ ----
function openEditor(iso) {
  editingDateISO = iso;

  let entry = diaryMap[iso];
  if (!entry) {
    entry = {
      date: iso,
      wake: "",
      breakfast: "",
      lunch: "",
      dinner: "",
      title: "",
      body: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    diaryMap[iso] = entry;
    saveLocal(diaryMap);
  }

  editDateLabel.textContent = fmtJP(iso);
  wakeInput.value = entry.wake || "";
  breakfastInput.value = entry.breakfast || "";
  lunchInput.value = entry.lunch || "";
  dinnerInput.value = entry.dinner || "";
  titleInput.value = entry.title || "";
  bodyInput.value = entry.body || "";

  showScreen("editor");
}

async function saveCurrentEntry() {
  if (!editingDateISO) return;
  const e = diaryMap[editingDateISO] || {
    date: editingDateISO,
    createdAt: Date.now()
  };

  e.wake = wakeInput.value || "";
  e.breakfast = breakfastInput.value || "";
  e.lunch = lunchInput.value || "";
  e.dinner = dinnerInput.value || "";
  e.title = titleInput.value || "";
  e.body = bodyInput.value || "";
  e.updatedAt = Date.now();

  diaryMap[editingDateISO] = e;
  saveLocal(diaryMap);
  await saveEntryToFirestore(e);

  selectedDateISO = editingDateISO;
  renderCalendar();
  showScreen("home");
}

// ---- イベント配線 ----

// 月移動
prevMonthBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

// エディタから戻る
backHomeBtn.addEventListener("click", () => {
  showScreen("home");
});

// 保存ボタン
saveDiaryBtn.addEventListener("click", () => {
  saveCurrentEntry();
});

// タブバー（今は日記タブだけ本格運用、それ以外はメッセージ）
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("tab-active", "active"));
    btn.classList.add("tab-active", "active");

    const tab = btn.dataset.tab;
    if (tab === "home") {
      showScreen("home");
    } else {
      alert("このタブは今後拡張予定です。（いまは日記のみ稼働中）");
      // 見た目だけ戻す
      tabButtons.forEach((b) => {
        if (b.dataset.tab === "home") {
          b.classList.add("tab-active", "active");
        }
      });
      showScreen("home");
    }
  });
});

// ---- 初期化 ----
(function init() {
  // ログイン状態に応じて onAuthStateChanged が動くので、ここでは最小限
  updateTopToday();
  // 非ログイン時でもとりあえずローカルのカレンダーは出せるようにしておく
  renderCalendar();
})();
