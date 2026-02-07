import "dotenv/config";
import { Bot, InputFile } from "grammy";

const bot = new Bot((process.env.TELEGRAM_BOT_TOKEN || "").trim());
const CHANNEL_ID = (
  process.env.TELEGRAM_STORAGE_CHANNEL_ID || "-1001234567890"
).trim();

async function main() {
  console.log("Testing Blob -> Buffer -> InputFile upload...");

  // Simulate Blob creation (Node 18+)
  const buffer = Buffer.from("fake video content");
  const blob = new Blob([buffer], { type: "video/mp4" });

  // Logic from route.ts
  const arrayBuffer = await blob.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const filename = "test_blob.mp4";

  const inputFile = new InputFile(fileBuffer, filename);

  try {
    console.log(`Sending to ${CHANNEL_ID}...`);
    await bot.api.sendVideo(CHANNEL_ID, inputFile);
    console.log("Success (unexpected)");
  } catch (err: any) {
    console.log("Error:", err.message);
    if (err.message.includes("string did not match")) {
      console.log("REPRODUCED!");
    }
  }
}

main();
