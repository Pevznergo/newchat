import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  like,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { message, user } from "@/lib/db/schema";

export interface DailyStats {
  totalUsers: number;
  newUsers24h: number;
  activeUsers24h: number;
  messages24h: number;
  messageHistory: number[];
  growthHistory: number[]; // Last 7 days new user counts
  tariffBreakdown: { free: number; premium: number };
  sources: { source: string; count: number }[];
}

export async function getDailyStats(): Promise<DailyStats> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Total Users
  const [totalResult] = await db
    .select({ count: count() })
    .from(user)
    .where(or(isNull(user.email), not(like(user.email, "guest%"))));
  const totalUsers = totalResult?.count || 0;

  // 2. New Users (24h)
  const [newResult] = await db
    .select({ count: count() })
    .from(user)
    .where(
      and(
        gte(user.createdAt, yesterday),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const newUsers24h = newResult?.count || 0;

  // 3. Active Users (24h)
  const [activeResult] = await db
    .select({ count: count() })
    .from(user)
    .where(
      and(
        gte(user.lastVisit, yesterday),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const activeUsers24h = activeResult?.count || 0;

  // 4. Growth History (Last 7 days) & Message History
  const growthHistory: number[] = [];
  const messageHistory: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // New Users
    const [dayResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(user)
      .where(
        and(
          gte(user.createdAt, dayStart),
          lt(user.createdAt, dayEnd),
          or(isNull(user.email), not(like(user.email, "guest%")))
        )
      );
    growthHistory.push(dayResult?.count || 0);

    // Messages
    const [msgResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(message)
      .where(
        and(gte(message.createdAt, dayStart), lt(message.createdAt, dayEnd))
      );
    messageHistory.push(msgResult?.count || 0);
  }

  // 4.5 Messages 24h (Last entry in history is today/yesterday window, but let's be explicit)
  const [messagesResult] = await db
    .select({ count: count() })
    .from(message)
    .where(gte(message.createdAt, yesterday));
  const messages24h = messagesResult?.count || 0;

  // 5. Tariff Breakdown
  const [paidResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(user)
    .where(
      and(
        eq(user.hasPaid, true),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    );
  const premiumCount = paidResult?.count || 0;
  const freeCount = totalUsers - premiumCount;

  // 6. Traffic Sources (QR Codes / UTM)
  const sourcesResult = await db
    .select({
      source: sql<string>`COALESCE(NULLIF(${user.startParam}, ''), NULLIF(${user.utmSource}, ''), 'Unknown')`,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(user)
    .where(
      and(
        or(
          sql`NULLIF(${user.startParam}, '') IS NOT NULL`,
          sql`NULLIF(${user.utmSource}, '') IS NOT NULL`
        ),
        or(isNull(user.email), not(like(user.email, "guest%")))
      )
    )
    .groupBy(
      sql`COALESCE(NULLIF(${user.startParam}, ''), NULLIF(${user.utmSource}, ''), 'Unknown')`
    )
    .orderBy(desc(count()))
    .limit(5);

  const sources = sourcesResult.map((s) => ({
    source: s.source || "Unknown",
    count: s.count,
  }));

  return {
    totalUsers,
    newUsers24h,
    activeUsers24h,
    messages24h,
    messageHistory,
    growthHistory,
    tariffBreakdown: { free: freeCount, premium: premiumCount },
    sources,
  };
}
