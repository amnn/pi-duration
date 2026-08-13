// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

/**
 * Adds wall-clock markers to Pi transcripts, measures accepted work through final settlement, and
 * shows the active interval in the footer.
 */

import { performance } from "node:perf_hooks";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Component, visibleWidth } from "@earendil-works/pi-tui";

import {
  formatClock,
  formatDuration,
  isValidDuration,
  isValidTimestamp,
} from "./time.ts";

import { Footer } from "./footer.ts";
import { SessionFacade } from "./session.ts";

const ENTRY_TYPE = "agent-settle-timestamp";
const ENTRY_VERSION = 1;
const TIMER_INTERVAL_MS = 1_000;

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
  let requestRender: (() => void) | undefined;

  pi.registerEntryRenderer(ENTRY_TYPE, (entry, _opts, theme) => {
    if (!isTimestampEntry(entry.data)) return undefined;

    let label = formatClock(entry.data.timestamp);
    if (entry.data.kind === "settled") {
      label = `${formatDuration(entry.data.durationMs)} ⧖ ${label}`;
    }

    return rightAligned(label, (text) => theme.fg("dim", text));
  });

  pi.on("session_start", (_event, ctx) => {
    start = undefined;
    appended = false;
    requestRender = undefined;
    if (ctx.mode !== "tui") return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = (): void => tui.requestRender();

      return new Footer({
        theme,
        footerData,
        session: new SessionFacade(ctx),
        getStart: () => start,
      });
    });
  });

  pi.on("before_agent_start", () => {
    const timerStart = observe();
    start = timerStart;
    appended = false;

    const render = requestRender;
    if (!render) return;

    render();
    const ticker = setInterval(() => {
      render();
      if (start !== timerStart) clearInterval(ticker);
    }, TIMER_INTERVAL_MS);
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

    start = undefined;
    appended = false;

    if (!isValidTimestamp(timestamp) || !isValidDuration(durationMs)) return;

    pi.appendEntry<SettledEntry>(ENTRY_TYPE, {
      version: ENTRY_VERSION,
      kind: "settled",
      timestamp,
      durationMs,
    });
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
