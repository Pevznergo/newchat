export const DEFAULT_REQUEST_COST = 1;

export const CONTEXT_COST_RUBRIC = {
  threshold: 6000,
  step: 6000,
  // Logic: 1 + floor((len - 1) / step) for multiplier
  baseMultiplier: 1,
};

// Internal ID mappings based on route.ts
export const INTERNAL_MODEL_IDS = {
  gpt4omini: "model_gpt4omini",
  gpt52: "model_gpt52",
  gpt5nano: "model_gpt5nano",
  o3: "model_o3",
  gpt41: "model_gpt41",
  claude45: "model_claude45sonnet",
  claude45thinking: "model_claude45thinking",
  deepseekV3: "model_deepseek_v3",
  deepseekR1: "model_deepseek_r1",
  gemini3pro: "model_gemini_pro",
  gemini3flash: "model_gemini_flash",
  deepresearch: "model_deepresearch",

  // Image
  nano: "model_image_nano_banana",
  gpt_images_1_5: "model_image_gpt_images_1_5",
  flux: "model_image_flux",
};

// Map of user-friendly names to specific limits (Characters)
// Can be mapped by ID prefixes or exact IDs
export const MODEL_LIMITS: Record<string, number> = {
  // Provider IDs
  "openai/gpt-4o-mini": 200_000,
  "openai/gpt-4o-search": 200_000,
  "openai/o3": 500_000,
  "xai/grok": 500_000,
  "openai/gpt-5": 700_000, // Covers 5.1/5.2 and highs
  "openai/gpt-4.1": 2_000_000,
  "google/gemini-flash": 2_000_000,
  "anthropic/claude": 400_000,
  "google/gemini-pro": 80_000,
  "openai/o4-mini": 400_000,
  deepseek: 120_000,

  // Internal IDs
  model_gpt4omini: 200_000,
  model_gpt52: 700_000,
  model_gpt41: 2_000_000,
  model_gpt5nano: 700_000,
  model_o3: 500_000,
  model_claude45sonnet: 400_000,
  model_claude45thinking: 400_000,
  model_gemini_pro: 80_000,
  model_gemini_flash: 2_000_000,
  model_deepseek_v3: 120_000,
  model_deepseek_r1: 120_000,
  model_grok41: 500_000,
  model_deepresearch: 500_000,

  // Web Search Variants
  model_gpt52_web: 700_000,
  model_claude45sonnet_web: 400_000,
  model_gemini_pro_web: 80_000,
  model_gemini_flash_web: 2_000_000,
  model_grok41_web: 500_000,
};

// Map of model IDs to their base request cost
export const MODEL_COSTS: Record<string, number> = {
  // Internal IDs
  model_gpt4omini: 2,
  model_gpt52: 4,
  model_gpt5nano: 1,
  model_o3: 3,
  model_gpt41: 3,
  model_claude45sonnet: 4,
  model_claude45thinking: 10,
  model_deepseek_v3: 2,
  model_deepseek_r1: 1,
  model_gemini_pro: 15,
  model_gemini_flash: 4,
  model_deepresearch: 50,
  model_grok41: 1,

  // Web Search Variants (Slightly higher cost for search)
  model_gpt52_web: 10,
  model_claude45sonnet_web: 10,
  model_gemini_pro_web: 20,
  model_gemini_flash_web: 8,
  model_grok41_web: 5,

  model_image_nano_banana: 15,
  model_image_banana_pro: 60,
  model_image_gpt_images_1_5: 20,
  model_image_flux: 2, // Flux Schnell defaults

  model_video_veo: 50,
  model_video_veo_fast: 25,
  model_video_sora: 170,
  model_video_sora_pro: 850,

  // Provider IDs (Keep for compatibility)
  "openai/gpt-4o-mini-2024-07-18": 2,
  "openai/o4-mini": 2,
  "openai/o4-mini-deep-research": 50,
  "openai/o3-mini": 3,
  "openai/o3-deep-research-2025-06-26": 3,
  "openai/o3-pro": 25,
  "openai/gpt-4o-search": 15,
  "openai/gpt-5.1": 3,
  "openai/gpt-5.1-high": 15,
  "openai/gpt-5.2": 4,
  "openai/gpt-5.2-high": 22,
  "openai/gpt-4.1": 3,
  "openai/gpt-4.1-nano": 1,

  "anthropic/claude-3-haiku": 1,
  "anthropic/claude-3-5-sonnet": 4,
  "anthropic/claude-3-5-sonnet-high": 10,
  "anthropic/claude-3-opus-4.1": 20,
  "anthropic/claude-3-opus-4.5": 7,

  "google/gemini-2.0-flash": 1,
  "google/gemini-2.5-pro": 10,
  "google/gemini-3.0-pro": 15,
  "google/gemini-3.0-flash": 4,

  "deepseek/deepseek-r1": 1,
  "deepseek/deepseek-v3.2": 2,

  "qwen/qwen-3-235b-thinking": 2,
  "qwen/qwen-3-max": 10,
  "qwen/qwen-lora-gen": 2,
  "qwen/qwen-lora-edit": 2,
  "qwen/qwen-lora-merge": 2,

  "xai/grok-xai": 1,
  "perplexity/perplexity-search": 2,
  "perplexity/perplexity-pro": 20,

  "flux-schnell": 2,
  "flux-pro": 10,
  "flux-ultra": 12,
  "flux-kontext-max": 30,
  "ideogram-3-turbo": 4,
  "ideogram-3": 8,
  "recraft-v3": 20,
  "google-nano-banana": 15,
  "google-nano-banana-pro": 60,
  "seedream-4.0": 12,
  "gpt-image-1-gen": 15,
  "gpt-image-1.5-gen": 12,
  "gpt-image-1-high-gen": 50,
  "gpt-image-1.5-high-gen": 40,
};

export const FEATURE_COSTS: Record<string, number> = {
  image_recognition: 10,

  // Modifiers
  "gpt-image-1-edit": 20,
  "gpt-image-1-merge-2": 25,
  "gpt-image-1-merge-3": 30,
  "gpt-image-1-merge-4": 35,

  "gpt-image-1.5-edit": 17,
  "gpt-image-1.5-merge-2": 22,
  "gpt-image-1.5-merge-3": 27,
  "gpt-image-1.5-merge-4": 32,

  "gpt-image-1-high-edit": 60,
  "gpt-image-1-high-merge-2": 70,
  "gpt-image-1-high-merge-3": 80,
  "gpt-image-1-high-merge-4": 90,

  "gpt-image-1.5-high-edit": 50,
  "gpt-image-1.5-high-merge-2": 60,
  "gpt-image-1.5-high-merge-3": 70,
  "gpt-image-1.5-high-merge-4": 80,

  // Video
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
};

export function getKlingVideoEditingCost(durationSec: number) {
  // 3s=165, steps of +55 per sec
  const k = 55;
  const base = 165;
  if (durationSec <= 3) {
    return base;
  }
  return base + (durationSec - 3) * k;
}
