// ===============================
// 是々日々 app.js
// ・ローカル保存（localStorage）
// ・カレンダー表示
// ・閲覧・編集
// ・検索
// ・エクスポート／インポート
// ===============================

(function () {
  "use strict";

  // ---- 定数・ユーティリティ ----
  const STORAGE_KEY = "zezehibi.diary.v1";
  const WJP = ["日", "月", "火", "水", "木", "金", "土"];

  const $ = (id) => document.getElementById(id);

  function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  function isoToJP(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const w = WJP[dt.getDay()];
    return `${m}月${d}日(${w})`;
  }

  function formatTopToday(dt) {
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const w = WJP[dt.getDay()];
    return `${y}年${m}月${d}日(${w})`;
  }

  function esc(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  // ---- データ管理 ----
  let db = loadDB();
  let state = {
    currentDate: todayISO(),
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth() + 1,
  };

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { entries: {} };
      const parsed = JSON.parse(raw);
      if (!parsed.entries || typeof parsed.entries !== "object") {
        return { entries: {} };
      }
      return parsed;
    } catch (e) {
      console.warn("loadDB failed", e);
      return { entries: {} };
    }
  }

  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function getEntry(date) {
    return db.entries[date] || null;
  }

  function upsertEntry(date, partial) {
    const now = Date.now();
    const prev = db.entries[date] || {};
    db.entries[date] = {
      date,
      wake: partial.wake ?? prev.wake ?? "",
      breakfast: partial.breakfast ?? prev.breakfast ?? "",
      lunch: partial.lunch ?? prev.lunch ?? "",
      dinner: partial.dinner ?? prev.dinner ?? "",
      news: partial.news ?? prev.news ?? "",
      body: partial.body ?? prev.body ?? "",
      updatedAt: now,
    };
    saveDB();
  }

  function deleteEntry(date) {
    delete db.entries[date];
    saveDB();
  }

  // ---- 画面制御 ----
  // ID名をHTMLと合わせる
  const screenCalendar = $("screenCalendar");
  const screenEdit = $("screenEdit");
  const screenSearch = $("screenSearch");
  const screenSettings = $("screenSettings");

  // タブID
  const tabCalendar = $("tabCalendar");
  const tabEdit = $("tabEdit"); // HTMLのIDを修正
  const tabSearch = $("tabSearch");
  const tabSettings = $("tabSettings");

  function showScreen(name) {
    // スクリーン切り替え
    screenCalendar.classList.remove("screen-active");
    screenEdit.classList.remove("screen-active");
    screenSearch.classList.remove("screen-active");
    screenSettings.classList.remove("screen-active");

    if (name === "calendar") screenCalendar.classList.add("screen-active");
    if (name === "edit") screenEdit.classList.add("screen-active");
    if (name === "search") screenSearch.classList.add("screen-active");
    if (name === "settings") screenSettings.classList.add("screen-active");

    // タブのアクティブ状態
    [tabCalendar, tabEdit, tabSearch, tabSettings].forEach((b) =>
      b.classList.remove("tab-active")
    );
    if (name === "calendar") tabCalendar.classList.add("tab-active");
    if (name === "edit") tabEdit.classList.add("tab-active");
    if (name === "search") tabSearch.classList.add("tab-active");
    if (name === "settings") tabSettings.classList.add("tab-active");

    // 閲覧・編集画面に入るときはフォームを同期
    if (name === "edit") renderEditScreen();
  }

  // イベントリスナーはID変更に合わせて修正
  tabCalendar.addEventListener("click", () => {
    showScreen("calendar");
  });
  tabEdit.addEventListener("click", () => {
    showScreen("edit");
  });
  tabSearch.addEventListener("click", () => {
    showScreen("search");
    renderSearchResults();
  });
  tabSettings.addEventListener("click", () => {
    showScreen("settings");
  });

  // ---- カレンダー描画 ----
  const calendarGrid = $("calendarGrid");
  const prevMonthBtn = $("prevMonthBtn"); // HTMLのIDを修正
  const nextMonthBtn = $("nextMonthBtn"); // HTMLのIDを修正
  const monthLabel = $("monthLabel");
  const topTodayLabel = $("topTodayLabel"); // HTMLのIDを修正

  function renderCalendar() {
    const year = state.viewYear;
    const month = state.viewMonth; // 1-12

    // 月ラベル
    monthLabel.textContent = `${year}年 ${month}月`;

    // 今日ラベル
    topTodayLabel.textContent = formatTopToday(new Date());

    // カレンダーグリッドを生成（7x6固定）
    calendarGrid.innerHTML = "";

    const firstOfMonth = new Date(year, month - 1, 1);
    const firstDay = firstOfMonth.getDay(); // 0:日〜6:土
    const startDate = new Date(year, month - 1, 1 - firstDay); // カレンダー開始日(前月を含む)

    const todayIso = todayISO();

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const cellIso = d.toISOString().slice(0, 10);
      const cellMonth = d.getMonth() + 1;
      const cellDay = d.getDate();
      const dow = d.getDay();

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day-cell";

      if (cellMonth !== month) {
        cell.classList.add("out");
      }
      if (dow === 0) cell.classList.add("sun");
      if (dow === 6) cell.classList.add("sat");
      if (cellIso === todayIso) {
        cell.classList.add("today");
      }
      if (cellIso === state.currentDate) {
        cell.classList.add("selected");
      }

      cell.dataset.date = cellIso;

      // 上：日付
      const dayNum = document.createElement("div");
      dayNum.className = "day-num";
      dayNum.textContent = cellDay;

      // 下：簡易タイトル・タグ
      const tags = document.createElement("div");
      tags.className = "day-tags";

      const entry = getEntry(cellIso);
      if (entry) {
        const parts = [];
        if (entry.wake) parts.push(`☀${entry.wake}`);
        if (entry.breakfast) parts.push("朝: " + entry.breakfast);
        if (entry.lunch) parts.push("昼: " + entry.lunch);
        if (entry.dinner) parts.push("夜: " + entry.dinner);
        if (entry.news) parts.push("📰 " + entry.news);
        if (!parts.length && entry.body) {
          parts.push(entry.body.slice(0, 30));
        }
        tags.textContent = parts.join(" / ");
      } else {
        tags.textContent = "";
      }

      cell.appendChild(dayNum);
      cell.appendChild(tags);

      // クリックで日付選択（&編集画面へ）
      cell.addEventListener("click", () => {
        state.currentDate = cellIso;
        renderCalendar(); // 選択反映
        showScreen("edit"); // すぐ編集画面へ
      });

      calendarGrid.appendChild(cell);
    }
  }

  prevMonthBtn.addEventListener("click", () => {
    let { viewYear, viewMonth } = state;
    viewMonth--;
    if (viewMonth < 1) {
      viewMonth = 12;
      viewYear--;
    }
    state.viewYear = viewYear;
    state.viewMonth = viewMonth;
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    let { viewYear, viewMonth } = state;
    viewMonth++;
    if (viewMonth > 12) {
      viewMonth = 1;
      viewYear++;
    }
    state.viewYear = viewYear;
    state.viewMonth = viewMonth;
    renderCalendar();
  });

  // ---- 閲覧・編集画面 ----
  const editDateLabel = $("editDateLabel");
  const editDateSub = $("editDateSub"); // ★追加：HTMLに要素を追加
  const editWake = $("editWake"); // HTMLのIDを修正
  const editBreakfast = $("editBreakfast"); // HTMLのIDを修正
  const editLunch = $("editLunch"); // HTMLのIDを修正
  const editDinner = $("editDinner"); // HTMLのIDを修正
  const editNews = $("editNews"); // HTMLのIDを修正
  const editBody = $("editBody"); // HTMLのIDを修正
  const editDateTodayBtn = $("editDateTodayBtn"); // ★追加：HTMLに要素を追加
  const deleteEntryBtn = $("deleteEntryBtn");
  const saveEntryBtn = $("saveEntryBtn"); // ★追加：HTMLにIDを追加
  const saveStatus = $("saveStatus"); // ★追加：HTMLにIDを追加

  function renderEditScreen() {
    const date = state.currentDate;
    editDateLabel.textContent = date;
    editDateSub.textContent = isoToJP(date);

    const entry = getEntry(date);
    if (entry) {
      editWake.value = entry.wake || "";
      editBreakfast.value = entry.breakfast || "";
      editLunch.value = entry.lunch || "";
      editDinner.value = entry.dinner || "";
      editNews.value = entry.news || "";
      editBody.value = entry.body || "";
      deleteEntryBtn.disabled = false;
    } else {
      editWake.value = "";
      editBreakfast.value = "";
      editLunch.value = "";
      editDinner.value = "";
      editNews.value = "";
      editBody.value = "";
      deleteEntryBtn.disabled = true;
    }
    saveStatus.textContent = "未保存";
  }

  // 「カレンダーへ戻る」ボタンの処理を追加
  $("editorBackBtn").addEventListener("click", () => {
    showScreen("calendar");
  });

  // 「今日」ボタンの処理
  editDateTodayBtn.addEventListener("click", () => {
    state.currentDate = todayISO();
    state.viewYear = new Date().getFullYear();
    state.viewMonth = new Date().getMonth() + 1;
    renderCalendar();
    renderEditScreen();
  });

  saveEntryBtn.addEventListener("click", () => {
    const date = state.currentDate;
    upsertEntry(date, {
      wake: editWake.value.trim(),
      breakfast: editBreakfast.value.trim(),
      lunch: editLunch.value.trim(),
      dinner: editDinner.value.trim(),
      news: editNews.value.trim(),
      body: editBody.value.trim(),
    });
    renderCalendar();
    saveStatus.textContent = "保存しました";
    setTimeout(() => {
      saveStatus.textContent = "未保存";
    }, 1500);
    deleteEntryBtn.disabled = false;
  });

  deleteEntryBtn.addEventListener("click", () => {
    const date = state.currentDate;
    if (!confirm(`${isoToJP(date)} の記録を削除しますか？`)) return;
    deleteEntry(date);
    renderCalendar();
    renderEditScreen();
    saveStatus.textContent = "削除しました";
    setTimeout(() => {
      saveStatus.textContent = "未保存";
    }, 1500);
  });

  // ---- 検索 ----
  const searchInput = $("searchInput");
  const searchResults = $("searchResults");

  function renderSearchResults() {
    const q = (searchInput.value || "").trim().toLowerCase();
    searchResults.innerHTML = "";

    const entriesArray = Object.values(db.entries || {});
    if (!q) {
      if (!entriesArray.length) {
        const div = document.createElement("div");
        div.className = "card-sub";
        div.textContent = "まだ日記がありません。";
        searchResults.appendChild(div);
      }
      return;
    }

    const hits = entriesArray.filter((e) => {
      const text =
        [
          e.date,
          e.wake,
          e.breakfast,
          e.lunch,
          e.dinner,
          e.news,
          e.body,
        ]
          .join(" ")
          .toLowerCase() || "";
      return text.includes(q);
    });

    if (!hits.length) {
      const div = document.createElement("div");
      div.className = "card-sub";
      div.textContent = "該当する記録がありません。";
      searchResults.appendChild(div);
      return;
    }

    hits
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .forEach((e) => {
        const card = document.createElement("div");
        card.className = "card";

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = isoToJP(e.date);

        const sub = document.createElement("div");
        sub.className = "card-sub";
        const summaryParts = [];
        if (e.wake) summaryParts.push(`☀${e.wake}`);
        if (e.breakfast) summaryParts.push("朝:" + e.breakfast);
        if (e.lunch) summaryParts.push("昼:" + e.lunch);
        if (e.dinner) summaryParts.push("夜:" + e.dinner);
        if (e.news) summaryParts.push("📰" + e.news);
        if (summaryParts.length === 0 && e.body) {
          summaryParts.push(e.body.slice(0, 40));
        }
        sub.textContent = summaryParts.join(" / ");

        card.appendChild(title);
        card.appendChild(sub);

        card.addEventListener("click", () => {
          state.currentDate = e.date;
          state.viewYear = Number(e.date.slice(0, 4));
          state.viewMonth = Number(e.date.slice(5, 7));
          renderCalendar();
          showScreen("edit");
        });

        searchResults.appendChild(card);
      });
  }

  searchInput.addEventListener("input", renderSearchResults);

  // ---- 設定：Googleログイン（ダミー）・エクスポート・インポート ----
  const googleLoginBtn = $("googleLoginBtn");
  const exportBtn = $("exportBtn");
  const importFile = $("importFile"); // HTMLのIDを修正

  googleLoginBtn.addEventListener("click", () => {
    alert("Googleログイン／同期は今後 Firebase 連携で実装予定です。いまはローカル保存のみです。");
  });

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `zezehibi-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  importFile.addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.entries || typeof imported.entries !== "object") {
          alert("インポート形式が不正です。");
          return;
        }
        // 既存とマージ（同じ日付は上書き）
        db.entries = {
          ...db.entries,
          ...imported.entries,
        };
        saveDB();
        renderCalendar();
        alert("インポート完了しました。");
      } catch (err) {
        console.error(err);
        alert("インポートに失敗しました。JSONを確認してください。");
      }
    };
    reader.readAsText(file);
    // 同じファイルを連続で選べるように
    ev.target.value = "";
  });

  // ---- 初期化 ----
  function init() {
    const t = new Date();
    state.currentDate = todayISO();
    state.viewYear = t.getFullYear();
    state.viewMonth = t.getMonth() + 1;

    renderCalendar();
    renderEditScreen();
    
    // アプリ起動時はカレンダー画面を表示
    showScreen("calendar");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
