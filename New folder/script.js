// ==============================
// Theme Toggle
// ==============================
let currentTheme = localStorage.getItem("theme") || "light";

function applyTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.getElementById("themeBtn").innerText = currentTheme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem("theme", currentTheme);
  applyTheme();
}

applyTheme();

// ==============================
// Prayers & Language
// ==============================
let prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
let prayerTimes = {};
let currentLang = localStorage.getItem("lang") || "en";
let userLat = null;
let userLon = null;
let countdownInterval = null;
let showTimeLeftTimer = null;
let showTimeLeftInterval = null;
let showTimeLeftPrayer = null;

const t = {
  en: {
    title: "Next Prayer",
    appTitle: "Salah Tracker",
    prayers: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
    sunrise: "Sunrise",
    progress: "Today's Progress",
    enableReminders: "Enable Reminders",
    disableReminders: "Reminders On",
    qibla: "Qibla Direction",
    north: "N",
    calcMethod: "Umm al-Qura Calculation",
    timeLeft: "Time Left"
  },
  ar: {
    title: "الصلاة القادمة",
    appTitle: "صلاتي",
    prayers: ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"],
    sunrise: "الشروق",
    progress: "إنجاز اليوم",
    enableReminders: "تفعيل التذكيرات",
    disableReminders: "التذكيرات مفعّلة",
    qibla: "اتجاه القبلة",
    north: "ش",
    calcMethod: "حساب أم القرى",
    timeLeft: "الوقت المتبقي"
  }
};

// ==============================
// Location & Fetch Times
// ==============================
navigator.geolocation.getCurrentPosition(
  pos => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    getTimes(userLat, userLon);
    calculateQibla(userLat, userLon);
  },
  () => {
    userLat = 21.3891;
    userLon = 39.8579;
    getTimes(userLat, userLon);
    calculateQibla(userLat, userLon);
  }
);

async function getTimes(lat, lon) {
  try {
    let res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=4`);
    let data = await res.json();
    prayerTimes = data.data.timings;

    // Extract date info
    let hijri = data.data.date.hijri;
    let greg = data.data.date.gregorian;

    // Display Hijri date
    let hijriText = currentLang === "ar"
      ? `${hijri.day} ${hijri.month.ar} ${hijri.year} هـ`
      : `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
    document.getElementById("hijriDate").innerText = hijriText;

    // Display Gregorian date
    let gregText = `${greg.weekday[currentLang === "ar" ? "ar" : "en"]}, ${greg.day} ${greg.month[currentLang === "ar" ? "ar" : "en"]} ${greg.year}`;
    document.getElementById("gregorianDate").innerText = gregText;

    // Reverse geocode for location name
    fetchLocationName(lat, lon);

    displayPrayerTimes();
    highlightNextPrayer();
    startCountdown();
    loadCompletedPrayers();
    scheduleNotifications();
  } catch (err) {
    console.log("Error fetching times:", err);
  }
}

// ==============================
// Location Name (Reverse Geocode)
// ==============================
async function fetchLocationName(lat, lon) {
  try {
    let res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${currentLang}`);
    let data = await res.json();
    let city = data.city || data.locality || "";
    let country = data.countryName || "";
    let locationStr = [city, country].filter(Boolean).join(", ");
    document.getElementById("locationName").innerText = locationStr ? `📍 ${locationStr}` : "";
  } catch (err) {
    document.getElementById("locationName").innerText = "";
  }
}

// ==============================
// Display Prayer Times
// ==============================
function displayPrayerTimes() {
  prayers.forEach(p => {
    document.getElementById("time" + capitalize(p)).innerText = prayerTimes[capitalize(p)];
  });
  // Show sunrise time
  if (prayerTimes.Sunrise) {
    document.getElementById("timeSunrise").innerText = prayerTimes.Sunrise;
  }
}

// ==============================
// Highlight Next Prayer
// ==============================
function highlightNextPrayer() {
  // Remove previous highlights
  document.querySelectorAll(".item.active-prayer").forEach(el => el.classList.remove("active-prayer"));

  let now = new Date();
  for (let p of prayers) {
    let [h, m] = prayerTimes[capitalize(p)].split(":").map(Number);
    let time = new Date();
    time.setHours(h, m, 0, 0);

    if (time > now) {
      document.getElementById(p).classList.add("active-prayer");
      return;
    }
  }
  // If all passed, highlight fajr (tomorrow)
  document.getElementById("fajr").classList.add("active-prayer");
}

// ==============================
// Countdown for Next Prayer
// ==============================
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    // Skip update when viewing a specific prayer's countdown
    if (showTimeLeftPrayer) return;

    let now = new Date();
    let nextPrayer = getNextPrayer(now);

    let diff = nextPrayer.time - now;
    if (diff < 0) diff = 0;
    let h = Math.floor(diff / 3600000);
    let m = Math.floor((diff % 3600000) / 60000);
    let s = Math.floor((diff % 60000) / 1000);

    document.getElementById("countdown").innerText = `${pad(h)}:${pad(m)}:${pad(s)}`;
    document.getElementById("nextPrayerName").innerText = t[currentLang].prayers[prayers.indexOf(nextPrayer.name)];

    // Re-highlight when prayer changes
    highlightNextPrayer();
  }, 1000);
}

function getNextPrayer(now) {
  for (let p of prayers) {
    let [h, m] = prayerTimes[capitalize(p)].split(":").map(Number);
    let time = new Date();
    time.setHours(h, m, 0, 0);

    if (time > now) return { name: p, time };
  }
  // Tomorrow Fajr
  let [h, m] = prayerTimes.Fajr.split(":").map(Number);
  let time = new Date();
  time.setDate(time.getDate() + 1);
  time.setHours(h, m, 0, 0);
  return { name: "fajr", time };
}

// ==============================
// Show Time Left for Each Prayer
// ==============================
function showTimeLeft(prayer) {
  // Clear any previous temporary countdown
  if (showTimeLeftTimer) clearTimeout(showTimeLeftTimer);
  if (showTimeLeftInterval) clearInterval(showTimeLeftInterval);

  // Pause the main countdown while showing this prayer
  showTimeLeftPrayer = prayer;

  // Add visual indicator to the next-card
  let nextCard = document.querySelector('.next-card');
  nextCard.classList.add('viewing-prayer');

  // Update display immediately and every second for 6s
  function updateTempCountdown() {
    let now = new Date();
    let [h, m] = prayerTimes[capitalize(prayer)].split(":").map(Number);
    let prayerTime = new Date();
    prayerTime.setHours(h, m, 0, 0);

    if (prayerTime < now) {
      prayerTime.setDate(prayerTime.getDate() + 1);
    }

    let diff = prayerTime - now;
    let hours = Math.floor(diff / 3600000);
    let minutes = Math.floor((diff % 3600000) / 60000);
    let seconds = Math.floor((diff % 60000) / 1000);

    document.getElementById("nextPrayerName").innerText = t[currentLang].prayers[prayers.indexOf(prayer)];
    document.getElementById("countdown").innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    document.getElementById("nextTitle").innerText = t[currentLang].timeLeft;
  }

  updateTempCountdown();
  showTimeLeftInterval = setInterval(updateTempCountdown, 1000);

  // After 6 seconds, revert to normal countdown
  showTimeLeftTimer = setTimeout(() => {
    clearInterval(showTimeLeftInterval);
    showTimeLeftInterval = null;
    showTimeLeftPrayer = null;
    showTimeLeftTimer = null;

    // Remove visual indicator
    nextCard.classList.remove('viewing-prayer');

    // Restore the "Next Prayer" label
    document.getElementById("nextTitle").innerText = t[currentLang].title;
  }, 6000);
}

// ==============================
// Prayer Completion Tracking
// ==============================
function getTodayKey() {
  let d = new Date();
  return `prayers_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function getCompletedPrayers() {
  let key = getTodayKey();
  let data = localStorage.getItem(key);
  return data ? JSON.parse(data) : {};
}

function saveCompletedPrayers(completed) {
  localStorage.setItem(getTodayKey(), JSON.stringify(completed));
}

function togglePrayer(prayer) {
  let completed = getCompletedPrayers();
  if (completed[prayer]) {
    delete completed[prayer];
  } else {
    completed[prayer] = true;
  }
  saveCompletedPrayers(completed);
  updatePrayerUI(prayer, !!completed[prayer]);
  updateProgress();
}

function loadCompletedPrayers() {
  let completed = getCompletedPrayers();
  prayers.forEach(p => {
    updatePrayerUI(p, !!completed[p]);
  });
  updateProgress();
}

function updatePrayerUI(prayer, done) {
  let item = document.getElementById(prayer);
  let btn = document.getElementById("check" + capitalize(prayer));

  if (done) {
    item.classList.add("prayer-done");
    btn.classList.add("checked");
    btn.querySelector(".check-icon").innerText = "✓";
  } else {
    item.classList.remove("prayer-done");
    btn.classList.remove("checked");
    btn.querySelector(".check-icon").innerText = "○";
  }
}

function updateProgress() {
  let completed = getCompletedPrayers();
  let count = Object.keys(completed).length;
  let pct = (count / 5) * 100;

  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressCount").innerText = `${count} / 5`;
}

// ==============================
// Qibla Direction
// ==============================
function calculateQibla(lat, lon) {
  // Kaaba coordinates
  let kaabaLat = 21.4225;
  let kaabaLon = 39.8262;

  let latRad = lat * Math.PI / 180;
  let lonRad = lon * Math.PI / 180;
  let kaabaLatRad = kaabaLat * Math.PI / 180;
  let kaabaLonRad = kaabaLon * Math.PI / 180;

  let y = Math.sin(kaabaLonRad - lonRad);
  let x = Math.cos(latRad) * Math.tan(kaabaLatRad) - Math.sin(latRad) * Math.cos(kaabaLonRad - lonRad);

  let qiblaAngle = Math.atan2(y, x) * 180 / Math.PI;
  if (qiblaAngle < 0) qiblaAngle += 360;

  // Position the needle and kaaba icon
  let needle = document.getElementById("qiblaNeedle");
  let kaaba = document.getElementById("kaabaIcon");

  needle.style.transform = `rotate(${qiblaAngle}deg)`;

  // Place kaaba icon at the edge of the compass in the qibla direction
  let rad = qiblaAngle * Math.PI / 180;
  let radius = 55;
  let iconX = Math.sin(rad) * radius;
  let iconY = -Math.cos(rad) * radius;
  kaaba.style.transform = `translate(${iconX}px, ${iconY}px)`;

  document.getElementById("qiblaDegree").innerText = `${Math.round(qiblaAngle)}°`;
}

// ==============================
// Browser Notifications
// ==============================
let notificationsEnabled = localStorage.getItem("notif") === "true";
let notificationTimeouts = [];

function toggleNotifications() {
  if (!notificationsEnabled) {
    if ("Notification" in window) {
      Notification.requestPermission().then(perm => {
        if (perm === "granted") {
          notificationsEnabled = true;
          localStorage.setItem("notif", "true");
          updateNotifButton();
          scheduleNotifications();
        }
      });
    }
  } else {
    notificationsEnabled = false;
    localStorage.setItem("notif", "false");
    clearNotificationTimeouts();
    updateNotifButton();
  }
}

function updateNotifButton() {
  let btn = document.getElementById("notifBtn");
  let icon = document.getElementById("notifIcon");
  let label = document.getElementById("notifLabel");

  if (notificationsEnabled) {
    btn.classList.add("active");
    icon.innerText = "🔔";
    label.innerText = t[currentLang].disableReminders;
  } else {
    btn.classList.remove("active");
    icon.innerText = "🔕";
    label.innerText = t[currentLang].enableReminders;
  }
}

function clearNotificationTimeouts() {
  notificationTimeouts.forEach(id => clearTimeout(id));
  notificationTimeouts = [];
}

function scheduleNotifications() {
  clearNotificationTimeouts();
  if (!notificationsEnabled || !prayerTimes.Fajr) return;

  let now = new Date();
  prayers.forEach((p, i) => {
    let [h, m] = prayerTimes[capitalize(p)].split(":").map(Number);
    let prayerTime = new Date();
    prayerTime.setHours(h, m, 0, 0);

    let diff = prayerTime - now;
    if (diff > 0) {
      let id = setTimeout(() => {
        let name = t[currentLang].prayers[i];
        new Notification(`${t[currentLang].appTitle}`, {
          body: `${name} - ${t[currentLang].title}`,
          icon: "assets/mosque.png",
          tag: p
        });
      }, diff);
      notificationTimeouts.push(id);
    }
  });
}

// ==============================
// Language Toggle
// ==============================
function toggleLanguage() {
  currentLang = currentLang === "en" ? "ar" : "en";
  localStorage.setItem("lang", currentLang);
  applyLang();
  // Refresh data for new language
  if (userLat !== null) {
    getTimes(userLat, userLon);
  }
}

function applyLang() {
  document.getElementById("appTitle").innerText = t[currentLang].appTitle;
  document.getElementById("nextTitle").innerText = t[currentLang].title;
  document.getElementById("sunriseName").innerText = t[currentLang].sunrise;
  document.getElementById("progressLabel").innerText = t[currentLang].progress;
  document.getElementById("qiblaTitle").innerText = t[currentLang].qibla;
  document.getElementById("compassN").innerText = t[currentLang].north;
  document.getElementById("calcMethod").innerText = t[currentLang].calcMethod;

  document.querySelectorAll(".list > .item:not(.sunrise-item) .name").forEach((el, i) => {
    el.innerText = t[currentLang].prayers[i];
  });

  document.body.dir = currentLang === "ar" ? "rtl" : "ltr";
  document.getElementById("langBtn").innerText = currentLang === "en" ? "AR" : "EN";

  updateNotifButton();
}

// ==============================
// Helpers
// ==============================
function pad(n) { return n.toString().padStart(2, '0'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ==============================
// Init
// ==============================
applyLang();
updateNotifButton();
