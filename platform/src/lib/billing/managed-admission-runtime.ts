import { createHmac } from "node:crypto";

const RUNTIME_CREDENTIAL_SECRET_ENV = "ABRA_MANAGED_RUNTIME_CREDENTIAL_SECRET";

export interface ManagedAdmissionRuntimeConfig {
  enabled: true;
  url?: string;
  accountId: string;
  deploymentId: string;
  credential?: string;
}

function normalizeString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getManagedAdmissionCredentialSecret() {
  return normalizeString(process.env[RUNTIME_CREDENTIAL_SECRET_ENV]);
}

export function createManagedRuntimeCredential(input: {
  accountId: string;
  deploymentId: string;
  secret: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`${input.accountId}:${input.deploymentId}`)
    .digest("hex");
}

export function resolveManagedAdmissionRuntimeConfig(input: {
  accountId: string;
  deploymentId: string;
}): ManagedAdmissionRuntimeConfig | null {
  const url = normalizeString(process.env.ABRA_MANAGED_ADMISSION_URL);
  const secret = getManagedAdmissionCredentialSecret();

  if (!url && !secret) {
    return null;
  }

  return {
    enabled: true,
    accountId: input.accountId,
    deploymentId: input.deploymentId,
    ...(url ? { url } : {}),
    ...(secret
      ? {
          credential: createManagedRuntimeCredential({
            accountId: input.accountId,
            deploymentId: input.deploymentId,
            secret,
          }),
        }
      : {}),
  };
}
