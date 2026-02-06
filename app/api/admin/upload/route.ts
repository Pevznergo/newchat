import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";

// Schema for admin uploads (allows video, larger size)
const AdminFileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 50 * 1024 * 1024, {
      // 50MB limit
      message: "File size should be less than 50MB",
    })
    .refine(
      (file) =>
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/quicktime",
          "video/webm",
        ].includes(file.type),
      {
        message:
          "File type must be an image (JPEG, PNG, WEBP, GIF) or video (MP4, MOV, WEBM)",
      }
    ),
});

export async function POST(request: Request) {
  const session = await auth();

  // Basic auth check - arguably should accept admin only
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add admin role check if available on session
  // if (!session.user.isAdmin) ...

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
    // Add timestamp/random to filename to avoid collisions
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;

    // Note: This requires BLOB_READ_WRITE_TOKEN env var
    const blob = await put(uniqueFilename, file, {
      access: "public",
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error("Upload failed details:", error);
    return NextResponse.json(
      { error: "Upload failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}
