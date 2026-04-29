import type { DashboardDeployment, DeploymentEnvironment } from "@/lib/deployments";

type FieldName = "name" | "environment" | "sourceRef" | "notes" | "mockOutcome";

export interface DeploymentFormState {
  status: "idle" | "success" | "error";
  message: string | null;
  warning: string | null;
  fields: {
    name: string;
    environment: DeploymentEnvironment;
    sourceRef: string;
    notes: string;
    mockOutcome: "succeeded" | "failed";
  };
  fieldErrors: Partial<Record<FieldName, string>>;
  deployment: DashboardDeployment | null;
}

export const initialDeploymentFormState: DeploymentFormState = {
  status: "idle",
  message: null,
  warning: null,
  fields: {
    name: "",
    environment: "preview",
    sourceRef: "main",
    notes: "",
    mockOutcome: "succeeded",
  },
  fieldErrors: {},
  deployment: null,
};

export type DeploymentFieldName = FieldName;
