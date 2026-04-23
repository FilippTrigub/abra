import { MockOrchestrationAdapter } from "./mock-adapter";
import type {
  OrchestrationAction,
  OrchestrationAdapter,
  OrchestrationOperationInput,
} from "./types";

let adapterSingleton: OrchestrationAdapter | null = null;

export function getOrchestrationAdapter(): OrchestrationAdapter {
  const backend = process.env.ORCHESTRATION_BACKEND ?? "mock";

  if (backend !== "mock") {
    throw new Error(
      `Unsupported orchestration backend \"${backend}\". Only \"mock\" is configured locally.`,
    );
  }

  if (!adapterSingleton) {
    adapterSingleton = new MockOrchestrationAdapter();
  }

  return adapterSingleton;
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
