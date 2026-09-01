#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const SOURCE_URL = "https://www.islamiskaforbundet.se/wp-json/wp/v2/pages?slug=bonetider";
const WIDGET_URL = "https://www.islamiskaforbundet.se/wp-content/plugins/bonetider/Bonetider_Widget.php";
const DEFAULT_CITY = "Stockholm, SE";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const SEED_OUTPUT_PATH = new URL("../data/islamiskaforbundet-bonetider.json", import.meta.url);
const LIVE_OUTPUT_PATH = new URL("../data/islamiskaforbundet-bonetider.live.json", import.meta.url);
const execFileAsync = promisify(execFile);
const stockholmNow = new Date(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date())
);

const monthArgRaw = process.argv[2];
const yearArgRaw = process.argv[3];
const hasMonthArg = monthArgRaw !== undefined;
const hasYearArg = yearArgRaw !== undefined;
const inputMonth = hasMonthArg ? Number(monthArgRaw) : null;
const inputYear = hasYearArg ? Number(yearArgRaw) : null;

if (hasMonthArg && (!Number.isInteger(inputMonth) || inputMonth < 1 || inputMonth > 12)) {
  throw new Error("Month must be an integer from 1 to 12.");
}
if (hasYearArg && (!Number.isInteger(inputYear) || inputYear < 2000 || inputYear > 3000)) {
  throw new Error("Year must be a valid 4-digit year.");
}

function normalizeTime(value) {
  const match = String(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function toDateKey(day, month, year) {
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

function parseTimingsByDate(renderedHtml, month, year) {
  const timesByDate = {};
  const dayRowPattern =
    /<td>\s*(\d{1,2})\s*<\/td>\s*<td[^>]*>\s*([0-2]\d:[0-5]\d)\s*<\/td>\s*<td[^>]*>\s*([0-2]\d:[0-5]\d)\s*<\/td>\s*<td[^>]*>\s*([0-2]\d:[0-5]\d)\s*<\/td>\s*<td[^>]*>\s*([0-2]\d:[0-5]\d)\s*<\/td>\s*<td[^>]*>\s*([0-2]\d:[0-5]\d)\s*<\/td>\s*<td[^>]*>\s*([0-2]\d:[0-5]\d)\s*<\/td>/gi;

  for (const match of renderedHtml.matchAll(dayRowPattern)) {
    const day = Number(match[1]);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;

    const timing = {
      Fajr: normalizeTime(match[2]),
      Sunrise: normalizeTime(match[3]),
      Dhuhr: normalizeTime(match[4]),
      Asr: normalizeTime(match[5]),
      Maghrib: normalizeTime(match[6]),
      Isha: normalizeTime(match[7])
    };

    if (Object.values(timing).some((value) => value === null)) continue;
    timesByDate[toDateKey(day, month, year)] = timing;
  }

  return timesByDate;
}

function parseSourceYear(renderedHtml) {
  const yearMatch = renderedHtml.match(/(\d{4})\s*B[öo]netider/i);
  if (yearMatch) return Number(yearMatch[1]);
  return stockholmNow.getFullYear();
}

function parseSelectedMonth(renderedHtml) {
  const selectedMonthMatch = renderedHtml.match(
    /<select[^>]*id="ifis_bonetider_page_months"[\s\S]*?<option\s+value="(\d{1,2})"\s+selected="selected"/i
  );
  if (!selectedMonthMatch) return stockholmNow.getMonth() + 1;
  const parsed = Number(selectedMonthMatch[1]);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
    ? parsed
    : stockholmNow.getMonth() + 1;
}

async function fetchSourcePageJson() {
  const { stdout: html } = await execFileAsync("curl", [
    "-sL",
    "-H",
    `User-Agent: ${BROWSER_UA}`,
    "-H",
    "Accept: application/json",
    SOURCE_URL
  ]);

  if (!html || !/^\s*\[/.test(html)) {
    throw new Error("Failed to fetch bonetider JSON from source.");
  }

  const pages = JSON.parse(html);
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("Could not find bonetider page via WordPress API.");
  }
  return pages;
}

async function fetchMonthHtml(month) {
  const { stdout } = await execFileAsync("curl", [
    "-sL",
    "-H",
    `User-Agent: ${BROWSER_UA}`,
    "--data-urlencode",
    `ifis_bonetider_page_city=${DEFAULT_CITY}`,
    "--data-urlencode",
    `ifis_bonetider_page_month=${month}`,
    WIDGET_URL
  ]);
  return stdout;
}

const pages = await fetchSourcePageJson();
const renderedHtml = String(pages[0]?.content?.rendered || "");
const sourceYear = inputYear ?? parseSourceYear(renderedHtml);
const selectedMonth = parseSelectedMonth(renderedHtml);
const monthsToSync = hasMonthArg
  ? [inputMonth]
  : Array.from({ length: 12 - selectedMonth + 1 }, (_, index) => selectedMonth + index);

const timesByDate = {};

for (const month of monthsToSync) {
  const monthHtml = month === selectedMonth ? renderedHtml : await fetchMonthHtml(month);
  const monthTimes = parseTimingsByDate(monthHtml, month, sourceYear);
  Object.assign(timesByDate, monthTimes);
}

const output = {
  source: "https://www.islamiskaforbundet.se/bonetider/",
  month: hasMonthArg
    ? `${String(inputMonth).padStart(2, "0")}-${sourceYear}`
    : `${String(selectedMonth).padStart(2, "0")}-${sourceYear}..12-${sourceYear}`,
  generatedAt: new Date().toISOString(),
  monthsSynced: monthsToSync.map((month) => `${String(month).padStart(2, "0")}-${sourceYear}`),
  timesByDate
};

if (Object.keys(timesByDate).length === 0) {
  throw new Error(
    "No timetable rows were parsed from the source page. Existing local timetable was kept unchanged."
  );
}

let existingTimesByDate = {};
let previousLivePayload = null;
for (const path of [LIVE_OUTPUT_PATH, SEED_OUTPUT_PATH]) {
  try {
    const existingRaw = await readFile(path, "utf8");
    const existingPayload = JSON.parse(existingRaw);
    if (path === LIVE_OUTPUT_PATH && existingPayload && typeof existingPayload === "object") {
      previousLivePayload = existingPayload;
    }
    if (existingPayload?.timesByDate && typeof existingPayload.timesByDate === "object") {
      existingTimesByDate = { ...existingTimesByDate, ...existingPayload.timesByDate };
    }
  } catch {
    // Ignore missing/unreadable files and continue.
  }
}

const mergedOutput = {
  ...output,
  timesByDate: {
    ...existingTimesByDate,
    ...timesByDate
  }
};

const previousTimesByDate = previousLivePayload?.timesByDate || null;
const hasTimesChanged =
  JSON.stringify(previousTimesByDate) !== JSON.stringify(mergedOutput.timesByDate);

if (!hasTimesChanged && previousLivePayload) {
  console.log(
    `No timetable change detected. Live JSON kept as-is (${Object.keys(mergedOutput.timesByDate).length} day(s)).`
  );
} else {
  await writeFile(LIVE_OUTPUT_PATH, `${JSON.stringify(mergedOutput, null, 2)}\n`, "utf8");
  console.log(
    `Updated live JSON: ${Object.keys(timesByDate).length} day(s) fetched, total ${Object.keys(mergedOutput.timesByDate).length} day(s) in ${LIVE_OUTPUT_PATH.pathname}`
  );
}
