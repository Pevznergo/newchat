import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { refreshClanLevel } from "@/lib/db/queries";
import { clan, user } from "@/lib/db/schema";

async function handleUserDeparture(userId: string, currentClanId: number) {
	// Check if owner
	const userRecord = await db.query.user.findFirst({
		where: eq(user.id, userId),
		columns: { clanRole: true },
	});

	if (userRecord?.clanRole === "owner") {
		// Find other members
		const otherMembers = await db.query.user.findMany({
			where: and(eq(user.clanId, currentClanId), ne(user.id, userId)),
		});

		if (otherMembers.length === 0) {
			// Mark clan deleted
			await db
				.update(clan)
				.set({ isDeleted: true })
				.where(eq(clan.id, currentClanId));
		} else {
			// Pick new owner
			// Priority: Pro members, then any.
			const proMembers = otherMembers.filter((m) => m.hasPaid);
			// Randomly pick from candidates
			const candidates = proMembers.length > 0 ? proMembers : otherMembers;
			const newOwner =
				candidates[Math.floor(Math.random() * candidates.length)];

			// Transfer ownership
			await db
				.update(clan)
				.set({ ownerId: newOwner.id })
				.where(eq(clan.id, currentClanId));
			await db
				.update(user)
				.set({ clanRole: "owner" })
				.where(eq(user.id, newOwner.id));
		}
	}

	// Remove current user from clan
	await db
		.update(user)
		.set({
			clanId: null,
			clanRole: "member", // Reset role to member
		})
		.where(eq(user.id, userId));

	// Refresh level for the OLD clan
	await refreshClanLevel(currentClanId);
}

export async function createClan(userId: string, name: string) {
	try {
		// Check if user already in clan
		const existingUser = await db.query.user.findFirst({
			where: eq(user.id, userId),
			columns: { clanId: true },
		});

		if (existingUser?.clanId) {
			return { success: false, error: "already_in_clan" };
		}

		// Check name uniqueness
		const existingName = await db.query.clan.findFirst({
			where: eq(clan.name, name),
		});
		if (existingName) {
			return { success: false, error: "name_taken" };
		}

		const inviteCode = `CLAN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

		const [newClan] = await db
			.insert(clan)
			.values({
				name,
				inviteCode,
				ownerId: userId,
				level: 1,
			})
			.returning();

		// Update user
		await db
			.update(user)
			.set({
				clanId: newClan.id,
				clanRole: "owner",
			})
			.where(eq(user.id, userId));

		// Refresh level (though it should be 1 initially, maybe counts/pro update?)
		await refreshClanLevel(newClan.id);

		return { success: true, clan: newClan };
	} catch (error) {
		console.error("Create clan failed", error);
		return { success: false, error: "database_error" };
	}
}

export async function joinClan(userId: string, inviteCode: string) {
	try {
		const targetClan = await db.query.clan.findFirst({
			where: eq(clan.inviteCode, inviteCode),
		});

		if (!targetClan) {
			return { success: false, error: "clan_not_found" };
		}

		const existingUser = await db.query.user.findFirst({
			where: eq(user.id, userId),
			columns: { clanId: true },
		});

		if (existingUser?.clanId) {
			if (existingUser.clanId === targetClan.id) {
				return { success: false, error: "already_in_this_clan" };
			}
			// User is in another clan -> Switch Clan
			await handleUserDeparture(userId, existingUser.clanId);
		}

		// Update user
		await db
			.update(user)
			.set({
				clanId: targetClan.id,
				clanRole: "member",
			})
			.where(eq(user.id, userId));

		// Refresh level for NEW clan
		await refreshClanLevel(targetClan.id);

		return { success: true, clan: targetClan };
	} catch (error) {
		console.error("Join clan failed", error);
		return { success: false, error: "database_error" };
	}
}

export async function leaveClan(userId: string) {
	try {
		const u = await db.query.user.findFirst({
			where: eq(user.id, userId),
			columns: { clanId: true, clanRole: true },
		});

		if (!u || !u.clanId) {
			return { success: false, error: "not_in_clan" };
		}

		// ALLOW owners to leave now, triggering transfer/delete logic
		await handleUserDeparture(userId, u.clanId);

		/* 
    // OLD LOGIC
    if (u.clanRole === "owner") {
       return { success: false, error: "owner_cannot_leave" };
    }
    await db.update(user)... 
    */

		return { success: true };
	} catch (error) {
		console.error("Leave clan failed", error);
		return { success: false, error: "database_error" };
	}
}
