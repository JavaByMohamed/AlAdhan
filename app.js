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
const ISLAMISKA_TIMETABLE_LIVE_PATH = "./data/islamiskaforbundet-bonetider.live.json";
const ISLAMISKA_TIMETABLE_SEED_PATH = "./data/islamiskaforbundet-bonetider.json";

const KISTA_PROFILE = {
  latitude: 59.4032,
  longitude: 17.9448
};
const KISTA_SL_SITE_ID = 9302;
const NORGEGATAN_SL_SITE_ID = 3759;
const NORGEGATAN_KISTA_LINES = new Set(["179", "685", "687", "612"]);

const statusEl = document.getElementById("status");
const liveClockEl = document.getElementById("live-clock");
// const liveClockDateEl = document.getElementById("live-clock-date");
// const liveClockWeekDayEl = document.getElementById("live-clock-weekday");
const hijriEl = document.getElementById("hijri");
const hijriGregorianEl = document.getElementById("hijri-gregorian");
const weatherCurrentEl = document.getElementById("weather-current");
const weatherIconEl = document.getElementById("weather-icon");
const weatherHighLowEl = document.getElementById("weather-high-low");
const weatherExtraEl = document.getElementById("weather-extra");
const weatherHoursEl = document.getElementById("weather-hours");
const weatherDailyEl = document.getElementById("weather-daily");
const slTrafficStatusEl = document.getElementById("sl-traffic-status");
const slTrafficListEl = document.getElementById("sl-traffic-list");
const slBusStatusEl = document.getElementById("sl-bus-status");
const slBusListEl = document.getElementById("sl-bus-list");
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
const manualPrayerSelectEl = document.getElementById("manual-prayer-select");
const manualTimeInputEl = document.getElementById("manual-time-input");
const setManualTimeBtn = document.getElementById("set-manual-time-btn");
const clearManualTimesBtn = document.getElementById("clear-manual-times-btn");
const manualOverrideNoteEl = document.getElementById("manual-override-note");
const nextPrayerLabelEl = document.getElementById("next-prayer-label");
const nextPrayerCountdownEl = document.getElementById("next-prayer-countdown");
const nextPrayerTimeEl = document.getElementById("next-prayer-time");
const makkahStreamToggleEl = document.getElementById("makkah-stream-toggle");
const makkahStreamPanelEl = document.getElementById("makkah-stream-panel");
const makkahStreamPlayerEl = document.getElementById("makkah-stream-player");
const makkahStreamCloseEl = document.getElementById("makkah-stream-close");
const makkahBackgroundToggleEl = document.getElementById("makkah-background-toggle");
const makkahBackgroundHelpEl = document.getElementById("makkah-background-help");
const contentPanelEl = document.querySelector(".content-panel");
let useLiveBackground = localStorage.getItem("makkahLiveBackground") === "true";

let currentTimings = null;
let countdownTimingsByDate = {};
let countdownFetchInFlight = false;
let lastCountdownFetchAt = 0;
let countdownError = "";
let renderedForDate = null;
let activePrayerCell = null;
let fetchInFlight = false;
let selectedDate = new Date();
let isMuted = localStorage.getItem("adhanMuted") === "true";
let lastPlayedPrayer = null;
let weatherFetchInFlight = false;
let lastWeatherFetchAt = 0;
let slTrafficFetchInFlight = false;
let lastSlTrafficFetchAt = 0;
let slBusFetchInFlight = false;
let lastSlBusFetchAt = 0;
let islamiskaTimetableByDate = null;
let islamiskaTimetableLoadPromise = null;
let islamiskaTimetableLoadedAt = 0;
let lastPrayerTimesFetchAt = 0;

const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const SL_TRAFFIC_REFRESH_MS = 5 * 60 * 1000;
const PRAYER_TIMES_REFRESH_MS = 5 * 60 * 1000;
const LOCAL_TIMETABLE_CACHE_MS = 5 * 60 * 1000;
const PAGE_AUTO_REFRESH_MS = 60 * 1000;
const CUSTOM_TIMINGS_STORAGE_KEY = "customPrayerTimingsByDate";
let customTimingsByDate = loadCustomTimingsByDate();

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
const arabicWeekDayFormatter = new Intl.DateTimeFormat("ar-EG", {
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

function isValidTimeValue(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function normalizePrayerTime(value) {
  const normalized = String(value || "").trim().split(" ")[0];
  return isValidTimeValue(normalized) ? normalized : null;
}

function loadCustomTimingsByDate() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_TIMINGS_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveCustomTimingsByDate() {
  localStorage.setItem(CUSTOM_TIMINGS_STORAGE_KEY, JSON.stringify(customTimingsByDate));
}

function applyCustomTimings(timings, dateKey) {
  const dateOverrides = customTimingsByDate[dateKey];
  if (!dateOverrides) return timings;

  const mergedTimings = { ...timings };
  for (const prayer of PRAYER_KEYS) {
    const override = normalizePrayerTime(dateOverrides[prayer.key]);
    if (override) {
      mergedTimings[prayer.key] = override;
    }
  }
  return mergedTimings;
}

function updateManualOverrideNote() {
  const dateKey = getSelectedDateFormatted();
  const dateOverrides = customTimingsByDate[dateKey];
  const overrideCount = PRAYER_KEYS.filter(
    (prayer) => normalizePrayerTime(dateOverrides?.[prayer.key]) !== null
  ).length;

  if (overrideCount === 0) {
    manualOverrideNoteEl.textContent = "";
    return;
  }

  manualOverrideNoteEl.textContent = `Manual times active for ${overrideCount} prayer(s) on ${datePickerEl.value}.`;
}

function syncManualTimeInputFromSelection() {
  if (!currentTimings) return;
  const selectedPrayer = manualPrayerSelectEl.value;
  const value = normalizePrayerTime(currentTimings[selectedPrayer]);
  manualTimeInputEl.value = value || "";
}

function handleSetManualPrayerTime() {
  if (!currentTimings) {
    setStatus("Load prayer times first.", true);
    return;
  }

  const prayerKey = manualPrayerSelectEl.value;
  const timeValue = normalizePrayerTime(manualTimeInputEl.value);
  if (!timeValue) {
    setStatus("Enter a valid time in HH:MM format.", true);
    return;
  }

  const dateKey = getSelectedDateFormatted();
  if (!customTimingsByDate[dateKey]) {
    customTimingsByDate[dateKey] = {};
  }
  customTimingsByDate[dateKey][prayerKey] = timeValue;
  saveCustomTimingsByDate();

  const updatedTimings = { ...currentTimings, [prayerKey]: timeValue };
  renderTimings(updatedTimings);
  renderedForDate = dateKey;
  updateManualOverrideNote();
  updatePrayerCountdown();

  const prayerLabel = PRAYER_KEYS.find((prayer) => prayer.key === prayerKey)?.label || prayerKey;
  setStatus(`${prayerLabel} set to ${timeValue} for ${datePickerEl.value}.`);
}

function handleClearManualPrayerTimes() {
  const dateKey = getSelectedDateFormatted();
  if (!customTimingsByDate[dateKey]) {
    setStatus(`No manual times found for ${datePickerEl.value}.`);
    return;
  }

  delete customTimingsByDate[dateKey];
  saveCustomTimingsByDate();
  updateManualOverrideNote();
  updatePrayerCountdown();
  setStatus(`Manual times cleared for ${datePickerEl.value}.`);
  fetchPrayerTimes();
}

function parsePrayerMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(" ")[0].split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizePrayerTimingsRecord(record) {
  if (!record || typeof record !== "object") return null;
  const normalizedRecord = {};
  for (const prayer of PRAYER_KEYS) {
    const value = normalizePrayerTime(record[prayer.key]);
    if (!value) return null;
    normalizedRecord[prayer.key] = value;
  }
  return normalizedRecord;
}

async function loadAlAdhanTimingsForDate(dateKey) {
  const url =
    `https://api.aladhan.com/v1/timings/${dateKey}` +
    `?latitude=${encodeURIComponent(STOCKHOLM_PROFILE.latitude)}` +
    `&longitude=${encodeURIComponent(STOCKHOLM_PROFILE.longitude)}` +
    `&method=${encodeURIComponent(STOCKHOLM_PROFILE.method)}` +
    `&school=${encodeURIComponent(STOCKHOLM_PROFILE.school)}` +
    `&latitudeAdjustmentMethod=${encodeURIComponent(STOCKHOLM_PROFILE.latitudeAdjustmentMethod)}` +
    `&tune=${encodeURIComponent(STOCKHOLM_PROFILE.tune)}`;

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.code !== 200 || !payload.data?.timings) {
    throw new Error(payload?.data || "Could not load prayer times.");
  }

  const normalized = normalizePrayerTimingsRecord(payload.data.timings);
  if (!normalized) {
    throw new Error("Received incomplete prayer times from API.");
  }
  return normalized;
}

async function loadIslamiskaTimetableByDate() {
  const isCacheFresh =
    islamiskaTimetableByDate &&
    Date.now() - islamiskaTimetableLoadedAt < LOCAL_TIMETABLE_CACHE_MS;
  if (isCacheFresh) return islamiskaTimetableByDate;
  if (islamiskaTimetableLoadPromise) return islamiskaTimetableLoadPromise;

  islamiskaTimetableLoadPromise = (async () => {
    const cacheBuster = `t=${Math.floor(Date.now() / LOCAL_TIMETABLE_CACHE_MS)}`;
    let raw = null;

    for (const path of [ISLAMISKA_TIMETABLE_LIVE_PATH, ISLAMISKA_TIMETABLE_SEED_PATH]) {
      try {
        const response = await fetch(`${path}?${cacheBuster}`, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json();
        if (payload?.timesByDate && typeof payload.timesByDate === "object") {
          raw = payload.timesByDate;
          break;
        }
      } catch {
        // Try fallback source.
      }
    }
    if (!raw) throw new Error("Could not load Islamiska Förbundet timetable.");

    const normalized = {};
    for (const [dateKey, record] of Object.entries(raw)) {
      const normalizedRecord = normalizePrayerTimingsRecord(record);
      if (normalizedRecord) {
        normalized[dateKey] = normalizedRecord;
      }
    }

    islamiskaTimetableByDate = normalized;
    islamiskaTimetableLoadedAt = Date.now();
    return islamiskaTimetableByDate;
  })();

  try {
    return await islamiskaTimetableLoadPromise;
  } finally {
    islamiskaTimetableLoadPromise = null;
  }
}

function getStockholmMinutes(date = new Date()) {
  const { hour, minute, second } = getStockholmParts(date);
  return Number(hour) * 60 + Number(minute) + Number(second) / 60;
}

function updateClock() {
  if (!clockHourEl || !clockMinuteEl || !clockSecondEl) {
    return;
  }

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

//  liveClockEl.textContent = stockholmTimeFormatter.format(now);
//  liveClockDateEl.textContent = stockholmWeekDayFormatter.format(now) + " " + stockholmDateFormatter.format(now);
//  hijriEl.textContent = `${stockholmHijriFormatter.format(now)}`;
}

function clock() {
  const now = new Date();
  const { hour, minute } = getStockholmParts(now);
  const hour24 = Number(hour);
  const hourText = String(hour24).padStart(2, "0");
  const minuteText = String(minute).padStart(2, "0");
  const timeKey = `${String(hour24).padStart(2, "0")}:${minuteText}`;

  liveClockEl.dataset.timeKey = timeKey;
  liveClockEl.innerHTML = `
    <div class="live-clock-display" aria-label="${hourText}:${minuteText}">
      <div class="live-clock-tile live-clock-hour">
        <span class="live-clock-number">${hourText}</span>
      </div>
      <div class="live-clock-tile live-clock-minute">
        <span class="live-clock-number">${minuteText}</span>
      </div>
    </div>
  `;
  hijriEl.textContent = `${stockholmHijriFormatter.format(now)}`;
  if (hijriGregorianEl) {
    hijriGregorianEl.textContent = stockholmDateFormatter.format(now);
  }
}

function setActivePrayerCell(cell) {
  if (activePrayerCell) {
    activePrayerCell.classList.remove("is-next-prayer");
    activePrayerCell.removeAttribute("aria-current");
  }
  activePrayerCell = cell;
  if (activePrayerCell) {
    activePrayerCell.classList.add("is-next-prayer");
    activePrayerCell.setAttribute("aria-current", "true");
  }
}

function getNextStockholmDateKey(date = new Date()) {
  const { year, month, day } = getStockholmParts(date);
  return getStockholmDateKey(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1, 12)));
}

function getPrayerTimestamp(dateKey, time) {
  const [day, month, year] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = wallTime;
  // Resolve the Stockholm UTC offset on the target date, including DST changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getStockholmParts(new Date(timestamp));
    const representedTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    timestamp += wallTime - representedTime;
  }
  return timestamp;
}

function findNextPrayer(now = new Date()) {
  for (const dateKey of [getStockholmDateKey(now), getNextStockholmDateKey(now)]) {
    const timings = countdownTimingsByDate[dateKey];
    if (!timings) return null;
    const effectiveTimings = applyCustomTimings(timings, dateKey);
    const upcoming = PRAYER_KEYS.filter((prayer) => prayer.key !== "Sunrise")
      .map((prayer) => {
        const time = normalizePrayerTime(effectiveTimings[prayer.key]);
        return time ? { ...prayer, dateKey, time, timestamp: getPrayerTimestamp(dateKey, time) } : null;
      })
      .filter((prayer) => prayer && prayer.timestamp >= now.getTime())
      .sort((a, b) => a.timestamp - b.timestamp);
    if (upcoming.length > 0) return upcoming[0];
  }
  return null;
}

async function fetchCountdownTimings() {
  if (countdownFetchInFlight) return;
  countdownFetchInFlight = true;
  lastCountdownFetchAt = Date.now();
  try {
    const now = new Date();
    const localTimetable = await loadIslamiskaTimetableByDate();
    const today = getStockholmDateKey(now);
    const tomorrow = getNextStockholmDateKey(now);
    for (const dateKey of [today, tomorrow]) {
      countdownTimingsByDate[dateKey] = localTimetable[dateKey] || await loadAlAdhanTimingsForDate(dateKey);
    }
    countdownTimingsByDate = {
      [today]: countdownTimingsByDate[today],
      [tomorrow]: countdownTimingsByDate[tomorrow]
    };
    countdownError = "";
  } catch (error) {
    countdownError = error instanceof Error ? error.message : "Unable to load prayer times.";
    console.error("Next prayer countdown:", error);
  } finally {
    countdownFetchInFlight = false;
    updatePrayerCountdown();
  }
}

function updatePrayerCountdown() {
  const now = new Date();
  const nextPrayer = findNextPrayer(now);
  if (!nextPrayer) {
    nextPrayerLabelEl.textContent = countdownError ? "Next prayer unavailable" : "Loading next prayer...";
    nextPrayerCountdownEl.textContent = "--:--:--";
    nextPrayerTimeEl.textContent = countdownError;
  } else {
    const remaining = Math.max(0, Math.ceil((nextPrayer.timestamp - now.getTime()) / 1000));
    const hours = String(Math.floor(remaining / 3600)).padStart(2, "0");
    const minutes = String(Math.floor(remaining / 60) % 60).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    nextPrayerLabelEl.textContent = `${nextPrayer.label} (${nextPrayer.ar})`;
    nextPrayerCountdownEl.textContent = `${hours}:${minutes}:${seconds}`;
    nextPrayerTimeEl.textContent = countdownError
      ? `Update failed: ${countdownError}`
      : "";
  }

  const nextPrayerKey = nextPrayer?.dateKey === renderedForDate ? nextPrayer.key : null;
  const cells = Array.from(timingsBodyEl.querySelectorAll("[data-prayer-key]"));
  const nextPrayerCell = cells.find((cell) => cell.dataset.prayerKey === nextPrayerKey) || null;
  setActivePrayerCell(nextPrayerCell);
}

function getLiveClockTimeKey() {
  const dataTimeKey = String(liveClockEl.dataset.timeKey || "").trim();
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(dataTimeKey)) {
    return dataTimeKey;
  }
  const displayedClockValue = String(liveClockEl.textContent || "").trim();
  const match = displayedClockValue.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

function checkAndPlayAdhan() {
  if (isMuted || !currentTimings) return;
  const nowTimeKey = getLiveClockTimeKey();
  if (!nowTimeKey) return;

  for (let index = 0; index < PRAYER_KEYS.length; index += 1) {
    const prayer = PRAYER_KEYS[index];
    if (prayer.key === "Sunrise") continue;
    const prayerTimeKey = normalizePrayerTime(currentTimings[prayer.key]);
    if (!prayerTimeKey) continue;
    if (prayerTimeKey === nowTimeKey) {
      // Only play once per prayer
      if (lastPlayedPrayer !== prayer.key) {
        playAdhan();
        lastPlayedPrayer = prayer.key;
      }
      return;
    }
  }
}

function playAdhan() {
  adhanAudioEl.currentTime = 0;
  adhanAudioEl.muted = false;
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
  } else {
    // Unmute the audio element when user enables sound
    adhanAudioEl.muted = false;
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
  statusEl.classList.toggle("is-error", isError);
}

function getWeatherSymbol(code) {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function getWeatherLabel(code) {
  if (code === 0) return "صافي";
  if (code >= 1 && code <= 3) return "غائم";
  if (code >= 45 && code <= 48) return "شبورة";
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) return "ممطر";
  if (code >= 71 && code <= 77) return "ثلوج";
  if (code >= 80 && code <= 82) return "زخات مطر";
  if (code >= 85 && code <= 86) return "زخات ثلج";
  if (code >= 95) return "عاصفة رعدية";
  return "غير واضح";
}

function getStockholmIsoDate(date = new Date()) {
  const { year, month, day } = getStockholmParts(date);
  return `${year}-${month}-${day}`;
}

function renderUpcomingHourlyWeather(hourly) {
  if (!weatherHoursEl) return;
  weatherHoursEl.className = "weather-hours";
  if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.temperature_2m)) {
    weatherHoursEl.textContent = "توقعات الساعات غير متاحة.";
    return;
  }

  const todayIsoDate = getStockholmIsoDate();
  const nowHour = Number(getStockholmParts().hour);
  const startHour = Math.max(nowHour, 8);

  const entries = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const isoTime = String(hourly.time[index] || "");
    if (isoTime.length < 13) continue;
    const hour = Number(isoTime.slice(11, 13));
    if (isoTime.slice(0, 10) !== todayIsoDate || Number.isNaN(hour) || hour < startHour) {
      continue;
    }

    const temperature = hourly.temperature_2m[index];
    if (typeof temperature !== "number") continue;
    const weatherCode = Number(hourly.weather_code?.[index] ?? NaN);
    entries.push({
      hourLabel: `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "ص" : "م"}`,
      symbol: Number.isNaN(weatherCode) ? "🌡️" : getWeatherSymbol(weatherCode),
      temp: `${Math.round(temperature)}°`
    });
    if (entries.length >= 6) break;
  }

  if (entries.length === 0) {
    weatherHoursEl.textContent = "لا توجد توقعات بالساعات القادمة.";
    return;
  }

  weatherHoursEl.textContent = "";
  weatherHoursEl.classList.add("weather-hours-board");

  const sectionTitle = document.createElement("p");
  sectionTitle.className = "weather-section-title";
  sectionTitle.textContent = "كل ساعة";
  weatherHoursEl.appendChild(sectionTitle);

  const row = document.createElement("div");
  row.className = "weather-hours-row";
  row.style.setProperty("--weather-cols", String(entries.length));

  for (const entry of entries) {
    const cell = document.createElement("article");
    cell.className = "weather-hour-cell";
    const time = document.createElement("span");
    time.className = "weather-hour-time";
    time.textContent = entry.hourLabel;
    const icon = document.createElement("span");
    icon.className = "weather-hour-icon";
    icon.textContent = entry.symbol;
    const temp = document.createElement("span");
    temp.className = "weather-hour-temp";
    temp.textContent = entry.temp;
    cell.append(time, icon, temp);
    row.appendChild(cell);
  }

  weatherHoursEl.appendChild(row);
}

function renderDailyWeather(daily) {
  if (!weatherDailyEl) return;
  weatherDailyEl.className = "weather-daily";
  weatherDailyEl.innerHTML = "";

  if (
    !Array.isArray(daily?.time) ||
    !Array.isArray(daily?.weather_code) ||
    !Array.isArray(daily?.temperature_2m_max)
  ) {
    weatherDailyEl.textContent = "توقعات الأيام غير متاحة.";
    return;
  }

  const sectionTitle = document.createElement("p");
  sectionTitle.className = "weather-section-title";
  sectionTitle.textContent = "يومي";
  weatherDailyEl.appendChild(sectionTitle);

  const list = document.createElement("div");
  list.className = "weather-daily-list";

  const maxItems = Math.min(4, daily.time.length);
  for (let index = 0; index < maxItems; index += 1) {
    const row = document.createElement("div");
    row.className = "weather-daily-row";

    const day = document.createElement("span");
    day.className = "weather-daily-day";
    const dateValue = new Date(`${daily.time[index]}T12:00:00`);
    day.textContent = arabicWeekDayFormatter.format(dateValue);

    const icon = document.createElement("span");
    icon.className = "weather-daily-icon";
    icon.textContent = getWeatherSymbol(Number(daily.weather_code[index]));

    const temp = document.createElement("span");
    temp.className = "weather-daily-temp";
    temp.textContent = `${Math.round(daily.temperature_2m_max[index])}°`;

    row.append(day, icon, temp);
    list.appendChild(row);
  }

  weatherDailyEl.appendChild(list);
}

function parseDisplayMinutes(displayValue) {
  const match = String(displayValue || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isKistaArrivalTowardCity(departure) {
  const destination = String(departure?.destination || "").toLowerCase();
  const direction = String(departure?.direction || "").toLowerCase();
  const stopPointDesignation = String(departure?.stop_point?.designation || "");
  const minutesUntilDeparture = getMinutesUntilDeparture(departure);
  return (
    stopPointDesignation === "2" &&
    minutesUntilDeparture <= 20 &&
    (destination.includes("t-centralen") ||
      direction.includes("kungsträdgården") ||
      direction.includes("kungstradgarden"))
  );
}

function getMinutesUntilDisplay(displayValue) {
  const targetMinutes = parseDisplayMinutes(displayValue);
  if (targetMinutes === null) return null;
  const nowMinutes = getStockholmMinutes();
  let delta = Math.round(targetMinutes - nowMinutes);
  if (delta < 0) delta += 24 * 60;
  return delta;
}

function getDepartureTimestamp(departure) {
  const value = departure?.expected || departure?.scheduled;
  const timestamp = Date.parse(String(value || ""));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getMinutesUntilDeparture(departure) {
  const minutesFromDisplay = getMinutesUntilDisplay(departure?.display);
  if (minutesFromDisplay !== null) return minutesFromDisplay;

  const departureTimestamp = getDepartureTimestamp(departure);
  if (departureTimestamp === null) return 0;

  const deltaMs = departureTimestamp - Date.now();
  return Math.max(0, Math.round(deltaMs / 60000));
}

function createSlBoardListItem(departure, options) {
  const listItem = document.createElement("li");
  listItem.className = "sl-board-item";

  const lineBadge = document.createElement("span");
  lineBadge.className = "sl-line-badge";
  lineBadge.textContent = String(departure?.line?.designation || options.fallbackLine || "SL");

  const destinationLabel = document.createElement("span");
  destinationLabel.className = "sl-destination";
  destinationLabel.textContent = String(
    options.getDestinationLabel(departure) || options.fallbackDestination || "Unknown destination"
  ).trim();

  const etaWrap = document.createElement("span");
  etaWrap.className = "sl-eta";
  const minutesUntil = getMinutesUntilDeparture(departure);
  const etaValue = document.createElement("span");
  etaValue.className = "sl-eta-value";
  etaValue.textContent = String(minutesUntil);
  const etaUnit = document.createElement("span");
  etaUnit.className = "sl-eta-unit";
  etaUnit.textContent = "min";
  etaWrap.append(etaValue, etaUnit);

  listItem.append(lineBadge, destinationLabel, etaWrap);
  return listItem;
}

function renderSlTrafficList(arrivals) {
  if (!slTrafficStatusEl || !slTrafficListEl) return;
  slTrafficListEl.innerHTML = "";

  if (arrivals.length === 0) {
    slTrafficStatusEl.textContent = "";
    return;
  }

  slTrafficStatusEl.textContent = "";
  for (const departure of arrivals.slice(0, 2)) {
    const listItem = createSlBoardListItem(departure, {
      fallbackLine: "METRO",
      fallbackDestination: "Kungsträdgården/T-Centralen",
      getDestinationLabel: (item) => item?.destination || item?.direction
    });
    slTrafficListEl.appendChild(listItem);
  }
}

async function fetchSlTrafficDepartures() {
  if (!slTrafficStatusEl || !slTrafficListEl || slTrafficFetchInFlight) return;
  slTrafficFetchInFlight = true;

  const url =
    `https://transport.integration.sl.se/v1/sites/${encodeURIComponent(KISTA_SL_SITE_ID)}/departures` +
    `?transport=METRO&forecast=1200`;

  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload?.departures)) {
      throw new Error("Could not load SL departures for Kista.");
    }

    const filteredDepartures = payload.departures
      .filter((departure) => isKistaArrivalTowardCity(departure))
      .sort((a, b) => {
        const aMinutes = parseDisplayMinutes(a.display) ?? 0;
        const bMinutes = parseDisplayMinutes(b.display) ?? 0;
        return aMinutes - bMinutes;
      });

    renderSlTrafficList(filteredDepartures);
    lastSlTrafficFetchAt = Date.now();
  } catch (error) {
    slTrafficStatusEl.textContent =
      error instanceof Error ? error.message : "Failed to fetch SL departures.";
    slTrafficListEl.innerHTML = "";
  } finally {
    slTrafficFetchInFlight = false;
  }
}

function isNorgegatanBusTowardKista(departure) {
  const lineDesignation = String(departure?.line?.designation || "");
  const destination = String(departure?.destination || "").toLowerCase().trim();
  const excludedDestinations = ["sollentuna station", "åkersberga", "vallentuna station", "arninge station"];
  const minutesUntilDeparture = getMinutesUntilDeparture(departure);
  return (
    NORGEGATAN_KISTA_LINES.has(lineDesignation) &&
    !excludedDestinations.some(excluded => destination.includes(excluded)) &&
    minutesUntilDeparture <= 15
  );
}

function renderNorgegatanBusList(arrivals) {
  if (!slBusStatusEl || !slBusListEl) return;
  slBusListEl.innerHTML = "";

  if (arrivals.length === 0) {
    slBusStatusEl.textContent = "";
    return;
  }

  slBusStatusEl.textContent = "";
  for (const departure of arrivals.slice(0, 2)) {
    const listItem = createSlBoardListItem(departure, {
      fallbackLine: "BUS",
      fallbackDestination: "Kista centrum",
      getDestinationLabel: (item) => item?.destination || item?.direction
    });
    slBusListEl.appendChild(listItem);
  }
}

async function fetchNorgegatanBusArrivals() {
  if (!slBusStatusEl || !slBusListEl || slBusFetchInFlight) return;
  slBusFetchInFlight = true;
  slBusStatusEl.textContent = "";

  const url =
    `https://transport.integration.sl.se/v1/sites/${encodeURIComponent(NORGEGATAN_SL_SITE_ID)}/departures` +
    `?transport=BUS&forecast=1200`;

  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload?.departures)) {
      throw new Error("Could not load bus arrivals for Norgegatan.");
    }

    const filteredDepartures = payload.departures
      .filter((departure) => isNorgegatanBusTowardKista(departure))
      .sort((a, b) => {
        const aTimestamp = getDepartureTimestamp(a);
        const bTimestamp = getDepartureTimestamp(b);
        if (aTimestamp !== null && bTimestamp !== null) return aTimestamp - bTimestamp;
        const aMinutes = parseDisplayMinutes(a.display) ?? 0;
        const bMinutes = parseDisplayMinutes(b.display) ?? 0;
        return aMinutes - bMinutes;
      });

    renderNorgegatanBusList(filteredDepartures);
    lastSlBusFetchAt = Date.now();
  } catch (error) {
    slBusStatusEl.textContent =
      error instanceof Error ? error.message : "Failed to fetch bus arrivals.";
    slBusListEl.innerHTML = "";
  } finally {
    slBusFetchInFlight = false;
  }
}

async function fetchCurrentWeather() {
  if (weatherFetchInFlight) return;
  weatherFetchInFlight = true;

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(KISTA_PROFILE.latitude)}` +
    `&longitude=${encodeURIComponent(KISTA_PROFILE.longitude)}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FStockholm`;

  try {
    const response = await fetch(weatherUrl);
    const payload = await response.json();
    const current = payload?.current;
    if (!response.ok || !current) {
      throw new Error("معرفتش أحمّل طقس كيستا.");
    }

    const roundedTemp = Math.round(current.temperature_2m);
    const roundedFeelsLike = Math.round(current.apparent_temperature);
    const roundedWind = Math.round(current.wind_speed_10m);
    const weatherLabel = getWeatherLabel(Number(current.weather_code));

    weatherCurrentEl.textContent = `${roundedTemp}°`;
    weatherIconEl.textContent = getWeatherSymbol(Number(current.weather_code));
    const todayIndex = payload.daily?.time?.indexOf(getStockholmIsoDate()) ?? -1;
    const high = payload.daily?.temperature_2m_max?.[todayIndex];
    const low = payload.daily?.temperature_2m_min?.[todayIndex];
    weatherHighLowEl.textContent = typeof high === "number" && typeof low === "number"
      ? `High ${Math.round(high)}° / Low ${Math.round(low)}°`
      : "High / low unavailable";
    weatherExtraEl.textContent = `${weatherLabel} • المحسوس ${roundedFeelsLike}° • الرياح ${roundedWind} كم/س`;
    renderUpcomingHourlyWeather(payload?.hourly);
    renderDailyWeather(payload?.daily);
    lastWeatherFetchAt = Date.now();
  } catch (error) {
    weatherCurrentEl.textContent = "--°";
    weatherIconEl.textContent = "";
    weatherHighLowEl.textContent = "";
    weatherExtraEl.textContent = error instanceof Error ? error.message : "بيانات الطقس غير متاحة.";
    if (weatherHoursEl) {
      weatherHoursEl.textContent = "";
    }
    if (weatherDailyEl) {
      weatherDailyEl.textContent = "";
    }
  } finally {
    weatherFetchInFlight = false;
  }
}

function renderTimings(timings) {
  currentTimings = timings;
  lastPlayedPrayer = null; // Reset for new date
  timingsBodyEl.innerHTML = "";
  for (const prayer of PRAYER_KEYS) {
    const stop = document.createElement("li");
    stop.dataset.prayerKey = prayer.key;
    const label = document.createElement("span");
    label.className = "prayer-stop-label";
    label.textContent = prayer.label;
    const time = document.createElement("span");
    time.className = "prayer-stop-time";
    time.textContent = formatPrayerTime(timings[prayer.key]);
    stop.append(label, time);
    timingsBodyEl.appendChild(stop);
  }
  resultEl.classList.remove("hidden");
  syncManualTimeInputFromSelection();
  updateManualOverrideNote();
  updatePrayerCountdown();
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
  fetchCountdownTimings();
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

  try {
    const localTimetable = await loadIslamiskaTimetableByDate();
    const siteTimings = localTimetable[date];
    if (!siteTimings) {
      const apiTimings = await loadAlAdhanTimingsForDate(date);
      const effectiveTimings = applyCustomTimings(apiTimings, date);
      renderedForDate = date;
      renderTimings(effectiveTimings, "");
      lastPrayerTimesFetchAt = Date.now();
      setStatus("Local timetable missing for this date, using API fallback.");
      return;
    }

    const effectiveTimings = applyCustomTimings(siteTimings, date);
    renderedForDate = date;
    renderTimings(effectiveTimings, "");
    lastPrayerTimesFetchAt = Date.now();
    setStatus("");
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

function initializeManualPrayerControls() {
  manualPrayerSelectEl.innerHTML = "";
  for (const prayer of PRAYER_KEYS) {
    const option = document.createElement("option");
    option.value = prayer.key;
    option.textContent = `${prayer.label} (${prayer.ar})`;
    manualPrayerSelectEl.appendChild(option);
  }
  manualPrayerSelectEl.value = PRAYER_KEYS[0].key;
  updateManualOverrideNote();
}

function setMakkahBackground(enabled) {
  useLiveBackground = enabled;
  localStorage.setItem("makkahLiveBackground", String(enabled));
  contentPanelEl.classList.toggle("has-live-background", enabled);
  makkahBackgroundToggleEl.setAttribute("aria-pressed", String(enabled));
  makkahBackgroundToggleEl.textContent = enabled ? "Use picture background" : "Use live background";
  makkahBackgroundHelpEl.hidden = !enabled;
  makkahStreamToggleEl.hidden = enabled;
  makkahStreamPanelEl.hidden = !enabled;
  if (enabled) {
    makkahStreamPlayerEl.src = "https://www.youtube.com/embed/eC4LfEVxvKg?autoplay=1&mute=1&playsinline=1&rel=0&controls=0";
    makkahStreamPlayerEl.setAttribute("tabindex", "-1");
    makkahStreamPanelEl.setAttribute("aria-hidden", "true");
  } else {
    makkahStreamPlayerEl.removeAttribute("src");
    makkahStreamPlayerEl.removeAttribute("tabindex");
    makkahStreamPanelEl.removeAttribute("aria-hidden");
  }
  makkahStreamToggleEl.setAttribute("aria-expanded", "false");
}

function closeMakkahStream() {
  makkahStreamPanelEl.hidden = true;
  makkahStreamPlayerEl.removeAttribute("src");
  makkahStreamToggleEl.hidden = false;
  makkahStreamToggleEl.setAttribute("aria-expanded", "false");
  makkahStreamToggleEl.focus();
}

makkahBackgroundToggleEl.addEventListener("click", () => {
  setMakkahBackground(!useLiveBackground);
});
setMakkahBackground(useLiveBackground);

makkahStreamToggleEl.addEventListener("click", () => {
  makkahStreamPlayerEl.src = "https://www.youtube.com/embed/eC4LfEVxvKg?autoplay=1&mute=1&playsinline=1&rel=0";
  makkahStreamPanelEl.hidden = false;
  makkahStreamToggleEl.hidden = true;
  makkahStreamToggleEl.setAttribute("aria-expanded", "true");
  makkahStreamCloseEl.focus();
});
makkahStreamCloseEl.addEventListener("click", closeMakkahStream);
makkahStreamPanelEl.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMakkahStream();
});

loadBtn.addEventListener("click", fetchPrayerTimes);
prevDayBtn.addEventListener("click", setPreviousDay);
nextDayBtn.addEventListener("click", setNextDay);
datePickerEl.addEventListener("change", handleDatePickerChange);
manualPrayerSelectEl.addEventListener("change", syncManualTimeInputFromSelection);
setManualTimeBtn.addEventListener("click", handleSetManualPrayerTime);
clearManualTimesBtn.addEventListener("click", handleClearManualPrayerTimes);
muteBtn.addEventListener("click", toggleMute);
testAdhanBtn.addEventListener("click", () => {
  if (isMuted) {
    setStatus("🔇 Muted - unmute to hear Azan");
    return;
  }
  adhanAudioEl.muted = false;
  playAdhan();
});
adhanAudioEl.addEventListener("ended", () => {
  setStatus("");
});
updateDatePicker();
initializeManualPrayerControls();
updateMuteButton();
fetchPrayerTimes();
fetchCurrentWeather();
fetchSlTrafficDepartures();
fetchNorgegatanBusArrivals();

let lastObservedStockholmDate = getTodayDate();
clock();
updateClock();
setInterval(() => {
  clock();
  updateClock();
  updatePrayerCountdown();
  checkAndPlayAdhan();

  if (Date.now() - lastCountdownFetchAt >= PRAYER_TIMES_REFRESH_MS ||
      (!countdownTimingsByDate[getTodayDate()] && !countdownError)) {
    fetchCountdownTimings();
  }

  const currentDate = getTodayDate();
  if (currentDate !== lastObservedStockholmDate) {
    if (getSelectedDateFormatted() === lastObservedStockholmDate) {
      const { year, month, day } = getStockholmParts();
      selectedDate = new Date(Number(year), Number(month) - 1, Number(day));
      updateDatePicker();
      fetchPrayerTimes();
    }
    lastObservedStockholmDate = currentDate;
  }

  const viewingToday = getSelectedDateFormatted() === currentDate;
  if (!fetchInFlight && viewingToday && Date.now() - lastPrayerTimesFetchAt >= PRAYER_TIMES_REFRESH_MS) {
    fetchPrayerTimes();
  }

  if (Date.now() - lastWeatherFetchAt >= WEATHER_REFRESH_MS) {
    fetchCurrentWeather();
  }

  if (Date.now() - lastSlTrafficFetchAt >= SL_TRAFFIC_REFRESH_MS) {
    fetchSlTrafficDepartures();
  }

  if (Date.now() - lastSlBusFetchAt >= SL_TRAFFIC_REFRESH_MS) {
    fetchNorgegatanBusArrivals();
  }
}, 1000);

setInterval(() => {
  const viewingToday = getSelectedDateFormatted() === getTodayDate();
  if (!viewingToday || fetchInFlight || !adhanAudioEl.paused ||
      !makkahStreamPanelEl.hidden || document.visibilityState !== "visible") {
    return;
  }

  window.location.reload();
}, PAGE_AUTO_REFRESH_MS);
