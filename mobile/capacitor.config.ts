import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Shell iOS. Por defecto carga producción.
 * Build interna: CAPACITOR_SERVER_URL=https://staging.example.com npx cap sync ios
 * (en Mac). No pongas localhost: el iPhone no llega a la PC.
 */
const serverUrl = (
  process.env.CAPACITOR_SERVER_URL || "https://www.adsholistic.com"
).replace(/\/$/, "");

const serverHost = new URL(serverUrl).hostname;

const config: CapacitorConfig = {
  appId: "com.adsholistic.app",
  appName: "Ads Holistic",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      serverHost,
      "adsholistic.com",
      "*.adsholistic.com",
    ],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#fcfbf9",
    preferredContentMode: "mobile",
    // La web puede detectar el shell con navigator.userAgent.includes("HolisticApp/ios").
    appendUserAgent: "HolisticApp/ios",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#fcfbf9",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#fcfbf9",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
