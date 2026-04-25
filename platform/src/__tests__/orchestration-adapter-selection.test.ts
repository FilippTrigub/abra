/**
 * Tests for orchestration adapter selection and backend configuration.
 * Covers getOrchestrationAdapter() behavior for mock, aks, and invalid backends.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/orchestration/firestore-operation-store", () => ({
  firestoreOperationStore: {
    create: vi.fn(),
    update: vi.fn(),
    getStatus: vi.fn(),
  },
}));

import { getOrchestrationAdapter, __resetAdapterSingleton } from "../lib/orchestration/server";
import { AksOrchestrationAdapter } from "../lib/orchestration/aks-adapter";
import { MockOrchestrationAdapter } from "../lib/orchestration/mock-adapter";

describe("Mock backend selection", () => {
  let originalBackend: string | undefined;

  beforeEach(() => {
    originalBackend = process.env.ORCHESTRATION_BACKEND;
    process.env.ORCHESTRATION_BACKEND = "mock";
    __resetAdapterSingleton();
  });

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.ORCHESTRATION_BACKEND;
    } else {
      process.env.ORCHESTRATION_BACKEND = originalBackend;
    }
    __resetAdapterSingleton();
  });

  it("returns mock adapter when ORCHESTRATION_BACKEND=mock", () => {
    const adapter = getOrchestrationAdapter();

    expect(adapter).toBeInstanceOf(MockOrchestrationAdapter);
    expect(adapter.name).toBe("mock");
  });

  it("returns singleton instance for mock adapter", () => {
    const adapter1 = getOrchestrationAdapter();
    const adapter2 = getOrchestrationAdapter();

    expect(adapter1).toBe(adapter2);
  });

  it("mock adapter has correct interface", () => {
    const adapter = getOrchestrationAdapter();

    expect(typeof adapter.create).toBe("function");
    expect(typeof adapter.update).toBe("function");
    expect(typeof adapter.restart).toBe("function");
    expect(typeof adapter.destroy).toBe("function");
    expect(typeof adapter.getStatus).toBe("function");
  });
});

describe("AKS backend selection", () => {
  let originalBackend: string | undefined;

  beforeEach(() => {
    originalBackend = process.env.ORCHESTRATION_BACKEND;
    process.env.ORCHESTRATION_BACKEND = "aks";
    __resetAdapterSingleton();
  });

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.ORCHESTRATION_BACKEND;
    } else {
      process.env.ORCHESTRATION_BACKEND = originalBackend;
    }
    __resetAdapterSingleton();
  });

  it("returns aks adapter when ORCHESTRATION_BACKEND=aks", () => {
    const adapter = getOrchestrationAdapter();

    expect(adapter).toBeInstanceOf(AksOrchestrationAdapter);
    expect(adapter.name).toBe("aks");
  });

  it("returns singleton instance for aks adapter", () => {
    const adapter1 = getOrchestrationAdapter();
    const adapter2 = getOrchestrationAdapter();

    expect(adapter1).toBe(adapter2);
  });

  it("aks adapter has correct interface", () => {
    const adapter = getOrchestrationAdapter() as AksOrchestrationAdapter;

    expect(typeof adapter.create).toBe("function");
    expect(typeof adapter.update).toBe("function");
    expect(typeof adapter.restart).toBe("function");
    expect(typeof adapter.destroy).toBe("function");
    expect(typeof adapter.getStatus).toBe("function");
    expect(typeof adapter.getBootstrapStatus).toBe("function");
  });

  it("aks adapter exposes getBootstrapStatus method", async () => {
    const adapter = getOrchestrationAdapter() as AksOrchestrationAdapter;

    const status = await adapter.getBootstrapStatus();
    expect(status).toBeDefined();
    expect(status).toHaveProperty("kubernetes");
    expect(status).toHaveProperty("azureWorkloadIdentity");
  });
});

describe("Unsupported backend handling", () => {
  let originalBackend: string | undefined;

  beforeEach(() => {
    originalBackend = process.env.ORCHESTRATION_BACKEND;
    __resetAdapterSingleton();
  });

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.ORCHESTRATION_BACKEND;
    } else {
      process.env.ORCHESTRATION_BACKEND = originalBackend;
    }
    __resetAdapterSingleton();
  });

  it("throws error when ORCHESTRATION_BACKEND=invalid", () => {
    process.env.ORCHESTRATION_BACKEND = "invalid";

    expect(() => getOrchestrationAdapter()).toThrow(
      /Unsupported orchestration backend/
    );
    expect(() => getOrchestrationAdapter()).toThrow(/mock/);
    expect(() => getOrchestrationAdapter()).toThrow(/aks/);
  });

  it("throws error with clear message mentioning supported values", () => {
    process.env.ORCHESTRATION_BACKEND = "custom-backend";

    expect(() => getOrchestrationAdapter()).toThrow(
      /Unsupported orchestration backend "custom-backend". Supported values: "mock", "aks"/
    );
  });

  it("throws error when ORCHESTRATION_BACKEND=unknown", () => {
    process.env.ORCHESTRATION_BACKEND = "unknown";

    expect(() => getOrchestrationAdapter()).toThrow(
      /Unsupported orchestration backend "unknown"/
    );
  });

  it("throws error when ORCHESTRATION_BACKEND=null (converted to string)", () => {
    process.env.ORCHESTRATION_BACKEND = "null";

    expect(() => getOrchestrationAdapter()).toThrow(
      /Unsupported orchestration backend/
    );
  });

  it("throws error for empty string backend", () => {
    process.env.ORCHESTRATION_BACKEND = "";

    expect(() => getOrchestrationAdapter()).toThrow(
      /Unsupported orchestration backend ""/
    );
  });
});

describe("Default backend (undefined)", () => {
  let originalBackend: string | undefined;

  beforeEach(() => {
    originalBackend = process.env.ORCHESTRATION_BACKEND;
    delete process.env.ORCHESTRATION_BACKEND;
    __resetAdapterSingleton();
  });

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.ORCHESTRATION_BACKEND;
    } else {
      process.env.ORCHESTRATION_BACKEND = originalBackend;
    }
    __resetAdapterSingleton();
  });

  it("returns mock adapter when ORCHESTRATION_BACKEND is not set", () => {
    const adapter = getOrchestrationAdapter();

    expect(adapter).toBeInstanceOf(MockOrchestrationAdapter);
    expect(adapter.name).toBe("mock");
  });
});
