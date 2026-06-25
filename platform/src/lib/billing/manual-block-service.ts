import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";

import { manualBlockStatePath, normalizeManualBlockState } from "./manual-block-gate";

export async function readManualBlockState(accountId: string) {
  const snapshot = await getAdminFirestore().doc(manualBlockStatePath(accountId)).get();

  return normalizeManualBlockState(snapshot.data());
}
