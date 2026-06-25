import "server-only";

import Stripe from "stripe";

import { getStripeBillingConfig } from "./config";

let cachedStripe: Stripe | null = null;

export function getStripeClient() {
  if (cachedStripe === null) {
    cachedStripe = new Stripe(getStripeBillingConfig().secretKey, {
      appInfo: {
        name: "Abra Platform",
      },
      typescript: true,
    });
  }

  return cachedStripe;
}

export function resetStripeClientForTests() {
  if (process.env.NODE_ENV === "test") {
    cachedStripe = null;
  }
}
