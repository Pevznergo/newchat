import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
	aiModel,
	chat,
	clan, // added
	document,
	message,
	messageDeprecated,
	stream,
	subscription,
	suggestion,
	tariff,
	user,
	userConsent,
	vote,
	voteDeprecated,
} from "./schema";

const schema = {
	aiModel,
	chat,
	document,
	message,
	messageDeprecated,
	stream,
	subscription,
	suggestion,
	tariff,
	user,
	userConsent,
	vote,
	voteDeprecated,
	clan, // added
};

// Prevent multiple connections in development
const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(process.env.POSTGRES_URL || "");
if (process.env.NODE_ENV !== "production") {
	globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });
