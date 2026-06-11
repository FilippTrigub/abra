import { beforeEach, describe, expect, test, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const saveRuntimeEnvFieldsMock = vi.fn();
const saveRuntimeEnvImportMock = vi.fn();
const deleteRuntimeEnvKeyMock = vi.fn();
const rollbackRuntimeEnvVersionMock = vi.fn();
const updateCurrentDeploymentRuntimeEnvForUserMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
}));

vi.mock("@/lib/runtime-env/service", () => ({
  loadRuntimeEnvSummary: vi.fn(),
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
  versionId: "ver_edge",
  createdAt: "2026-06-11T20:00:00.000Z",
  updatedAt: "2026-06-11T20:00:00.000Z",
  values: [],
};

function mutationResult(versionId: string) {
  return {
    success: true,
    summary: { ...redactedSummary, versionId },
    versionId,
    eventId: `evt_${versionId}`,
    errors: [],
  };
}

describe("runtime env edge-case hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    saveRuntimeEnvFieldsMock.mockResolvedValue(mutationResult("ver_save"));
    saveRuntimeEnvImportMock.mockResolvedValue(mutationResult("ver_import"));
    deleteRuntimeEnvKeyMock.mockResolvedValue(mutationResult("ver_delete"));
    rollbackRuntimeEnvVersionMock.mockResolvedValue(mutationResult("ver_rollback"));
    updateCurrentDeploymentRuntimeEnvForUserMock.mockResolvedValue({
      applied: false,
      status: "saved",
      reason: "No runtime deployed",
      deployment: null,
      warning: null,
    });
  });

  test("rejects empty manual saves before service persistence and points users to delete", async () => {
    const localSecretInput = "";
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: { BUFFER_API_KEY: localSecretInput },
    });

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      code: "INVALID_INPUT",
      message: "Runtime environment value for BUFFER_API_KEY cannot be empty. Use delete to remove a saved value.",
    });
    expect(saveRuntimeEnvFieldsMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("buf_");
  });

  test("rejects empty dotenv import values before service persistence", async () => {
    const { saveRuntimeEnvImportAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvImportAction(`
BUFFER_API_KEY=
FAL_API_KEY=fal_supported
`);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_INPUT");
    expect(result.error?.message).toContain("BUFFER_API_KEY");
    expect(result.error?.message).toContain("Use delete");
    expect(result.accepted.map((entry) => entry.key)).toEqual(["BUFFER_API_KEY", "FAL_API_KEY"]);
    expect(saveRuntimeEnvImportMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("fal_supported");
  });

  test("rejects oversized preview and import content before persistence", async () => {
    const {
      MAX_RUNTIME_ENV_DOTENV_IMPORT_BYTES,
      previewRuntimeEnvDotenvImport,
      saveRuntimeEnvImportAction,
    } = await import("@/lib/runtime-env/actions");
    const oversizedContent = `BUFFER_API_KEY=${"x".repeat(MAX_RUNTIME_ENV_DOTENV_IMPORT_BYTES)}`;

    const preview = await previewRuntimeEnvDotenvImport(oversizedContent);
    const imported = await saveRuntimeEnvImportAction(oversizedContent);

    expect(preview).toEqual({
      success: false,
      accepted: [],
      rejected: [],
      warnings: [],
      error: {
        code: "INVALID_INPUT",
        message: "Runtime environment import is too large. Paste at most 64 KiB.",
      },
    });
    expect(imported.success).toBe(false);
    expect(imported.error).toEqual(preview.error);
    expect(imported.accepted).toEqual([]);
    expect(saveRuntimeEnvImportMock).not.toHaveBeenCalled();
    expect(JSON.stringify(preview)).not.toContain("xxx");
  });

  test("keeps duplicate dotenv warnings deterministic and persists the last supported value", async () => {
    const { saveRuntimeEnvImportAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvImportAction(`
BUFFER_API_KEY=buf_old
FAL_API_KEY=fal_value
BUFFER_API_KEY=buf_new
BUFFER_API_KEY=buf_final
`);

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      {
        code: "duplicate-key",
        key: "BUFFER_API_KEY",
        lineNumber: 4,
        message: "Duplicate environment variable; the last supported value wins.",
      },
      {
        code: "duplicate-key",
        key: "BUFFER_API_KEY",
        lineNumber: 5,
        message: "Duplicate environment variable; the last supported value wins.",
      },
    ]);
    expect(saveRuntimeEnvImportMock).toHaveBeenCalledWith("user-1", {
      values: {
        BUFFER_API_KEY: "buf_final",
        FAL_API_KEY: "fal_value",
      },
    });
    expect(JSON.stringify(result)).not.toContain("buf_final");
    expect(JSON.stringify(result)).not.toContain("fal_value");
  });

  test("delete and rollback queue deployment updates with resulting version ids", async () => {
    const { deleteRuntimeEnvKeyAction, rollbackRuntimeEnvVersionAction } = await import("@/lib/runtime-env/actions");

    const deleted = await deleteRuntimeEnvKeyAction({ key: "BUFFER_API_KEY" });
    const rolledBack = await rollbackRuntimeEnvVersionAction({ versionId: "ver_previous" });

    expect(deleted.success).toBe(true);
    expect(rolledBack.success).toBe(true);
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenNthCalledWith(1, "user-1", "ver_delete");
    expect(updateCurrentDeploymentRuntimeEnvForUserMock).toHaveBeenNthCalledWith(2, "user-1", "ver_rollback");
  });

  test("redacts plaintext from thrown service errors", async () => {
    const localSecretInput = "buf_service_throw_secret";
    saveRuntimeEnvFieldsMock.mockRejectedValue(new Error(`failed to save ${localSecretInput}`));
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: { BUFFER_API_KEY: localSecretInput },
    });

    expect(result).toEqual({
      success: false,
      summary: null,
      versionId: null,
      eventId: null,
      errors: ["Unable to update runtime environment values."],
      error: {
        code: "SERVICE_ERROR",
        message: "Unable to update runtime environment values.",
      },
      deploymentUpdate: null,
    });
    expect(JSON.stringify(result)).not.toContain(localSecretInput);
  });
});
