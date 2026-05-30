import type { DashboardDeployment } from "@/lib/deployments";

export interface DeploymentFormState {
  status: "idle" | "success" | "error";
  message: string | null;
  warning: string | null;
  deployment: DashboardDeployment | null;
}

export const initialDeploymentFormState: DeploymentFormState = {
  status: "idle",
  message: null,
  warning: null,
  deployment: null,
};
