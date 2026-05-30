"use server";

import { after } from "next/server";
import {
  createDeploymentRecord,
  dispatchDeploymentRequest,
  type DeploymentEnvironment,
} from "@/lib/deployments";
import { getUser } from "@/lib/auth/firebase-auth";
import {
  initialDeploymentFormState,
  type DeploymentFieldName,
  type DeploymentFormState,
} from "./deployment-form-state";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitDeploymentRequest(
  _previousState: DeploymentFormState,
  formData: FormData,
): Promise<DeploymentFormState> {
  const { user, error } = await getUser();

  if (error || !user) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: "Your session expired. Sign in again to queue a deployment.",
    };
  }

  const fields = {
    name: getString(formData, "name"),
    environment: getString(formData, "environment"),
    sourceRef: getString(formData, "sourceRef"),
    notes: getString(formData, "notes"),
  };

  const fieldErrors: Partial<Record<DeploymentFieldName, string>> = {};

  if (fields.name.length < 3 || fields.name.length > 60) {
    fieldErrors.name = "Use 3 to 60 characters for the deployment name.";
  }

  if (!(["preview", "staging", "production"] as const).includes(fields.environment as DeploymentEnvironment)) {
    fieldErrors.environment = "Choose preview, staging, or production.";
  }

  if (fields.sourceRef.length < 2 || fields.sourceRef.length > 120) {
    fieldErrors.sourceRef = "Enter a branch, tag, or version between 2 and 120 characters.";
  }

  if (fields.notes.length > 500) {
    fieldErrors.notes = "Keep rollout notes under 500 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fields: {
        name: fields.name,
        environment: (fields.environment as DeploymentEnvironment) || "preview",
        sourceRef: fields.sourceRef,
        notes: fields.notes,
      },
      fieldErrors,
    };
  }

  const { deployment, warning } = await createDeploymentRecord({
    authUserId: user.id,
    request: {
      name: fields.name,
      environment: fields.environment as DeploymentEnvironment,
      sourceRef: fields.sourceRef,
      notes: fields.notes,
    },
  });

  after(async () => {
    await dispatchDeploymentRequest(deployment.id, user.id);
  });

  return {
    ...initialDeploymentFormState,
    status: "success",
    message: `Deployment request for ${deployment.request.name} was queued.`,
    warning,
    deployment,
  };
}
