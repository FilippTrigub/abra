export type FirestoreTimestampLike = {
  toDate?: () => Date;
  _seconds?: number;
  _nanoseconds?: number;
};

function isFirestoreTimestampLike(value: unknown): value is FirestoreTimestampLike {
  return typeof value === "object" && value !== null;
}

export function toIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isFirestoreTimestampLike(value) && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (
    isFirestoreTimestampLike(value) &&
    typeof value._seconds === "number" &&
    typeof value._nanoseconds === "number"
  ) {
    return new Date(
      value._seconds * 1000 + Math.floor(value._nanoseconds / 1_000_000),
    ).toISOString();
  }

  return fallback;
}
