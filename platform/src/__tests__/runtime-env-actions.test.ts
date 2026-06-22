import { beforeEach, describe, expect, test, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const loadRuntimeEnvSummaryMock = vi.fn();
const saveRuntimeEnvFieldsMock = vi.fn();
const saveRuntimeEnvImportMock = vi.fn();
const deleteRuntimeEnvKeyMock = vi.fn();
const rollbackRuntimeEnvVersionMock = vi.fn();
const updateCurrentDeploymentRuntimeEnvForUserMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
}));

vi.mock("@/lib/runtime-env/service", () => ({
  loadRuntimeEnvSummary: loadRuntimeEnvSummaryMock,
  saveRuntimeEnvFields: saveRuntimeEnvFieldsMock,
  saveRuntimeEnvImport: saveRuntimeEnvImportMock,
  deleteRuntimeEnvKey: deleteRuntimeEnvKeyMock,
  rollbackRuntimeEnvVersion: rollbackRuntimeEnvVersionMock,
}));

vi.mock("@/lib/deployments", () => ({
  updateCurrentDeploymentRuntimeEnvForUser: updateCurrentDeploymentRuntimeEnvForUserMock,
}));

const redactedSummary = {
  accountScope: "user-1",
  versionId: "ver_1",
  createdAt: "2026-06-11T20:00:00.000Z",
  updatedAt: "2026-06-11T20:00:00.000Z",
  values: [
    {
      key: "BUFFER_API_KEY",
      configured: true,
      fingerprint: "hmac-sha256:abc123abc123abcd",
      source: "manual",
      createdAt: "2026-06-11T20:00:00.000Z",
      updatedAt: "2026-06-11T20:00:00.000Z",
    },
  ],
};

const mutationResult = {
  success: true,
  summary: redactedSummary,
  versionId: "ver_1",
  eventId: "evt_1",
  errors: [],
};

const noRuntimeDeploymentUpdate = {
  applied: false,
  status: "saved" as const,
  message: "Runtime environment values are saved. Deploy Abra to apply them.",
  reason: "No runtime deployed",
  warning: null,
};

describe("runtime env server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    loadRuntimeEnvSummaryMock.mockResolvedValue(redactedSummary);
    saveRuntimeEnvFieldsMock.mockResolvedValue(mutationResult);
    saveRuntimeEnvImportMock.mockResolvedValue(mutationResult);
    deleteRuntimeEnvKeyMock.mockResolvedValue(mutationResult);
    rollbackRuntimeEnvVersionMock.mockResolvedValue(mutationResult);
    updateCurrentDeploymentRuntimeEnvForUserMock.mockResolvedValue({
      applied: false,
      status: "saved",
      reason: "No runtime deployed",
      deployment: null,
      warning: null,
    });
  });

  test("loads a redacted summary through authenticated account scope", async () => {
    const { loadRuntimeEnvSummaryAction } = await import("@/lib/runtime-env/actions");

    const result = await loadRuntimeEnvSummaryAction();

    expect(requireApiAuthMock).toHaveBeenCalledTimes(1);
    expect(loadRuntimeEnvSummaryMock).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ success: true, summary: redactedSummary, error: null });
  });

  test("returns structured unauthenticated save errors without calling service methods", async () => {
    requireApiAuthMock.mockResolvedValue({ error: "Unauthorized" });
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: { BUFFER_API_KEY: "buf_plain_secret" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      code: "UNAUTHORIZED",
      message: "Sign in to update runtime environment values.",
    });
    expect(result.deploymentUpdate).toBeNull();
    expect(saveRuntimeEnvFieldsMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("buf_plain_secret");
  });

  test("previews dotenv imports without returning accepted plaintext or persistable values", async () => {
    const { previewRuntimeEnvDotenvImport } = await import("@/lib/runtime-env/actions");

    const result = await previewRuntimeEnvDotenvImport(`
BUFFER_API_KEY=buf_super_secret
RANDOM_SECRET=random_plain_secret
KUBECONFIG_B64=reserved_plain_secret
sk_live_malformed_secret
`);

    expect(result.accepted).toEqual([
      {
        key: "BUFFER_API_KEY",
        lineNumber: 2,
        label: "Buffer API key",
        group: "contentMedia",
      },
    ]);
    expect(result.rejected).toEqual([
      expect.objectContaining({ code: "unknown-key", key: "RANDOM_SECRET", lineNumber: 3 }),
      expect.objectContaining({ code: "reserved-key", key: "KUBECONFIG_B64", lineNumber: 4 }),
      expect.objectContaining({ code: "missing-assignment", key: null, lineNumber: 5 }),
    ]);
    expect(result).not.toHaveProperty("persistableValues");
    expect(result.accepted[0]).not.toHaveProperty("value");
    expect(JSON.stringify(result)).not.toContain("buf_super_secret");
    expect(JSON.stringify(result)).not.toContain("random_plain_secret");
    expect(JSON.stringify(result)).not.toContain("reserved_plain_secret");
    expect(JSON.stringify(result)).not.toContain("sk_live_malformed_secret");
  });

  test("saves manual fields through the service and returns its redacted summary", async () => {
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const input = { values: { BUFFER_API_KEY: "buf_plain_secret" } };
    const result = await saveRuntimeEnvFieldsAction(input);

    expect(saveRuntimeEnvFieldsMock).toHaveBeenCalledWith("user-1", input);
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenCalledTimes(1);
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenCalledWith("user-1", "ver_1");
    expect(result).toEqual({
      ...mutationResult,
      error: null,
      deploymentUpdate: noRuntimeDeploymentUpdate,
    });
    expect(JSON.stringify(result)).not.toContain("buf_plain_secret");
  });

  test("imports only accepted dotenv values and returns rejected metadata without raw values", async () => {
    const { saveRuntimeEnvImportAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvImportAction(`
BUFFER_API_KEY=buf_import_secret
RANDOM_SECRET=random_plain_secret
OBSIDIAN_VAULT_PATH=@abra-home
`);

    expect(saveRuntimeEnvImportMock).toHaveBeenCalledWith("user-1", {
      values: {
        BUFFER_API_KEY: "buf_import_secret",
        OBSIDIAN_VAULT_PATH: "@abra-home",
      },
    });
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenCalledTimes(1);
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenCalledWith("user-1", "ver_1");
    expect(result.summary).toBe(redactedSummary);
    expect(result.deploymentUpdate).toEqual(noRuntimeDeploymentUpdate);
    expect(result.rejected).toEqual([
      expect.objectContaining({ code: "unknown-key", key: "RANDOM_SECRET", lineNumber: 3 }),
    ]);
    expect(result.accepted.map((entry) => entry.key)).toEqual(["BUFFER_API_KEY", "OBSIDIAN_VAULT_PATH"]);
    expect(result).not.toHaveProperty("persistableValues");
    expect(JSON.stringify(result)).not.toContain("buf_import_secret");
    expect(JSON.stringify(result)).not.toContain("random_plain_secret");
    expect(JSON.stringify(result)).not.toContain("@abra-home");
  });

  test("imports full dotenv templates by skipping blank accepted values", async () => {
    const { saveRuntimeEnvImportAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvImportAction(`
BUFFER_API_KEY=buf_import_secret
FAL_API_KEY=
OBSIDIAN_VAULT_PATH=
POSTHOG_HOST=https://app.posthog.com
`);

    expect(saveRuntimeEnvImportMock).toHaveBeenCalledWith("user-1", {
      values: {
        BUFFER_API_KEY: "buf_import_secret",
        POSTHOG_HOST: "https://app.posthog.com",
      },
    });
    expect(result.success).toBe(true);
    expect(result.accepted.map((entry) => entry.key)).toEqual([
      "BUFFER_API_KEY",
      "FAL_API_KEY",
      "OBSIDIAN_VAULT_PATH",
      "POSTHOG_HOST",
    ]);
    expect(JSON.stringify(result)).not.toContain("buf_import_secret");
    expect(JSON.stringify(result)).not.toContain("https://app.posthog.com");
  });

  test("delete and rollback delegate to service methods and return redacted summaries", async () => {
    const { deleteRuntimeEnvKeyAction, rollbackRuntimeEnvVersionAction } = await import("@/lib/runtime-env/actions");

    const deleteResult = await deleteRuntimeEnvKeyAction({ key: "BUFFER_API_KEY" });
    const rollbackResult = await rollbackRuntimeEnvVersionAction({ versionId: "ver_previous" });

    expect(deleteRuntimeEnvKeyMock).toHaveBeenCalledWith("user-1", { key: "BUFFER_API_KEY" });
    expect(rollbackRuntimeEnvVersionMock).toHaveBeenCalledWith("user-1", { versionId: "ver_previous" });
    expect(deleteResult).toEqual({
      ...mutationResult,
      error: null,
      deploymentUpdate: noRuntimeDeploymentUpdate,
    });
    expect(rollbackResult).toEqual({
      ...mutationResult,
      error: null,
      deploymentUpdate: noRuntimeDeploymentUpdate,
    });
  });

  test("save action exposes applying deployment status without returning plaintext", async () => {
    updateCurrentDeploymentRuntimeEnvForUserMock.mockResolvedValue({
      applied: false,
      status: "applying",
      reason: null,
      deployment: { id: "abra-instance" },
      warning: null,
    });
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: { BUFFER_API_KEY: "buf_plain_secret" },
    });

    expect(result.deploymentUpdate).toEqual({
      applied: false,
      status: "applying",
      message: "Runtime environment values were saved and Abra is updating.",
      reason: null,
      warning: null,
    });
    expect(JSON.stringify(result)).not.toContain("buf_plain_secret");
  });

  test("apply action delegates deployment update and exposes a safe unapplied surface", async () => {
    const { applyRuntimeEnvAction } = await import("@/lib/runtime-env/actions");

    const result = await applyRuntimeEnvAction();

    expect(loadRuntimeEnvSummaryMock).toHaveBeenCalledWith("user-1");
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenCalledWith("user-1", "ver_1");
    expect(result).toEqual({
      success: true,
      applied: false,
      status: "saved",
      message: "Runtime environment values are saved. Deploy Abra to apply them.",
      summary: redactedSummary,
      error: null,
    });
  });

  test("apply action exposes explicit applying status for queued deployment updates", async () => {
    updateCurrentDeploymentRuntimeEnvForUserMock.mockResolvedValue({
      applied: false,
      status: "applying",
      reason: null,
      deployment: { id: "abra-instance" },
      warning: null,
    });
    const { applyRuntimeEnvAction } = await import("@/lib/runtime-env/actions");

    const result = await applyRuntimeEnvAction();

    expect(result).toEqual({
      success: true,
      applied: false,
      status: "applying",
      message: "Runtime environment values were saved and Abra is updating.",
      summary: redactedSummary,
      error: null,
    });
  });
});
