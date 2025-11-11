// ===== 設定 =====
const STORAGE_PREFIX = "zezehibi_v1_"; // 将来アップデートしてもキーを変えれば既存は保持

// ===== ユーティリティ =====
const $ = (id) => document.getElementById(id);

const fmtDate = (d) => d.toISOString().slice(0, 10);
const jpDate = (d) =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${
    "日月火水木金土"[d.getDay()]
  }）`;

const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const today = new Date();

// ===== 状態 =====
let diaryMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let schedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDiaryDate = fmtDate(today);
let selectedSchedDate = fmtDate(today);

// ===== ストレージ =====
const loadJSON = (key, def) => {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + key);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
};

const saveJSON = (key, value) => {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
};

let diaryData = loadJSON("diary", {});
let schedData = loadJSON("sched", {});

// ===== タブ切替 =====
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.remove("screen-active"));
    document.getElementById(target).classList.add("screen-active");

    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
  });
});

// 今日ラベル
$("todayLabel").textContent = jpDate(today);

// ===== カレンダー描画共通 =====
function buildMonthDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const start = new Date(year, month, 1 - startDay); // 日曜始まり
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(d);
  }
  return days;
}

function fillCalendarGrid(gridEl, monthDate, hasFn) {
  gridEl.innerHTML = "";
  const days = buildMonthDays(monthDate);
  const curYear = monthDate.getFullYear();
  const curMonth = monthDate.getMonth();

  days.forEach((d) => {
    const iso = fmtDate(d);
    const cell = document.createElement("div");
    cell.className = "day-cell";

    if (d.getMonth() !== curMonth) cell.classList.add("other-month");
    if (iso === fmtDate(today)) cell.classList.add("today");

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = d.getDate();
    cell.appendChild(num);

    const tagsText = hasFn(iso);
    if (tagsText) {
      cell.classList.add("has-entry");
      const tags = document.createElement("div");
      tags.className = "day-tags";
      tags.textContent = tagsText;
      cell.appendChild(tags);
    }

    cell.addEventListener("click", () => {
      if (gridEl.id === "dCalGrid") {
        selectedDiaryDate = iso;
        renderDiaryList();
      } else if (gridEl.id === "sCalGrid") {
        selectedSchedDate = iso;
        renderSchedList();
      }
    });

    gridEl.appendChild(cell);
  });
}

// ===== 日記 =====
function renderDiaryMonth() {
  $("dMonthLabel").textContent =
    diaryMonth.getFullYear() + "年" + (diaryMonth.getMonth() + 1) + "月";
  fillCalendarGrid($("dCalGrid"), diaryMonth, (iso) => {
    const items = diaryData[iso];
    if (!items || !items.length) return "";
    // その日のタイトルをつなげて表示
    return items
      .map((i) => i.title || i.body?.slice(0, 6) || "")
      .filter(Boolean)
      .join(" / ");
  });
}

function renderDiaryList() {
  $("dSelDateLabel").textContent = selectedDiaryDate;
  $("dSelJP").textContent = jpDate(parseDate(selectedDiaryDate));
  const box = $("dList");
  box.innerHTML = "";

  const items = diaryData[selectedDiaryDate] || [];
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.textContent = "この日の記録はまだありません。";
    box.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.title || "(無題)";
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = [
      item.wake ? `起床 ${item.wake}` : "",
      item.breakfast ? `朝: ${item.breakfast}` : "",
      item.lunchDinner ? `昼/夕: ${item.lunchDinner}` : "",
    ]
      .filter(Boolean)
      .join(" / ");
    const body = document.createElement("div");
    body.textContent = item.body || "";

    card.appendChild(title);
    if (sub.textContent !== "") card.appendChild(sub);
    card.appendChild(body);

    card.addEventListener("click", () => openDiaryModal(item.id));

    box.appendChild(card);
  });
}

function openDiaryModal(id) {
  const dlg = $("dlgDiary");
  const isNew = !id;
  const iso = isNew ? selectedDiaryDate : findDiaryById(id)?.date;

  $("diaryDate").value = iso || selectedDiaryDate;
  $("diaryWake").value = isNew ? "" : findDiaryById(id).wake || "";
  $("diaryBreakfast").value = isNew ? "" : findDiaryById(id).breakfast || "";
  $("diaryLunchDinner").value = isNew ? "" : findDiaryById(id).lunchDinner || "";
  $("diaryTitle").value = isNew ? "" : findDiaryById(id).title || "";
  $("diaryBody").value = isNew ? "" : findDiaryById(id).body || "";
  $("diaryId").value = id || "";

  $("diaryDelete").style.display = isNew ? "none" : "inline-flex";
  $("dlgDiaryTitle").textContent = isNew ? "日記を追加" : "日記を編集";

  dlg.showModal();
}

function findDiaryById(id) {
  for (const date in diaryData) {
    const hit = (diaryData[date] || []).find((d) => d.id === id);
    if (hit) return hit;
  }
  return null;
}

// 新規ボタン
$("dNewBtn").addEventListener("click", () => openDiaryModal(""));

// 保存
$("diarySave").addEventListener("click", (e) => {
  e.preventDefault();
  const id = $("diaryId").value || "d_" + Date.now();
  const date = $("diaryDate").value || selectedDiaryDate;
  const obj = {
    id,
    date,
    wake: $("diaryWake").value,
    breakfast: $("diaryBreakfast").value,
    lunchDinner: $("diaryLunchDinner").value,
    title: $("diaryTitle").value,
    body: $("diaryBody").value,
  };

  if (!diaryData[date]) diaryData[date] = [];
  const list = diaryData[date];
  const idx = list.findIndex((i) => i.id === id);
  if (idx >= 0) list[idx] = obj;
  else list.push(obj);

  saveJSON("diary", diaryData);
  $("dlgDiary").close();

  selectedDiaryDate = date;
  renderDiaryMonth();
  renderDiaryList();
});

// 削除
$("diaryDelete").addEventListener("click", (e) => {
  e.preventDefault();
  const id = $("diaryId").value;
  if (!id) return;
  for (const date in diaryData) {
    diaryData[date] = diaryData[date].filter((i) => i.id !== id);
    if (!diaryData[date].length) delete diaryData[date];
  }
  saveJSON("diary", diaryData);
  $("dlgDiary").close();
  renderDiaryMonth();
  renderDiaryList();
});

// 月移動
$("dPrevM").addEventListener("click", () => {
  diaryMonth = new Date(diaryMonth.getFullYear(), diaryMonth.getMonth() - 1, 1);
  renderDiaryMonth();
});
$("dNextM").addEventListener("click", () => {
  diaryMonth = new Date(diaryMonth.getFullYear(), diaryMonth.getMonth() + 1, 1);
  renderDiaryMonth();
});

// ===== 予定 =====
function renderSchedMonth() {
  $("sMonthLabel").textContent =
    schedMonth.getFullYear() + "年" + (schedMonth.getMonth() + 1) + "月";
  fillCalendarGrid($("sCalGrid"), schedMonth, (iso) => {
    const items = schedData[iso];
    if (!items || !items.length) return "";
    return items
      .map((i) => i.title || "")
      .filter(Boolean)
      .join(" / ");
  });
}

function renderSchedList() {
  $("sSelDateLabel").textContent = selectedSchedDate;
  $("sSelJP").textContent = jpDate(parseDate(selectedSchedDate));

  const box = $("sList");
  box.innerHTML = "";
  const items = schedData[selectedSchedDate] || [];
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.textContent = "この日の予定はありません。";
    box.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.title || "(無題)";
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${item.start || ""}〜${item.end || ""} ${item.done ? "（完了）" : ""}`;
    const note = document.createElement("div");
    note.textContent = item.note || "";

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(note);

    card.addEventListener("click", () => openSchedModal(item.id));

    box.appendChild(card);
  });
}

function findSchedById(id) {
  for (const date in schedData) {
    const hit = (schedData[date] || []).find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
}

function openSchedModal(id) {
  const dlg = $("dlgSched");
  const isNew = !id;
  const base = isNew ? null : findSchedById(id);

  $("schDate").value = base?.date || selectedSchedDate;
  $("schStart").value = base?.start || "";
  $("schEnd").value = base?.end || "";
  $("schTitle").value = base?.title || "";
  $("schNote").value = base?.note || "";
  $("schDone").checked = !!base?.done;
  $("schId").value = base?.id || "";

  $("schDelete").style.display = isNew ? "none" : "inline-flex";

  dlg.showModal();
}

$("sNewBtn").addEventListener("click", () => openSchedModal(""));

// 保存
$("schSave").addEventListener("click", (e) => {
  e.preventDefault();
  const id = $("schId").value || "s_" + Date.now();
  const date = $("schDate").value || selectedSchedDate;
  const obj = {
    id,
    date,
    start: $("schStart").value,
    end: $("schEnd").value,
    title: $("schTitle").value,
    note: $("schNote").value,
    done: $("schDone").checked,
  };

  if (!schedData[date]) schedData[date] = [];
  const list = schedData[date];
  const idx = list.findIndex((i) => i.id === id);
  if (idx >= 0) list[idx] = obj;
  else list.push(obj);

  saveJSON("sched", schedData);
  $("dlgSched").close();

  selectedSchedDate = date;
  renderSchedMonth();
  renderSchedList();
});

// 削除
$("schDelete").addEventListener("click", (e) => {
  e.preventDefault();
  const id = $("schId").value;
  if (!id) return;
  for (const date in schedData) {
    schedData[date] = schedData[date].filter((i) => i.id !== id);
    if (!schedData[date].length) delete schedData[date];
  }
  saveJSON("sched", schedData);
  $("dlgSched").close();
  renderSchedMonth();
  renderSchedList();
});

// 月移動
$("sPrevM").addEventListener("click", () => {
  schedMonth = new Date(schedMonth.getFullYear(), schedMonth.getMonth() - 1, 1);
  renderSchedMonth();
});
$("sNextM").addEventListener("click", () => {
  schedMonth = new Date(schedMonth.getFullYear(), schedMonth.getMonth() + 1, 1);
  renderSchedMonth();
});

// ===== 検索 =====
$("searchInput").addEventListener("input", () => {
  const q = $("searchInput").value.trim();
  renderSearch(q);
});

function renderSearch(q) {
  const boxD = $("searchDiary");
  const boxS = $("searchSched");
  boxD.innerHTML = "";
  boxS.innerHTML = "";
  if (!q) return;

  const qLower = q.toLowerCase();

  // 日記
  for (const date in diaryData) {
    (diaryData[date] || []).forEach((d) => {
      const text =
        `${d.title || ""} ${d.body || ""} ${d.breakfast || ""} ${d.lunchDinner || ""}`.toLowerCase();
      if (text.includes(qLower)) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<div class="card-title">${d.title || "(無題)"}</div>
          <div class="card-sub">${date}</div>
          <div>${(d.body || "").slice(0, 80)}</div>`;
        card.addEventListener("click", () => {
          selectedDiaryDate = date;
          renderDiaryMonth();
          renderDiaryList();
          document
            .querySelector('[data-target="screenDiary"]')
            .click();
        });
        boxD.appendChild(card);
      }
    });
  }

  // 予定
  for (const date in schedData) {
    (schedData[date] || []).forEach((s) => {
      const text =
        `${s.title || ""} ${s.note || ""}`.toLowerCase();
      if (text.includes(qLower)) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<div class="card-title">${s.title || "(無題)"}</div>
          <div class="card-sub">${date} ${s.start || ""}〜${s.end || ""}</div>
          <div>${(s.note || "").slice(0, 80)}</div>`;
        card.addEventListener("click", () => {
          selectedSchedDate = date;
          renderSchedMonth();
          renderSchedList();
          document
            .querySelector('[data-target="screenSched"]')
            .click();
        });
        boxS.appendChild(card);
      }
    });
  }
}

// ===== スケジュール調整（簡略） =====
function renderCoord() {
  const box = $("coordBands");
  box.innerHTML = "";

  // 今週〜2週間分ざっくり
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  $("coordWeekLabel").textContent =
    `${base.getFullYear()}年${base.getMonth() + 1}月 第${Math.floor(
      (base.getDate() - 1) / 7
    ) + 1}週`;

  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const iso = fmtDate(d);
    const plans = (schedData[iso] || []).map((p) => p.title).join(" / ");

    const row = document.createElement("div");
    row.className = "band-row";
    const left = document.createElement("div");
    left.textContent = `${d.getMonth() + 1}/${d.getDate()}（${
      "日月火水木金土"[d.getDay()]
    }）`;
    const right = document.createElement("div");
    right.textContent = plans || "予定少なめ / 調整しやすい";
    right.style.color = plans ? "#38bdf8" : "#6b7280";

    row.appendChild(left);
    row.appendChild(right);
    box.appendChild(row);
  }
}

$("coordPrev").addEventListener("click", () => {
  today.setDate(today.getDate() - 7);
  renderCoord();
});
$("coordNext").addEventListener("click", () => {
  today.setDate(today.getDate() + 7);
  renderCoord();
});

// ===== 初期描画 =====
renderDiaryMonth();
renderDiaryList();
renderSchedMonth();
renderSchedList();
renderCoord();

// ===== PWA Service Worker 登録（既存 sw.js がある前提） =====
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
