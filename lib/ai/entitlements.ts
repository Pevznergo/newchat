import type { UserType } from "@/app/(auth)/auth";

type Entitlements = {
  maxMessagesPerDay: number;
  charLimit: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account (Guest)
   * Limit: 3 messages, 2500 chars, Basic models only
   */
  guest: {
    maxMessagesPerDay: 3,
    charLimit: 2500,
  },

  /*
   * For users with an account (Regular)
   * Limit: 15 messages, 2500 chars, Basic models only
   */
  regular: {
    maxMessagesPerDay: 15,
    charLimit: 2500,
  },

  /*
   * For users with an account and a paid membership (Pro)
   * Limit: Unlimited, 20000 chars, All models
   */
  pro: {
    maxMessagesPerDay: Infinity,
    charLimit: 20000,
  },
};
