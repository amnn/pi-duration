// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { SessionFacade } from "../src/session.ts";

describe("session facade", () => {
  it("exposes the live session state expected by Pi's footer", () => {
    const sessionManager = { marker: "session" };
    const usage = { tokens: 42 };
    const model = { provider: "subscription-provider", id: "model" };
    let usesOAuth = true;
    let subscription = true;

    const context = {
      model,
      thinkingLevel: "high",
      sessionManager,
      getContextUsage: () => usage,
      modelRegistry: {
        isUsingOAuth: () => usesOAuth,
        getProvider: () => ({
          auth: { oauth: { isSubscription: subscription } },
        }),
      },
    } as unknown as ExtensionContext;

    const facade = new SessionFacade(context);
    assert.deepEqual(facade.state, { model, thinkingLevel: "high" });
    assert.equal(facade.sessionManager, sessionManager);
    assert.equal(facade.getContextUsage(), usage);
    assert.equal(
      facade.modelRuntime.isUsingSubscription("subscription-provider"),
      true,
    );
    assert.equal(facade.modelRuntime.isUsingSubscription("other"), false);

    usesOAuth = false;
    assert.equal(
      facade.modelRuntime.isUsingSubscription("subscription-provider"),
      false,
    );

    usesOAuth = true;
    subscription = false;
    assert.equal(
      facade.modelRuntime.isUsingSubscription("subscription-provider"),
      false,
    );
    assert.equal(facade.asAgentSession(), facade);
  });
});
