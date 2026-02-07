import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { type Context, InputFile } from "grammy";
import { db } from "@/lib/db";
import { cachedAssets } from "@/lib/db/schema";

// Channel ID to upload caching files to (User must provide this via env or hardcode)
const FILES_CHANNEL_ID =
  process.env.TELEGRAM_STORAGE_CHANNEL_ID || "-100YOURCHANNELID";

/**
 * Smart caching for Telegram files.
 * 1. Checks DB for existing file_id.
 * 2. If missing, attempts to upload to channel to get persistent ID.
 * 3. Falls back to InputFile if upload fails.
 */
export async function getTelegramFileId(
  ctx: Context,
  key: string,
  filePath: string,
  type: "video" | "photo" = "video"
): Promise<string | InputFile> {
  try {
    // 1. Check Cache
    const cached = await db.query.cachedAssets.findFirst({
      where: eq(cachedAssets.key, key),
    });

    if (cached?.fileId) {
      console.log(`[Cache Hit] Using cached file_id for ${key}`);
      return cached.fileId;
    }

    // 2. Not cached - Upload required
    console.log(`[Cache Miss] Uploading ${filePath} for key ${key}...`);

    let fileId: string | undefined;

    // Try uploading to dedicated channel if ID is set
    // Note: Bot must be admin in channel
    // Note: Bot must be admin in channel

    if (FILES_CHANNEL_ID && FILES_CHANNEL_ID !== "-100YOURCHANNELID") {
      try {
        const fileName = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        const file = new InputFile(fileBuffer, fileName);
        let sentMsg: any;

        if (type === "video") {
          sentMsg = await ctx.api.sendVideo(FILES_CHANNEL_ID, file, {
            caption: `Cache: ${key}`,
            supports_streaming: true,
          });
          fileId = sentMsg.video?.file_id;
        } else if (type === "photo") {
          sentMsg = await ctx.api.sendPhoto(FILES_CHANNEL_ID, file, {
            caption: `Cache: ${key}`,
          });
          // Use largest photo variant (last item)
          const photos = sentMsg.photo;
          if (photos && photos.length > 0) {
            fileId = photos.at(-1)?.file_id;
          }
        }

        if (fileId) {
          // 3. Save to DB
          await db.insert(cachedAssets).values({
            key,
            fileId,
            type,
          });
          console.log(`[Cache Saved] ${key} -> ${fileId}`);
          return fileId;
        }
      } catch (uploadError) {
        console.warn(
          `Failed to upload to cache channel ${FILES_CHANNEL_ID}:`,
          uploadError
        );
        // Fallback to uploading directly to user (no channel)
      }
    }

    // Fallback: If channel upload failed or not configured, return InputFile
    // Pass InputFile to caller, they will send it.
    // OPTIONAL: We could capture the file_id AFTER sending to user, but that requires
    // intercepting the SendMessage result in the route handler.
    // For now, simpler implementation: Return InputFile.
    return new InputFile(filePath);
  } catch (error) {
    console.error("Error in getTelegramFileId:", error);
    return new InputFile(filePath);
  }
}
