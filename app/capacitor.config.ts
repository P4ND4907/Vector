import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vectorcontrolhub.app",
  appName: "Vector Control Hub",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for nearby Bluetooth devices...",
        cancel: "Cancel",
        availableDevices: "Nearby Bluetooth devices",
        noDeviceFound: "No Bluetooth devices found"
      }
    }
  }
};

export default config;
