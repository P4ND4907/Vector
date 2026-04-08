import type { AppSettings, MonetizationAccessTier } from "@/types";

export type PremiumFeatureArea = "advanced-automation" | "premium-animations";

export const premiumAnimationCategories = new Set(["silly", "celebration", "sleepy"]);

export const isProAccessActive = (settings: Pick<AppSettings, "planAccess">) =>
  settings.planAccess === "pro";

export const getAccessTierLabel = (tier: MonetizationAccessTier) =>
  tier === "pro" ? "Companion Pro" : "Free";

export const getPremiumFeatureCopy = (feature: PremiumFeatureArea) => {
  if (feature === "advanced-automation") {
    return {
      eyebrow: "Companion Pro",
      title: "Advanced automation stays in Pro.",
      summary:
        "Free keeps pairing, reconnect, commands, and diagnostics wide open. Pro unlocks autonomous patrols, richer roam setup, and the data-heavy tools power users actually want.",
      freeHighlights: [
        "Manual controls, repair tools, and robot status stay free.",
        "You can still see saved automation data and understand what Pro adds."
      ],
      proHighlights: [
        "Start, pause, resume, and stop autonomous patrols.",
        "Configure safe-return behavior, snapshot capture, and stored telemetry."
      ]
    };
  }

  return {
    eyebrow: "Companion Pro",
    title: "Premium face and animation packs live in Pro.",
    summary:
      "Free keeps the everyday reactions easy to reach. Pro unlocks the richer personality packs, premium categories, and time-saving queue tools that make Vector feel more alive.",
    freeHighlights: [
      "Play core greeting, happy, curious, and idle reactions for free.",
      "Browse the full library so owners can see what is available."
    ],
    proHighlights: [
      "Unlock silly, celebration, and sleepy packs.",
      "Use queue mode and random mode for richer personality moments."
    ]
  };
};
