import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

async function main() {
	console.log("Checking 'cached_assets' table...");
	try {
		const assets =
			await sql`SELECT * FROM cached_assets ORDER BY created_at DESC LIMIT 10;`;

		if (assets.length === 0) {
			console.log("No assets found in cache yet.");
		} else {
			console.log(`Found ${assets.length} cached assets:`);
			assets.forEach((asset) => {
				console.log(`- URL: ${asset.url}`);
				console.log(`  File ID: ${asset.file_id}`);
				console.log(`  Type: ${asset.file_type}`);
				console.log(`  Created: ${asset.created_at}`);
				console.log("---");
			});
		}
	} catch (e) {
		console.error("Error querying table:", e);
	}
	process.exit(0);
}

main();
