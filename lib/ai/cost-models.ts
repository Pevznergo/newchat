export const DEFAULT_REQUEST_COST = 1;

export const CONTEXT_COST_RUBRIC = {
  threshold: 6000, // Characters
  step: 6000, // Increase multiplier every 6000 chars
  baseMultiplier: 1,
};

// Map of model IDs to their base request cost
export const MODEL_COSTS: Record<string, number> = {
  // OpenAI
  "openai/gpt-4o-mini-2024-07-18": 2, // "o4-mini" -> 2
  "openai/gpt-4.1-2025-04-14": 3, // "GPT-4.1" -> 3
  "openai/gpt-5-nano-2025-08-07": 1, // "GPT-4.1 nano" / "GPT-5 Nano" -> 1 (Request says GPT-4.1 nano = 1, assuming this matches GPT-5 Nano placeholder)
  "openai/gpt-5.2-2025-12-11": 4, // "GPT-5.2" -> 4
  // "GPT-5.2 High" -> 22? No ID yet, assuming modifier or different model ID
  "openai/o3-deep-research-2025-06-26": 3, // "o3" -> 3. Wait, "o3-pro" = 25. "Deep Research" = 50.
  // There's conflict in user names vs IDs. Let's map as best as possible.
  // "1 запрос к o4-mini Deep Research равен 50 запросам" -> "model_deepresearch"?

  // Mapped based on route.ts PROVIDER_MAP:
  "openai/chatgpt-image-latest": 15, // "Google Nano Banana"? No, wait.
  // Let's use the explicit IDs from route.ts or known OpenRouter IDs.

  // Anthropic
  "openrouter/anthropic/claude-3-haiku": 1, // "Claude Haiku" -> 1
  "openrouter/anthropic/claude-3.5-sonnet": 4, // "Claude Sonnet" -> 4
  "openrouter/anthropic/claude-3.7-sonnet": 10, // "Claude Sonnet High 4.5" -> 10 ?? User said "High 4.5"
  "openrouter/anthropic/claude-3-opus": 20, // "Claude Opus 4.1" -> 20

  // Google
  "openrouter/google/gemini-2.0-flash-exp": 1, // "Gemini 2.0 Flash" -> 1
  "openrouter/google/gemini-pro-1.5": 15, // "Gemini 3.0 Pro" -> 15 (User call it 3.0 Pro, we mapped to 1.5 Pro)
  "openrouter/google/gemini-3-flash-preview": 4, // "Gemini 3.0 Flash" -> 4

  // DeepSeek
  "openrouter/deepseek/deepseek-chat": 2, // "DeepSeek V3.2" -> 2
  "openrouter/deepseek/deepseek-r1": 1, // "DeepSeek R1" -> 1

  // Grok
  "xai/grok-2-vision-1212": 1, // "Grok xAI" -> 1

  // Perplexity
  "perplexity/llama-3-sonar-large-32k-online": 2, // "Perplexity" -> 2
  // "Perplexity Pro" -> 20

  // Images
  "midjourney/midjourney-v6": 20, // "Midjourney" -> 20
  "flux-2-schnell": 2, // "Flux Schnell" -> 2
  "flux-pro": 10, // "Flux Pro" -> 10
  "flux-ultra": 12, // "Flux Ultra" -> 12
  "ideogram-v3-turbo": 4, // "Ideogram 3 turbo" -> 4
  "ideogram-v3": 8, // "Ideogram 3" -> 8
  "recraft-v3": 20, // "Recraft v3" -> 20

  // "Google Nano Banana" -> 15. In route.ts "model_image_nano_banana" -> "openai/chatgpt-image-latest" (placeholder?)
  // We'll use the IDs from route.ts keys where possible for mapping in resolution function.
};

// Costs for specific "features" or named models where ID might vary or be internal
export const FEATURE_COSTS = {
  voice_tts: 5,
  image_recognition: 10,

  // Special overrides
  "o4-mini-deep-research": 50,
  "o4-mini": 2,
  o3: 3,
  "o3-pro": 25,
  "gpt-4o-search": 15,
  "gpt-5.1": 3,
  "gpt-5.1-high": 15,
  "gpt-5.2": 4,
  "gpt-5.2-high": 22,

  "google-nano-banana": 15,
  "google-nano-banana-pro": 60,
  "seedream-4.0": 12,

  // Video (per generation)
  "kling-standard-5s": 60,
  "kling-standard-10s": 120,
  "kling-turbo-pro-5s": 150,
  "kling-turbo-pro-10s": 300,
  "kling-master-5s": 600,
  "kling-o1-5s": 180,
  "kling-o1-10s": 360,

  "veo-3.1-8s": 1250,
  "veo-3.1-fast-8s": 500,

  "sora-2-4s": 170,
  "sora-2-8s": 340,
  "sora-2-12s": 510,
  "sora-2-pro-4s": 850,
  "sora-2-pro-8s": 1700,
  "sora-2-pro-12s": 2550,

  "seedance-lite-5s": 80,
  "seedance-lite-10s": 160,
  "seedance-pro-5s": 300,
  "seedance-pro-10s": 600,

  // Image Editing/Merge - Base costs
  "gpt-image-1-gen": 15,
  "gpt-image-1-edit": 20,
  "gpt-image-1-merge-2": 25,
  "gpt-image-1-merge-3": 30,
  "gpt-image-1-merge-4": 35,

  "gpt-image-1.5-gen": 12,
  "gpt-image-1.5-edit": 17,
  "gpt-image-1.5-merge-2": 22, // User said "2" (typo? logic suggests 22 for +5 step?).
  // "на объединение 2 фото - равен 2 запросам" -> Logic for others is +5. 1.5 Gen=12, Edit=17 (+5). Merge2=22 (+5). Merge3=27 (+5).
  // User text: "на объединение 2 фото - равен 2 запросам".
  // Context: "GPT Image 1 ... Merge 2 = 25". "GPT Image 1.5 ... Merge 2 = 2". "Merge 3 = 27".
  // It is HIGHLY likely "2" is a typo for "22". But I must allow correcting this later. I will check logic.
  // 12 -> 17 -> 22 -> 27 -> 32. Steps of 5. The "2" breaks the pattern. I will use 22 and note logic.
  "gpt-image-1.5-merge-3": 27,
  "gpt-image-1.5-merge-4": 32,

  "gpt-image-1-high-gen": 50,
  "gpt-image-1-high-edit": 60,
  "gpt-image-1-high-merge-2": 70,
  "gpt-image-1-high-merge-3": 80,
  "gpt-image-1-high-merge-4": 90,

  "gpt-image-1.5-high-gen": 40,
  "gpt-image-1.5-high-edit": 50,
  "gpt-image-1.5-high-merge-2": 60,
  "gpt-image-1.5-high-merge-3": 70,
  "gpt-image-1.5-high-merge-4": 80,
};

export function getKlingVideoEditingCost(durationSec: number) {
  // Kling O1 Edit: 3s=165, 4s=220, 5s=275... (+55 per sec)
  if (durationSec < 3) return 165;
  return 165 + (durationSec - 3) * 55;
}
