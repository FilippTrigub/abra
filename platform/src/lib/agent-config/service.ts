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
  const homeChannel =
    typeof data?.telegramHomeChannel === "string"
      ? data.telegramHomeChannel.trim()
      : typeof data?.telegramAllowedUsers === "string"
        ? data.telegramAllowedUsers.trim()
        : "";
  const allowedUsers =
    typeof data?.telegramAllowedUsers === "string"
      ? data.telegramAllowedUsers.trim()
      : homeChannel;
  if (!token || !homeChannel) return null;

  return { telegramBotToken: token, telegramHomeChannel: homeChannel, telegramAllowedUsers: allowedUsers };
}

export async function saveAgentConfig(authUserId: string, config: AgentConfig): Promise<void> {
  const firestore = getAdminFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp() as unknown as Timestamp;
  await firestore.doc(docPath(authUserId)).set(
    {
      telegramBotToken: config.telegramBotToken,
      telegramHomeChannel: config.telegramHomeChannel,
      telegramAllowedUsers: config.telegramAllowedUsers,
      updatedAt: now,
    },
    { merge: true },
  );
}

export async function hasAgentConfig(authUserId: string): Promise<boolean> {
  const config = await loadAgentConfig(authUserId);
  return config !== null;
}
