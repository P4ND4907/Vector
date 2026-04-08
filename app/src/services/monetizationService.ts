import { getAdSenseConfig } from "@/lib/adsense";
import { isMobileShellLikeRuntime } from "@/lib/runtime-target";
import { getJson } from "@/services/apiClient";
import type { MonetizationOverview } from "@/types";

const buildFallbackOverview = (): MonetizationOverview => ({
  headline: "Keep the app generous for new owners, then make Pro feel like the easy yes.",
  summary:
    "Free should get owners paired, reconnected, and using Vector daily. Pro should save time, remove friction, and add the premium personality layer heavy users will actually want.",
  supportEmail: "",
  plans: [
    {
      id: "free",
      name: "Free",
      priceLabel: "$0",
      cadence: "free",
      summary: "Keep the whole core owner loop free so new users can pair, reconnect, use commands, and trust the app before you ever ask them to upgrade.",
      highlights: [
        "Pairing, reconnect, dashboard, controls, and diagnostics",
        "Voice and typed commands plus basic teach mode",
        "Free on desktop and mobile, with hosted-web ads only when applicable"
      ],
      status: "live",
      note: "Do not paywall the trust-building features. If owners cannot get paired, repaired, and talking to Vector for free, they will leave before they ever consider Pro."
    },
    {
      id: "pro",
      name: "Companion Pro",
      priceLabel: "$4.99 / month",
      cadence: "monthly",
      summary: "The upgrade for people who use Vector often and want the smoother, deeper, more magical version of the app every day.",
      highlights: [
        "Advanced automation, patrol presets, and richer teach-mode tools",
        "Premium personality packs, face animations, and faster feature drops",
        "No hosted-web ads plus priority support and backup-style extras"
      ],
      status: "needs-config",
      ctaLabel: "Add desktop/web checkout",
      desktopWebOnly: true,
      note: "Pro should feel like saved time plus extra delight, not like you locked away the basics."
    },
    {
      id: "setup",
      name: "Setup Concierge",
      priceLabel: "$79 one time",
      cadence: "one-time",
      summary: "Sell a done-with-you setup or repair session before subscriptions are fully dialed in.",
      highlights: [
        "Remote onboarding or rescue call",
        "Great for first-time Vector owners",
        "Fastest service revenue you can start charging for"
      ],
      status: "needs-config",
      ctaLabel: "Add booking or payment link",
      desktopWebOnly: true
    },
    {
      id: "studio",
      name: "Studio",
      priceLabel: "$29 / month",
      cadence: "monthly",
      summary: "A higher tier for creators, labs, or business installs that need more support and multi-robot polish.",
      highlights: [
        "Multi-robot workflows and premium support",
        "Business notifications and custom rollout help",
        "Best fit once the install base grows"
      ],
      status: "coming-soon",
      ctaLabel: "Plan the business tier",
      desktopWebOnly: true
    }
  ],
  freeKeepsPeople: [
    "Let every owner pair, reconnect, check battery, run diagnostics, and use core controls for free.",
    "Keep voice commands, typed commands, and simple teach-mode mapping in the free plan so the app reaches a real daily-use moment.",
    "Show ads only on hosted web if needed. Do not clutter mobile or block the robot workflow."
  ],
  proReasons: [
    "Charge for deeper value: premium automations, richer personality packs, special animations, and time-saving power tools.",
    "Make Pro feel better every day with no hosted-web ads, priority support, faster new features, and better customization.",
    "Keep the upgrade pitch simple: free gets you running, Pro makes the experience smoother, smarter, and more fun."
  ],
  retentionHooks: [
    "Free users should keep discovering new commands, teaching phrases, and seeing support tools improve over time.",
    "Pro users should feel ongoing momentum through premium command drops, automation bundles, and personality updates.",
    "Both tiers should feel alive, but only Pro should feel like the polished enthusiast version."
  ],
  nextMoves: [
    "Add Stripe or other desktop/web payment links in server/.env.local so the Upgrade page can open live checkout.",
    "Keep the free plan strong enough that testers still want to open the app every day without feeling punished.",
    "Sell Pro as the enthusiast layer and Setup Concierge as the fast service-revenue path."
  ],
  status: {
    desktopCheckoutReady: false,
    supportEmailConfigured: false,
    androidPlayBillingReady: false,
    hostedAdsReady: false,
    checkoutLockedToDesktop: false
  }
});

const enrichOverview = (overview: MonetizationOverview): MonetizationOverview => {
  const ads = getAdSenseConfig();
  const checkoutLockedToDesktop = isMobileShellLikeRuntime();

  return {
    ...overview,
    status: {
      ...overview.status,
      hostedAdsReady: ads.enabled,
      checkoutLockedToDesktop
    }
  };
};

export const monetizationService = {
  async getOverview() {
    try {
      const response = await getJson<MonetizationOverview>(
        "/api/monetization/overview",
        "Monetization details could not be loaded."
      );
      return enrichOverview(response);
    } catch {
      return enrichOverview(buildFallbackOverview());
    }
  }
};
