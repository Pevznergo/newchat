"use client";

import { FileVideo, Image as ImageIcon, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

interface MediaUploaderProps {
	mediaType: string;
	mediaUrl: string;
	onUploadComplete: (url: string) => void;
	onClear: () => void;
}

export default function MediaUploader({
	mediaType,
	mediaUrl,
	onUploadComplete,
	onClear,
}: MediaUploaderProps) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		setError(null);
		setUploading(true);

		try {
			if (mediaType === "photo" && !file.type.startsWith("image/")) {
				throw new Error("Please select an image file");
			}
			if (mediaType === "video" && !file.type.startsWith("video/")) {
				throw new Error("Please select a video file");
			}

			const formData = new FormData();

			// If it's a video, try to get dimensions and duration
			if (mediaType === "video") {
				try {
					const video = document.createElement("video");
					video.preload = "metadata";
					video.src = URL.createObjectURL(file);

					await new Promise<void>((resolve, reject) => {
						video.onloadedmetadata = () => {
							URL.revokeObjectURL(video.src);
							resolve();
						};
						video.onerror = () => reject(new Error("Invalid video file"));
					});

					formData.append("width", video.videoWidth.toString());
					formData.append("height", video.videoHeight.toString());
					formData.append("duration", Math.ceil(video.duration).toString());
				} catch (e) {
					console.warn("Could not extract video metadata:", e);
				}
			}

			formData.append("file", file);

			const response = await fetch("/api/admin/upload", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const text = await response.text();
				let errorMessage = "Upload failed";
				try {
					const data = JSON.parse(text);
					errorMessage = data.error || errorMessage;
				} catch {
					console.error("Non-JSON error response:", text);
					errorMessage = `Server Error (${response.status}): ${text.slice(0, 100)}`;
				}
				throw new Error(errorMessage);
			}

			const blob = await response.json();
			onUploadComplete(blob.url);
		} catch (err: any) {
			console.error("Upload error details:", err);
			setError(err.message || "An unexpected error occurred");
		} finally {
			setUploading(false);
			// Reset input so same file can be selected again if needed
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	if (!mediaType) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="block text-sm font-medium text-zinc-400">
					Media File ({mediaType === "photo" ? "Image" : "Video"})
				</div>
				{mediaUrl && (
					<button
						className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
						onClick={onClear}
						type="button"
					>
						<X className="w-3 h-3" /> Remove
					</button>
				)}
			</div>

			<div className="border border-zinc-700 rounded-lg p-4 bg-zinc-950/50">
				{mediaUrl ? (
					<div className="relative group">
						{mediaUrl.startsWith("http") ? (
							<>
								{mediaType === "photo" ? (
									<div className="relative h-48 w-full rounded-lg overflow-hidden bg-zinc-900">
										<Image
											alt="Media preview"
											className="object-contain"
											fill
											src={mediaUrl}
											unoptimized // Allow external URLs
										/>
									</div>
								) : (
									<video
										className="w-full h-48 rounded-lg bg-black cursor-pointer"
										controls
										src={mediaUrl}
									>
										<track kind="captions" />
									</video>
								)}
							</>
						) : (
							<div className="h-48 w-full flex flex-col items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
								{mediaType === "photo" ? (
									<ImageIcon className="w-12 h-12 text-zinc-600 mb-2" />
								) : (
									<FileVideo className="w-12 h-12 text-zinc-600 mb-2" />
								)}
								<p className="text-sm text-zinc-400 font-medium">
									Native Telegram {mediaType}
								</p>
								<p className="text-xs text-zinc-600 mt-1">
									Ready for broadcast
								</p>
							</div>
						)}
						<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
								onClick={onClear}
								type="button"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
						<p className="text-xs text-zinc-500 mt-2 truncate font-mono">
							ID: {mediaUrl}
						</p>
					</div>
				) : (
					<button
						className={`w-full border-2 border-dashed border-zinc-800 rounded-lg p-8 text-center transition-colors ${
							uploading
								? "opacity-50 cursor-not-allowed"
								: "hover:border-zinc-600 cursor-pointer"
						}`}
						disabled={uploading}
						onClick={() => {
							if (!uploading) {
								fileInputRef.current?.click();
							}
						}}
						type="button"
					>
						<input
							accept={mediaType === "photo" ? "image/*" : "video/*"}
							className="hidden"
							disabled={uploading}
							onChange={handleFileSelect}
							ref={fileInputRef}
							type="file"
						/>

						<div className="flex flex-col items-center gap-2">
							{uploading ? (
								<Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
							) : mediaType === "photo" ? (
								<ImageIcon className="w-8 h-8 text-zinc-600" />
							) : (
								<FileVideo className="w-8 h-8 text-zinc-600" />
							)}

							<p className="text-sm text-zinc-400 font-medium">
								{uploading ? "Uploading..." : `Click to upload ${mediaType}`}
							</p>
							<p className="text-xs text-zinc-600">
								{mediaType === "photo"
									? "PNG, JPG up to 5MB"
									: "MP4 up to 50MB"}
							</p>
						</div>
					</button>
				)}

				{error && (
					<p className="text-sm text-red-500 mt-2 bg-red-500/10 p-2 rounded border border-red-500/20">
						Error: {error}
					</p>
				)}
			</div>
		</div>
	);
}
