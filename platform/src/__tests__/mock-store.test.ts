import { describe, expect, it } from "vitest";

import { synthesizeMockOperation } from "@/lib/orchestration/mock-store";

describe("mock orchestration synthesis", () => {
  it("preserves a successful mock outcome when rebuilt from persisted deployment data", () => {
    const operation = synthesizeMockOperation(
      "operation-1",
      "create",
      {
        requestId: "request-1",
        target: {
          accountId: "account-1",
          agentId: null,
          deploymentId: "deployment-1",
        },
        payload: {
          name: "Success path",
        },
        mockBehavior: {
          outcome: "succeeded",
        },
      },
      "succeeded",
      new Date(Date.now() - 5000).toISOString(),
    );

    expect(operation.status).toBe("succeeded");
    expect(operation.error).toBeNull();
    expect(operation.result?.resourceHandle).toContain("mock-agent/");
  });
});
