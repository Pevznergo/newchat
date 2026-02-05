import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const inspect = async () => {
	const connectionString = process.env.POSTGRES_URL;
	if (!connectionString) {
		throw new Error("POSTGRES_URL is not defined");
	}

	const sql = postgres(connectionString);

	console.log("🔍 Inspecting AiModel columns...");

	const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'AiModel' OR table_name = 'aimodel'
  `;

	console.log("Columns found:", columns);

	process.exit(0);
};

inspect();
