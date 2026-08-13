// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

const MILLISECONDS_PER_TENTH = 100;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;
const TENTHS_PER_SECOND = 10;

/** Formats an epoch timestamp as invariant local 24-hour time. */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Checks that an elapsed time is finite and nonnegative. */
export function isValidDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Checks that a value is a finite epoch timestamp accepted by `Date`. */
export function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

/** Formats sub-minute durations in tenths and longer durations with compact units. */
export function formatDuration(durationMs: number): string {
  if (durationMs > 0 && durationMs < MILLISECONDS_PER_TENTH) return "<0.1s";

  const tenths = Math.round(durationMs / MILLISECONDS_PER_TENTH);
  if (tenths < SECONDS_PER_MINUTE * TENTHS_PER_SECOND) {
    return `${(tenths / TENTHS_PER_SECOND).toFixed(1)}s`;
  }

  return formatWholeSecondDuration(durationMs);
}

/** Formats a duration to the nearest whole second with compact units. */
export function formatWholeSecondDuration(durationMs: number): string {
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
