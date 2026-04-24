/**
 * Session auth helpers for T8: centralized auth checks and ownership enforcement.
 * 
 * This module provides:
 * - requireAuth(): throws redirect or returns error if unauthenticated
 * - requireOwnership(): throws error if resource does not belong to user
 * 
 * Usage:
 * - In Server Components/Routes: wrap getUser() with requireAuth() for consistent redirects
 * - In API handlers: requireAuth() returns { error } object for JSON responses
 * - For ownership: pass userId + resourceId to requireOwnership()
 */

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getUser } from "./supabase-client";
import type { AuthenticatedUser } from "./supabase-client";

/**
 * Centralized auth check for Server Components and Layouts.
 * Throws redirect to /sign-in if unauthenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const { user, error } = await getUser();

  if (error || !user) {
    redirect("/sign-in");
  }

  return user;
}

/**
 * Centralized auth check for API routes and server actions.
 * Returns an error object if unauthenticated.
 */
export async function requireApiAuth(): Promise<{ user: AuthenticatedUser } | { error: string }> {
  const { user, error } = await getUser();

  if (error || !user) {
    return { error: "Unauthorized" };
  }

  return { user };
}

/**
 * Ownership check for user-scoped resources.
 * Throws error if resource does not belong to user.
 * 
 * Use for: orchestration operations, deployments, settings lookups
 */
export function requireOwnership(userId: string, resourceOwnerId?: string | null): asserts resourceOwnerId {
  if (!resourceOwnerId || resourceOwnerId !== userId) {
    throw new Error("INSUFFICIENT_PERMISSIONS", {
      cause: `Resource does not belong to user ${userId}`,
    });
  }
}

/**
 * Ownership check for API routes that returns a JSON error.
 */
export function checkOwnershipJson(userId: string, resourceOwnerId?: string | null): boolean {
  try {
    requireOwnership(userId, resourceOwnerId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Standardized unauthenticated response.
 */
export function unauthenticatedResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "You must be signed in to access this resource." } },
    { status: 401 },
  );
}

/**
 * Standardized permission denied response.
 */
export function permissionDeniedResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: "PERMISSION_DENIED", message: "You do not have permission to access this resource." } },
    { status: 403 },
  );
}
