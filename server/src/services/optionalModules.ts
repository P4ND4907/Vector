import type {
  FeatureFlagsRecord,
  OptionalFeatureListItemRecord,
  OptionalModulesRecord
} from "../robot/types.js";

interface OptionalModuleEnv {
  openaiApiKey: string;
}

const moduleHasFeature = (
  modules: OptionalModulesRecord,
  moduleKey: keyof OptionalModulesRecord | string,
  feature: string
) => Boolean(modules[moduleKey]?.features.includes(feature));

export const optionalModules: OptionalModulesRecord = {
  dashboard: {
    enabled: true,
    description: "Main control center UI",
    features: [
      "battery_status",
      "movement_joystick",
      "command_history",
      "routine_builder",
      "camera_panel_optional"
    ],
    endpoints: ["/robot/status", "/robot/move", "/robot/dock", "/robot/stop"]
  },
  wirepodExpansion: {
    enabled: true,
    description: "Custom app endpoints layered on top of WirePod",
    features: [
      "routine_start",
      "business_notify",
      "ai_chat",
      "automation_trigger",
      "status_broadcast"
    ],
    endpoints: ["/routine/start", "/business/notify", "/ai/chat", "/automation/trigger"]
  },
  aiBrain: {
    enabled: true,
    description: "Chat, memory, and context-aware responses",
    features: [
      "chat_responses",
      "user_memory",
      "conversation_context",
      "fallback_to_basic_commands"
    ],
    endpoints: ["/ai/chat", "/ai/memory/save", "/ai/memory/get"]
  }
};

export const buildFeatureFlags = (modules: OptionalModulesRecord): FeatureFlagsRecord => ({
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

export const buildOptionalFeatureList = (
  modules: OptionalModulesRecord
): OptionalFeatureListItemRecord[] => {
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

export const buildAvailableOptionalModules = (
  modules: OptionalModulesRecord,
  env: OptionalModuleEnv
): OptionalModulesRecord => ({
  ...modules,
  aiBrain: {
    ...modules.aiBrain,
    features: env.openaiApiKey
      ? modules.aiBrain.features
      : modules.aiBrain.features.filter((feature) => feature !== "conversation_context")
  }
});

export const buildOptionalModuleSnapshot = (
  modules: OptionalModulesRecord,
  env: OptionalModuleEnv
) => {
  const availableModules = buildAvailableOptionalModules(modules, env);

  return {
    optionalModules: availableModules,
    featureFlags: buildFeatureFlags(availableModules),
    optionalFeatureList: buildOptionalFeatureList(availableModules)
  };
};
