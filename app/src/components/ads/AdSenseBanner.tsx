import { useEffect, useMemo, useRef } from "react";
import { getAdSenseConfig, ensureAdSenseScript } from "@/lib/adsense";
import { useAppStore } from "@/store/useAppStore";

export function AdSenseBanner() {
  const adElementRef = useRef<HTMLModElement | null>(null);
  const hasRequestedAdRef = useRef(false);
  const config = useMemo(() => getAdSenseConfig(), []);
  const planAccess = useAppStore((state) => state.settings.planAccess);

  useEffect(() => {
    if (!config.enabled || planAccess === "pro" || !adElementRef.current || hasRequestedAdRef.current) {
      return;
    }

    const requestAd = () => {
      if (hasRequestedAdRef.current) {
        return;
      }

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        hasRequestedAdRef.current = true;
      } catch {
        // Keep ad failures silent so the main app stays stable.
      }
    };

    ensureAdSenseScript(config.client, requestAd);
  }, [config.client, config.enabled, planAccess]);

  if (!config.enabled || planAccess === "pro") {
    return null;
  }

  return (
    <div className="vector-adsense-shell">
      <div className="mx-auto w-full max-w-[1900px] px-4 md:px-6">
        <div className="vector-adsense-frame">
          <ins
            ref={adElementRef}
            className="adsbygoogle vector-adsense-unit"
            data-ad-client={config.client}
            data-ad-slot={config.slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  );
}
