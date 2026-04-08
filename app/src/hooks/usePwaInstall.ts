import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandaloneDisplay = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

const isLocalhost = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

const isIosSafariLike = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isWebkit = /webkit/.test(ua);
  const isCrios = /crios|fxios|edgios/.test(ua);
  return isIos && isWebkit && !isCrios;
};

export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay());
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const isNativeShell = Capacitor.isNativePlatform();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneDisplay());
    };
    const canUseServiceWorker = "serviceWorker" in navigator && !isNativeShell;

    if (canUseServiceWorker) {
      navigator.serviceWorker
        .getRegistration("/sw.js")
        .then((registration) => {
          if (registration) {
            setServiceWorkerReady(true);
            return;
          }

          return navigator.serviceWorker.ready
            .then(() => setServiceWorkerReady(true))
            .catch(() => setServiceWorkerReady(false));
        })
        .catch(() => setServiceWorkerReady(false));
    } else {
      setServiceWorkerReady(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, [isNativeShell]);

  const canInstall = useMemo(() => !isInstalled && Boolean(deferredPrompt), [deferredPrompt, isInstalled]);
  const showIosHint = useMemo(() => !isInstalled && !deferredPrompt && isIosSafariLike(), [deferredPrompt, isInstalled]);
  const supportsServiceWorker = useMemo(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && !isNativeShell,
    [isNativeShell]
  );
  const isSecureContextLike = useMemo(
    () => typeof window !== "undefined" && (window.isSecureContext || isLocalhost()),
    []
  );
  const installUrl = useMemo(
    () => (typeof window === "undefined" ? "" : window.location.href),
    []
  );
  const canSelfInstall = useMemo(
    () => !isNativeShell && supportsServiceWorker && isSecureContextLike,
    [isNativeShell, isSecureContextLike, supportsServiceWorker]
  );

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return false;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return choice.outcome === "accepted";
  };

  return {
    canInstall,
    canSelfInstall,
    installUrl,
    isInstalled,
    isNativeShell,
    isSecureContextLike,
    serviceWorkerReady,
    showIosHint,
    promptInstall,
    supportsServiceWorker
  };
};
