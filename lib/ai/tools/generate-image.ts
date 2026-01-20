import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type GenerateImageProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const generateImage = ({ session, dataStream }: GenerateImageProps) =>
  tool({
    description: "Generate an image based on a prompt.",
    parameters: z.object({
      prompt: z.string().describe("The description of the image to generate"),
    }),
    execute: async ({ prompt }) => {
      // Check user entitlement
      const userType = session?.user?.type;

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
