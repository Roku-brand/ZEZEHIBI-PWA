// =========================
//  初期設定
// =========================
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth(); // 0 = Jan
let selectedDate = null;

// 一括で管理するデータ
let diaryData = JSON.parse(localStorage.getItem("ZEZEHIBI_DATA") || "{}");

// =========================
//  DOM取得
// =========================
const screenCalendar = document.getElementById("screen-calendar");
const screenEditor = document.getElementById("screen-editor");
const screenSearch = document.getElementById("screen-search");
const screenSettings = document.getElementById("screen-settings");

const monthLabel = document.getElementById("month-label");
const calendarGrid = document.getElementById("calendar-grid");
const summaryBox = document.getElementById("day-summary");

// Editor elements
const editDateLabel = document.getElementById("edit-date-label");
const editTitle = document.getElementById("edit-title");
const editContent = document.getElementById("edit-content");

// Search
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

// =========================
// 画面切り替え
// =========================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  // カレンダーに戻ったら再描画
  if (id === "screen-calendar") {
    renderCalendar();
  }
}

// =========================
//  カレンダー描画
// =========================
function renderCalendar() {
  calendarGrid.innerHTML = "";
  summaryBox.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1);
  const startDay = firstDay.getDay();
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 前月末日
  const prevLast = new Date(currentYear, currentMonth, 0).getDate();

  monthLabel.textContent = `${currentYear}年${currentMonth + 1}月`;

  let cells = [];

  // 前月の余白
  for (let i = 0; i < startDay; i++) {
    cells.push({
      day: prevLast - startDay + 1 + i,
      out: true
    });
  }

  // 今月
  for (let d = 1; d <= lastDate; d++) {
    cells.push({
      day: d,
      out: false
    });
  }

  // 6行確保のため残りは翌月
  while (cells.length < 42) {
    cells.push({
      day: cells.length - (startDay + lastDate) + 1,
      out: true
    });
  }

  // 生成
  cells.forEach((c, idx) => {
    const cell = document.createElement("div");
    cell.classList.add("day-cell");

    if (c.out) cell.classList.add("out");

    const weekday = idx % 7;
    if (weekday === 0) cell.classList.add("sun");
    if (weekday === 6) cell.classList.add("sat");

    // 今日
    if (!c.out &&
        currentYear === today.getFullYear() &&
        currentMonth === today.getMonth() &&
        c.day === today.getDate()) {
      cell.classList.add("today");
    }

    // 日付
    const num = document.createElement("div");
    num.classList.add("day-num");
    num.textContent = c.day;
    cell.appendChild(num);

    // 日記タイトル（最大3行）
    const key = `${currentYear}-${currentMonth + 1}-${c.day}`;
    if (diaryData[key]?.title) {
      const tag = document.createElement("div");
      tag.classList.add("day-tags");
      tag.textContent = diaryData[key].title;
      cell.appendChild(tag);
    }

    // クリック → 選択＆下に概要を表示
    cell.addEventListener("click", () => {
      selectedDate = key;
      updateDaySummary();
      document.querySelectorAll(".day-cell").forEach(x => x.classList.remove("selected"));
      cell.classList.add("selected");
    });

    // ダブルタップ → 編集画面へ
    let tapTimeout = null;
    cell.addEventListener("touchend", () => {
      if (tapTimeout === null) {
        tapTimeout = setTimeout(() => {
          tapTimeout = null;
        }, 230);
      } else {
        clearTimeout(tapTimeout);
        tapTimeout = null;
        openEditor(key);
      }
    });

    // PCダブルクリック
    cell.addEventListener("dblclick", () => openEditor(key));

    calendarGrid.appendChild(cell);
  });
}

// =========================
//  選択日のサマリー
// =========================
function updateDaySummary() {
  summaryBox.innerHTML = "";

  if (!selectedDate) return;

  const d = new Date(selectedDate);
  const data = diaryData[selectedDate];

  const label = document.createElement("div");
  label.innerHTML = `<strong>${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日</strong>`;
  summaryBox.appendChild(label);

  if (!data) {
    const empty = document.createElement("div");
    empty.textContent = "まだ日記はありません。ダブルタップで作成できます。";
    summaryBox.appendChild(empty);
    return;
  }

  const p = document.createElement("div");
  p.textContent = data.title || "(タイトルなし)";
  summaryBox.appendChild(p);
}

// =========================
//  編集画面
// =========================
function openEditor(key) {
  selectedDate = key;

  const d = new Date(key);
  editDateLabel.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

  const data = diaryData[key] || { title: "", content: "" };

  editTitle.value = data.title || "";
  editContent.value = data.content || "";

  showScreen("screen-editor");
}

// 保存
document.getElementById("btn-save").addEventListener("click", () => {
  if (!selectedDate) return;

  diaryData[selectedDate] = {
    title: editTitle.value,
    content: editContent.value
  };

  localStorage.setItem("ZEZEHIBI_DATA", JSON.stringify(diaryData));

  showScreen("screen-calendar");
});

// 削除
document.getElementById("btn-delete").addEventListener("click", () => {
  if (!selectedDate) return;
  delete diaryData[selectedDate];
  localStorage.setItem("ZEZEHIBI_DATA", JSON.stringify(diaryData));
  showScreen("screen-calendar");
});

// キャンセル
document.getElementById("btn-cancel").addEventListener("click", () => {
  showScreen("screen-calendar");
});

// =========================
//  検索
// =========================
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  searchResults.innerHTML = "";

  if (!q) return;

  Object.entries(diaryData).forEach(([key, v]) => {
    if (
      (v.title && v.title.includes(q)) ||
      (v.content && v.content.includes(q))
    ) {
      const card = document.createElement("div");
      card.classList.add("card");

      const d = new Date(key);

      card.innerHTML = `
        <div class="card-title">${v.title || "(タイトルなし)"}</div>
        <div class="card-sub">${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日</div>
      `;

      card.addEventListener("click", () => openEditor(key));
      searchResults.appendChild(card);
    }
  });
});

// =========================
// 月移動
// =========================
document.getElementById("month-prev").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
});

document.getElementById("month-next").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
});

// =========================
// 初期描画
// =========================
renderCalendar();
updateDaySummary();
