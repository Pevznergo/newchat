import { Bot, InputFile } from "grammy";
import { NextResponse } from "next/server";
import { Readable } from "stream";
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
	console.log("[Admin Upload] Start processing request");
	const session = await auth();

	if (!session) {
		console.warn("[Admin Upload] Unauthorized access attempt");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!STORAGE_CHANNEL_ID) {
		console.error("[Admin Upload] TELEGRAM_STORAGE_CHANNEL_ID missing");
		return NextResponse.json(
			{ error: "TELEGRAM_STORAGE_CHANNEL_ID not configured" },
			{ status: 500 },
		);
	}

	try {
		const formData = await request.formData();
		const file = formData.get("file") as Blob;

		if (!file) {
			console.warn("[Admin Upload] No file in request");
			return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
		}

		const filename = (formData.get("file") as File).name;
		const fileType = file.type;
		const fileSize = file.size;

		console.log(
			`[Admin Upload] File received: ${filename}, Type: ${fileType}, Size: ${fileSize}`,
		);

		const validatedFile = AdminFileSchema.safeParse({ file });

		if (!validatedFile.success) {
			const errorMessage = validatedFile.error.errors
				.map((error) => error.message)
				.join(", ");
			console.warn(`[Admin Upload] Validation failed: ${errorMessage}`);
			return NextResponse.json({ error: errorMessage }, { status: 400 });
		}

		// Convert to Stream for efficient piping to Telegram (avoids loading full file into RAM)
		console.log("[Admin Upload] Creating stream pipeline to Telegram...");

		// Convert Web Stream (Blob) to Node Stream
		const nodeStream = Readable.fromWeb(file.stream() as any);
		const inputFile = new InputFile(nodeStream, filename);

		console.log("[Admin Upload] Sending to Telegram...");
		let result: any;

		if (fileType.startsWith("image/")) {
			result = await bot.api.sendPhoto(STORAGE_CHANNEL_ID, inputFile);
		} else if (fileType.startsWith("video/")) {
			result = await bot.api.sendVideo(STORAGE_CHANNEL_ID, inputFile);
		} else {
			result = await bot.api.sendDocument(STORAGE_CHANNEL_ID, inputFile);
		}

		console.log("[Admin Upload] Telegram response received");

		// Extract file_id from search for 'file_id' in result object
		let fileId = "";
		if (result.photo) {
			fileId = result.photo.at(-1).file_id;
		} else if (result.video) {
			fileId = result.video.file_id;
		} else if (result.document) {
			fileId = result.document.file_id;
		}

		if (!fileId) {
			console.error(
				"[Admin Upload] Failed to extract file_id from response",
				result,
			);
			throw new Error("Failed to extract file_id from Telegram response");
		}

		console.log(`[Admin Upload] Success. File ID: ${fileId}`);
		return NextResponse.json({ url: fileId, file_id: fileId });
	} catch (error) {
		console.error("[Admin Upload] Error:", error);
		return NextResponse.json(
			{ error: `Telegram upload failed: ${(error as Error).message}` },
			{ status: 500 },
		);
	}
}
