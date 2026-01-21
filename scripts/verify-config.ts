import dotenv from "dotenv";
import fs from "node:fs";
import path from "path";

// Adjust path to .env.local from scripts folder (assuming run from root, but script is in scripts/)
// Actually if run with npx tsx scripts/verify-config.ts from root, cwd is root.
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

async function verify() {
  console.log("Verifying Config Fetch...");
  // Use dynamic import to ensure env is loaded
  const { getProviderMap, getActiveModels } = await import("../lib/ai/config");
  
  const map = await getProviderMap();
  console.log("Provider Map Keys:", Object.keys(map).length);
  console.log("Sample (model_gpt4omini):", map.model_gpt4omini);
  
  const models = await getActiveModels();
  console.log("Active Models Count:", models.length);
  
  if (Object.keys(map).length > 0 && models.length > 0) {
      console.log("✅ Verification Successful");
  } else {
      console.error("❌ Verification Failed: No models found");
      process.exit(1);
  }
}

verify().catch(console.error);
