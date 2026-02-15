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
		console.log("Creating test codes...");
		// 1. Create a fresh code
		const _code1 = await createGiftCode({
			codeType: "premium_week",
			durationDays: 7,
		});

		// 2. Create another code and mark it used
		const code2 = await createGiftCode({
			codeType: "premium_week",
			durationDays: 7,
		});

		const [u] = await db.select().from(user).limit(1);
		if (!u) {
			console.error("No users");
			process.exit(1);
		}

		await activateGiftCode(code2.code, u.id);

		console.log(
			"Fetching with default filter (excludeFullyUsed=undefined -> backend logic?)",
		);
		// In my route.ts logic: if showUsed=false (default), excludeFullyUsed=true.
		// But getAllGiftCodes itself needs an explicit flag.
		// Let's test calling getAllGiftCodes directly with filters.

		console.log("--- TEST 1: excludeFullyUsed = true (Should hide used)");
		const codesHidden = await getAllGiftCodes({ excludeFullyUsed: true });
		const found2Hidden = codesHidden.find((c) => c.id === code2.id);
		console.log("Used code hidden?", !found2Hidden);

		console.log("--- TEST 2: excludeFullyUsed = false (Should show used)");
		const codesShown = await getAllGiftCodes({ excludeFullyUsed: false });
		const found2Shown = codesShown.find((c) => c.id === code2.id);
		console.log("Used code shown?", !!found2Shown);

		process.exit(0);
	} catch (e) {
		console.error("Error:", e);
		process.exit(1);
	}
}

run();
