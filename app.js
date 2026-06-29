const PRAYER_KEYS = [
  { label: "Fajr", ar: "الفجر", key: "Fajr" },
  { label: "Sunrise", ar: "الشروق", key: "Sunrise" },
  { label: "Dhuhr", ar: "الظهر", key: "Dhuhr" },
  { label: "Asr", ar: "العصر", key: "Asr" },
  { label: "Maghrib", ar: "المغرب", key: "Maghrib" },
  { label: "Isha", ar: "العشاء", key: "Isha" }
];

const STOCKHOLM_PROFILE = {
  latitude: 59.3293,
  longitude: 18.0686,
  method: 13,
  school: 0,
  latitudeAdjustmentMethod: 2,
  tune: "0,-25,0,0,0,0,0,18,0"
};

const statusEl = document.getElementById("status");
const liveClockEl = document.getElementById("live-clock");
const liveClockDateEl = document.getElementById("live-clock-date");
const liveClockWeekDayEl = document.getElementById("live-clock-weekday");
const hijriEl = document.getElementById("hijri");
const clockHourEl = document.getElementById("clock-hour");
const clockMinuteEl = document.getElementById("clock-minute");
const clockSecondEl = document.getElementById("clock-second");
const resultEl = document.getElementById("result");
const timingsBodyEl = document.getElementById("timings-body");
const loadBtn = document.getElementById("load-btn");
const prevDayBtn = document.getElementById("prev-day-btn");
const nextDayBtn = document.getElementById("next-day-btn");
const datePickerEl = document.getElementById("date-picker");
const adhanAudioEl = document.getElementById("adhan-audio");
const muteBtn = document.getElementById("mute-btn");
const testAdhanBtn = document.getElementById("test-adhan-btn");

let currentTimings = null;
let renderedForDate = null;
let activePrayerRow = null;
let fetchInFlight = false;
let selectedDate = new Date();
let isMuted = localStorage.getItem("adhanMuted") === "true";
let lastPlayedPrayer = null;

const stockholmTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const stockholmDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const stockholmWeekDayFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  weekday: "long"
});

const stockholmHijriFormatter = new Intl.DateTimeFormat("en-GB-u-ca-islamic", {
  timeZone: "Europe/Stockholm",
  day: "2-digit",
  month: "long",
  year: "numeric"
});

function getStockholmParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second
  };
}

function getStockholmDateKey(date = new Date()) {
  const { day, month, year } = getStockholmParts(date);
  return `${day}-${month}-${year}`;
}

function formatPrayerTime(value) {
  if (!value) return "-";
  return value.split(" ")[0];
}

function parsePrayerMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(" ")[0].split(":").map(Number);
  return hours * 60 + minutes;
}

function getStockholmMinutes(date = new Date()) {
  const { hour, minute, second } = getStockholmParts(date);
  return Number(hour) * 60 + Number(minute) + Number(second) / 60;
}

function updateClock() {
  const now = new Date();
  const stockholmParts = getStockholmParts(now);
  const hours = Number(stockholmParts.hour);
  const minutes = Number(stockholmParts.minute);
  const seconds = Number(stockholmParts.second);

  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  clockHourEl.style.transform = `translateX(-50%) rotate(${hourAngle}deg)`;
  clockMinuteEl.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;
  clockSecondEl.style.transform = `translateX(-50%) rotate(${secondAngle}deg)`;

  liveClockEl.textContent = stockholmTimeFormatter.format(now);
  liveClockDateEl.textContent = stockholmWeekDayFormatter.format(now) + " " + stockholmDateFormatter.format(now);
  hijriEl.textContent = `${stockholmHijriFormatter.format(now)}`;
}

function setActivePrayerRow(row) {
  if (activePrayerRow) {
    activePrayerRow.classList.remove("is-next-prayer");
  }
  activePrayerRow = row;
  if (activePrayerRow) {
    activePrayerRow.classList.add("is-next-prayer");
  }
}

function updateNextPrayerHighlight() {
  if (!currentTimings) {
    setActivePrayerRow(null);
    return;
  }

  const nowMinutes = getStockholmMinutes();
  const rows = Array.from(timingsBodyEl.querySelectorAll("tr"));
  const prayerTimes = PRAYER_KEYS.map((prayer) => ({
    key: prayer.key,
    minutes: parsePrayerMinutes(currentTimings[prayer.key])
  }));

  let nextIndex = prayerTimes.findIndex((prayer) => prayer.minutes !== null && prayer.minutes >= nowMinutes);
  if (nextIndex === -1) nextIndex = 0;

  setActivePrayerRow(rows[nextIndex] ?? null);
  
  // Check if it's time to play Adhan
  checkAndPlayAdhan(prayerTimes, nowMinutes);
}

function checkAndPlayAdhan(prayerTimes, nowMinutes) {
  if (isMuted || !currentTimings) return;

  // Check if current time matches any prayer time (within 1 minute window)
  for (const prayer of prayerTimes) {
    if (prayer.minutes !== null) {
      const timeDiff = Math.abs(nowMinutes - prayer.minutes);
      if (timeDiff < 1) {
        // Only play once per prayer
        if (lastPlayedPrayer !== prayer.key) {
          playAdhan();
          lastPlayedPrayer = prayer.key;
        }
        return;
      }
    }
  }
}

function playAdhan() {
  adhanAudioEl.currentTime = 0;
  adhanAudioEl.play()
    .then(() => {
      console.log("✅ Adhan playing");
      setStatus("🔊 Adhan is playing...");
    })
    .catch((error) => {
      console.error("❌ Audio play failed:", error);
      setStatus(`❌ Audio failed: ${error.message}`);
    });
}

function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem("adhanMuted", isMuted);
  console.log("🔇 Mute toggled:", isMuted);
  
  // Stop audio if muting
  if (isMuted) {
    adhanAudioEl.pause();
    adhanAudioEl.currentTime = 0;
    setStatus("");
  }
  
  updateMuteButton();
}

function updateMuteButton() {
  console.log("📢 Updating mute button. isMuted:", isMuted);
  if (isMuted) {
    muteBtn.textContent = "🔇";
    muteBtn.classList.add("muted");
    muteBtn.title = "Adhan sound is muted (click to enable)";
  } else {
    muteBtn.textContent = "🔊";
    muteBtn.classList.remove("muted");
    muteBtn.title = "Adhan sound is enabled (click to mute)";
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#374151";
}

function renderTimings(timings) {
  currentTimings = timings;
  lastPlayedPrayer = null; // Reset for new date
  timingsBodyEl.innerHTML = "";
  for (const prayer of PRAYER_KEYS) {
    const row = document.createElement("tr");
    const arabicCell = document.createElement("td");
    const timeCell = document.createElement("td");
    const prayerCell = document.createElement("td");
    arabicCell.textContent = prayer.ar;
    arabicCell.dir = "rtl";
    prayerCell.textContent = prayer.label;
    timeCell.textContent = formatPrayerTime(timings[prayer.key]);
    row.append(prayerCell, timeCell, arabicCell);
    timingsBodyEl.appendChild(row);
  }
  resultEl.classList.remove("hidden");
  updateNextPrayerHighlight();
}

function getTodayDate() {
  return getStockholmDateKey();
}

function getSelectedDateFormatted() {
  const day = String(selectedDate.getDate()).padStart(2, "0");
  const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const year = selectedDate.getFullYear();
  return `${day}-${month}-${year}`;
}

function updateDatePicker() {
  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const day = String(selectedDate.getDate()).padStart(2, "0");
  datePickerEl.value = `${year}-${month}-${day}`;
}

function setPreviousDay() {
  selectedDate.setDate(selectedDate.getDate() - 1);
  updateDatePicker();
  fetchPrayerTimes();
}

function setNextDay() {
  selectedDate.setDate(selectedDate.getDate() + 1);
  updateDatePicker();
  fetchPrayerTimes();
}

function handleDatePickerChange(e) {
  const [year, month, day] = e.target.value.split("-");
  selectedDate = new Date(year, month - 1, day);
  fetchPrayerTimes();
}

async function fetchPrayerTimes() {
  if (fetchInFlight) return;
  fetchInFlight = true;

  const date = getSelectedDateFormatted();
  const url =
    `https://api.aladhan.com/v1/timings/${date}` +
    `?latitude=${encodeURIComponent(STOCKHOLM_PROFILE.latitude)}` +
    `&longitude=${encodeURIComponent(STOCKHOLM_PROFILE.longitude)}` +
    `&method=${encodeURIComponent(STOCKHOLM_PROFILE.method)}` +
    `&school=${encodeURIComponent(STOCKHOLM_PROFILE.school)}` +
    `&latitudeAdjustmentMethod=${encodeURIComponent(
      STOCKHOLM_PROFILE.latitudeAdjustmentMethod
    )}` +
    `&tune=${encodeURIComponent(STOCKHOLM_PROFILE.tune)}`;

  try {
    const response = await fetch(url);
    const payload = await response.json();

    if (!response.ok || payload.code !== 200 || !payload.data?.timings) {
      throw new Error(payload?.data || "Could not load prayer times.");
    }

    renderTimings(payload.data.timings, "");
    renderedForDate = date;
  } catch (error) {
    resultEl.classList.add("hidden");
    setStatus(
      `Error: ${
        error instanceof Error ? error.message : "Unable to load prayer times."
      }`,
      true
    );
  } finally {
    fetchInFlight = false;
  }
}

loadBtn.addEventListener("click", fetchPrayerTimes);
prevDayBtn.addEventListener("click", setPreviousDay);
nextDayBtn.addEventListener("click", setNextDay);
datePickerEl.addEventListener("change", handleDatePickerChange);
muteBtn.addEventListener("click", toggleMute);
/*testAdhanBtn.addEventListener("click", () => {
  if (isMuted) {
    setStatus("🔇 Muted - unmute to hear Azan");
    return;
  }
  playAdhan();
  setStatus("🔊 Adhan is playing...");
});*/
adhanAudioEl.addEventListener("ended", () => {
  setStatus("");
});
updateDatePicker();
updateMuteButton();
fetchPrayerTimes();

updateClock();
setInterval(() => {
  updateClock();
  updateNextPrayerHighlight();

  const currentDate = getTodayDate();
  if (!fetchInFlight && renderedForDate && currentDate !== renderedForDate) {
    fetchPrayerTimes();
  }
}, 1000);
