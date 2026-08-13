// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";

import durationExtension from "../index.ts";

type EventHandler = (
  event: Record<string, unknown>,
  ctx: ExtensionContext,
) => unknown | Promise<unknown>;

type EntryRenderer = (
  entry: { data?: unknown },
  options: { expanded: boolean },
  theme: Theme,
) => Component | undefined;

interface AppendedEntry {
  customType: string;
  data: Record<string, unknown>;
}

class ExtensionHarness {
  readonly handlers = new Map<string, EventHandler[]>();
  readonly appended: AppendedEntry[] = [];
  renderer: EntryRenderer | undefined;
  rendererType: string | undefined;

  readonly api = {
    on: (event: string, handler: EventHandler) => {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
    },
    registerEntryRenderer: (customType: string, renderer: EntryRenderer) => {
      this.rendererType = customType;
      this.renderer = renderer;
    },
    appendEntry: (customType: string, data: Record<string, unknown>) => {
      this.appended.push({ customType, data });
    },
  } as unknown as ExtensionAPI;

  constructor() {
    durationExtension(this.api);
  }

  async emit(
    event: string,
    payload: Record<string, unknown>,
    ctx: ExtensionContext,
  ): Promise<void> {
    for (const handler of this.handlers.get(event) ?? []) {
      await handler(payload, ctx);
    }
  }
}

const plainTheme = {
  fg: (_color: string, text: string) => text,
} as unknown as Theme;

describe("duration extension", () => {
  it("renders valid transcript markers right-aligned", () => {
    const harness = new ExtensionHarness();
    assert.equal(harness.rendererType, "agent-settle-timestamp");
    assert.ok(harness.renderer);

    const timestamp = new Date(2024, 0, 2, 3, 4, 5).getTime();
    const started = harness.renderer(
      { data: { version: 1, kind: "started", timestamp } },
      { expanded: false },
      plainTheme,
    );
    assert.ok(started);
    assert.deepEqual(started.render(10), ["  03:04:05"]);
    assert.deepEqual(started.render(5), ["04:05"]);
    assert.deepEqual(started.render(0), []);

    const settled = harness.renderer(
      {
        data: {
          version: 1,
          kind: "settled",
          timestamp,
          durationMs: 1_250,
        },
      },
      { expanded: false },
      plainTheme,
    );
    assert.ok(settled);
    assert.deepEqual(settled.render(17), ["  1.3s ⧖ 03:04:05"]);
  });

  it("ignores malformed persisted marker data", () => {
    const harness = new ExtensionHarness();
    assert.ok(harness.renderer);

    for (const data of [
      null,
      [],
      { version: 2, kind: "started", timestamp: Date.now() },
      { version: 1, kind: "started", timestamp: Number.NaN },
      { version: 1, kind: "settled", timestamp: Date.now() },
      {
        version: 1,
        kind: "settled",
        timestamp: Date.now(),
        durationMs: -1,
      },
    ]) {
      assert.equal(
        harness.renderer({ data }, { expanded: false }, plainTheme),
        undefined,
      );
    }
  });

  it("records one start and one settled entry for accepted work", async () => {
    const harness = new ExtensionHarness();
    const ctx = {
      mode: "print",
      ui: {
        setFooter: () => assert.fail("print mode must not install a footer"),
      },
    } as unknown as ExtensionContext;

    await harness.emit("session_start", { reason: "startup" }, ctx);
    await harness.emit("before_agent_start", { prompt: "work" }, ctx);
    await harness.emit("message_start", { message: { role: "user" } }, ctx);
    await harness.emit(
      "message_start",
      { message: { role: "assistant" } },
      ctx,
    );
    await harness.emit(
      "message_start",
      { message: { role: "assistant" } },
      ctx,
    );
    await harness.emit("agent_settled", {}, ctx);

    assert.equal(harness.appended.length, 2);
    assert.deepEqual(
      harness.appended.map(({ customType, data }) => [
        customType,
        data.version,
        data.kind,
      ]),
      [
        ["agent-settle-timestamp", 1, "started"],
        ["agent-settle-timestamp", 1, "settled"],
      ],
    );

    const started = harness.appended[0]!.data;
    const settled = harness.appended[1]!.data;
    assert.equal(typeof started.timestamp, "number");
    assert.equal(typeof settled.timestamp, "number");
    assert.equal(typeof settled.durationMs, "number");
    assert.ok(Number(settled.timestamp) >= Number(started.timestamp));
    assert.ok(Number(settled.durationMs) >= 0);

    await harness.emit("session_shutdown", { reason: "quit" }, ctx);
    await harness.emit(
      "message_start",
      { message: { role: "assistant" } },
      ctx,
    );
    assert.equal(harness.appended.length, 2);
  });

  it("installs its footer only in TUI mode", async () => {
    const harness = new ExtensionHarness();
    let footerFactory: unknown;
    const ctx = {
      mode: "tui",
      ui: {
        setFooter: (factory: unknown) => {
          footerFactory = factory;
        },
      },
    } as unknown as ExtensionContext;

    await harness.emit("session_start", { reason: "startup" }, ctx);
    assert.equal(typeof footerFactory, "function");
  });
});
