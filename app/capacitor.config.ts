import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vectorcontrolhub.app",
  appName: "Vector Control Hub",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
