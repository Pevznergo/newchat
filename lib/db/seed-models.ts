import dotenv from "dotenv";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}


const MODELS = [
  { modelId: "model_gpt52", name: "GPT-5.2", providerId: "openai/gpt-4o", type: "text", isPremium: true },
  { modelId: "model_o3", name: "OpenAI o3", providerId: "openai/gpt-4o", type: "text", isPremium: true },
  { modelId: "model_gpt41", name: "GPT-4.1", providerId: "openai/gpt-4o", type: "text", isPremium: true },
  { modelId: "model_gpt5mini", name: "GPT-5 Mini", providerId: "openai/gpt-4o-mini", type: "text", isPremium: false },
  { modelId: "model_gpt4omini", name: "GPT-4o Mini", providerId: "openai/gpt-4o-mini", type: "text", isPremium: false },
  { modelId: "model_claude45sonnet", name: "Claude 3.5 Sonnet", providerId: "anthropic/claude-3-5-sonnet-20240620", type: "text", isPremium: true },
  { modelId: "model_claude45thinking", name: "Claude 3.5 Thinking", providerId: "anthropic/claude-3-5-sonnet-20240620", type: "text", isPremium: true },
  { modelId: "model_deepseek32", name: "DeepSeek V3", providerId: "deepseek/deepseek-chat", type: "text", isPremium: false },
  { modelId: "model_deepseek32thinking", name: "DeepSeek R1", providerId: "deepseek/deepseek-reasoner", type: "text", isPremium: false },
  { modelId: "model_gemini3pro", name: "Gemini 1.5 Pro", providerId: "google/gemini-1.5-pro-latest", type: "text", isPremium: true },
  { modelId: "model_gemini3flash", name: "Gemini 1.5 Flash", providerId: "google/gemini-1.5-flash-latest", type: "text", isPremium: false },
  { modelId: "model_perplexity", name: "Perplexity", providerId: "openrouter/perplexity/llama-3.1-sonar-large-128k-online", type: "text", isPremium: false },
  { modelId: "model_grok41", name: "Grok Beta", providerId: "xai/grok-beta", type: "text", isPremium: false },
  { modelId: "model_deepresearch", name: "Deep Research", providerId: "openai/gpt-4o", type: "text", isPremium: true },
  
  // Image Models
  { modelId: "model_image_gpt", name: "GPT Images", providerId: "openai/chatgpt-image-latest", type: "image", isPremium: false },
  { modelId: "model_image_midjourney", name: "Midjourney", providerId: "openai/gpt-4o", type: "image", isPremium: true },
  { modelId: "model_image_flux", name: "Flux", providerId: "openai/gpt-4o", type: "image", isPremium: true },
  
  // Video Models
  { modelId: "model_video_kling", name: "Kling", providerId: "openai/gpt-4o", type: "video", isPremium: true },
  { modelId: "model_video_hailuo", name: "Hailuo", providerId: "openai/gpt-4o", type: "video", isPremium: true },
];

async function seed() {
  const { db } = await import("./drizzle");
  const { aiModel, modelLimit } = await import("./schema");
  const { eq } = await import("drizzle-orm");

  console.log("Seeding AI Models...");
  
  for (const m of MODELS) {
    // Upsert
    const existing = await db.select().from(aiModel).where(eq(aiModel.modelId, m.modelId));
    if (existing.length === 0) {
        const [inserted] = await db.insert(aiModel).values({
            modelId: m.modelId,
            name: m.name,
            providerId: m.providerId,
            type: m.type,
            isPremium: m.isPremium,
            isActive: true
        }).returning();
        console.log(`Inserted ${m.name}`);
        
        // Add default limit for GPT Images free users
        if (m.modelId === "model_image_gpt") {
            await db.insert(modelLimit).values({
                modelId: inserted.id,
                userRole: "free",
                limitCount: 5,
                limitPeriod: "monthly",
                isActive: true
            });
            console.log("Added limit for GPT Images");
        }
    } else {
        console.log(`Skipping ${m.name} (already exists)`);
        // Optional: Update providerId if mismatch?
        if (existing[0].providerId !== m.providerId) {
             await db.update(aiModel).set({ providerId: m.providerId }).where(eq(aiModel.id, existing[0].id));
             console.log(`Updated provider for ${m.name}`);
        }
    }
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch(console.error);
