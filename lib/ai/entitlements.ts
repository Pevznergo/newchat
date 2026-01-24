import type { UserType } from "@/app/(auth)/auth";

type Entitlements = {
  maxMessagesPerDay: number;
  charLimit: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account (Guest)
   * Limit: 20 requests (Strict trial)
   */
  guest: {
    maxMessagesPerDay: 20,
    charLimit: 2500,
  },

  /*
   * For users with an account (Free)
   * Limit: 100 requests per 7 days
   */
  regular: {
    maxMessagesPerDay: 100,
    charLimit: 2500,
  },

  /*
   * For users with an account and a paid membership (Pro/Premium)
   * Limit: Defined by subscription type (2500 or 7500)
   */
  pro: {
    maxMessagesPerDay: 7500,
    charLimit: 20_000,
  },
};

export const SUBSCRIPTION_LIMITS = {
  free: 100,
  premium: 2500,
  pro: 7500,
};
