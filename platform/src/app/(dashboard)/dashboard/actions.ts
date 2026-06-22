"use server";

import { after } from "next/server";
import {
  createDeploymentRecord,
  destroyCurrentDeploymentForUser,
  dispatchDeploymentRequest,
} from "@/lib/deployments";
import { getUser } from "@/lib/auth/firebase-auth";
import { loadAgentConfig } from "@/lib/agent-config/service";
import {
  initialDeploymentFormState,
  type DeploymentFormState,
} from "./deployment-form-state";

const DEFAULT_ABRA_INSTANCE_REQUEST = {
  name: "Abra instance",
  environment: "production" as const,
  sourceRef: "current",
  notes: "",
};

export async function submitDeploymentRequest(
  previousState: DeploymentFormState,
  formData: FormData,
): Promise<DeploymentFormState> {
  void previousState;
  void formData;

  const { user, error } = await getUser();

  if (error || !user) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: "Your session expired. Sign in again to queue a deployment.",
    };
  }

  const agentConfig = await loadAgentConfig(user.id);
  if (!agentConfig) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: "Add a Telegram bot token and allowed user list before deploying Abra.",
    };
  }

  const { deployment, warning, created } = await createDeploymentRecord({
    authUserId: user.id,
    request: DEFAULT_ABRA_INSTANCE_REQUEST,
  });

  if (!created) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: warning ?? "An Abra instance already exists. Delete it before deploying another one.",
      warning,
      deployment,
    };
  }

  after(async () => {
    await dispatchDeploymentRequest(deployment.id, user.id);
  });

  return {
    ...initialDeploymentFormState,
    status: "success",
    message: "Abra instance deployment started.",
    warning,
    deployment,
  };
}

export async function deleteAbraInstance(
  previousState: DeploymentFormState,
): Promise<DeploymentFormState> {
  void previousState;

  const { user, error } = await getUser();

  if (error || !user) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: "Your session expired. Sign in again to delete this Abra instance.",
    };
  }

  const { deployment, warning, destroyed } = await destroyCurrentDeploymentForUser(user.id);

  if (!deployment) {
    return {
      ...initialDeploymentFormState,
      status: "error",
      message: "No Abra instance exists for this account.",
      warning,
    };
  }

  return {
    ...initialDeploymentFormState,
    status: destroyed ? "success" : "error",
    message: destroyed
      ? "Abra instance deletion started. The status box will update as AKS removes the runtime."
      : deployment.errorMessage ?? "Unable to delete this Abra instance.",
    warning,
    deployment,
  };
}
