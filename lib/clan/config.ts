export type ClanLevelConfig = {
  requirements: {
    minUsers: number;
    minPro: number;
    maxFreeToPaidRatio?: number; // Infinite if undefined, else Free/Paid ratio
  };
  benefits: {
    weeklyTextCredits: number; // For Free users
    weeklyImageGenerations: number;
    unlimitedModels?: string[]; // IDs of models that cost 0 for this level
  };
};

export const CLAN_LEVELS: Record<number, ClanLevelConfig> = {
  1: {
    requirements: { minUsers: 1, minPro: 0 },
    benefits: { weeklyTextCredits: 15, weeklyImageGenerations: 0 },
  },
  2: {
    requirements: { minUsers: 2, minPro: 0 },
    benefits: { weeklyTextCredits: 30, weeklyImageGenerations: 0 },
  },
  3: {
    requirements: { minUsers: 6, minPro: 1 },
    benefits: { weeklyTextCredits: 50, weeklyImageGenerations: 5 }, // Images on Nano Banana only check happens in logic
  },
  4: {
    requirements: { minUsers: 10, minPro: 2 },
    benefits: { weeklyTextCredits: 75, weeklyImageGenerations: 5 },
  },
  5: {
    requirements: { minUsers: 15, minPro: 3, maxFreeToPaidRatio: 5 },
    benefits: {
      weeklyTextCredits: 100, // For "Others"
      weeklyImageGenerations: 10,
      unlimitedModels: [
        "openai/gpt-5-nano-2025-08-07", // GPT-5 Nano
        "openrouter/google/gemini-3-flash-preview", // Gemini 3 Flash
        "openai/gpt-4o-mini-2024-07-18", // GPT-4o mini
      ],
    },
  },
};

export const NANO_BANANA_ID = "openai/chatgpt-image-latest"; // Verify ID from cost-models
