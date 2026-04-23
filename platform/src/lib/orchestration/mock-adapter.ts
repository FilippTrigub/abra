import { createMockOperation, readMockOperation } from "./mock-store";
import type {
  OrchestrationAdapter,
  OrchestrationOperationInput,
} from "./types";

export class MockOrchestrationAdapter implements OrchestrationAdapter {
  readonly name = "mock";

  create(input: OrchestrationOperationInput) {
    return Promise.resolve(createMockOperation("create", input));
  }

  update(input: OrchestrationOperationInput) {
    return Promise.resolve(createMockOperation("update", input));
  }

  restart(input: OrchestrationOperationInput) {
    return Promise.resolve(createMockOperation("restart", input));
  }

  destroy(input: OrchestrationOperationInput) {
    return Promise.resolve(createMockOperation("destroy", input));
  }

  getStatus(operationId: string) {
    return Promise.resolve(readMockOperation(operationId));
  }
}
