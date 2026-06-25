import "server-only";

import type { ManagedBillingTier } from "./contracts";

export const STRIPE_GROWTH_PLAN_KEY = "growth" as const;
export type StripeCheckoutPlanKey = typeof STRIPE_GROWTH_PLAN_KEY;

export interface StripeBillingConfig {
  secretKey: string;
  webhookSecret: string;
  growthPriceId: string;
}

export class StripeBillingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeBillingConfigError";
  }
}

function requireServerEnv(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET" | "STRIPE_GROWTH_PRICE_ID") {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new StripeBillingConfigError(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getStripeBillingConfig(): StripeBillingConfig {
  return {
    secretKey: requireServerEnv("STRIPE_SECRET_KEY"),
    webhookSecret: requireServerEnv("STRIPE_WEBHOOK_SECRET"),
    growthPriceId: requireServerEnv("STRIPE_GROWTH_PRICE_ID"),
  };
}

export function parseStripeCheckoutPlanKey(value: unknown): StripeCheckoutPlanKey | null {
  return value === STRIPE_GROWTH_PLAN_KEY ? STRIPE_GROWTH_PLAN_KEY : null;
}

export function managedTierForStripePrice(priceId: string, config = getStripeBillingConfig()): ManagedBillingTier | null {
  return priceId === config.growthPriceId ? "growth" : null;
}
