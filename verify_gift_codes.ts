import "dotenv/config";
import "dotenv/config";
import {
	activateGiftCode,
	createGiftCode,
	getAllGiftCodes,
} from "./lib/db/gift-queries";
import { db } from "./lib/db/index";
import { user } from "./lib/db/schema";

async function run() {
	try {
		// Need to wait for connection? Usually drizzle/postgres handles it.
		console.log("Creating test codes...");
		// 1. Create a fresh code
		const code1 = await createGiftCode({
			codeType: "premium_week",
			durationDays: 7,
			// removed quantity
		});

		console.log("Created unused code:", code1.code);

		// 2. Create another code and mark it used
		const code2 = await createGiftCode({
			codeType: "premium_week",
			durationDays: 7,
		});
		console.log("Created code to serve as used:", code2.code);

		// Mock a user ID (or find one)
		const [u] = await db.select().from(user).limit(1);
		if (!u) {
			console.error("No users found to activate code");
			return;
		}

		// Activate it
		// code2.code might need to be passed strictly
		await activateGiftCode(code2.code, u.id);
		console.log("Activated code:", code2.code);

		// 3. Fetch all codes
		console.log("Fetching all codes...");
		const allCodes = await getAllGiftCodes();

		const found1 = allCodes.find((c) => c.id === code1.id);
		const found2 = allCodes.find((c) => c.id === code2.id);

		console.log("Found unused code?", !!found1);
		console.log("Found used code?", !!found2);

		if (found2) {
			console.log("Used code details:", found2);
		}

		process.exit(0);
	} catch (e) {
		console.error("Error:", e);
		process.exit(1);
	}
}

run();
