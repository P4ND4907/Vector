import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

const isNativeCapacitorRuntime = Capacitor.isNativePlatform();
const canRegisterServiceWorker =
  "serviceWorker" in navigator &&
  !isNativeCapacitorRuntime &&
  (window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

if ("serviceWorker" in navigator && isNativeCapacitorRuntime) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {
          // Keep failures quiet so the native shell still boots normally.
        });
      });
    });
  });
}

if (canRegisterServiceWorker) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep registration failures quiet so local robot control still works.
    });
  });
}
