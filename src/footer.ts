// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

import { performance } from "node:perf_hooks";

import {
  FooterComponent,
  type ReadonlyFooterDataProvider,
  type Theme,
} from "@earendil-works/pi-coding-agent";

import {
  type Component,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";

import { formatWholeSecondDuration, isValidDuration } from "./time.ts";
import { SessionFacade } from "./session.ts";

const TIMER_MARKER = "⧖";
const SCROLLBACK_TIMESTAMP_PLACEHOLDER = " 00:00:00";

/** Monotonic start time read by the active footer timer. */
export interface TimerStart {
  monotonicTime: number;
}

export interface FooterOptions {
  theme: Theme;
  footerData: ReadonlyFooterDataProvider;
  session: SessionFacade;
  getStart: () => TimerStart | undefined;
}

/** Pi's standard footer decorated with a right-aligned active-turn timer. */
export class Footer implements Component {
  private readonly footer: FooterComponent;

  public constructor(private readonly options: FooterOptions) {
    this.footer = new FooterComponent(
      options.session.asAgentSession(),
      options.footerData,
    );
  }

  public render(width: number): string[] {
    const lines = this.footer.render(width);
    const start = this.options.getStart();
    if (!start || lines.length < 1) return lines;

    const elapsedMs = performance.now() - start.monotonicTime;
    if (!isValidDuration(elapsedMs)) return lines;

    const label = `  ${formatWholeSecondDuration(elapsedMs)} ${TIMER_MARKER}`;
    const maxPad = visibleWidth(SCROLLBACK_TIMESTAMP_PLACEHOLDER);
    const padding = clamp(0, width - visibleWidth(label), maxPad);

    const timer = `${this.options.theme.fg("dim", label)}${" ".repeat(padding)}`;
    const timerWidth = visibleWidth(timer);

    if (timerWidth > width) {
      return lines;
    }

    const fittedLine = truncateToWidth(lines[0]!, width - timerWidth, "", true);
    lines[0] = `${fittedLine}${timer}`;
    return lines;
  }

  public invalidate(): void {
    this.footer.invalidate();
  }

  public dispose(): void {
    this.footer.dispose();
  }
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(min, value), max);
}
