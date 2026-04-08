# Revenue Plan

This project now has a built-in monetization foundation inside the app at `Upgrade`.

## Fastest revenue path

1. Sell desktop and hosted-web upgrades first.
2. Sell a one-time setup or rescue service before a full subscription stack is mature.
3. Keep Android Play-safe for now and mirror the winning paid plan there later.

## Starting offers

- `Free`
  - Pairing, reconnect, dashboard, controls, commands, AI teaching, diagnostics
  - Free should reach a real daily-use moment before any upgrade ask
  - Keep hosted-web ads on when available, but do not clutter mobile or block robot workflows
  - This stays free

- `Companion Pro`
  - Suggested starting price: `$4.99 / month`
  - Advanced automations, richer teach mode, premium face and personality packs, faster polish drops, priority support, and no hosted-web ads

- `Setup Concierge`
  - Suggested starting price: `$79 one time`
  - Remote onboarding, rescue, or repair help

- `Studio`
  - Suggested starting price: `$29 / month`
  - Multi-robot or business-friendly support once demand is real

## Environment variables

Add these to `server/.env.local`:

```env
SUPPORT_EMAIL=you@example.com
STRIPE_PAYMENT_LINK_PRO=https://buy.stripe.com/your-pro-link
STRIPE_PAYMENT_LINK_SETUP=https://buy.stripe.com/your-setup-link
STRIPE_PAYMENT_LINK_STUDIO=https://buy.stripe.com/your-studio-link
```

## Why desktop and hosted web first

- It is the fastest route to real checkout without waiting on Play billing work.
- The app already supports ads on hosted web.
- Android can stay clean and policy-safe while the paid value proposition is proven.

## Free vs Pro rule

- `Free should build trust`
  - Do not paywall pairing, reconnect, battery, controls, diagnostics, or core commands.
  - If owners cannot get Vector working for free, they will leave before they value Pro.

- `Pro should save time and add delight`
  - Charge for deeper automation, richer personality and animation packs, premium teach-mode extras, and better support.
  - Pro should feel like the enthusiast version, not the fixed version of a broken free app.

- `Ads should stay out of the way`
  - If ads are used, keep them on hosted web only.
  - Do not put ads into the main mobile or desktop robot-control flow.

## Current product rule

- `Desktop and hosted web`
  - okay to open external payment links

- `Android`
  - keep the app focused on product value and setup until native Play billing is ready

## What to do next

1. Create real payment links.
2. Put them in `server/.env.local`.
3. Rebuild and open the `Upgrade` page.
4. Offer `Setup Concierge` first to existing testers and new owners.
5. Keep improving the free daily-use loop so Pro upgrades happen from habit, not pressure.
