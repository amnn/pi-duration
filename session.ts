// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

import type {
  AgentSession,
  ExtensionContext as Context,
} from "@earendil-works/pi-coding-agent";

/** Adapts the extension context to the session properties read by Pi's footer. */
export class SessionFacade {
  public constructor(private readonly context: Context) {}

  public get state() {
    return {
      model: this.context.model,
      thinkingLevel: this.context.thinkingLevel,
    };
  }

  public get sessionManager() {
    return this.context.sessionManager;
  }

  public getContextUsage() {
    return this.context.getContextUsage();
  }

  public readonly modelRuntime = {
    isUsingSubscription: (providerId: string): boolean => {
      const model = this.context.model;
      if (!model || model.provider !== providerId) return false;

      const provider = this.context.modelRegistry.getProvider(providerId);
      return (
        this.context.modelRegistry.isUsingOAuth(model) &&
        provider?.auth.oauth?.isSubscription === true
      );
    },
  };

  /** Returns the AgentSession view expected by Pi's footer component. */
  public asAgentSession(): AgentSession {
    return this as unknown as AgentSession;
  }
}
