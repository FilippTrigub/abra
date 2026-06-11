import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConfigSnapshot,
  SettingsKey,
  SettingsResponse,
} from "@/lib/settings/schema";

const loadUserSettings = vi.fn();
const updateUserSetting = vi.fn();
const revertToDefaults = vi.fn();
const loadRuntimeEnvSummaryAction = vi.fn();
const previewRuntimeEnvDotenvImport = vi.fn();
const saveRuntimeEnvFieldsAction = vi.fn();
const saveRuntimeEnvImportAction = vi.fn();
const applyRuntimeEnvAction = vi.fn();

vi.mock("@/lib/settings/actions", () => ({
  loadUserSettings,
  updateUserSetting,
  revertToDefaults,
}));

vi.mock("@/lib/agent-config/actions", () => ({
  loadUserAgentConfig: vi.fn().mockResolvedValue({
    configured: false,
    token: null,
    allowedUsers: null,
  }),
  saveUserAgentConfig: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/runtime-env/actions", () => ({
  loadRuntimeEnvSummaryAction,
  previewRuntimeEnvDotenvImport,
  saveRuntimeEnvFieldsAction,
  saveRuntimeEnvImportAction,
  applyRuntimeEnvAction,
}));

function buildSnapshot(
  overrides: Partial<ConfigSnapshot["values"]> = {},
): ConfigSnapshot {
  return {
    id: "snapshot-1",
    accountScope: "user-1",
    values: {
      defaultEnvironment: "preview",
      deploymentAutoPoll: true,
      deploymentPollInterval: 1500,
      notificationsEnabled: true,
      brandAccentColor: "coral",
      dashboardLocale: "en-US",
      ...overrides,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const runtimeSummary = {
  accountScope: "user-1",
  versionId: "ver_runtime_ui",
  createdAt: "2026-06-11T20:00:00.000Z",
  updatedAt: "2026-06-11T20:00:00.000Z",
  values: [],
};

const applyingDeploymentUpdate = {
  applied: false,
  status: "applying" as const,
  message: "Runtime environment values were saved and Abra is updating.",
  reason: null,
  warning: null,
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    loadUserSettings.mockResolvedValue({
      snapshot: buildSnapshot(),
      definitions: [],
      persistence: "database",
      warning: null,
    } satisfies SettingsResponse);

    updateUserSetting.mockImplementation(async ({ key }: { key: SettingsKey }) => {
      if (key === "defaultEnvironment") {
        return {
          success: true,
          snapshot: null,
          errors: [],
          restartRequired: true,
          warning: null,
        };
      }

      if (key === "brandAccentColor") {
        return {
          success: false,
          snapshot: null,
          errors: [{ key, message: "Could not save brand accent color." }],
          restartRequired: false,
          warning: null,
        };
      }

      return {
        success: true,
        snapshot: null,
        errors: [],
        restartRequired: false,
        warning: null,
      };
    });

    loadRuntimeEnvSummaryAction.mockResolvedValue({
      success: true,
      summary: null,
      error: null,
    });
    previewRuntimeEnvDotenvImport.mockResolvedValue({
      success: true,
      accepted: [],
      rejected: [],
      warnings: [],
      error: null,
    });
    saveRuntimeEnvFieldsAction.mockResolvedValue({
      success: true,
      summary: runtimeSummary,
      versionId: "ver_runtime_ui",
      eventId: "evt_runtime_ui",
      errors: [],
      error: null,
      deploymentUpdate: applyingDeploymentUpdate,
    });
    saveRuntimeEnvImportAction.mockResolvedValue({
      success: true,
      summary: runtimeSummary,
      versionId: "ver_runtime_ui",
      eventId: "evt_runtime_ui",
      errors: [],
      accepted: [],
      rejected: [],
      warnings: [],
      error: null,
      deploymentUpdate: applyingDeploymentUpdate,
    });
    applyRuntimeEnvAction.mockResolvedValue({
      success: true,
      applied: false,
      status: "applying",
      message: "Runtime environment values were saved and Abra is updating.",
      summary: runtimeSummary,
      error: null,
    });
  });

  it("keeps failed settings dirty and preserves restartRequired", async () => {
    const realSetTimeout = globalThis.setTimeout;
    type SetTimeoutHandler = Parameters<typeof setTimeout>[0];
    type SetTimeoutArgs = Parameters<typeof setTimeout> extends [
      SetTimeoutHandler,
      number?,
      ...infer Rest,
    ]
      ? Rest
      : never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (handler: SetTimeoutHandler, _timeout?: number, ...args: SetTimeoutArgs) =>
        realSetTimeout(handler, 0, ...args),
    );
    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");
    try {
      render(<SettingsPage />);

      await screen.findByLabelText("Default deployment environment");

      fireEvent.change(screen.getByLabelText("Default deployment environment"), {
        target: { value: "staging" },
      });
      fireEvent.change(screen.getByLabelText("Brand accent color"), {
        target: { value: "violet" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(2);
      });

      expect(screen.getByText("Restart required")).toBeTruthy();

      await waitFor(
        () => {
          expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
        },
        { timeout: 5000 },
      );
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("does not raise restartRequired when saving unrelated dirty settings", async () => {
    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");

    render(<SettingsPage />);

    await screen.findByLabelText("Default deployment environment");

    fireEvent.click(screen.getByLabelText("Auto-poll deployment status"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateUserSetting).toHaveBeenCalledTimes(1);
    });

    expect(updateUserSetting).toHaveBeenCalledWith({
      key: "deploymentAutoPoll",
      value: false,
    });
    expect(screen.queryByText("Restart required")).toBeNull();
  });

  it("clears restartRequired after a later successful save or revert", async () => {
    const realSetTimeout = globalThis.setTimeout;
    type SetTimeoutHandler = Parameters<typeof setTimeout>[0];
    type SetTimeoutArgs = Parameters<typeof setTimeout> extends [
      SetTimeoutHandler,
      number?,
      ...infer Rest,
    ]
      ? Rest
      : never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (handler: SetTimeoutHandler, _timeout?: number, ...args: SetTimeoutArgs) =>
        realSetTimeout(handler, 0, ...args),
    );

    updateUserSetting
      .mockResolvedValueOnce({
        success: true,
        snapshot: buildSnapshot({ defaultEnvironment: "staging" }),
        errors: [],
        restartRequired: true,
        warning: null,
      })
      .mockResolvedValueOnce({
        success: true,
        snapshot: buildSnapshot(),
        errors: [],
        restartRequired: true,
        warning: null,
      })
      .mockResolvedValueOnce({
        success: true,
        snapshot: buildSnapshot({ defaultEnvironment: "staging" }),
        errors: [],
        restartRequired: true,
        warning: null,
      });

    revertToDefaults.mockResolvedValue({
      success: true,
      snapshot: buildSnapshot(),
      errors: [],
      restartRequired: false,
      warning: null,
    });

    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");
    try {
      render(<SettingsPage />);

      await screen.findByLabelText("Default deployment environment");

      fireEvent.change(screen.getByLabelText("Default deployment environment"), {
        target: { value: "staging" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByText("Restart required")).toBeTruthy();

      fireEvent.change(screen.getByLabelText("Default deployment environment"), {
        target: { value: "preview" },
      });

      await waitFor(() => {
        expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(2);
      });

      expect(screen.queryByText("Restart required")).toBeNull();

      fireEvent.change(screen.getByLabelText("Default deployment environment"), {
        target: { value: "staging" },
      });

      await waitFor(() => {
        expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(3);
      });

      expect(screen.getByText("Restart required")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

      await waitFor(() => {
        expect(revertToDefaults).toHaveBeenCalledTimes(1);
      });

      expect(screen.queryByText("Restart required")).toBeNull();
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("clears stale field errors after a successful retry and keeps local-only saves dirty", async () => {
    const realSetTimeout = globalThis.setTimeout;
    type SetTimeoutHandler = Parameters<typeof setTimeout>[0];
    type SetTimeoutArgs = Parameters<typeof setTimeout> extends [
      SetTimeoutHandler,
      number?,
      ...infer Rest,
    ]
      ? Rest
      : never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (handler: SetTimeoutHandler, _timeout?: number, ...args: SetTimeoutArgs) =>
        realSetTimeout(handler, 0, ...args),
    );

    updateUserSetting
      .mockResolvedValueOnce({
        success: false,
        snapshot: null,
        errors: [{ key: "brandAccentColor", message: "Could not save brand accent color." }],
        restartRequired: false,
        warning: null,
      })
      .mockResolvedValueOnce({
        success: true,
        snapshot: null,
        errors: [],
        restartRequired: false,
        warning: "Firestore storage is unavailable. Changes are only reflected in memory.",
      })
      .mockResolvedValueOnce({
        success: true,
        snapshot: buildSnapshot({ brandAccentColor: "violet" }),
        errors: [],
        restartRequired: false,
        warning: null,
      });

    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");
    try {
      render(<SettingsPage />);

      await screen.findByLabelText("Default deployment environment");

      fireEvent.change(screen.getByLabelText("Brand accent color"), {
        target: { value: "violet" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByText("Could not save brand accent color.")).toBeTruthy();

      await waitFor(() => {
        expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(2);
      });

      expect(screen.queryByText("Could not save brand accent color.")).toBeNull();
      expect(screen.getByText("In-memory fallback")).toBeTruthy();
      expect(screen.queryByText("Database")).toBeNull();
      expect(
        screen.getAllByText("Firestore storage is unavailable. Changes are only reflected in memory."),
      ).not.toHaveLength(0);

      await waitFor(() => {
        expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
      });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(updateUserSetting).toHaveBeenCalledTimes(3);
      });

      expect(screen.getByText("Database")).toBeTruthy();
      expect(screen.queryByText("In-memory fallback")).toBeNull();
      expect(screen.queryByText("Firestore storage is unavailable. Changes are only reflected in memory.")).toBeNull();
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("keeps reverted settings dirty when revert falls back to a local-only warning", async () => {
    const realSetTimeout = globalThis.setTimeout;
    type SetTimeoutHandler = Parameters<typeof setTimeout>[0];
    type SetTimeoutArgs = Parameters<typeof setTimeout> extends [
      SetTimeoutHandler,
      number?,
      ...infer Rest,
    ]
      ? Rest
      : never;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (handler: SetTimeoutHandler, _timeout?: number, ...args: SetTimeoutArgs) =>
        realSetTimeout(handler, 0, ...args),
    );

    revertToDefaults.mockResolvedValue({
      success: true,
      snapshot: null,
      errors: [],
      restartRequired: false,
      warning: "Firestore storage is unavailable. Defaults were restored in memory.",
    });

    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");
    try {
      render(<SettingsPage />);

      await screen.findByLabelText("Default deployment environment");

      fireEvent.click(screen.getByLabelText("Auto-poll deployment status"));
      fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

      await waitFor(() => {
        expect(revertToDefaults).toHaveBeenCalledTimes(1);
      });

      expect((screen.getByLabelText("Auto-poll deployment status") as HTMLInputElement).checked).toBe(true);
      expect(screen.getByText("In-memory fallback")).toBeTruthy();
      expect(screen.queryByText("Database")).toBeNull();
      await waitFor(() => {
        expect(
          screen.getAllByText("Firestore storage is unavailable. Defaults were restored in memory."),
        ).not.toHaveLength(0);
        expect(screen.queryByText("All settings saved")).toBeNull();
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("uses save action deployment status for field saves without calling explicit apply", async () => {
    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");

    render(<SettingsPage />);

    const bufferInput = await screen.findByLabelText("Buffer API key");
    fireEvent.change(bufferInput, { target: { value: "buf_ui_secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save runtime values" }));

    await waitFor(() => {
      expect(saveRuntimeEnvFieldsAction).toHaveBeenCalledTimes(1);
    });

    expect(saveRuntimeEnvFieldsAction).toHaveBeenCalledWith({
      values: { BUFFER_API_KEY: "buf_ui_secret" },
    });
    expect(applyRuntimeEnvAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("Applying to Abra")).not.toHaveLength(0);
    expect(screen.queryByText("buf_ui_secret")).toBeNull();
  });

  it("uses save action deployment status for dotenv imports without calling explicit apply", async () => {
    previewRuntimeEnvDotenvImport.mockResolvedValueOnce({
      success: true,
      accepted: [
        {
          key: "BUFFER_API_KEY",
          lineNumber: 1,
          label: "Buffer API key",
          group: "contentMedia",
        },
      ],
      rejected: [],
      warnings: [],
      error: null,
    });
    saveRuntimeEnvImportAction.mockResolvedValueOnce({
      success: true,
      summary: runtimeSummary,
      versionId: "ver_runtime_ui",
      eventId: "evt_runtime_ui",
      errors: [],
      accepted: [
        {
          key: "BUFFER_API_KEY",
          lineNumber: 1,
          label: "Buffer API key",
          group: "contentMedia",
        },
      ],
      rejected: [],
      warnings: [],
      error: null,
      deploymentUpdate: applyingDeploymentUpdate,
    });
    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");

    render(<SettingsPage />);

    await screen.findByLabelText("Buffer API key");
    fireEvent.click(screen.getByRole("button", { name: ".env import" }));
    fireEvent.change(screen.getByLabelText("Paste .env content"), {
      target: { value: "BUFFER_API_KEY=buf_import_ui_secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));

    await waitFor(() => {
      expect(previewRuntimeEnvDotenvImport).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));

    await waitFor(() => {
      expect(saveRuntimeEnvImportAction).toHaveBeenCalledTimes(1);
    });

    expect(saveRuntimeEnvImportAction).toHaveBeenCalledWith("BUFFER_API_KEY=buf_import_ui_secret");
    expect(applyRuntimeEnvAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("Applying to Abra")).not.toHaveLength(0);
    expect(screen.queryByText("buf_import_ui_secret")).toBeNull();
  });
});
