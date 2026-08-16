#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SYNC_COMMAND = ["run", "--silent", "sync:bonetider"];
const SERVER_COMMAND = ["-m", "http.server", "3000"];
const STOCKHOLM_TZ = "Europe/Stockholm";

function getStockholmParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TZ,
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
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: map.hour,
    minute: map.minute
  };
}

async function runSync() {
  try {
    const { stdout } = await execFileAsync("npm", SYNC_COMMAND, { cwd: process.cwd() });
    if (stdout?.trim()) console.log(stdout.trim());
  } catch (error) {
    const output = error?.stdout || error?.stderr || error?.message;
    console.error(`sync:bonetider failed: ${String(output).trim()}`);
  }
}

async function freePort3000() {
  await execFileAsync("sh", [
    "-c",
    "pids=$(lsof -ti tcp:3000 2>/dev/null); if [ -n \"$pids\" ]; then kill $pids; fi"
  ]);
}

await runSync();
await freePort3000();

const server = spawn("python3", SERVER_COMMAND, {
  cwd: process.cwd(),
  stdio: "inherit"
});

let lastMidnightSyncDate = null;
const midnightWatcher = setInterval(() => {
  const stockholm = getStockholmParts();
  if (
    stockholm.hour === "00" &&
    stockholm.minute === "00" &&
    stockholm.dateKey !== lastMidnightSyncDate
  ) {
    lastMidnightSyncDate = stockholm.dateKey;
    runSync();
  }
}, 30 * 1000);

function shutdown(signal) {
  clearInterval(midnightWatcher);
  if (!server.killed) {
    server.kill(signal);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("exit", (code) => {
  clearInterval(midnightWatcher);
  process.exit(code ?? 0);
});
