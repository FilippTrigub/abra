/**
 * Unit tests for runtime naming helpers.
 *
 * Tests cover:
 * - Deterministic naming from stable inputs
 * - Validation of required inputs
 * - Kubernetes name sanitization
 * - Operation-based name extraction
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  getRuntimeNamespace,
  getStatefulSetName,
  getServiceName,
  getPvcName,
  getConfigRevisionId,
  getPodName,
  getRuntimeNamesFromOperation,
  validateDeploymentIdForNaming,
  validateAccountIdForNaming,
} from "@/lib/orchestration/naming-helpers";
import type { OrchestrationOperation } from "@/lib/orchestration/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ACCOUNT_ID = "user123";
const TEST_DEPLOYMENT_ID = "abra-main";
const TEST_OPERATION: OrchestrationOperation = {
  operationId: "op-test-123",
  adapter: "aks",
  action: "create",
  requestId: "req-456",
  target: {
    accountId: "user123",
    agentId: "agent-789",
    deploymentId: "abra-main",
  },
  payload: {},
  status: "queued",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  completedAt: null,
  pollAfterMs: 1000,
  steps: [],
  error: null,
  result: null,
};

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

describe("getRuntimeNamespace", () => {
  const originalEnv = process.env.AKS_RUNTIME_NAMESPACE;

  beforeEach(() => {
    delete process.env.AKS_RUNTIME_NAMESPACE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AKS_RUNTIME_NAMESPACE = originalEnv;
    } else {
      delete process.env.AKS_RUNTIME_NAMESPACE;
    }
  });

  test("returns default 'abra' when env var is not set", () => {
    expect(getRuntimeNamespace()).toBe("abra");
  });

  test("returns AKS_RUNTIME_NAMESPACE when set", () => {
    process.env.AKS_RUNTIME_NAMESPACE = "custom-namespace";
    expect(getRuntimeNamespace()).toBe("custom-namespace");
  });
});

// ---------------------------------------------------------------------------
// StatefulSet naming tests
// ---------------------------------------------------------------------------

describe("getStatefulSetName", () => {
  test("generates deterministic name from valid inputs", () => {
    const name1 = getStatefulSetName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID);
    const name2 = getStatefulSetName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID);
    expect(name1).toBe(name2);
  });

  test("generates expected format: {prefix}-{account}-{deployment}", () => {
    const name = getStatefulSetName("user123", "abra-main");
    expect(name).toBe("abra-user123-abra-main");
  });

  test("sanitizes uppercase characters", () => {
    const name = getStatefulSetName("User123", "ABRA-MAIN");
    expect(name).toBe("abra-user123-abra-main");
  });

  test("sanitizes special characters", () => {
    const name = getStatefulSetName("user@#$123", "abra*main");
    expect(name).toBe("abra-user-123-abra-main");
  });

  test("throws error when accountId is empty", () => {
    expect(() => getStatefulSetName("", TEST_DEPLOYMENT_ID)).toThrow(
      "accountId is required"
    );
  });

  test("throws error when deploymentId is empty", () => {
    expect(() => getStatefulSetName(TEST_ACCOUNT_ID, "")).toThrow(
      "deploymentId is required"
    );
  });

  test("compacts long account and deployment ids deterministically", () => {
    const accountId = "fjyqatlmasrvefkf0g6lgajz9gv2";
    const deploymentId = "9ba066b6-8348-4e00-abd3-52e7fcc7e04c";

    const name1 = getStatefulSetName(accountId, deploymentId);
    const name2 = getStatefulSetName(accountId, deploymentId);

    expect(name1).toBe(name2);
    expect(name1.length).toBeLessThanOrEqual(55);
    expect(name1.startsWith("abra-")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Service naming tests
// ---------------------------------------------------------------------------

describe("getServiceName", () => {
  test("generates name with -svc suffix", () => {
    const name = getServiceName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID);
    expect(name).toBe("abra-user123-abra-main-svc");
  });

  test("is deterministic", () => {
    const name1 = getServiceName("user1", "deploy1");
    const name2 = getServiceName("user1", "deploy1");
    expect(name1).toBe(name2);
  });

  test("sanitizes input correctly", () => {
    const name = getServiceName("User@123", "Deploy*456");
    expect(name).toBe("abra-user-123-deploy-456-svc");
  });

  test("keeps long generated service names within the 63-character DNS label limit", () => {
    const name = getServiceName(
      "fjyqatlmasrvefkf0g6lgajz9gv2",
      "9ba066b6-8348-4e00-abd3-52e7fcc7e04c"
    );

    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith("-svc")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PVC naming tests
// ---------------------------------------------------------------------------

describe("getPvcName", () => {
  test("generates name with -data suffix", () => {
    const name = getPvcName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID);
    expect(name).toBe("abra-user123-abra-main-data");
  });

  test("is deterministic", () => {
    const name1 = getPvcName("user1", "deploy1");
    const name2 = getPvcName("user1", "deploy1");
    expect(name1).toBe(name2);
  });

  test("sanitizes input correctly", () => {
    const name = getPvcName("User@123", "Deploy*456");
    expect(name).toBe("abra-user-123-deploy-456-data");
  });

  test("keeps long generated pvc names within the shared 63-character runtime budget", () => {
    const name = getPvcName(
      "fjyqatlmasrvefkf0g6lgajz9gv2",
      "9ba066b6-8348-4e00-abd3-52e7fcc7e04c"
    );

    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith("-data")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Config revision identifier tests
// ---------------------------------------------------------------------------

describe("getConfigRevisionId", () => {
  test("generates name with -rev-{number} suffix", () => {
    const id = getConfigRevisionId(TEST_DEPLOYMENT_ID, 1);
    expect(id).toBe("abra-main-rev-1");
  });

  test("increments revision correctly", () => {
    const id1 = getConfigRevisionId(TEST_DEPLOYMENT_ID, 1);
    const id2 = getConfigRevisionId(TEST_DEPLOYMENT_ID, 2);
    const id3 = getConfigRevisionId(TEST_DEPLOYMENT_ID, 10);
    expect(id1).toBe("abra-main-rev-1");
    expect(id2).toBe("abra-main-rev-2");
    expect(id3).toBe("abra-main-rev-10");
  });

  test("sanitizes deploymentId", () => {
    const id = getConfigRevisionId("User@123", 5);
    expect(id).toBe("user-123-rev-5");
  });

  test("throws error when deploymentId is empty", () => {
    expect(() => getConfigRevisionId("", 1)).toThrow(
      "deploymentId is required"
    );
  });

  test("throws error when revision is negative", () => {
    expect(() => getConfigRevisionId(TEST_DEPLOYMENT_ID, -1)).toThrow(
      "revision must be a non-negative integer"
    );
  });

  test("throws error when revision is not an integer", () => {
    expect(() => getConfigRevisionId(TEST_DEPLOYMENT_ID, 1.5)).toThrow(
      "revision must be a non-negative integer"
    );
  });
});

// ---------------------------------------------------------------------------
// Pod name tests
// ---------------------------------------------------------------------------

describe("getPodName", () => {
  test("generates name with ordinal 0 by default", () => {
    const name = getPodName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID);
    expect(name).toBe("abra-user123-abra-main-0");
  });

  test("uses specified ordinal", () => {
    const name = getPodName(TEST_ACCOUNT_ID, TEST_DEPLOYMENT_ID, 1);
    expect(name).toBe("abra-user123-abra-main-1");
  });

  test("uses specified ordinal with multiple deployments", () => {
    const name1 = getPodName("user1", "deploy1", 0);
    const name2 = getPodName("user1", "deploy1", 1);
    expect(name1).toBe("abra-user1-deploy1-0");
    expect(name2).toBe("abra-user1-deploy1-1");
  });

  test("keeps long generated pod names within the shared 63-character runtime budget", () => {
    const name = getPodName(
      "fjyqatlmasrvefkf0g6lgajz9gv2",
      "9ba066b6-8348-4e00-abd3-52e7fcc7e04c"
    );

    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith("-0")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Operation-based naming tests
// ---------------------------------------------------------------------------

describe("getRuntimeNamesFromOperation", () => {
  test("extracts names from operation target", () => {
    const names = getRuntimeNamesFromOperation(TEST_OPERATION);
    expect(names).toEqual({
      namespace: "abra",
      statefulSetName: "abra-user123-abra-main",
      serviceName: "abra-user123-abra-main-svc",
      pvcName: "abra-user123-abra-main-data",
      podName: "abra-user123-abra-main-0",
    });
  });

  test("uses custom namespace from env var", () => {
    process.env.AKS_RUNTIME_NAMESPACE = "custom-ns";
    try {
      const names = getRuntimeNamesFromOperation(TEST_OPERATION);
      expect(names.namespace).toBe("custom-ns");
    } finally {
      delete process.env.AKS_RUNTIME_NAMESPACE;
    }
  });

  test("throws error when accountId is missing from target", () => {
    const opWithoutAccountId: OrchestrationOperation = {
      ...TEST_OPERATION,
      target: {
        accountId: "",
        agentId: "agent-789",
        deploymentId: "abra-main",
      },
    };
    expect(() => getRuntimeNamesFromOperation(opWithoutAccountId)).toThrow(
      "Operation target missing accountId"
    );
  });

  test("throws error when deploymentId is missing from target", () => {
    const opWithoutDeploymentId: OrchestrationOperation = {
      ...TEST_OPERATION,
      target: {
        accountId: "user123",
        agentId: "agent-789",
        deploymentId: "",
      },
    };
    expect(() =>
      getRuntimeNamesFromOperation(opWithoutDeploymentId)
    ).toThrow("Operation target missing deploymentId");
  });
});

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

describe("validateDeploymentIdForNaming", () => {
  test("throws error when deploymentId is empty", () => {
    expect(() => validateDeploymentIdForNaming("")).toThrow(
      "deploymentId cannot be empty"
    );
  });

  test("throws error when deploymentId is whitespace", () => {
    expect(() => validateDeploymentIdForNaming("   ")).toThrow(
      "deploymentId cannot be whitespace"
    );
  });

  test("throws error when deploymentId is not a string", () => {
    expect(() => validateDeploymentIdForNaming(123 as unknown as string)).toThrow(
      "deploymentId must be a string"
    );
  });

  test("throws error when deploymentId is too long", () => {
    const longId = "a".repeat(101);
    expect(() => validateDeploymentIdForNaming(longId)).toThrow(
      "deploymentId is too long"
    );
  });

  test("passes valid deploymentId", () => {
    expect(() => validateDeploymentIdForNaming("valid-deployment-123")).not.toThrow();
  });
});

describe("validateAccountIdForNaming", () => {
  test("throws error when accountId is empty", () => {
    expect(() => validateAccountIdForNaming("")).toThrow(
      "accountId cannot be empty"
    );
  });

  test("throws error when accountId is whitespace", () => {
    expect(() => validateAccountIdForNaming("   ")).toThrow(
      "accountId cannot be whitespace"
    );
  });

  test("throws error when accountId is not a string", () => {
    expect(() => validateAccountIdForNaming(123 as unknown as string)).toThrow(
      "accountId must be a string"
    );
  });

  test("passes valid accountId", () => {
    expect(() => validateAccountIdForNaming("valid-user-123")).not.toThrow();
  });
});
