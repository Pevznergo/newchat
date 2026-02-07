import "dotenv/config";
import fs from "fs";
import { Bot, InputFile } from "grammy";
import path from "path";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");
const CHANNEL_ID = process.env.TELEGRAM_STORAGE_CHANNEL_ID;

async function main() {
  if (!CHANNEL_ID) {
    console.error("No TELEGRAM_STORAGE_CHANNEL_ID provided in env.");
    // We can't test if we don't have it, but maybe we can trigger the error with a fake one?
    // But sending to a fake ID usually returns "Chat not found".
    // "String did not match pattern" suggests client-side validation failure.
  }

  const filePath = path.join(process.cwd(), "public", "1.mp4");
  const buffer = fs.readFileSync(filePath);
  const filename = "1.mp4"; // Simulating file.name

  console.log("Testing upload with Buffer...");

  try {
    const inputFile = new InputFile(buffer, filename);
    console.log("InputFile created.");

    // Testing specific error source
    // Maybe CHANNEL_ID has weird chars?
    const targetId = CHANNEL_ID || "-1001234567890";

    console.log(`Sending to ${targetId}...`);
    // NOTE: If this fails with "Chat not found", it's expected.
    // We are looking for "The string did not match the expected pattern".

    await bot.api.sendVideo(targetId, inputFile);
    console.log("Upload success (unexpected if ID is fake)");
  } catch (err: any) {
    console.error("Caught error:", err);
    console.error("Message:", err.message);
  }
}

main();
