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
 * - mock: Default for local development and testing
 * - aks: AKS-backed adapter with Kubernetes auth bootstrap
 */
export function getOrchestrationAdapter(): OrchestrationAdapter {
  const backend = process.env.ORCHESTRATION_BACKEND ?? "mock";

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
