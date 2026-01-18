// Curated list of top models from Vercel AI Gateway
export const DEFAULT_CHAT_MODEL = "openai/gpt-5-nano-2025-08-07";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  tier: "basic" | "advanced";
};

export const chatModels: ChatModel[] = [
  // Anthropic
  {
    id: "anthropic/claude-3-5-sonnet-20240620",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    description: "Best balance of speed, intelligence, and cost",
    tier: "advanced",
  },
  {
    id: "anthropic/claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    description: "Fast and affordable, great for everyday tasks",
    tier: "basic",
  },
  // OpenAI
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Most capable OpenAI model",
    tier: "advanced",
  },
  {
    id: "openai/gpt-4o-mini-2024-07-18",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Fast and cost-effective for simple tasks",
    tier: "basic",
  },
  {
    id: "openai/gpt-5-nano-2025-08-07",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Latest OpenAI model - ultra fast and efficient",
    tier: "basic",
  },
  // Google
  {
    id: "google/gemini-1.5-pro-latest",
    name: "Gemini 1.5 Pro",
    provider: "google",
    description: "Most capable Google model",
    tier: "advanced",
  },
  {
    id: "google/gemini-1.5-flash-latest",
    name: "Gemini 1.5 Flash",
    provider: "google",
    description: "Ultra fast and affordable",
    tier: "basic",
  },
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
