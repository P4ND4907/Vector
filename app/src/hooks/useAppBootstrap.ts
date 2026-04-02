import { useAppStore } from "@/store/useAppStore";

export const useAppBootstrap = () => {
  const initialize = useAppStore((state) => state.initialize);
  const theme = useAppStore((state) => state.settings.theme);
  const colorTheme = useAppStore((state) => state.settings.colorTheme);

  return {
    initialize,
    theme,
    colorTheme
  };
};
