// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

/**
 * Adds wall-clock markers to Pi transcripts and measures the complete interval from accepted agent
 * work through final settlement.
 */

import { performance } from "node:perf_hooks";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Component, visibleWidth } from "@earendil-works/pi-tui";

const ENTRY_TYPE = "agent-settle-timestamp";
const ENTRY_VERSION = 1;
const MILLISECONDS_PER_TENTH = 100;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;
const TENTHS_PER_SECOND = 10;

/** A persisted wall-clock marker for the beginning of one accepted request. */
interface StartedEntry {
  version: typeof ENTRY_VERSION;
  kind: "started";
  timestamp: number;
}

/** A persisted wall-clock marker and monotonic duration for fully settled work. */
interface SettledEntry {
  version: typeof ENTRY_VERSION;
  kind: "settled";
  timestamp: number;
  durationMs: number;
}

/** Versioned transcript data rendered by this extension. */
type TimestampEntry = StartedEntry | SettledEntry;

/** Couples wall-clock display time with a monotonic clock for reliable elapsed time. */
interface Observation {
  timestamp: number;
  monotonicTime: number;
}

/**
 * Registers one accepted-work-to-settlement timer per session. Timing starts before agent work,
 * while the marker is appended at the first assistant message, after the user message is persisted.
 */
export default function (pi: ExtensionAPI): void {
  let start: Observation | undefined;
  let appended = false;

  pi.registerEntryRenderer(ENTRY_TYPE, (entry, _opts, theme) => {
    if (!isTimestampEntry(entry.data)) return undefined;

    let label = formatClock(entry.data.timestamp);
    if (entry.data.kind === "settled") {
      label = `${formatDuration(entry.data.durationMs)} · ${label}`;
    }

    return rightAligned(label, (text) => theme.fg("dim", text));
  });

  pi.on("session_start", () => {
    start = undefined;
    appended = false;
  });

  pi.on("before_agent_start", () => {
    start = observe();
    appended = false;
  });

  pi.on("message_start", (event) => {
    if (event.message.role !== "assistant" || !start || appended) return;

    pi.appendEntry<StartedEntry>(ENTRY_TYPE, {
      version: ENTRY_VERSION,
      kind: "started",
      timestamp: start.timestamp,
    });

    appended = true;
  });

  pi.on("agent_settled", () => {
    if (!start) return;

    const timestamp = Date.now();
    const durationMs = performance.now() - start.monotonicTime;
    if (!isValidTimestamp(timestamp) || !isValidDuration(durationMs)) return;

    pi.appendEntry<SettledEntry>(ENTRY_TYPE, {
      version: ENTRY_VERSION,
      kind: "settled",
      timestamp,
      durationMs,
    });

    start = undefined;
    appended = false;
  });

  pi.on("session_shutdown", () => {
    start = undefined;
    appended = false;
  });
}

/** Captures the display and elapsed-time clocks for one accepted request. */
function observe(): Observation {
  return {
    timestamp: Date.now(),
    monotonicTime: performance.now(),
  };
}

/** Formats an epoch timestamp as invariant local 24-hour time. */
function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Formats sub-minute durations in tenths and longer durations with compact calendar-free units. */
function formatDuration(durationMs: number): string {
  if (durationMs > 0 && durationMs < MILLISECONDS_PER_TENTH) return "<0.1s";

  const tenths = Math.round(durationMs / MILLISECONDS_PER_TENTH);
  if (tenths < SECONDS_PER_MINUTE * TENTHS_PER_SECOND) {
    return `${(tenths / TENTHS_PER_SECOND).toFixed(1)}s`;
  }

  let seconds = Math.round(durationMs / 1_000);
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  seconds %= SECONDS_PER_DAY;
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  seconds %= SECONDS_PER_HOUR;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  seconds %= SECONDS_PER_MINUTE;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** Creates a one-line component whose visible label ends at the available right edge. */
function rightAligned(
  label: string,
  style: (text: string) => string,
): Component {
  return {
    render(width) {
      if (width < 1) return [];

      const fitted = fitFromRight(label, width);
      const padding = " ".repeat(Math.max(0, width - visibleWidth(fitted)));
      return [`${padding}${style(fitted)}`];
    },
    invalidate() {},
  };
}

/** Retains the rightmost visible cells so narrow terminals continue to show the wall clock. */
function fitFromRight(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;

  let fitted = "";
  for (const character of [...text].reverse()) {
    const candidate = `${character}${fitted}`;
    if (visibleWidth(candidate) > width) break;
    fitted = candidate;
  }
  return fitted;
}

/** Validates persisted custom-entry data before rendering it. */
function isTimestampEntry(value: unknown): value is TimestampEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  if (entry.version !== ENTRY_VERSION || !isValidTimestamp(entry.timestamp)) {
    return false;
  }

  if (entry.kind === "started") return true;
  return entry.kind === "settled" && isValidDuration(entry.durationMs);
}

/** Checks that persisted elapsed time is finite and nonnegative. */
function isValidDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Checks that a persisted value is a finite epoch timestamp accepted by `Date`. */
function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}
