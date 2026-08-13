// Copyright (c) Ashok Menon
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatClock,
  formatDuration,
  formatWholeSecondDuration,
  isValidDuration,
  isValidTimestamp,
} from "../src/time.ts";

describe("time formatting", () => {
  it("formats local wall-clock timestamps with fixed-width fields", () => {
    const timestamp = new Date(2024, 0, 2, 3, 4, 5).getTime();
    assert.equal(formatClock(timestamp), "03:04:05");
  });

  it("formats short durations in tenths of a second", () => {
    assert.equal(formatDuration(0), "0.0s");
    assert.equal(formatDuration(1), "<0.1s");
    assert.equal(formatDuration(99), "<0.1s");
    assert.equal(formatDuration(100), "0.1s");
    assert.equal(formatDuration(1_250), "1.3s");
    assert.equal(formatDuration(59_949), "59.9s");
    assert.equal(formatDuration(59_950), "1m");
  });

  it("formats long durations with compact whole-second units", () => {
    assert.equal(formatWholeSecondDuration(0), "0s");
    assert.equal(formatWholeSecondDuration(500), "1s");
    assert.equal(formatWholeSecondDuration(61_000), "1m 1s");
    assert.equal(formatWholeSecondDuration(3_661_000), "1h 1m 1s");
    assert.equal(formatWholeSecondDuration(90_061_000), "1d 1h 1m 1s");
  });

  it("rejects invalid elapsed times and timestamps", () => {
    assert.equal(isValidDuration(0), true);
    assert.equal(isValidDuration(-1), false);
    assert.equal(isValidDuration(Number.POSITIVE_INFINITY), false);
    assert.equal(isValidDuration("1"), false);

    assert.equal(isValidTimestamp(Date.now()), true);
    assert.equal(isValidTimestamp(Number.NaN), false);
    assert.equal(isValidTimestamp(Number.POSITIVE_INFINITY), false);
    assert.equal(isValidTimestamp("now"), false);
  });
});
