import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export const useAppBootstrap = () => {
  const initialize = useAppStore((state) => state.initialize);
  const theme = useAppStore((state) => state.settings.theme);
  const colorTheme = useAppStore((state) => state.settings.colorTheme);
  const [hasHydrated, setHasHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    setHasHydrated(useAppStore.persist.hasHydrated());

    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return unsubscribe;
  }, []);

  return {
    initialize,
    theme,
    colorTheme,
    hasHydrated
  };
};
