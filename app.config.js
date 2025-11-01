// app.config.js
require('dotenv').config({ path: process.env.ENVFILE || '.env' });

module.exports = {
  expo: {
    name: "Tracksy",
    slug: "tracksy",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0a0a0a"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "bg.tracksy.app",
      buildNumber: "10",
      infoPlist: {
        NSLocationAlwaysAndWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
        NSLocationAlwaysUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
        NSLocationWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
        UIBackgroundModes: ["location"]
      },
      entitlements: {
        "com.apple.developer.networking.wifi-info": true
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "bg.tracksy.app",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION"
      ]
    },
    web: {
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "https://rork.com/"
        }
      ],
      [
        "expo-location",
        {
          isAndroidForegroundServiceEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true,
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location."
        }
      ],
      [
        "expo-notifications",
        {
          color: "#ffffff",
          defaultChannel: "default",
          enableBackgroundRemoteNotifications: false
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: "https://rork.com/"
      },
      eas: {
        projectId: "b1b97394-2212-4034-8605-702386ff2dfc"
      },
      // Environment variables from .env or fallback to production values
      SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ztlyoketfstcsjylvfyq.supabase.co",
      SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI",
      MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoicGxhbWVuc3RveWFub3YiLCJhIjoiY21mcGtzdTh6MGMwdTJqc2NqNjB3ZjZvcSJ9.mYM2IeJEeCJkeaR2TVd4BQ",
      // Also set as EXPO_PUBLIC_* for runtime access
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ztlyoketfstcsjylvfyq.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bHlva2V0ZnN0Y3NqeWx2ZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDI2OTAsImV4cCI6MjA3MzAxODY5MH0.hIpD_IyAxCHs2JLzUUIGL9wVwzZw-QRV2ca_ZEfyaLI",
      EXPO_PUBLIC_MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoicGxhbWVuc3RveWFub3YiLCJhIjoiY21mcGtzdTh6MGMwdTJqc2NqNjB3ZjZvcSJ9.mYM2IeJEeCJkeaR2TVd4BQ"
    }
  }
};


