import { Router, type Request, type Response } from "express";

type BuildEnvResult = ReturnType<typeof import("../utils/env.js").buildEnv>;

export const createMonetizationRouter = (env: BuildEnvResult) => {
  const router = Router();

  router.get("/overview", (_request: Request, response: Response) => {
    const supportEmail = env.supportEmail.trim();
    const proCheckout = env.stripePaymentLinkPro.trim();
    const setupCheckout = env.stripePaymentLinkSetup.trim();
    const studioCheckout = env.stripePaymentLinkStudio.trim();

    response.json({
      headline: "Let owners fall in love with the free app, then make Pro the obvious enthusiast upgrade.",
      summary:
        "The free tier should cover pairing, reconnect, commands, and diagnostics. Pro should remove friction, add delight, and reward the owners who use Vector the most.",
      supportEmail,
      plans: [
        {
          id: "free",
          name: "Free",
          priceLabel: "$0",
          cadence: "free",
          summary: "Keep the whole owner trust loop free so people can pair, reconnect, control Vector, and build a habit before you ever ask them to pay.",
          highlights: [
            "Pairing, reconnect, dashboard, controls, and diagnostics",
            "Voice and typed commands plus basic teach mode",
            "Free on desktop and mobile, with hosted-web ads only when applicable"
          ],
          status: "live",
          note: "Do not lock away the trust-building features. The free plan needs to get people to a real daily-use moment."
        },
        {
          id: "pro",
          name: "Companion Pro",
          priceLabel: "$4.99 / month",
          cadence: "monthly",
          summary: "The upgrade for owners who want the smoother, deeper, more magical version of the app every day.",
          highlights: [
            "Advanced automation, patrol presets, and richer teach-mode tools",
            "Premium personality packs, face animations, and faster feature drops",
            "Priority support and no hosted-web ads"
          ],
          status: proCheckout ? "live" : "needs-config",
          ctaLabel: proCheckout ? "Open Pro checkout" : "Set Pro payment link",
          checkoutUrl: proCheckout || undefined,
          desktopWebOnly: true,
          note: "Pro should feel like saved time plus extra delight, not like the basics were taken away."
        },
        {
          id: "setup",
          name: "Setup Concierge",
          priceLabel: "$79 one time",
          cadence: "one-time",
          summary: "A paid setup, rescue, or optimization session you can sell before subscriptions are fully mature.",
          highlights: [
            "Remote setup or repair help",
            "Simple offer for first-time owners",
            "Fastest service revenue path"
          ],
          status: setupCheckout ? "live" : "needs-config",
          ctaLabel: setupCheckout ? "Open setup booking" : "Set setup payment link",
          checkoutUrl: setupCheckout || undefined,
          desktopWebOnly: true
        },
        {
          id: "studio",
          name: "Studio",
          priceLabel: "$29 / month",
          cadence: "monthly",
          summary: "For creators, labs, and business installs once there is enough demand to support a bigger plan.",
          highlights: [
            "Best fit for multi-robot or premium installs",
            "Business notifications and rollout support",
            "Higher-touch commercial tier"
          ],
          status: studioCheckout ? "live" : "coming-soon",
          ctaLabel: studioCheckout ? "Open Studio checkout" : "Plan the Studio tier",
          checkoutUrl: studioCheckout || undefined,
          desktopWebOnly: true
        }
      ],
      freeKeepsPeople: [
        "Let every owner pair, reconnect, check battery, run diagnostics, and use core controls for free.",
        "Keep voice commands, typed commands, and simple teach mode in the free plan so people actually build a habit.",
        "If ads are used, keep them on hosted web only and out of the main mobile robot flow."
      ],
      proReasons: [
        "Charge for deeper value like advanced automations, premium face and personality packs, and premium teach-mode tools.",
        "Make Pro feel better every day with no hosted-web ads, faster polish, and better support.",
        "Keep the upgrade message simple: free gets you running, Pro makes the experience smoother, smarter, and more fun."
      ],
      retentionHooks: [
        "Free users should keep finding new useful commands and repair wins without feeling blocked.",
        "Pro users should keep seeing new command packs, automation bundles, and personality drops.",
        "Both tiers should feel active, but Pro should feel like the enthusiast version."
      ],
      nextMoves: [
        "Configure STRIPE_PAYMENT_LINK_PRO, STRIPE_PAYMENT_LINK_SETUP, and optionally STRIPE_PAYMENT_LINK_STUDIO in server/.env.local.",
        "Keep the free plan strong enough that new users still want to return every day.",
        "Sell Pro as the enthusiast layer and Setup Concierge as the fast service-revenue path."
      ],
      status: {
        desktopCheckoutReady: Boolean(proCheckout || setupCheckout || studioCheckout),
        supportEmailConfigured: Boolean(supportEmail),
        androidPlayBillingReady: false,
        hostedAdsReady: false,
        checkoutLockedToDesktop: false
      }
    });
  });

  return router;
};
