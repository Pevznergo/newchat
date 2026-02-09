import { Bot, InputFile } from "grammy";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");
const STORAGE_CHANNEL_ID = process.env.TELEGRAM_STORAGE_CHANNEL_ID;

// Schema for admin uploads (allows video, larger size)
const AdminFileSchema = z.object({
  file: z.instanceof(Blob).refine((file) => file.size <= 50 * 1024 * 1024, {
    // 50MB limit
    message: "File size should be less than 50MB",
  }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!STORAGE_CHANNEL_ID) {
    return NextResponse.json(
      { error: "TELEGRAM_STORAGE_CHANNEL_ID not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = AdminFileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    console.log(
      `[Admin Upload] Processing file: ${filename}, Size: ${file.size}, Type: ${file.type}`
    );
    console.log(
      `[Admin Upload] Storage Channel: ${STORAGE_CHANNEL_ID}, Token length: ${bot.token?.length}`
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const inputFile = new InputFile(buffer, filename);

    let result: any;
    const mimeType = file.type;

    if (mimeType.startsWith("image/")) {
      result = await bot.api.sendPhoto(STORAGE_CHANNEL_ID, inputFile);
    } else if (mimeType.startsWith("video/")) {
      result = await bot.api.sendVideo(STORAGE_CHANNEL_ID, inputFile);
    } else {
      result = await bot.api.sendDocument(STORAGE_CHANNEL_ID, inputFile);
    }

    // Extract file_id from search for 'file_id' in result object
    let fileId = "";
    if (result.photo) {
      fileId = result.photo.at(-1).file_id;
    } else if (result.video) {
      fileId = result.video.file_id;
    } else if (result.document) {
      fileId = result.document.file_id;
    }

    return NextResponse.json({ url: fileId, file_id: fileId });
  } catch (error) {
    console.error("Telegram upload failed:", error);
    return NextResponse.json(
      { error: `Telegram upload failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
