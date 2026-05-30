import { getAdminFirestore } from "@/lib/firebase/admin";
import * as admin from "firebase-admin";
import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { AgentConfig } from "./types";

function docPath(authUserId: string) {
  return `accounts/${authUserId}/agent-config/current`;
}

export async function loadAgentConfig(authUserId: string): Promise<AgentConfig | null> {
  const firestore = getAdminFirestore();
  const doc = await firestore.doc(docPath(authUserId)).get();
  if (!doc.exists) return null;

  const data = doc.data() as DocumentData | undefined;
  const token = typeof data?.telegramBotToken === "string" ? data.telegramBotToken.trim() : "";
  if (!token) return null;

  return { telegramBotToken: token };
}

export async function saveAgentConfig(authUserId: string, config: AgentConfig): Promise<void> {
  const firestore = getAdminFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp() as unknown as Timestamp;
  await firestore.doc(docPath(authUserId)).set(
    {
      telegramBotToken: config.telegramBotToken,
      updatedAt: now,
    },
    { merge: true },
  );
}

export async function hasAgentConfig(authUserId: string): Promise<boolean> {
  const config = await loadAgentConfig(authUserId);
  return config !== null;
}
