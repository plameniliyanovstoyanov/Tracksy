import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  try {
    // Try to get from Constants first (for release builds)
    const Constants = require('expo-constants').default;
    const extra = Constants?.expoConfig?.extra ?? Constants?.manifest?.extra ?? {};
    if (extra.EXPO_PUBLIC_RORK_API_BASE_URL) {
      return extra.EXPO_PUBLIC_RORK_API_BASE_URL;
    }
    
    // Fallback to process.env (for development)
    if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
      return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    }

    // Return empty string instead of throwing error (no backend needed for now)
    return "";
  } catch (error) {
    console.warn('⚠️ Failed to get base URL, using empty string:', error);
    return "";
  }
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});