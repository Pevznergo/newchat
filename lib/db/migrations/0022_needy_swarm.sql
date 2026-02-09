CREATE INDEX "user_created_at_idx" ON "User" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_last_visit_idx" ON "User" USING btree ("last_visit");--> statement-breakpoint
CREATE INDEX "user_has_paid_idx" ON "User" USING btree ("has_paid");--> statement-breakpoint
CREATE INDEX "user_telegram_id_idx" ON "User" USING btree ("telegramId");