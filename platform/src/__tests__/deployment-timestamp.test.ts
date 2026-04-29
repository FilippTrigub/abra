import { describe, expect, it } from "vitest";

import {
  toIsoTimestamp,
  type FirestoreTimestampLike,
} from "@/lib/firestore-serialization";

describe("deployment timestamp normalization", () => {
  it("converts Firestore timestamp-like values into ISO strings", () => {
    const value: FirestoreTimestampLike = {
      _seconds: 1713960000,
      _nanoseconds: 923000000,
      toDate: () => new Date("2024-04-24T12:00:00.923Z"),
    };

    expect(toIsoTimestamp(value, "fallback")).toBe("2024-04-24T12:00:00.923Z");
  });

  it("falls back when the value is not timestamp-like", () => {
    expect(toIsoTimestamp(null, "fallback")).toBe("fallback");
  });
});
