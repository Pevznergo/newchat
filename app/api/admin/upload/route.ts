import Busboy from "busboy";
import { Bot, InputFile } from "grammy";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import { auth } from "@/app/(auth)/auth";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "");
const STORAGE_CHANNEL_ID = process.env.TELEGRAM_STORAGE_CHANNEL_ID;

// Schema for admin uploads not used in streaming mode
// const AdminFileSchema = ...

export async function POST(request: Request) {
	console.log("[Admin Upload] Start processing request (Stream Mode)");
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
		const contentType = request.headers.get("content-type");
		if (!contentType || !contentType.includes("multipart/form-data")) {
			return NextResponse.json(
				{ error: "Content-Type must be multipart/form-data" },
				{ status: 400 },
			);
		}

		const fileId = await new Promise<string>((resolve, reject) => {
			const bb = Busboy({
				headers: {
					"content-type": contentType,
				},
			});

			let fileStreamDetected = false;

			let videoWidth: number | undefined;
			let videoHeight: number | undefined;
			let videoDuration: number | undefined;
			let thumbnailBuffer: Buffer | null = null;

			bb.on("field", (name, val) => {
				if (name === "width") videoWidth = parseInt(val);
				if (name === "height") videoHeight = parseInt(val);
				if (name === "duration") videoDuration = parseInt(val);
			});

			bb.on("file", async (name, fileStream, info) => {
				const { filename, mimeType } = info;

				// Handle thumbnail upload (must be before the main file in FormData)
				if (name === "thumb") {
					console.log("[Admin Upload] thumb received");
					const chunks: Uint8Array[] = [];
					fileStream.on("data", (chunk) => chunks.push(chunk));
					fileStream.on("end", () => {
						thumbnailBuffer = Buffer.concat(chunks);
						console.log(
							`[Admin Upload] Thumbnail buffered: ${thumbnailBuffer.length} bytes`,
						);
					});
					return;
				}

				console.log(
					`[Admin Upload] Stream received: ${filename}, Type: ${mimeType}`,
				);
				fileStreamDetected = true;

				try {
					// Pass the stream directly to Grammy
					// InputFile accepts a Readable stream.
					const inputFile = new InputFile(fileStream, filename);

					console.log("[Admin Upload] Sending stream to Telegram...");
					let result: any;

					if (mimeType.startsWith("image/")) {
						result = await bot.api.sendPhoto(STORAGE_CHANNEL_ID, inputFile);
					} else if (mimeType.startsWith("video/")) {
						console.log(
							`[Admin Upload] Sending video with dimensions: ${videoWidth}x${videoHeight}, duration: ${videoDuration}`,
						);

						const videoOptions: any = { supports_streaming: true };
						if (videoWidth) videoOptions.width = videoWidth;
						if (videoHeight) videoOptions.height = videoHeight;
						if (videoDuration) videoOptions.duration = videoDuration;
						if (thumbnailBuffer) {
							videoOptions.thumbnail = new InputFile(
								thumbnailBuffer,
								"thumb.jpg",
							);
						}

						result = await bot.api.sendVideo(
							STORAGE_CHANNEL_ID,
							inputFile,
							videoOptions,
						);
					} else {
						result = await bot.api.sendDocument(STORAGE_CHANNEL_ID, inputFile);
					}

					console.log("[Admin Upload] Telegram response received");

					// Extract file_id
					let fid = "";
					if (result.photo) {
						fid = result.photo.at(-1).file_id;
					} else if (result.video) {
						fid = result.video.file_id;
					} else if (result.document) {
						fid = result.document.file_id;
					}

					if (fid) {
						resolve(fid);
					} else {
						reject(
							new Error("Failed to extract file_id from Telegram response"),
						);
					}
				} catch (err) {
					console.error("[Admin Upload] Streaming upload failed:", err);
					reject(err);
				} finally {
					// Ensure stream is consumed if error occurred
					if (name !== "thumb") {
						fileStream.resume();
					}
				}
			});

			bb.on("error", (err) => {
				console.error("[Admin Upload] Busboy error:", err);
				reject(err);
			});

			bb.on("close", () => {
				if (!fileStreamDetected) {
					reject(new Error("No file found in request"));
				}
			});

			// Pipe the Web Request body (converted to Node stream) to Busboy
			if (request.body) {
				// @ts-expect-error
				const nodeStream = Readable.fromWeb(request.body);
				nodeStream.pipe(bb);
			} else {
				reject(new Error("Request body is empty"));
			}
		});

		console.log(`[Admin Upload] Success. File ID: ${fileId}`);
		return NextResponse.json({ url: fileId, file_id: fileId });
	} catch (error) {
		console.error("[Admin Upload] Error:", error);
		return NextResponse.json(
			{ error: `Upload failed: ${(error as Error).message}` },
			{ status: 500 },
		);
	}
}
