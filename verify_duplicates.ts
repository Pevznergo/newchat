import "dotenv/config";
import { createGiftCodeBatch } from "./lib/db/gift-queries";

async function run() {
	try {
		console.log("Testing batch creation for duplication...");
		const quantity = 1;
		console.log(`Requesting ${quantity} code(s)...`);

		const codes = await createGiftCodeBatch({
			codeType: "premium_week",
			durationDays: 7,
			quantity: quantity,
		});

		console.log(`Created ${codes.length} codes.`);
		for (const c of codes) {
			console.log(`- ${c.code}`);
		}

		if (codes.length !== quantity) {
			console.error(`ERROR: Expected ${quantity}, got ${codes.length}`);
			process.exit(1);
		} else {
			console.log("SUCCESS: Correct number of codes created.");
		}
		process.exit(0);
	} catch (e) {
		console.error("Error:", e);
		process.exit(1);
	}
}

run();
