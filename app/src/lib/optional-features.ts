import type {
  FeatureFlags,
  OptionalFeatureListItem,
  OptionalModules
} from "@/types";

const moduleHasFeature = (modules: OptionalModules, moduleKey: keyof OptionalModules | string, feature: string) =>
  Boolean(modules[moduleKey]?.features.includes(feature));

export const buildFeatureFlags = (modules: OptionalModules): FeatureFlags => ({
  aiBrain: modules.aiBrain.enabled,
  dashboard: modules.dashboard.enabled,
  wirepodExpansion: modules.wirepodExpansion.enabled,
  liveCamera: false,
  businessNotifications:
    modules.wirepodExpansion.enabled && moduleHasFeature(modules, "wirepodExpansion", "business_notify"),
  memory: modules.aiBrain.enabled && moduleHasFeature(modules, "aiBrain", "user_memory"),
  routines:
    (modules.dashboard.enabled && moduleHasFeature(modules, "dashboard", "routine_builder")) ||
    (modules.wirepodExpansion.enabled && moduleHasFeature(modules, "wirepodExpansion", "routine_start"))
});

export const buildOptionalFeatureList = (modules: OptionalModules): OptionalFeatureListItem[] => {
  const flags = buildFeatureFlags(modules);

  return [
    {
      name: "AI Brain",
      enabled: flags.aiBrain,
      value: "Natural chat, memory, context"
    },
    {
      name: "Dashboard",
      enabled: flags.dashboard,
      value: "Battery, movement, history, routines"
    },
    {
      name: "WirePod Expansion",
      enabled: flags.wirepodExpansion,
      value: "Custom endpoints and automations"
    },
    {
      name: "Live Camera",
      enabled: flags.liveCamera,
      value: "Only if your current stack supports stream access"
    },
    {
      name: "Business Notifications",
      enabled: flags.businessNotifications,
      value: "Announce bookings, reminders, messages"
    },
    {
      name: "Routine Builder",
      enabled: flags.routines,
      value: "Chain actions together"
    }
  ];
};

export const formatModuleName = (moduleKey: string) =>
  moduleKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const formatFeatureFlagName = (flag: string) => flag.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

export const sortOptionalModuleEntries = (optionalModules: OptionalModules) =>
  Object.entries(optionalModules).sort(([leftKey], [rightKey]) => {
    if (leftKey === "dashboard") {
      return -1;
    }

    if (rightKey === "dashboard") {
      return 1;
    }

    if (leftKey === "aiBrain") {
      return -1;
    }

    if (rightKey === "aiBrain") {
      return 1;
    }

    return leftKey.localeCompare(rightKey);
  });
