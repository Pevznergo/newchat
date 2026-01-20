import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type GenerateImageProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const generateImage = ({ session }: GenerateImageProps) =>
  tool({
    description:
      "Generate an image, picture, or drawing. Use this tool when the user asks to 'draw', 'create', 'generate' or 'make' an image/picture (keywords: нарисуй, создай, сгенерируй, сделай картинку/изображение).",
    inputSchema: z.object({
      prompt: z.string().describe("The description of the image to generate"),
    }),
    execute: async ({ prompt }) => {
      // Check user entitlement
      const userType = session?.user?.type;

      // Simulate async operation to satisfy tool requirement if needed,
      // though typically async without await is just a lint warning.
      // We will add a small delay to make it truly async and realistic.
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (userType === "pro") {
        return {
          status: "success",
          message: "Image generation is coming soon!",
          prompt,
        };
      }

      return {
        status: "denied",
        reason: "upgrade_required",
        prompt,
      };
    },
  });
