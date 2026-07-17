const PRAYER_KEYS = [
  { label: "Fajr", ar: "الفجر", key: "Fajr" },
  { label: "Sunrise", ar: "الشروق", key: "Sunrise" },
  { label: "Dhuhr", ar: "الظهر", key: "Dhuhr" },
  { label: "Asr", ar: "العصر", key: "Asr" },
  { label: "Maghrib", ar: "المغرب", key: "Maghrib" },
  { label: "Isha", ar: "العشاء", key: "Isha" }
];
const PRAYER_TABLE_COLUMNS = [
  { label: "الفجر", key: "Fajr" },
  { label: "الشروق", key: "Sunrise" },
  { label: "الظهر", key: "Dhuhr" },
  { label: "العصر", key: "Asr" },
  { label: "العصر", key: "Asr" },
  { label: "المغرب", key: "Maghrib" },
  { label: "العشاء", key: "Isha" }
];

const STOCKHOLM_PROFILE = {
  latitude: 59.3293,
  longitude: 18.0686,
  method: 13,
  school: 0,
  latitudeAdjustmentMethod: 2,
  tune: "0,-25,0,0,0,0,0,18,0"
};

const KISTA_PROFILE = {
  latitude: 59.4032,
  longitude: 17.9448
};
const KISTA_SL_SITE_ID = 9302;
const NORGEGATAN_SL_SITE_ID = 3759;
const NORGEGATAN_KISTA_LINES = new Set(["179", "685", "687"]);

const statusEl = document.getElementById("status");
const liveClockEl = document.getElementById("live-clock");
// const liveClockDateEl = document.getElementById("live-clock-date");
// const liveClockWeekDayEl = document.getElementById("live-clock-weekday");
const hijriEl = document.getElementById("hijri");
const weatherCurrentEl = document.getElementById("weather-current");
const weatherExtraEl = document.getElementById("weather-extra");
const weatherHoursEl = document.getElementById("weather-hours");
const slTrafficStatusEl = document.getElementById("sl-traffic-status");
const slTrafficListEl = document.getElementById("sl-traffic-list");
const slBusStatusEl = document.getElementById("sl-bus-status");
const slBusListEl = document.getElementById("sl-bus-list");
const clockHourEl = document.getElementById("clock-hour");
const clockMinuteEl = document.getElementById("clock-minute");
const clockSecondEl = document.getElementById("clock-second");
const resultEl = document.getElementById("result");
const timingsBodyEl = document.getElementById("timings-body");
const timingsHeadRowEl = document.getElementById("timings-head-row");
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

let currentTimings = null;
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

const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const SL_TRAFFIC_REFRESH_MS = 5 * 60 * 1000;
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
  setStatus(`Manual times cleared for ${datePickerEl.value}.`);
  fetchPrayerTimes();
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
  liveClockEl.textContent = stockholmTimeFormatter.format(now);
  hijriEl.textContent = `${stockholmHijriFormatter.format(now)}`;
}

function setActivePrayerCell(cell) {
  if (activePrayerCell) {
    activePrayerCell.classList.remove("is-next-prayer");
  }
  activePrayerCell = cell;
  if (activePrayerCell) {
    activePrayerCell.classList.add("is-next-prayer");
  }
}

function updateNextPrayerHighlight() {
  if (!currentTimings) {
    setActivePrayerCell(null);
    return;
  }

  const nowMinutes = getStockholmMinutes();
  const prayerTimes = PRAYER_KEYS.map((prayer) => ({
    key: prayer.key,
    minutes: parsePrayerMinutes(currentTimings[prayer.key])
  }));

  let nextIndex = prayerTimes.findIndex((prayer) => prayer.minutes !== null && prayer.minutes >= nowMinutes);
  if (nextIndex === -1) nextIndex = 0;

  const nextPrayerKey = prayerTimes[nextIndex]?.key;
  const cells = Array.from(timingsBodyEl.querySelectorAll("td[data-prayer-key]"));
  const nextPrayerCell = cells.find((cell) => cell.dataset.prayerKey === nextPrayerKey) || null;
  setActivePrayerCell(nextPrayerCell);
  
  // Check if it's time to play Adhan
  checkAndPlayAdhan();
}

function getLiveClockTimeKey() {
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
  statusEl.style.color = isError ? "#b91c1c" : "#374151";
}

function getWeatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "☁️";
  if (code >= 45 && code <= 48) return "🌫️";
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function getWeatherLabel(code) {
  const emoji = getWeatherEmoji(code);
  if (code === 0) return `${emoji} صافي`;
  if (code >= 1 && code <= 3) return `${emoji} الجو مغيم سنة`;
  if (code >= 45 && code <= 48) return `${emoji} شبورة`;
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) return `${emoji} مطر`;
  if (code >= 71 && code <= 77) return `${emoji} تلج`;
  if (code >= 80 && code <= 82) return `${emoji} شوية مطر`;
  if (code >= 85 && code <= 86) return `${emoji} شوية تلج`;
  if (code >= 95) return `${emoji} عاصفة ورعد`;
  return `${emoji} مش واضح`;
}

function getWeatherCompactLabel(code) {
  const emoji = getWeatherEmoji(code);
  if (code === 0) return `${emoji} صافي`;
  if (code >= 1 && code <= 3) return `${emoji} مغيم`;
  if (code >= 45 && code <= 48) return `${emoji} شبورة`;
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) return `${emoji} مطر`;
  if (code >= 71 && code <= 77) return `${emoji} تلج`;
  if (code >= 80 && code <= 82) return `${emoji} شوية مطر`;
  if (code >= 85 && code <= 86) return `${emoji} شوية تلج`;
  if (code >= 95) return `${emoji} عاصفة`;
  return `${emoji} مش واضح`;
}

function getStockholmIsoDate(date = new Date()) {
  const { year, month, day } = getStockholmParts(date);
  return `${year}-${month}-${day}`;
}

function renderUpcomingHourlyWeather(hourly) {
  if (!weatherHoursEl) return;
  weatherHoursEl.className = "weather-hours";
  if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.temperature_2m)) {
    weatherHoursEl.textContent = "توقعات الساعات مش متاحة.";
    return;
  }

  const todayIsoDate = getStockholmIsoDate();
  const nowHour = Number(getStockholmParts().hour);
  const startHour = Math.max(8, nowHour);

  if (startHour > 18) {
    weatherHoursEl.textContent = "مفيش توقعات جاية النهارده بين 08:00 و 18:00.";
    return;
  }

  const entries = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const isoTime = String(hourly.time[index] || "");
    if (isoTime.length < 13) continue;
    const hour = Number(isoTime.slice(11, 13));
    if (isoTime.slice(0, 10) !== todayIsoDate || Number.isNaN(hour) || hour < startHour || hour > 18) {
      continue;
    }

    const temperature = hourly.temperature_2m[index];
    if (typeof temperature !== "number") continue;
    const weatherCode = Number(hourly.weather_code?.[index]);
    const weatherLabel = Number.isNaN(weatherCode) ? "مش واضح" : getWeatherCompactLabel(weatherCode);
    entries.push({
      time: `${String(hour).padStart(2, "0")}:00`,
      data: `${Math.round(temperature)}° ${weatherLabel}`
    });
  }

  if (entries.length === 0) {
    weatherHoursEl.textContent = "مفيش بيانات بالساعات بين 08:00 و 18:00 النهارده.";
    return;
  }

  weatherHoursEl.textContent = "";
  weatherHoursEl.classList.add("weather-hours-grid");
  weatherHoursEl.style.setProperty("--weather-cols", String(entries.length));

  const timeRow = document.createElement("div");
  timeRow.className = "weather-hours-row weather-hours-row-time";
  const dataRow = document.createElement("div");
  dataRow.className = "weather-hours-row weather-hours-row-data";

  for (const entry of entries) {
    const timeCell = document.createElement("span");
    timeCell.className = "weather-hours-cell";
    timeCell.textContent = entry.time;
    timeRow.appendChild(timeCell);

    const dataCell = document.createElement("span");
    dataCell.className = "weather-hours-cell";
    dataCell.textContent = entry.data;
    dataRow.appendChild(dataCell);
  }

  weatherHoursEl.appendChild(timeRow);
  weatherHoursEl.appendChild(dataRow);
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
  return (
    stopPointDesignation === "2" &&
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

function renderSlTrafficList(arrivals) {
  if (!slTrafficStatusEl || !slTrafficListEl) return;
  slTrafficListEl.innerHTML = "";

  if (arrivals.length === 0) {
    slTrafficStatusEl.textContent = "No upcoming train arrivals found right now.";
    return;
  }

  slTrafficStatusEl.textContent = `Next ${arrivals.length} train arrival(s) to Kista platform toward city.`;
  for (const departure of arrivals) {
    const listItem = document.createElement("li");
    const lineDesignation = departure?.line?.designation ? `Line ${departure.line.designation}` : "Metro";
    const directionLabel = departure?.direction || departure?.destination || "Kungsträdgården/T-Centralen";
    const minutesUntil = getMinutesUntilDisplay(departure.display);
    const etaLabel = minutesUntil === null ? "ETA unknown" : `${minutesUntil} min`;
    listItem.textContent = `${departure.display} • ${etaLabel} • ${lineDesignation} • ${directionLabel}`;
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
  const destination = String(departure?.destination || "").toLowerCase();
  const direction = String(departure?.direction || "").toLowerCase();
  return (
    NORGEGATAN_KISTA_LINES.has(lineDesignation) &&
    (destination.includes("kista") || direction.includes("kista"))
  );
}

function renderNorgegatanBusList(arrivals) {
  if (!slBusStatusEl || !slBusListEl) return;
  slBusListEl.innerHTML = "";

  if (arrivals.length === 0) {
    slBusStatusEl.textContent = "No upcoming buses found for lines 179/685/687 toward Kista right now.";
    return;
  }

  slBusStatusEl.textContent = `Found ${arrivals.length} upcoming bus arrival(s) at Norgegatan toward Kista.`;
  for (const departure of arrivals) {
    const listItem = document.createElement("li");
    const lineDesignation = departure?.line?.designation ? `Line ${departure.line.designation}` : "Bus";
    const destinationLabel = departure?.destination || "Kista centrum";
    const minutesUntil = getMinutesUntilDisplay(departure.display);
    const etaLabel = minutesUntil === null ? "ETA unknown" : `${minutesUntil} min`;
    listItem.textContent = `${departure.display} • ${etaLabel} • ${lineDesignation} • ${destinationLabel}`;
    slBusListEl.appendChild(listItem);
  }
}

async function fetchNorgegatanBusArrivals() {
  if (!slBusStatusEl || !slBusListEl || slBusFetchInFlight) return;
  slBusFetchInFlight = true;
  slBusStatusEl.textContent = "Loading bus arrivals at Norgegatan...";

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

    weatherCurrentEl.textContent = `${roundedTemp}°C • ${weatherLabel}`;
    weatherExtraEl.textContent = `المحسوس ${roundedFeelsLike}°C • الهوا ${roundedWind} كم/س`;
    renderUpcomingHourlyWeather(payload?.hourly);
    lastWeatherFetchAt = Date.now();
  } catch (error) {
    weatherCurrentEl.textContent = "الطقس مش متاح";
    weatherExtraEl.textContent = error instanceof Error ? error.message : "حصلت مشكلة في تحميل بيانات الطقس.";
    if (weatherHoursEl) {
      weatherHoursEl.textContent = "";
    }
  } finally {
    weatherFetchInFlight = false;
  }
}

function renderTimings(timings) {
  currentTimings = timings;
  lastPlayedPrayer = null; // Reset for new date
  timingsBodyEl.innerHTML = "";
  const row = document.createElement("tr");
  for (const column of PRAYER_TABLE_COLUMNS) {
    const timeCell = document.createElement("td");
    timeCell.dataset.prayerKey = column.key;
    timeCell.textContent = formatPrayerTime(timings[column.key]);
    row.appendChild(timeCell);
  }
  timingsBodyEl.appendChild(row);
  resultEl.classList.remove("hidden");
  syncManualTimeInputFromSelection();
  updateManualOverrideNote();
  updateNextPrayerHighlight();
}

function initializeTimingsHeader() {
  if (!timingsHeadRowEl) return;
  timingsHeadRowEl.innerHTML = "";
  for (const column of PRAYER_TABLE_COLUMNS) {
    const headerCell = document.createElement("th");
    headerCell.textContent = column.label;
    timingsHeadRowEl.appendChild(headerCell);
  }
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

    const effectiveTimings = applyCustomTimings(payload.data.timings, date);
    renderTimings(effectiveTimings, "");
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
initializeTimingsHeader();
initializeManualPrayerControls();
updateMuteButton();
fetchPrayerTimes();
fetchCurrentWeather();
fetchSlTrafficDepartures();
fetchNorgegatanBusArrivals();

clock();
updateClock();
setInterval(() => {
  clock();
  updateClock();
  updateNextPrayerHighlight();

  const currentDate = getTodayDate();
  if (!fetchInFlight && renderedForDate && currentDate !== renderedForDate) {
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
  if (!viewingToday || fetchInFlight || !adhanAudioEl.paused || document.visibilityState !== "visible") {
    return;
  }

  window.location.reload();
}, PAGE_AUTO_REFRESH_MS);
