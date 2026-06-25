import { describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

import {
  decideManualBlockGate,
  manualBlockStatePath,
  normalizeManualBlockState,
  summarizeManualBlockForBrowser,
} from "@/lib/billing";
import { NO_MANUAL_BLOCK, projectStripeEntitlement, type ManualBlockState } from "@/lib/billing";
import { readManualBlockState } from "@/lib/billing/manual-block-service";

function createFirestoreMock(docs: Map<string, Record<string, unknown>>) {
  return {
    doc: vi.fn((path: string) => ({
      get: vi.fn().mockResolvedValue({
        data: () => docs.get(path),
      }),
    })),
  };
}

const blockedState: ManualBlockState = {
  blocked: true,
  reason: "abuse",
  message: "Account access paused while we review suspicious traffic.",
  operatorNote: "Internal escalation notes must never reach browsers.",
  updatedAt: "2026-06-25T12:00:00.000Z",
  updatedBy: "operator@example.com",
};

describe("manual block state normalization", () => {
  it("reads and normalizes server-owned moderation state from the canonical account path", async () => {
    const docs = new Map<string, Record<string, unknown>>([
      [manualBlockStatePath("acct_123"), {
        blocked: true,
        reason: "terms_violation",
        publicReason: "Terms violation review",
        operatorNote: "Chargeback narrative and internal ticket link.",
        updatedAt: "2026-06-25T12:00:00.000Z",
        updatedBy: "operator@example.com",
        rawProviderMetadata: { shouldNotLeak: true },
      }],
    ]);
    const firestore = createFirestoreMock(docs);
    getAdminFirestoreMock.mockReturnValue(firestore);

    await expect(readManualBlockState("acct_123")).resolves.toEqual({
      blocked: true,
      reason: "terms_violation",
      message: "Terms violation review",
      operatorNote: "Chargeback narrative and internal ticket link.",
      updatedAt: "2026-06-25T12:00:00.000Z",
      updatedBy: "operator@example.com",
    });
    expect(firestore.doc).toHaveBeenCalledWith("accounts/acct_123/moderation/current");
  });

  it("treats missing or unblocked moderation state as no manual block", () => {
    expect(normalizeManualBlockState(undefined)).toBe(NO_MANUAL_BLOCK);
    expect(normalizeManualBlockState({ blocked: false, reason: "abuse" })).toBe(NO_MANUAL_BLOCK);
  });
});

describe("manual block gate decisions", () => {
  it.each(["create", "start", "update", "admission"] as const)(
    "denies %s for manually blocked accounts",
    (operation) => {
      expect(decideManualBlockGate({ operation, manualBlock: blockedState })).toEqual({
        operation,
        allowed: false,
        reasonCode: "manual_block",
      });
    },
  );

  it("allows destroy for a manually blocked account when ownership is already verified", () => {
    expect(decideManualBlockGate({
      operation: "destroy",
      manualBlock: blockedState,
      ownershipVerified: true,
    })).toEqual({
      operation: "destroy",
      allowed: true,
      reasonCode: null,
    });
  });

  it("does not turn nonpayment or free tier demotion into a manual block", () => {
    const projection = projectStripeEntitlement({ status: "unpaid", mappedTier: "growth" });

    expect(projection).toMatchObject({
      tier: "free",
      hardBlocked: false,
      reason: "subscription-not-entitled",
    });
    expect(decideManualBlockGate({ operation: "start", manualBlock: NO_MANUAL_BLOCK })).toEqual({
      operation: "start",
      allowed: true,
      reasonCode: null,
    });
  });
});

describe("browser-safe manual block summary", () => {
  it("exposes only manual block status and sanitized public reason fields", () => {
    const summary = summarizeManualBlockForBrowser({
      blocked: true,
      reason: "operator_hold",
      message: "  Public review note\nwith control characters\u0000  ",
      operatorNote: "Private operator note",
      updatedAt: "2026-06-25T12:00:00.000Z",
      updatedBy: "operator@example.com",
    });

    expect(summary).toEqual({
      isManuallyBlocked: true,
      reasonCode: "operator_hold",
      reason: "Public review note with control characters",
    });
    expect(summary).not.toHaveProperty("operatorNote");
    expect(summary).not.toHaveProperty("updatedBy");
    expect(summary).not.toHaveProperty("updatedAt");
    expect(summary).not.toHaveProperty("rawProviderMetadata");
  });
});
