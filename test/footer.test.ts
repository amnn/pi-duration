// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";
import { stripVTControlCharacters } from "node:util";

import {
  initTheme,
  type ExtensionContext,
  type ReadonlyFooterDataProvider,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

import { Footer, type TimerStart } from "../src/footer.ts";
import { SessionFacade } from "../src/session.ts";

const plainTheme = {
  fg: (_color: string, text: string) => text,
} as unknown as Theme;

const footerData = {
  getGitBranch: () => null,
  getExtensionStatuses: () => new Map<string, string>(),
  getAvailableProviderCount: () => 1,
  onBranchChange: () => () => {},
} satisfies ReadonlyFooterDataProvider;

function createContext(): ExtensionContext {
  return {
    model: undefined,
    thinkingLevel: "off",
    sessionManager: {
      getEntries: () => [],
      getCwd: () => "/tmp/pi-duration",
      getSessionName: () => undefined,
    },
    getContextUsage: () => undefined,
    modelRegistry: {},
  } as unknown as ExtensionContext;
}

describe("duration footer", () => {
  it("preserves the standard footer and adds a fixed-width active timer", () => {
    initTheme("dark");
    let start: TimerStart | undefined;
    const footer = new Footer({
      theme: plainTheme,
      footerData,
      session: new SessionFacade(createContext()),
      getStart: () => start,
    });

    const width = 60;
    const idle = footer.render(width).map(stripVTControlCharacters);
    assert.equal(idle.length, 2);
    assert.doesNotMatch(idle[0]!, /⧖/);

    start = { monotonicTime: performance.now() - 5_500 };
    const active = footer.render(width).map(stripVTControlCharacters);
    assert.match(active[0]!, /\d+s ⧖/);
    assert.ok(active.every((line) => visibleWidth(line) <= width));

    const narrow = footer.render(5).map(stripVTControlCharacters);
    assert.doesNotMatch(narrow[0]!, /⧖/);
    assert.ok(narrow.every((line) => visibleWidth(line) <= 5));

    footer.invalidate();
    footer.dispose();
  });
});
