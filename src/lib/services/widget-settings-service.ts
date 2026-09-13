import { withMockDelay } from "./utils";

export type WidgetLauncherMode = "default" | "manual";
export type WidgetPlacement = "bottom-right" | "bottom-left";

export type WidgetInstallSettings = {
  projectId: string;
  launcherMode: WidgetLauncherMode;
  placement: WidgetPlacement;
  showUnreadBadge: boolean;
  theme: "inherit" | "light" | "dark";
};

let widgetSettings: WidgetInstallSettings = {
  projectId: "sb_acme_8e2f",
  launcherMode: "default",
  placement: "bottom-right",
  showUnreadBadge: true,
  theme: "inherit",
};

/**
 * A deliberately isolated local boundary for the embed settings. A real
 * backend can replace this module without changing the installer UI.
 */
export const widgetSettingsService = {
  async get(): Promise<WidgetInstallSettings> {
    return withMockDelay(() => ({ ...widgetSettings }), 260);
  },
  async update(patch: Partial<WidgetInstallSettings>): Promise<WidgetInstallSettings> {
    return withMockDelay(() => {
      widgetSettings = { ...widgetSettings, ...patch };
      return { ...widgetSettings };
    }, 420);
  },
};
