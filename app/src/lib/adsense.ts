import { isMobileShellLikeRuntime } from "@/lib/runtime-target";

const ADSENSE_SCRIPT_ID = "vector-control-hub-adsense";

const isStandaloneDisplay = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

const isHostedBrowserRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (isMobileShellLikeRuntime()) {
    return false;
  }

  if (!window.location.protocol.startsWith("http")) {
    return false;
  }

  if (!window.isSecureContext) {
    return false;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return false;
  }

  if (isStandaloneDisplay()) {
    return false;
  }

  return true;
};

export const getAdSenseConfig = () => {
  const client = (import.meta.env.VITE_ADSENSE_CLIENT || "").trim();
  const slot = (import.meta.env.VITE_ADSENSE_SLOT || "").trim();

  return {
    client,
    slot,
    enabled: isHostedBrowserRuntime() && client.startsWith("ca-pub-") && slot.length > 0
  };
};

export const ensureAdSenseScript = (client: string, onReady: () => void) => {
  if (typeof document === "undefined") {
    return;
  }

  const existing = document.getElementById(ADSENSE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    if (existing.dataset.loaded === "true") {
      onReady();
    } else {
      existing.addEventListener("load", onReady, { once: true });
    }
    return;
  }

  const script = document.createElement("script");
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  script.crossOrigin = "anonymous";
  script.dataset.loaded = "false";
  script.addEventListener(
    "load",
    () => {
      script.dataset.loaded = "true";
      onReady();
    },
    { once: true }
  );
  document.head.appendChild(script);
};
