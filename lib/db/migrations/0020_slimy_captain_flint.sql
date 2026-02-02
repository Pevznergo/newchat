ALTER TABLE "AiModel" ADD COLUMN "api_model_id" varchar(255);--> statement-breakpoint
ALTER TABLE "AiModel" ADD COLUMN "required_clan_level" integer DEFAULT 1;