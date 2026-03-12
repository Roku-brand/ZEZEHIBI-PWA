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
  const IDEAS_STORAGE_KEY = "zezehibi.ideas.v1";
  const CATEGORIES_STORAGE_KEY = "zezehibi.categories.v1";
  const AUTH_STORAGE_KEY = "zezehibi.auth.v1";
  const NOTIFICATION_STORAGE_KEY = "zezehibi.notification.v1";
  const NOTIFICATION_RUNTIME_KEY = "zezehibi.notification.runtime.v1";
  const WJP = ["日", "月", "火", "水", "木", "金", "土"];
  
  // デフォルトカテゴリ（編集不可）
  const DEFAULT_CATEGORIES = {
    failure: "＃自分の失敗",
    aruaru: "＃〇〇のあるある",
    thinking: "＃考え方",
    knowledge: "＃教養",
    other: "＃その他"
  };

  const $ = (id) => document.getElementById(id);

  function hideSplashScreen() {
    const splash = $("splashScreen");
    if (!splash) return;
    splash.classList.add("is-hidden");
    splash.setAttribute("aria-hidden", "true");
    setTimeout(() => splash.remove(), 320);
  }

  // Convert a Date object to local YYYY-MM-DD string (avoiding UTC timezone issues)
  function toLocalISODateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function todayISO() {
    return toLocalISODateString(new Date());
  }

  function isoToJP(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
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

  function formatWeight(weight) {
    if (!weight) return "";
    return `⚖${weight}kg`;
  }

  // ---- データ管理 ----
  let db = loadDB();
  let ideasDB = loadIdeasDB();
  let categoriesDB = loadCategoriesDB();
  let authState = loadAuthState();
  let notificationState = loadNotificationState();
  let notificationTimerId = null;
  let state = {
    currentDate: todayISO(),
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth() + 1,
    libraryOpen: false,
    selectedCategory: "all"
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
  
  // アイデアライブラリのデータ管理
  function loadIdeasDB() {
    try {
      const raw = localStorage.getItem(IDEAS_STORAGE_KEY);
      if (!raw) return { ideas: [] };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.ideas)) {
        return { ideas: [] };
      }
      return parsed;
    } catch (e) {
      console.warn("loadIdeasDB failed", e);
      return { ideas: [] };
    }
  }
  
  function saveIdeasDB() {
    localStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideasDB));
  }
  
  // カテゴリのデータ管理
  function loadCategoriesDB() {
    try {
      const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (!raw) return { categories: {} };
      const parsed = JSON.parse(raw);
      if (!parsed.categories || typeof parsed.categories !== "object") {
        return { categories: {} };
      }
      return parsed;
    } catch (e) {
      console.warn("loadCategoriesDB failed", e);
      return { categories: {} };
    }
  }
  
  function saveCategoriesDB() {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categoriesDB));
  }
  
  // 全カテゴリを取得（デフォルト + カスタム）
  function getAllCategories() {
    return { ...DEFAULT_CATEGORIES, ...categoriesDB.categories };
  }
  
  // カテゴリ名を取得
  function getCategoryName(categoryId) {
    const all = getAllCategories();
    return all[categoryId] || categoryId;
  }
  
  // カテゴリがデフォルトかどうか
  function isDefaultCategory(categoryId) {
    return Object.hasOwn(DEFAULT_CATEGORIES, categoryId);
  }
  
  // カスタムカテゴリを追加
  function addCategory(name) {
    const id = "custom_" + crypto.randomUUID();
    categoriesDB.categories[id] = "＃" + name;
    saveCategoriesDB();
    return id;
  }
  
  // カテゴリ名を編集
  function editCategory(categoryId, newName) {
    if (isDefaultCategory(categoryId)) return false;
    categoriesDB.categories[categoryId] = "＃" + newName;
    saveCategoriesDB();
    return true;
  }
  
  // カテゴリを削除
  function deleteCategory(categoryId) {
    if (isDefaultCategory(categoryId)) return false;
    delete categoriesDB.categories[categoryId];
    saveCategoriesDB();
    // このカテゴリに属するアイデアを「その他」に移動
    ideasDB.ideas.forEach(idea => {
      if (idea.category === categoryId) {
        idea.category = "other";
      }
    });
    saveIdeasDB();
    return true;
  }
  
  function addIdea(category, content) {
    const idea = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      category,
      content,
      createdAt: Date.now()
    };
    ideasDB.ideas.push(idea);
    saveIdeasDB();
    return idea;
  }
  
  function deleteIdea(id) {
    ideasDB.ideas = ideasDB.ideas.filter(i => i.id !== id);
    saveIdeasDB();
  }
  
  function getIdeasByCategory(category) {
    if (category === "all") return ideasDB.ideas;
    return ideasDB.ideas.filter(i => i.category === category);
  }
  
  // 認証状態の管理
  function loadAuthState() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return { isLoggedIn: false, user: null };
      return JSON.parse(raw);
    } catch (e) {
      return { isLoggedIn: false, user: null };
    }
  }
  
  function saveAuthState() {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
  }

  // 通知設定の管理
  function loadNotificationState() {
    try {
      const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (!raw) {
        return { enabled: false, time: "21:00", message: "今日の日記を記録しましょう。" };
      }
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        time: typeof parsed.time === "string" && parsed.time ? parsed.time : "21:00",
        message: typeof parsed.message === "string" && parsed.message ? parsed.message : "今日の日記を記録しましょう。",
      };
    } catch (e) {
      console.warn("loadNotificationState failed", e);
      return { enabled: false, time: "21:00", message: "今日の日記を記録しましょう。" };
    }
  }

  function saveNotificationState() {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationState));
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
      bed: partial.bed ?? prev.bed ?? "",
      weight: partial.weight ?? prev.weight ?? "",
      breakfast: partial.breakfast ?? prev.breakfast ?? "",
      lunch: partial.lunch ?? prev.lunch ?? "",
      dinner: partial.dinner ?? prev.dinner ?? "",
      weather: partial.weather ?? prev.weather ?? prev.news ?? "",
      title: partial.title ?? prev.title ?? "",
      body: partial.body ?? prev.body ?? "",
      idea: partial.idea ?? prev.idea ?? "",
      satisfaction: partial.satisfaction ?? prev.satisfaction ?? "",
      photo: partial.photo ?? prev.photo ?? null,
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
  const prevMonthBtn = $("prevMonthBtn");
  const nextMonthBtn = $("nextMonthBtn");
  const monthLabel = $("monthLabel");

  function renderCalendar() {
    const year = state.viewYear;
    const month = state.viewMonth; // 1-12

    // 月ラベル
    monthLabel.textContent = `${year}年 ${month}月`;

    // カレンダーグリッドを生成（7x6固定）
    calendarGrid.innerHTML = "";

    const firstOfMonth = new Date(year, month - 1, 1);
    const firstDay = firstOfMonth.getDay(); // 0:日〜6:土
    const startDate = new Date(year, month - 1, 1 - firstDay); // カレンダー開始日(前月を含む)

    const todayIso = todayISO();

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const cellIso = toLocalISODateString(d);
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
      if (entry && entry.title) {
        tags.textContent = entry.title;
        tags.classList.add("has-title");
      } else {
        tags.textContent = "";
      }

      cell.appendChild(dayNum);
      cell.appendChild(tags);

      // 充実度バッジ（右下に表示）
      if (entry && entry.satisfaction) {
        const satisfactionBadge = document.createElement("div");
        satisfactionBadge.className = "day-satisfaction satisfaction-" + entry.satisfaction.toLowerCase();
        satisfactionBadge.textContent = entry.satisfaction;
        cell.appendChild(satisfactionBadge);
      }

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
  const editWake = $("editWake");
  const editBed = $("editBed");
  const editWeight = $("editWeight");
  const editBreakfast = $("editBreakfast");
  const editLunch = $("editLunch");
  const editDinner = $("editDinner");
  const editWeather = $("editWeather");
  const editTitle = $("editTitle");
  const editBody = $("editBody");
  const editIdea = $("editIdea");
  const editPrevDayBtn = $("editPrevDayBtn");
  const editNextDayBtn = $("editNextDayBtn");
  const deleteEntryBtn = $("deleteEntryBtn");
  const saveEntryBtn = $("saveEntryBtn");
  const saveStatus = $("saveStatus");
  const satisfactionPicker = $("satisfactionPicker");
  
  // 写真関連の要素
  const photoInput = $("photoInput");
  const photoPreview = $("photoPreview");
  const addPhotoBtn = $("addPhotoBtn");
  const removePhotoBtn = $("removePhotoBtn");
  
  // 一時的な写真データ（保存前の状態を保持）
  let currentPhoto = null;
  // 現在の充実度
  let currentSatisfaction = "";

  // 体重ピッカーの初期化（30.0 〜 150.0kg、0.1刻み、デフォルト55.0）
  function initWeightPicker() {
    editWeight.innerHTML = '<option value="">--</option>';
    for (let i = 300; i <= 1500; i += 1) {
      const w = i / 10;
      const wStr = w.toFixed(1);
      const opt = document.createElement("option");
      opt.value = wStr;
      opt.textContent = wStr + " kg";
      if (wStr === "55.0") {
        opt.selected = true;
      }
      editWeight.appendChild(opt);
    }
  }

  // 天気ピッカーの初期化（リール型）
  function initWeatherPicker() {
    const weatherOptions = ["", "晴れ", "雨", "曇り", "雪", "突風"];
    editWeather.innerHTML = "";

    weatherOptions.forEach((weather) => {
      const opt = document.createElement("option");
      opt.value = weather;
      opt.textContent = weather || "--";
      editWeather.appendChild(opt);
    });
  }

  // 充実度ボタンの選択状態を更新
  function updateSatisfactionButtons() {
    const buttons = satisfactionPicker.querySelectorAll(".satisfaction-btn");
    buttons.forEach(btn => {
      if (btn.dataset.value === currentSatisfaction) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
  }

  // 充実度ボタンのクリックイベント
  satisfactionPicker.addEventListener("click", (e) => {
    if (e.target.classList.contains("satisfaction-btn")) {
      const value = e.target.dataset.value;
      // 同じボタンを再クリックで選択解除
      if (currentSatisfaction === value) {
        currentSatisfaction = "";
      } else {
        currentSatisfaction = value;
      }
      updateSatisfactionButtons();
      saveStatus.textContent = "未保存";
    }
  });

  function renderEditScreen() {
    const date = state.currentDate;
    editDateLabel.textContent = isoToJP(date);

    const entry = getEntry(date);
    if (entry) {
      editWake.value = entry.wake || "";
      editBed.value = entry.bed || "";
      editWeight.value = entry.weight || "55.0";
      editBreakfast.value = entry.breakfast || "";
      editLunch.value = entry.lunch || "";
      editDinner.value = entry.dinner || "";
      editWeather.value = entry.weather || entry.news || "";
      editTitle.value = entry.title || "";
      editBody.value = entry.body || "";
      editIdea.value = entry.idea || "";
      currentSatisfaction = entry.satisfaction || "";
      currentPhoto = entry.photo || null;
      deleteEntryBtn.disabled = false;
    } else {
      editWake.value = "";
      editBed.value = "";
      editWeight.value = "55.0";
      editBreakfast.value = "";
      editLunch.value = "";
      editDinner.value = "";
      editWeather.value = "";
      editTitle.value = "";
      editBody.value = "";
      editIdea.value = "";
      currentSatisfaction = "";
      currentPhoto = null;
      deleteEntryBtn.disabled = true;
    }
    updateSatisfactionButtons();
    renderPhotoPreview();
    saveStatus.textContent = "未保存";
  }
  
  // 写真プレビューの描画
  function renderPhotoPreview() {
    photoPreview.innerHTML = "";
    if (currentPhoto) {
      const item = document.createElement("div");
      item.className = "photo-preview-item";
      const img = document.createElement("img");
      img.src = currentPhoto;
      img.alt = "写真";
      item.appendChild(img);
      photoPreview.appendChild(item);
      removePhotoBtn.style.display = "inline-block";
    } else {
      removePhotoBtn.style.display = "none";
    }
  }
  
  // 写真追加ボタンのクリック
  addPhotoBtn.addEventListener("click", () => {
    photoInput.click();
  });
  
  // 写真ファイル選択時の処理
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // ファイルサイズチェック（5MB以下に制限）
    if (file.size > 5 * 1024 * 1024) {
      alert("画像ファイルは5MB以下にしてください。");
      photoInput.value = "";
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      // 画像をリサイズして保存（ストレージ容量削減のため）
      resizeImage(event.target.result, 800, 800, (resizedDataUrl) => {
        currentPhoto = resizedDataUrl;
        renderPhotoPreview();
        saveStatus.textContent = "未保存";
      });
    };
    reader.onerror = () => {
      alert("画像の読み込みに失敗しました。");
      photoInput.value = "";
    };
    reader.readAsDataURL(file);
    photoInput.value = ""; // 同じファイルを再選択可能にする
  });
  
  // 画像リサイズ関数
  function resizeImage(dataUrl, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      // アスペクト比を維持してリサイズ
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        alert("画像の処理に失敗しました。");
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      // JPEG形式で圧縮（品質0.8）
      callback(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      alert("画像の読み込みに失敗しました。");
    };
    img.src = dataUrl;
  }
  
  // 写真削除ボタンのクリック
  removePhotoBtn.addEventListener("click", () => {
    if (confirm("写真を削除しますか？")) {
      currentPhoto = null;
      renderPhotoPreview();
      saveStatus.textContent = "未保存";
    }
  });

  function moveCurrentDateByDays(days) {
    if (!Number.isFinite(days) || days === 0) return;

    const [year, month, day] = (state.currentDate || todayISO()).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);

    state.currentDate = toLocalISODateString(date);
    state.viewYear = date.getFullYear();
    state.viewMonth = date.getMonth() + 1;
    renderCalendar();
    renderEditScreen();
  }

  // 「前日」ボタンの処理
  editPrevDayBtn.addEventListener("click", () => {
    moveCurrentDateByDays(-1);
  });


  // 「翌日」ボタンの処理
  editNextDayBtn.addEventListener("click", () => {
    moveCurrentDateByDays(1);
  });

  saveEntryBtn.addEventListener("click", () => {
    const date = state.currentDate;
    const weightValue = editWeight.value;
    upsertEntry(date, {
      wake: editWake.value.trim(),
      bed: editBed.value.trim(),
      weight: weightValue,
      breakfast: editBreakfast.value.trim(),
      lunch: editLunch.value.trim(),
      dinner: editDinner.value.trim(),
      weather: editWeather.value,
      title: editTitle.value.trim(),
      body: editBody.value.trim(),
      idea: editIdea.value.trim(),
      satisfaction: currentSatisfaction,
      photo: currentPhoto,
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
          e.bed,
          e.weight,
          e.breakfast,
          e.lunch,
          e.dinner,
          e.weather || e.news,
          e.title,
          e.body,
          e.idea,
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
        if (e.bed) summaryParts.push(`🌙${e.bed}`);
        if (e.weight) summaryParts.push(formatWeight(e.weight));
        if (e.breakfast) summaryParts.push("朝:" + e.breakfast);
        if (e.lunch) summaryParts.push("昼:" + e.lunch);
        if (e.dinner) summaryParts.push("夜:" + e.dinner);
        if (e.weather || e.news) summaryParts.push("☁️" + (e.weather || e.news));
        if (e.idea) summaryParts.push("💡" + e.idea);
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

  // ---- 管理：ログイン・エクスポート・インポート・アイデアライブラリ ----
  const googleLoginBtn = $("googleLoginBtn");
  const googleLogoutBtn = $("googleLogoutBtn");
  const loginStatusLabel = $("loginStatusLabel");
  const exportBtn = $("exportBtn");
  const importFile = $("importFile");
  const notificationEnabled = $("notificationEnabled");
  const notificationTime = $("notificationTime");
  const notificationMessage = $("notificationMessage");
  const saveNotificationBtn = $("saveNotificationBtn");
  const notificationStatusLabel = $("notificationStatusLabel");
  
  // アイデアライブラリ関連の要素
  const ideaLibraryHeader = $("ideaLibraryHeader");
  const ideaLibraryToggle = $("ideaLibraryToggle");
  const ideaLibraryBody = $("ideaLibraryBody");
  const ideaCategoryList = $("ideaCategoryList");
  const newCategoryName = $("newCategoryName");
  const addCategoryBtn = $("addCategoryBtn");
  const ideaCategorySelect = $("ideaCategorySelect");
  const addIdeaBtn = $("addIdeaBtn");
  const ideaLibraryList = $("ideaLibraryList");
  const ideaAddForm = $("ideaAddForm");
  const newIdeaCategory = $("newIdeaCategory");
  const newIdeaContent = $("newIdeaContent");
  const cancelIdeaBtn = $("cancelIdeaBtn");
  const saveIdeaBtn = $("saveIdeaBtn");
  
  // ライブラリの開閉
  function toggleIdeaLibrary() {
    state.libraryOpen = !state.libraryOpen;
    ideaLibraryBody.style.display = state.libraryOpen ? "block" : "none";
    ideaLibraryToggle.classList.toggle("open", state.libraryOpen);
  }
  
  ideaLibraryHeader.addEventListener("click", toggleIdeaLibrary);
  
  // ログイン状態を更新
  function updateLoginUI() {
    if (authState.isLoggedIn && authState.user) {
      loginStatusLabel.textContent = `ログイン中: ${authState.user.email}`;
      googleLoginBtn.style.display = "none";
      googleLogoutBtn.style.display = "inline-block";
    } else {
      loginStatusLabel.textContent = "未ログイン";
      googleLoginBtn.style.display = "inline-block";
      googleLogoutBtn.style.display = "none";
    }
  }

  googleLoginBtn.addEventListener("click", () => {
    // シンプルなローカルログイン（実際のGoogleログインの代わり）
    const email = prompt("メールアドレスを入力してください（ローカル保存用）:");
    if (email && email.trim()) {
      // 基本的なメール形式のバリデーション
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedEmail = email.trim();
      if (!emailPattern.test(trimmedEmail)) {
        alert("有効なメールアドレスを入力してください。");
        return;
      }
      authState.isLoggedIn = true;
      authState.user = { 
        email: trimmedEmail,
        loginAt: Date.now()
      };
      saveAuthState();
      updateLoginUI();
      alert("ログインしました。データはローカルに安全に保存されます。");
    }
  });
  
  googleLogoutBtn.addEventListener("click", () => {
    if (confirm("ログアウトしますか？（データはローカルに残ります）")) {
      authState.isLoggedIn = false;
      authState.user = null;
      saveAuthState();
      updateLoginUI();
    }
  });
  
  function getNotificationStatusText() {
    if (!notificationState.enabled) return "通知はOFFです。";
    return `毎日 ${notificationState.time} に通知します。`;
  }

  function renderNotificationUI() {
    notificationEnabled.checked = notificationState.enabled;
    notificationTime.value = notificationState.time || "21:00";
    notificationMessage.value = notificationState.message || "今日の日記を記録しましょう。";
    notificationStatusLabel.textContent = getNotificationStatusText();
  }

  async function requestNotificationPermissionIfNeeded() {
    if (!("Notification" in window)) {
      alert("この端末は通知機能に対応していません。");
      return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") {
      alert("通知が拒否されています。iPhoneの設定から通知を許可してください。");
      return false;
    }
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      alert("通知の許可が必要です。設定から通知をONにしてください。");
      return false;
    }
    return true;
  }

  saveNotificationBtn.addEventListener("click", async () => {
    const timeValue = notificationTime.value || "21:00";
    const messageValue = notificationMessage.value.trim() || "今日の日記を記録しましょう。";
    const enabledValue = notificationEnabled.checked;

    if (enabledValue) {
      const ok = await requestNotificationPermissionIfNeeded();
      if (!ok) {
        notificationEnabled.checked = false;
        return;
      }
    }

    notificationState = {
      enabled: enabledValue,
      time: timeValue,
      message: messageValue,
    };
    saveNotificationState();
    renderNotificationUI();
    startNotificationScheduler();

    alert(enabledValue ? "通知設定を保存しました。" : "通知をOFFにしました。");
  });

  function loadNotificationRuntime() {
    try {
      return JSON.parse(localStorage.getItem(NOTIFICATION_RUNTIME_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveNotificationRuntime(runtime) {
    localStorage.setItem(NOTIFICATION_RUNTIME_KEY, JSON.stringify(runtime));
  }

  async function fireDiaryNotification(message) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const text = message || "今日の日記を記録しましょう。";

    if (navigator.serviceWorker) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("是々日々", {
        body: text,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
      });
      return;
    }

    new Notification("是々日々", { body: text });
  }

  async function checkAndNotify() {
    if (!notificationState.enabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const today = toLocalISODateString(now);
    const [h, m] = (notificationState.time || "21:00").split(":").map(Number);
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = (h || 0) * 60 + (m || 0);

    const runtime = loadNotificationRuntime();
    if (runtime.lastNotifiedDate === today) return;

    if (minutesNow >= targetMinutes) {
      await fireDiaryNotification(notificationState.message);
      saveNotificationRuntime({ lastNotifiedDate: today });
      notificationStatusLabel.textContent = `${getNotificationStatusText()} 本日は通知済みです。`;
    }
  }

  function startNotificationScheduler() {
    checkAndNotify();
    if (notificationTimerId) clearInterval(notificationTimerId);
    notificationTimerId = setInterval(checkAndNotify, 30000);
  }

  // カテゴリセレクトの更新
  function updateCategorySelects() {
    const categories = getAllCategories();
    const optionsHtml = '<option value="all">すべて</option>' +
      Object.entries(categories).map(([id, name]) => 
        `<option value="${esc(id)}">${esc(name)}</option>`
      ).join('');
    
    ideaCategorySelect.innerHTML = optionsHtml;
    ideaCategorySelect.value = state.selectedCategory;
    
    // 新規追加用のセレクト（「すべて」は不要）
    const newIdeaOptionsHtml = Object.entries(categories).map(([id, name]) => 
      `<option value="${esc(id)}">${esc(name)}</option>`
    ).join('');
    newIdeaCategory.innerHTML = newIdeaOptionsHtml;
  }
  
  // カテゴリチップのCSSクラスを取得
  function getCategoryChipClass(categoryId) {
    if (isDefaultCategory(categoryId)) return categoryId;
    return "custom";
  }
  
  // カテゴリリストの描画
  function renderCategoryList() {
    const categories = getAllCategories();
    ideaCategoryList.innerHTML = "";
    
    Object.entries(categories).forEach(([id, name]) => {
      const chip = document.createElement("div");
      chip.className = `idea-category-chip ${getCategoryChipClass(id)}`;
      if (id === state.selectedCategory) {
        chip.classList.add("selected");
      }
      
      const chipName = document.createElement("span");
      chipName.className = "idea-category-chip-name";
      chipName.textContent = name;
      chip.appendChild(chipName);
      
      // カスタムカテゴリの場合は編集・削除ボタンを追加
      if (!isDefaultCategory(id)) {
        const editBtn = document.createElement("span");
        editBtn.className = "idea-category-chip-edit";
        editBtn.textContent = "✏️";
        editBtn.title = "編集";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const currentName = name.replace(/^＃/, "");
          const newName = prompt("カテゴリ名を入力:", currentName);
          if (newName && newName.trim()) {
            editCategory(id, newName.trim());
            renderCategoryList();
            updateCategorySelects();
            renderIdeaLibrary();
          }
        });
        
        const deleteBtn = document.createElement("span");
        deleteBtn.className = "idea-category-chip-delete";
        deleteBtn.textContent = "×";
        deleteBtn.title = "削除";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`「${name}」を削除しますか？\n（このカテゴリのアイデアは「その他」に移動されます）`)) {
            deleteCategory(id);
            if (state.selectedCategory === id) {
              state.selectedCategory = "all";
            }
            renderCategoryList();
            updateCategorySelects();
            renderIdeaLibrary();
          }
        });
        
        chip.appendChild(editBtn);
        chip.appendChild(deleteBtn);
      }
      
      // チップクリックでフィルター
      chip.addEventListener("click", () => {
        state.selectedCategory = id;
        ideaCategorySelect.value = id;
        renderCategoryList();
        renderIdeaLibrary();
      });
      
      ideaCategoryList.appendChild(chip);
    });
  }
  
  // カテゴリ追加ボタン
  addCategoryBtn.addEventListener("click", () => {
    const name = newCategoryName.value.trim();
    if (!name) {
      alert("カテゴリ名を入力してください。");
      return;
    }
    addCategory(name);
    newCategoryName.value = "";
    renderCategoryList();
    updateCategorySelects();
  });
  
  // Enterキーでカテゴリ追加
  newCategoryName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategoryBtn.click();
    }
  });
  
  // アイデアライブラリの描画
  function renderIdeaLibrary() {
    const category = ideaCategorySelect.value;
    state.selectedCategory = category;
    const ideas = getIdeasByCategory(category);
    
    ideaLibraryList.innerHTML = "";
    
    if (ideas.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "card-sub";
      emptyMsg.textContent = "まだアイデアがありません。＋追加ボタンで追加できます。";
      ideaLibraryList.appendChild(emptyMsg);
      return;
    }
    
    ideas.sort((a, b) => b.createdAt - a.createdAt).forEach(idea => {
      const item = document.createElement("div");
      item.className = "idea-item";
      
      const header = document.createElement("div");
      header.className = "idea-item-header";
      
      const badge = document.createElement("span");
      const badgeClass = isDefaultCategory(idea.category) ? idea.category : "custom";
      badge.className = `idea-category-badge ${badgeClass}`;
      badge.textContent = getCategoryName(idea.category);
      
      const actions = document.createElement("div");
      actions.className = "idea-item-actions";
      
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "idea-delete-btn";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        if (confirm("このアイデアを削除しますか？")) {
          deleteIdea(idea.id);
          renderIdeaLibrary();
        }
      });
      
      actions.appendChild(deleteBtn);
      header.appendChild(badge);
      header.appendChild(actions);
      
      const content = document.createElement("div");
      content.className = "idea-item-content";
      content.textContent = idea.content;
      
      item.appendChild(header);
      item.appendChild(content);
      ideaLibraryList.appendChild(item);
    });
  }
  
  ideaCategorySelect.addEventListener("change", renderIdeaLibrary);
  
  addIdeaBtn.addEventListener("click", () => {
    ideaAddForm.style.display = "block";
    newIdeaContent.value = "";
    newIdeaContent.focus();
  });
  
  cancelIdeaBtn.addEventListener("click", () => {
    ideaAddForm.style.display = "none";
    newIdeaContent.value = "";
  });
  
  saveIdeaBtn.addEventListener("click", () => {
    const category = newIdeaCategory.value;
    const content = newIdeaContent.value.trim();
    
    if (!content) {
      alert("内容を入力してください。");
      return;
    }
    
    addIdea(category, content);
    ideaAddForm.style.display = "none";
    newIdeaContent.value = "";
    renderIdeaLibrary();
  });

  exportBtn.addEventListener("click", () => {
    // エクスポートにアイデアライブラリとカテゴリも含める
    const exportData = {
      entries: db.entries,
      ideas: ideasDB.ideas,
      categories: categoriesDB.categories
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = toLocalISODateString(new Date());
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
        
        // 日記エントリのインポート
        if (imported.entries && typeof imported.entries === "object") {
          db.entries = {
            ...db.entries,
            ...imported.entries,
          };
          saveDB();
        }
        
        // カテゴリのインポート
        if (imported.categories && typeof imported.categories === "object") {
          Object.entries(imported.categories).forEach(([id, name]) => {
            if (id && name && !isDefaultCategory(id)) {
              categoriesDB.categories[id] = String(name);
            }
          });
          saveCategoriesDB();
        }
        
        // アイデアのインポート
        if (Array.isArray(imported.ideas)) {
          // 既存のアイデアとマージ（IDで重複排除）
          const existingIds = new Set(ideasDB.ideas.map(i => i.id));
          imported.ideas.forEach(idea => {
            // 必須フィールドのバリデーション
            if (idea && typeof idea === "object" && idea.id && idea.category && idea.content) {
              if (!existingIds.has(idea.id)) {
                ideasDB.ideas.push({
                  id: String(idea.id),
                  category: String(idea.category),
                  content: String(idea.content),
                  createdAt: idea.createdAt || Date.now()
                });
              }
            }
          });
          saveIdeasDB();
        }
        
        renderCalendar();
        renderCategoryList();
        updateCategorySelects();
        renderIdeaLibrary();
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

    initWeightPicker();
    initWeatherPicker();
    renderCalendar();
    renderEditScreen();
    updateLoginUI();
    renderNotificationUI();
    startNotificationScheduler();
    updateCategorySelects();
    renderCategoryList();
    renderIdeaLibrary();
    
    // アプリ起動時はカレンダー画面を表示
    showScreen("calendar");
    hideSplashScreen();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
