(function(){
"use strict";

var STORAGE_KEY = "kambetz-tasks-v1";
var WEEKDAYS = ["יום א","יום ב","יום ג","יום ד","יום ה","יום ו","שבת"];

function $(id){ return document.getElementById(id); }
function pad(n){ return String(n).padStart(2,"0"); }

/* ============ STORAGE ============ */
function loadTasks(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveTasks(tasks){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }catch(e){}
}
function addTask(data){
  var tasks = loadTasks();
  tasks.push({
    id: "k" + Date.now() + Math.random().toString(36).slice(2,8),
    text: data.text,
    importance: data.importance,
    dueAt: data.dueAt || null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    source: data.source,
    notifiedUrgent: false
  });
  saveTasks(tasks);
}

/* ============ HELPERS ============ */
function priorityClass(importance){ return importance>=7 ? "high" : importance>=4 ? "mid" : "low"; }
function priorityLabel(importance){ return importance>=7 ? "גבוהה" : importance>=4 ? "בינונית" : "נמוכה"; }
function priorityColorVar(importance){
  var cls = priorityClass(importance);
  return cls==="high" ? "var(--prio-high)" : cls==="mid" ? "var(--prio-mid)" : "var(--prio-low)";
}

function formatDue(dueAtIso){
  if (!dueAtIso) return { label:"ללא תאריך", overdue:false, today:false };
  var due = new Date(dueAtIso);
  var now = new Date();
  var timeStr = pad(due.getHours()) + ":" + pad(due.getMinutes());

  if (due.getTime() < now.getTime()){
    var diffMs = now.getTime() - due.getTime();
    var diffH = Math.max(1, Math.floor(diffMs / 3600000));
    if (diffH < 24) return { label: "באיחור " + diffH + " שע'", overdue:true, today:false };
    var diffD = Math.floor(diffH / 24);
    return { label: "באיחור " + diffD + " " + (diffD===1 ? "יום" : "ימים"), overdue:true, today:false };
  }

  var dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var diffDays = Math.round((dueDay - today) / 86400000);

  if (diffDays === 0) return { label: "היום, " + timeStr, overdue:false, today:true };
  if (diffDays === 1) return { label: "מחר, " + timeStr, overdue:false, today:false };
  if (diffDays > 1 && diffDays < 7) return { label: WEEKDAYS[due.getDay()] + ", " + timeStr, overdue:false, today:false };
  return { label: pad(due.getDate()) + "/" + pad(due.getMonth()+1) + ", " + timeStr, overdue:false, today:false };
}

/* ============ ADVISOR ============ */
var GENERAL_TIPS = [
  { title:"שיטת שתי הדקות", text:"אם משימה לוקחת פחות משתי דקות לביצוע — פשוט תעשו אותה עכשיו, לפני שהיא נכנסת ללוח." },
  { title:"בוקר עם סדר עדיפויות", text:"התחילו כל בוקר בבדיקת המשימות האדומות בלוח — אלו שבאמת קובעות אם היום היה מוצלח." },
  { title:"פירוק משימות", text:"משימה שמרגישה גדולה מדי? פרקו אותה לכמה משימות קטנות עם תאריכי יעד נפרדים." },
  { title:"זמן חסום ביומן", text:"קבעו לעצמכם בלוקים קבועים בלוח הזמנים — שעה קבועה למשימות אדומות עוזרת יותר מרשימה בלי סדר." },
  { title:"סקירת ערב", text:"לפני השינה, העיפו מבט על מחר — עדכון קטן היום חוסך בלבול בבוקר." },
  { title:"חשיבות זה לא דחיפות", text:"לא כל משימה עם תאריך קרוב היא חשובה. תנו לציון החשיבות לשקף כמה זה באמת משנה, לא רק כמה זה בוער." },
  { title:"הפסקה בין אדומות", text:"אחרי שתי משימות בעדיפות גבוהה ברצף, קחו הפסקה קצרה — ריכוז לאורך זמן חשוב יותר ממרוץ." },
  { title:"חגגו כל סיום", text:"כל משימה שמסומנת כבוצעה עוברת ללוח ההישגים שלכם. תנו לעצמכם רגע להרגיש את ההתקדמות." }
];
function computeAdvisor(tasks){
  var active = tasks.filter(function(t){ return !t.completedAt; });
  var now = Date.now();
  var overdue = active.filter(function(t){ return t.dueAt && new Date(t.dueAt).getTime() < now; });
  var urgent = active.filter(function(t){
    if (!t.dueAt) return false;
    var d = new Date(t.dueAt).getTime();
    return d >= now && d - now <= 24*3600*1000;
  });
  var highCount = active.filter(function(t){ return t.importance >= 7; }).length;

  if (active.length === 0){
    return { title:"בואו נתחיל", text:"עדיין אין לכם משימות. הוסיפו אחת ידנית או צלמו פתק — ותראו איך הלוח מתארגן לבד." };
  }
  if (overdue.length > 0){
    return { title:"יש משימות באיחור", text: overdue.length + " משימות עברו את המועד שלהן. כדאי לטפל בהן קודם, או לעדכן תאריך חדש אם הן כבר לא רלוונטיות." };
  }
  if (urgent.length >= 3){
    return { title:"יום עמוס מתקרב", text: urgent.length + " משימות דחופות בתוך 24 שעות. נסו לזהות מה באמת קריטי ולדחות את השאר ליום אחר." };
  }
  if (urgent.length > 0){
    return { title:"תשומת לב", text:"יש לכם " + urgent.length + (urgent.length===1 ? " משימה" : " משימות") + " עם מועד בתוך 24 שעות." };
  }
  if (highCount >= 4){
    return { title:"הרבה משימות בעדיפות גבוהה", text:"שקלו לפרק משימות גדולות לצעדים קטנים יותר — זה מקל להתחיל ומראה התקדמות מהר יותר." };
  }
  var dayIndex = Math.floor(Date.now() / 86400000) % GENERAL_TIPS.length;
  return GENERAL_TIPS[dayIndex];
}

/* ============ TOAST ============ */
var toastTimer = null;
function showToast(msg){
  var t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2400);
}

/* ============ VIEW ROUTER ============ */
var VIEWS = ["home","add","camera","board","settings"];
var TITLES = { home:"קמבץ אותה!", add:"הוספת משימה", camera:"צילום משימה", board:"מעקב משימות", settings:"הגדרות" };
function showView(name){
  VIEWS.forEach(function(v){ $("view-" + v).classList.toggle("active", v === name); });
  $("back-btn").hidden = (name === "home");
  $("appbar-title").textContent = TITLES[name] || "קמבץ אותה!";
  window.scrollTo({ top:0 });
}

/* ============ IMPORTANCE SLIDERS ============ */
function updateImportanceUI(rangeId, chipId, labelId){
  var range = $(rangeId), chip = $(chipId), label = $(labelId);
  var v = parseInt(range.value, 10);
  chip.textContent = v;
  label.textContent = "(" + v + "/10)";
  var cls = priorityClass(v);
  var color = priorityColorVar(v);
  var bg = cls==="high" ? "var(--prio-high-bg)" : cls==="mid" ? "var(--prio-mid-bg)" : "var(--prio-low-bg)";
  chip.style.color = color;
  chip.style.background = bg;
  range.style.setProperty("--imp-color", color);
}

/* ============ HOME ============ */
function refreshHome(){
  var tasks = loadTasks();
  var active = tasks.filter(function(t){ return !t.completedAt; });
  $("stat-active").textContent = active.length;
  var now = Date.now();
  var urgent = active.filter(function(t){
    if (!t.dueAt) return false;
    var d = new Date(t.dueAt).getTime();
    return d - now <= 24*3600*1000;
  });
  $("stat-urgent").textContent = urgent.length;

  var badge = $("tile-board-badge");
  if (active.length > 0){ badge.hidden = false; badge.textContent = active.length; }
  else { badge.hidden = true; }

  var adv = computeAdvisor(tasks);
  $("adv-title").textContent = adv.title;
  $("adv-text").textContent = adv.text;
}

/* ============ MANUAL ADD ============ */
function resetAddForm(){
  $("add-text").value = "";
  $("add-due").value = "";
  $("add-importance").value = 5;
  updateImportanceUI("add-importance","add-imp-chip","add-imp-label");
}
function handleAddSave(){
  var text = $("add-text").value.trim();
  var dueVal = $("add-due").value;
  var importance = parseInt($("add-importance").value, 10);
  if (!text){ showToast("כתבו קודם את המשימה"); return; }
  if (!dueVal){ showToast("בחרו מועד ביצוע"); return; }
  addTask({ text:text, dueAt:new Date(dueVal).toISOString(), importance:importance, source:"manual" });
  showToast("המשימה נשמרה");
  boardTab = "active";
  updateTabsUI();
  renderBoard();
  refreshHome();
  showView("board");
}

/* ============ CAMERA FLOW ============ */
function showCamStage(stage){
  $("cam-stage-capture").hidden = stage !== "capture";
  $("cam-stage-analyzing").hidden = stage !== "analyzing";
  $("cam-stage-confirm").hidden = stage !== "confirm";
}
function resetCameraFlow(){
  showCamStage("capture");
  $("file-camera").value = "";
  $("file-gallery").value = "";
}
function mapOcrStatus(status){
  var map = {
    "loading tesseract core":"טוען מנוע זיהוי…",
    "initializing tesseract":"מכין את המנוע…",
    "loading language traineddata":"טוען תמיכה בעברית…",
    "initializing api":"כמעט מוכן…",
    "recognizing text":"קורא את הטקסט…"
  };
  return map[status] || "מנתח את התמונה…";
}
function cleanOcrText(raw){
  return raw.replace(/\r/g,"").split("\n").map(function(l){ return l.trim(); }).filter(Boolean).join("\n").trim();
}
function preprocessForOcr(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      var longSide = Math.max(img.width, img.height);
      var scale = longSide > 1800 ? 1800 / longSide : (longSide < 900 ? 900 / longSide : 1);
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try{
        var imgData = ctx.getImageData(0, 0, w, h);
        var d = imgData.data;
        var n = w * h;
        var gray = new Float32Array(n);
        var min = 255, max = 0;
        for (var i = 0, p = 0; p < n; i += 4, p++){
          var g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
          gray[p] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        var range = Math.max(1, max - min);
        for (var j = 0, q = 0; q < n; j += 4, q++){
          var v = (gray[q] - min) * (255 / range);
          d[j] = d[j+1] = d[j+2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
      }catch(e){ /* canvas read blocked or unsupported — fall back to plain resized image */ }
      resolve(canvas);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("image-load-failed")); };
    img.src = url;
  });
}
function runOcr(file, previewDataUrl){
  showCamStage("analyzing");
  $("cam-progress-text").textContent = "מעבד את התמונה…";

  if (typeof Tesseract === "undefined"){
    showToast("שירות זיהוי הטקסט לא נטען — בדקו חיבור לאינטרנט ונסו שוב");
    showCamStage("capture");
    return;
  }

  preprocessForOcr(file).catch(function(){ return file; }).then(function(source){
    return Tesseract.recognize(source, "heb+eng", {
      logger: function(m){
        if (m && m.status){
          var pct = (typeof m.progress === "number") ? " " + Math.round(m.progress*100) + "%" : "";
          $("cam-progress-text").textContent = mapOcrStatus(m.status) + pct;
        }
      }
    });
  }).then(function(result){
    var text = cleanOcrText((result && result.data && result.data.text) || "");
    $("cam-preview").src = previewDataUrl;
    $("cam-text").value = text;
    $("cam-due").value = "";
    $("cam-importance").value = 5;
    updateImportanceUI("cam-importance","cam-imp-chip","cam-imp-label");
    showCamStage("confirm");
    if (!text) showToast("לא הצלחנו לזהות טקסט בבירור — אפשר לכתוב ידנית");
  }).catch(function(err){
    console.error("OCR error", err);
    showToast("משהו השתבש בזיהוי הטקסט — נסו שוב");
    showCamStage("capture");
  });
}
function handleImageSelected(e){
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){ runOcr(file, ev.target.result); };
  reader.readAsDataURL(file);
}
function handleCamSave(){
  var text = $("cam-text").value.trim();
  var dueVal = $("cam-due").value;
  var importance = parseInt($("cam-importance").value, 10);
  if (!text){ showToast("הטקסט ריק — כתבו את המשימה"); return; }
  if (!dueVal){ showToast("בחרו מועד ביצוע"); return; }
  addTask({ text:text, dueAt:new Date(dueVal).toISOString(), importance:importance, source:"camera" });
  showToast("המשימה נשמרה");
  boardTab = "active";
  updateTabsUI();
  renderBoard();
  refreshHome();
  showView("board");
}

/* ============ BOARD ============ */
var boardTab = "active";
function updateTabsUI(){
  $("tab-active").classList.toggle("active", boardTab === "active");
  $("tab-done").classList.toggle("active", boardTab === "done");
}
function renderTaskCard(t){
  var card = document.createElement("div");
  card.className = "task-card" + (t.completedAt ? " completed" : "");
  card.style.setProperty("--prio-color", priorityColorVar(t.importance));

  var due = formatDue(t.dueAt);
  if (!t.completedAt && due.overdue) card.classList.add("overdue");

  var dueChipClass = due.overdue ? "overdue" : due.today ? "today" : "";
  var prioCls = priorityClass(t.importance);
  var sourceLabel = t.source === "camera" ? "📷 מצילום" : "✍️ ידני";

  card.innerHTML =
    '<button class="task-check' + (t.completedAt ? " checked" : "") + '" aria-label="סמנו כבוצע">' +
      (t.completedAt ? '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : "") +
    '</button>' +
    '<div class="task-body">' +
      '<div class="task-text"></div>' +
      '<div class="task-meta">' +
        '<span class="due-chip ' + dueChipClass + '">' + due.label + '</span>' +
        '<span class="prio-chip ' + prioCls + '">' + priorityLabel(t.importance) + ' (' + t.importance + ')</span>' +
        '<span class="task-source">' + sourceLabel + '</span>' +
      '</div>' +
    '</div>' +
    '<button class="task-del" aria-label="מחקו משימה">' +
      '<svg class="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
    '</button>';

  card.querySelector(".task-text").textContent = t.text;
  card.querySelector(".task-check").addEventListener("click", function(){
    if (!t.completedAt){
      this.classList.add("checked","just-checked");
      var id = t.id;
      setTimeout(function(){ toggleComplete(id); }, 380);
    } else {
      toggleComplete(t.id);
    }
  });
  card.querySelector(".task-del").addEventListener("click", function(){
    if (window.confirm("למחוק את המשימה \"" + t.text + "\"?")) deleteTask(t.id);
  });
  return card;
}
function renderBoard(){
  var tasks = loadTasks();
  var list = boardTab === "active"
    ? tasks.filter(function(t){ return !t.completedAt; })
    : tasks.filter(function(t){ return !!t.completedAt; });

  if (boardTab === "active"){
    list.sort(function(a,b){
      var ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      var bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return b.importance - a.importance;
    });
  } else {
    list.sort(function(a,b){ return new Date(b.completedAt) - new Date(a.completedAt); });
  }

  var container = $("task-list");
  container.innerHTML = "";
  list.forEach(function(t){ container.appendChild(renderTaskCard(t)); });

  $("board-empty").hidden = list.length > 0;
  $("board-empty-text").textContent = boardTab === "active"
    ? 'אין עדיין משימות פה — לחצו על "הוספת משימה" בעמוד הבית.'
    : "עוד לא השלמתם משימות. כשתסמנו משימה כבוצעה, היא תופיע כאן.";
}
function toggleComplete(id){
  var tasks = loadTasks();
  var t = tasks.find(function(x){ return x.id === id; });
  if (!t) return;
  t.completedAt = t.completedAt ? null : new Date().toISOString();
  saveTasks(tasks);
  renderBoard();
  refreshHome();
  if (t.completedAt) showToast("כל הכבוד! המשימה הושלמה");
}
function deleteTask(id){
  var tasks = loadTasks().filter(function(t){ return t.id !== id; });
  saveTasks(tasks);
  renderBoard();
  refreshHome();
  showToast("המשימה נמחקה");
}

/* ============ SETTINGS ============ */
function updateNotifStatus(){
  var el = $("notif-status");
  if (!("Notification" in window)){ el.textContent = "הדפדפן הזה לא תומך בהתראות."; return; }
  if (Notification.permission === "granted") el.textContent = "התראות פעילות ✓";
  else if (Notification.permission === "denied") el.textContent = "התראות חסומות — יש לאשר בהגדרות הדפדפן/המכשיר.";
  else el.textContent = "התראות עדיין לא הופעלו.";
}
function handleEnableNotifications(){
  if (!("Notification" in window)){ showToast("הדפדפן לא תומך בהתראות"); return; }
  Notification.requestPermission().then(function(perm){
    updateNotifStatus();
    if (perm === "granted"){ showToast("התראות הופעלו"); checkUrgentNotifications(); }
    else if (perm === "denied") showToast("ההתראות נחסמו");
  });
}
function handleClearData(){
  if (!window.confirm("למחוק את כל המשימות לצמיתות?")) return;
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  renderBoard();
  refreshHome();
  showToast("כל המשימות נמחקו");
}

/* ============ NOTIFICATIONS (24h reminder) ============ */
function fireNotification(t){
  var title = "תזכורת: " + (t.text.length > 40 ? t.text.slice(0,40) + "…" : t.text);
  var due = formatDue(t.dueAt);
  var body = "מועד ביצוע: " + due.label;
  try{
    if (navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(function(reg){
        reg.showNotification(title, { body:body, icon:"icons/icon-192.png", badge:"icons/icon-192.png" });
      });
    } else {
      new Notification(title, { body:body, icon:"icons/icon-192.png" });
    }
  }catch(e){}
}
function checkUrgentNotifications(){
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  var tasks = loadTasks();
  var changed = false;
  var now = Date.now();
  tasks.forEach(function(t){
    if (t.completedAt || !t.dueAt || t.notifiedUrgent) return;
    var diff = new Date(t.dueAt).getTime() - now;
    if (diff <= 24*3600*1000){
      fireNotification(t);
      t.notifiedUrgent = true;
      changed = true;
    }
  });
  if (changed) saveTasks(tasks);
}

/* ============ INSTALL BANNER (PWA) ============ */
function isStandalone(){
  try{ return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
  catch(e){ return false; }
}
function dismissedRecently(){
  try{
    var v = localStorage.getItem("kambetz-install-dismissed");
    if (!v) return false;
    return (Date.now() - parseInt(v,10)) < 7*24*60*60*1000;
  }catch(e){ return false; }
}
function markDismissed(){
  try{ localStorage.setItem("kambetz-install-dismissed", String(Date.now())); }catch(e){}
}
function setupInstallBanner(){
  if (isStandalone() || dismissedRecently()) return;
  var banner = $("install-banner");
  var installBtn = $("ib-install");
  var closeBtn = $("ib-close");
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    banner.hidden = false;
  });
  if (isIOS){
    $("ib-title").textContent = "הוסיפו את קמבץ אותה! למסך הבית";
    $("ib-sub").textContent = "הקישו על שיתוף, ואז \"הוסף למסך הבית\"";
    installBtn.hidden = true;
    setTimeout(function(){ banner.hidden = false; }, 1200);
  }
  installBtn.addEventListener("click", function(){
    if (!deferredPrompt) return;
    installBtn.disabled = true;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function(){ deferredPrompt = null; banner.hidden = true; });
  });
  closeBtn.addEventListener("click", function(){ banner.hidden = true; markDismissed(); });
  window.addEventListener("appinstalled", function(){ banner.hidden = true; });
}
function registerServiceWorker(){
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(function(){});
  }
}

/* ============ INIT ============ */
function init(){
  updateImportanceUI("add-importance","add-imp-chip","add-imp-label");
  updateImportanceUI("cam-importance","cam-imp-chip","cam-imp-label");
  $("add-importance").addEventListener("input", function(){ updateImportanceUI("add-importance","add-imp-chip","add-imp-label"); });
  $("cam-importance").addEventListener("input", function(){ updateImportanceUI("cam-importance","cam-imp-chip","cam-imp-label"); });

  $("tile-add").addEventListener("click", function(){ resetAddForm(); showView("add"); });
  $("tile-camera").addEventListener("click", function(){ resetCameraFlow(); showView("camera"); });
  $("tile-board").addEventListener("click", function(){ boardTab="active"; updateTabsUI(); renderBoard(); showView("board"); });
  $("settings-btn").addEventListener("click", function(){ updateNotifStatus(); showView("settings"); });
  $("back-btn").addEventListener("click", function(){ refreshHome(); showView("home"); });

  $("add-save").addEventListener("click", handleAddSave);
  $("add-cancel").addEventListener("click", function(){ refreshHome(); showView("home"); });

  $("cam-take").addEventListener("click", function(){ $("file-camera").click(); });
  $("cam-pick").addEventListener("click", function(){ $("file-gallery").click(); });
  $("file-camera").addEventListener("change", handleImageSelected);
  $("file-gallery").addEventListener("change", handleImageSelected);
  $("cam-save").addEventListener("click", handleCamSave);
  $("cam-retake").addEventListener("click", resetCameraFlow);

  $("tab-active").addEventListener("click", function(){ boardTab="active"; updateTabsUI(); renderBoard(); });
  $("tab-done").addEventListener("click", function(){ boardTab="done"; updateTabsUI(); renderBoard(); });

  $("notif-enable").addEventListener("click", handleEnableNotifications);
  $("clear-data").addEventListener("click", handleClearData);

  refreshHome();
  renderBoard();
  setupInstallBanner();
  registerServiceWorker();
  checkUrgentNotifications();
  setInterval(checkUrgentNotifications, 5*60*1000);
  setInterval(refreshHome, 60*1000);
}

document.addEventListener("DOMContentLoaded", init);

})();
