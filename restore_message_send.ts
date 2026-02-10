import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

async function main() {
	console.log("Restoring 'MessageSend' table...");
	try {
		await sql`
      CREATE TABLE IF NOT EXISTS "MessageSend" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "template_id" uuid REFERENCES "MessageTemplate"("id") ON DELETE SET NULL,
        "follow_up_rule_id" uuid REFERENCES "FollowUpRule"("id") ON DELETE SET NULL,
        "broadcast_id" uuid,
        "send_type" varchar(20) NOT NULL,
        "status" varchar(20) DEFAULT 'pending',
        "telegram_message_id" varchar(50),
        "telegram_chat_id" varchar(50),
        "error_message" text,
        "retry_count" integer DEFAULT 0,
        "scheduled_at" timestamp,
        "sent_at" timestamp,
        "delivered_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "mixpanel_event_id" varchar(255),
        "mixpanel_tracked" boolean DEFAULT false
      );
    `;
		console.log("Table 'MessageSend' created successfully.");
	} catch (e) {
		console.error("Error creating table:", e);
	}
	process.exit(0);
}

main();
