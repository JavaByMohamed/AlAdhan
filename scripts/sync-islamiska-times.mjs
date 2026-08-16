#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const SOURCE_URL = "https://www.islamiskaforbundet.se/wp-json/wp/v2/pages?slug=bonetider";
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

const inputMonth = Number(process.argv[2] || stockholmNow.getMonth() + 1);
const inputYear = Number(process.argv[3] || stockholmNow.getFullYear());

if (!Number.isInteger(inputMonth) || inputMonth < 1 || inputMonth > 12) {
  throw new Error("Month must be an integer from 1 to 12.");
}
if (!Number.isInteger(inputYear) || inputYear < 2000 || inputYear > 3000) {
  throw new Error("Year must be a valid 4-digit year.");
}

function normalizeTime(value) {
  const match = String(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function toDateKey(day, month, year) {
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

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

const renderedHtml = String(pages[0]?.content?.rendered || "");
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
  timesByDate[toDateKey(day, inputMonth, inputYear)] = timing;
}

const output = {
  source: SOURCE_URL,
  month: `${String(inputMonth).padStart(2, "0")}-${inputYear}`,
  generatedAt: new Date().toISOString(),
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
