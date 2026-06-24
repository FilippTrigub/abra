import * as admin from "firebase-admin";
import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { BrandProfile, BrandProfileInput } from "./types";

function docPath(authUserId: string) {
  return `accounts/${authUserId}/brand-profile/current`;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return null;
}

export function buildBrandMarkdown(profile: BrandProfileInput): string {
  const brandDescription = normalizeText(profile.brandDescription);

  return [
    "# Brand Profile",
    "",
    "This file is generated from the user's Abra onboarding profile and should guide brand-manager decisions before drafting, adapting, scheduling, or creating assets.",
    "",
    "## User Description",
    brandDescription || "Not specified yet.",
    "",
    "## Operating Principle",
    "Abra prepares drafts and assets; the expert reviews, edits, approves, and remains accountable.",
  ].join("\n");
}

function toBrandProfile(data: DocumentData | undefined): BrandProfile | null {
  if (!data) return null;
  const legacyDescription = [
    typeof data.brandName === "string" ? data.brandName : "",
    typeof data.audience === "string" ? data.audience : "",
    typeof data.offer === "string" ? data.offer : "",
    typeof data.voice === "string" ? data.voice : "",
    typeof data.differentiators === "string" ? data.differentiators : "",
    typeof data.sourceNotes === "string" ? data.sourceNotes : "",
  ].filter(Boolean).join("\n\n");
  const existingMarkdown = typeof data.markdown === "string" ? data.markdown : "";
  const brandDescription = typeof data.brandDescription === "string" && data.brandDescription.trim()
    ? data.brandDescription
    : legacyDescription || existingMarkdown;
  const markdown = existingMarkdown || buildBrandMarkdown({ brandDescription });

  return {
    brandDescription,
    markdown,
    completedAt: toIsoString(data.completedAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export async function loadBrandProfile(authUserId: string): Promise<BrandProfile | null> {
  const firestore = getAdminFirestore();
  const doc = await firestore.doc(docPath(authUserId)).get();
  if (!doc.exists) return null;
  return toBrandProfile(doc.data());
}

export async function hasCompletedBrandProfile(authUserId: string): Promise<boolean> {
  const profile = await loadBrandProfile(authUserId);
  return Boolean(profile?.completedAt && profile.markdown.trim());
}

export async function saveBrandProfile(authUserId: string, input: BrandProfileInput): Promise<BrandProfile> {
  const normalized: BrandProfileInput = {
    brandDescription: normalizeText(input.brandDescription),
  };
  const markdown = buildBrandMarkdown(normalized);
  const firestore = getAdminFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp() as unknown as Timestamp;

  await firestore.doc(docPath(authUserId)).set(
    {
      ...normalized,
      markdown,
      completedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const saved = await loadBrandProfile(authUserId);
  return saved ?? {
    ...normalized,
    markdown,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
