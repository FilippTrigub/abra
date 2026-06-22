import type { DashboardDeployment } from "@/lib/deployments";

/**
 * Plain module (no "use client") so this can be called from server
 * components — functions exported from a "use client" file can only be
 * rendered as components, not invoked directly during server rendering.
 */
export function canDeploy(deployment: DashboardDeployment | null) {
  return !deployment || deployment.status === "deleted" ||
    (deployment.status === "failed" && deployment.orchestration?.action !== "destroy");
}
