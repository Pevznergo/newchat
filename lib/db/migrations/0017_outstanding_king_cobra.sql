ALTER TABLE "AiModel" RENAME COLUMN "provider" TO "provider_id";--> statement-breakpoint
ALTER TABLE "Clan" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;