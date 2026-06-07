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
  });

  it("keeps failed settings dirty and preserves restartRequired", async () => {
    const { default: SettingsPage } = await import("@/app/(dashboard)/dashboard/settings/page");

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
});
