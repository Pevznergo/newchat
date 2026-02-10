import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { messageTemplate } from "./schema";

config({
	path: ".env.local",
});

async function seedWeeklyTemplate() {
	if (!process.env.POSTGRES_URL) {
		console.log("⏭️  POSTGRES_URL not defined, cannot seed template");
		process.exit(1);
	}

	const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
	const db = drizzle(connection, { schema: { messageTemplate } });

	console.log("Seeding Weekly Limit Reminder template...");

	const templateName = "Weekly Limit Reminder";
	const content =
		"Ваши {{credits}} бесплатных запросов всё ещё ждут! ✨\n" +
		"Не упустите возможность создать что‑то уникальное.\n" +
		"Просто напишите нам — и мы поможем с любой задачей.";

	try {
		// Check if exists
		const existing = await db.query.messageTemplate.findFirst({
			where: eq(messageTemplate.name, templateName),
		});

		if (existing) {
			console.log("Template already exists. Updating content...");
			await db
				.update(messageTemplate)
				.set({
					content,
					updatedAt: new Date(),
				})
				.where(eq(messageTemplate.id, existing.id));
		} else {
			console.log("Creating new template...");
			await db.insert(messageTemplate).values({
				name: templateName,
				content,
				contentType: "text",
				templateType: "broadcast", // or system
				targetAudience: "free",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		console.log("Template seeded successfully!");
		process.exit(0);
	} catch (error) {
		console.error("Failed to seed template:", error);
		process.exit(1);
	}
}

seedWeeklyTemplate();
