import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

async function main() {
	console.log("Checking for 'MessageSend' table...");
	try {
		// Check if table exists (case sensitive)
		const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name = 'MessageSend' OR table_name = 'message_send');
    `;

		console.log("Found tables:", tables);

		if (tables.length === 0) {
			console.log(
				"Table 'MessageSend' NOT found. You might need to run migration.",
			);
		} else {
			const found = tables[0].table_name;
			console.log(`Table '${found}' exists.`);

			// If query fails with "MessageSend" relation not exist, it might be due to quotes.
			// Drizzle uses "MessageSend" (quoted) if defined as pgTable("MessageSend", ...)
			// If Postgres has it as message_send (lowercase), querying "MessageSend" will fail.

			if (found !== "MessageSend") {
				console.log(
					"Warning: Table name mismatch. Drizzle expects 'MessageSend' but DB has '" +
						found +
						"'.",
				);
				// Recommendation: Rename table to "MessageSend" to match Drizzle schema
				// await sql`ALTER TABLE "${found}" RENAME TO "MessageSend";`;
			}
		}
	} catch (e) {
		console.error("Error asking DB:", e);
	}
	process.exit(0);
}

main();
