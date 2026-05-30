import { AksOrchestrationAdapter } from "./aks-adapter";
import { MockOrchestrationAdapter } from "./mock-adapter";
import type {
  OrchestrationAction,
  OrchestrationAdapter,
  OrchestrationOperationInput,
} from "./types";

let adapterSingleton: OrchestrationAdapter | null = null;

/**
 * Gets the orchestration adapter based on backend configuration.
 *
 * Supported backends:
 * - aks: Default AKS-backed adapter with Kubernetes auth bootstrap
 * - mock: Explicit local development and testing adapter
 */
export function getOrchestrationAdapter(): OrchestrationAdapter {
  const backend = process.env.ORCHESTRATION_BACKEND ?? "aks";

  switch (backend) {
    case "mock":
      if (!adapterSingleton) {
        adapterSingleton = new MockOrchestrationAdapter();
      }
      return adapterSingleton;

    case "aks":
      if (!adapterSingleton) {
        adapterSingleton = new AksOrchestrationAdapter();
      }
      return adapterSingleton;

    default:
      throw new Error(
        `Unsupported orchestration backend "${backend}". Supported values: "mock", "aks".`,
      );
  }
}

/** @internal For testing only - resets the adapter singleton */
export function __resetAdapterSingleton(): void {
  adapterSingleton = null;
}

export async function dispatchOrchestrationAction(
  action: OrchestrationAction,
  input: OrchestrationOperationInput,
) {
  const adapter = getOrchestrationAdapter();

  switch (action) {
    case "create":
      return adapter.create(input);
    case "update":
      return adapter.update(input);
    case "restart":
      return adapter.restart(input);
    case "destroy":
      return adapter.destroy(input);
  }
}
