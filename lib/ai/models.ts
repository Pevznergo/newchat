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
  // OpenAI
  {
    id: "openai/gpt-5.2-2025-12-11",
    name: "GPT-5.2",
    provider: "openai",
    description: "New top-tier OpenAI model",
    tier: "advanced",
  },
  {
    id: "openai/o3-deep-research-2025-06-26",
    name: "OpenAI o3",
    provider: "openai",
    description: "Deep research and reasoning model",
    tier: "advanced",
  },
  {
    id: "openai/gpt-4.1-2025-04-14",
    name: "GPT-4.1",
    provider: "openai",
    description: "Efficient and capable universal model",
    tier: "advanced",
  },
  {
    id: "openai/gpt-5-nano-2025-08-07",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Ultra-fast and efficient",
    tier: "basic",
  },
  {
    id: "openai/gpt-4o-mini-2024-07-18",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Trusted fast model",
    tier: "basic",
  },
  // OpenRouter (Anthropic/Google/DeepSeek)
  {
    id: "openrouter/anthropic/claude-4.5-sonnet",
    name: "Claude 4.5 Sonnet",
    provider: "openrouter",
    description: "Best for coding and nuance",
    tier: "advanced",
  },
  {
    id: "openrouter/anthropic/claude-4.5-thinking",
    name: "Claude 4.5 Thinking",
    provider: "openrouter",
    description: "Thinking mode for complex tasks",
    tier: "advanced",
  },
  {
    id: "openrouter/deepseek/deepseek-v3.2",
    name: "DeepSeek-V3.2",
    provider: "openrouter",
    description: "Strong open model",
    tier: "advanced",
  },
  {
    id: "openrouter/deepseek/deepseek-v3.2-thinking",
    name: "DeepSeek-V3.2 Thinking",
    provider: "openrouter",
    description: "Deep reasoning open model",
    tier: "advanced",
  },
  {
    id: "openrouter/google/gemini-3.0-pro",
    name: "Gemini 3 Pro",
    provider: "openrouter",
    description: "Google's best model",
    tier: "advanced",
  },
  {
    id: "openrouter/google/gemini-3.0-flash",
    name: "Gemini 3 Flash",
    provider: "openrouter",
    description: "High speed, low latency",
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

export type ImageModel = {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
};

export const IMAGE_MODELS: Record<string, ImageModel> = {
  model_image_nano_banana: {
    id: "google/gemini-2.5-flash-image",
    name: "Nano Banana",
    provider: "openrouter",
    enabled: true,
  },
  model_image_banana_pro: {
    id: "openai/dall-e-3", // Or another premium provider
    name: "Nano Banana Pro",
    provider: "openai",
    enabled: true,
  },
  model_image_midjourney: {
    id: "midjourney/midjourney-v6",
    name: "Midjourney",
    provider: "openai", // Placeholder, processed by specialized tools/bot logic
    enabled: false,
  },
  model_image_flux: {
    id: "flux-2-schnell",
    name: "FLUX 2",
    provider: "openai",
    enabled: false,
  },
};
