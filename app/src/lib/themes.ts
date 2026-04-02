import type { ColorTheme, ThemeMode } from "@/types";

export interface ThemePreset {
  id: ColorTheme;
  name: string;
  description: string;
  swatches: [string, string, string];
}

export const themePresets: ThemePreset[] = [
  {
    id: "vector",
    name: "Vector",
    description: "Cyan face glow with warm gold accents inspired by Vector's hardware.",
    swatches: ["#7AF8EA", "#FFD45A", "#0D111C"]
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "The darker control-room look with teal and ember highlights.",
    swatches: ["#65E8FF", "#FF9C6B", "#09101D"]
  },
  {
    id: "ice",
    name: "Ice",
    description: "Cool blue highlights and cleaner contrast for a lighter sci-fi feel.",
    swatches: ["#A4F3FF", "#7AA6FF", "#101828"]
  }
];

export const applyThemeClasses = (theme: ThemeMode, colorTheme: ColorTheme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");

  const paletteClasses: ColorTheme[] = ["vector", "midnight", "ice"];
  paletteClasses.forEach((palette) => {
    document.documentElement.classList.toggle(`theme-${palette}`, colorTheme === palette);
  });
};
