import { getAdminFirestore } from "@/lib/firebase/admin";
import type {
  OrchestrationAction,
  OrchestrationOperation,
  OrchestrationOperationError,
  OrchestrationOperationResult,
  OrchestrationOperationStep,
  OrchestrationOperationStatus,
  OrchestrationTargetRef,
} from "./types";

const OPERATIONS_COLLECTION = "orchestration_operations";

interface FirestoreOperationRecord {
  operationId: string;
  adapter: string;
  action: OrchestrationAction;
  requestId: string;
  target: OrchestrationTargetRef;
  payload: Record<string, unknown>;
  status: OrchestrationOperationStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  pollAfterMs: number;
  steps: OrchestrationOperationStep[];
  error: OrchestrationOperationError | null;
  result: OrchestrationOperationResult | null;
  runtimeMetadata?: Record<string, unknown>;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === "object") {
    const sanitizedEntries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([entryKey, entryValue]) => [entryKey, stripUndefinedDeep(entryValue)]);

    return Object.fromEntries(sanitizedEntries) as T;
  }

  return value;
}

/**
 * Durable operation store using Firestore.
 *
 * This store persists orchestration operations to Firestore, ensuring they
 * survive process restarts and can be shared across multiple platform instances.
 *
 * Schema:
 * - Collection: orchestration_operations
 * - Document ID: operationId
 *
 * Fields are normalized to match the OrchestrationOperation interface exactly.
 * runtimeMetadata is persisted inline as a Record<string, unknown> for flexibility.
 */
class FirestoreOperationStore {
  private async getOperationsCollection() {
    return getAdminFirestore().collection(OPERATIONS_COLLECTION);
  }

  async create(operation: OrchestrationOperation): Promise<OrchestrationOperation> {
    const collection = await this.getOperationsCollection();
    const record: FirestoreOperationRecord = this.toFirestoreRecord(operation);

    await collection.doc(operation.operationId).set(record);

    return operation;
  }

  async update(operation: OrchestrationOperation): Promise<OrchestrationOperation> {
    const collection = await this.getOperationsCollection();
    const record: FirestoreOperationRecord = this.toFirestoreRecord(operation);

    await collection.doc(operation.operationId).set(record, { merge: true });

    return operation;
  }

  async getStatus(operationId: string): Promise<OrchestrationOperation | null> {
    const collection = await this.getOperationsCollection();
    const doc = await collection.doc(operationId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return this.fromFirestoreRecord(data);
  }

  async delete(operationId: string): Promise<void> {
    const collection = await this.getOperationsCollection();
    await collection.doc(operationId).delete();
  }

  private toFirestoreRecord(operation: OrchestrationOperation): FirestoreOperationRecord {
    return {
      operationId: operation.operationId,
      adapter: operation.adapter,
      action: operation.action,
      requestId: operation.requestId,
      target: stripUndefinedDeep(operation.target),
      payload: stripUndefinedDeep(operation.payload),
      status: operation.status,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
      completedAt: operation.completedAt,
      pollAfterMs: operation.pollAfterMs,
      steps: stripUndefinedDeep(operation.steps),
      error: operation.error ? stripUndefinedDeep(operation.error) : null,
      result: operation.result ? stripUndefinedDeep(operation.result) : null,
      runtimeMetadata: operation.runtimeMetadata
        ? this.serializeMetadata(stripUndefinedDeep(operation.runtimeMetadata))
        : undefined,
    };
  }

  private fromFirestoreRecord(data: unknown): OrchestrationOperation {
    if (!this.isFirestoreOperationRecord(data)) {
      throw new Error("Invalid operation record from Firestore");
    }

    return {
      operationId: data.operationId,
      adapter: data.adapter,
      action: data.action,
      requestId: data.requestId,
      target: data.target,
      payload: data.payload,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      completedAt: data.completedAt,
      pollAfterMs: data.pollAfterMs,
      steps: data.steps,
      error: data.error,
      result: data.result,
      runtimeMetadata: data.runtimeMetadata ? this.deserializeMetadata(data.runtimeMetadata) : undefined,
    };
  }

  private isFirestoreOperationRecord(data: unknown): data is FirestoreOperationRecord {
    const record = data as Record<string, unknown>;

    return (
      typeof record.operationId === "string" &&
      typeof record.adapter === "string" &&
      typeof record.action === "string" &&
      typeof record.requestId === "string" &&
      typeof record.pollAfterMs === "number" &&
      typeof record.createdAt === "string" &&
      typeof record.updatedAt === "string" &&
      (record.completedAt === null || typeof record.completedAt === "string") &&
      Array.isArray(record.steps) &&
      (record.error === null || typeof record.error === "object" && record.error !== null) &&
      (record.result === null || typeof record.result === "object" && record.result !== null) &&
      (record.target === undefined ||
        (typeof record.target === "object" && record.target !== null &&
          typeof (record.target as Record<string, unknown>).accountId === "string"))
    );
  }

  private serializeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    return metadata;
  }

  private deserializeMetadata(serialized: Record<string, unknown>): Record<string, unknown> {
    return serialized;
  }
}

export const firestoreOperationStore = new FirestoreOperationStore();
