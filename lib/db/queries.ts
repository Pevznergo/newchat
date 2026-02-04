import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import { generateUUID } from "../utils";
import {
  type AiModel,
  aiModel,
  type Chat,
  chat,
  clanLevel,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  userConsent,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

import { db } from "@/lib/db";
import { clan, tariff } from "@/lib/db/schema"; // Ensure tariff and clan schema is imported

export async function getUserClan(userId: string) {
  try {
    const [u] = await db
      .select({ clanId: user.clanId, clanRole: user.clanRole })
      .from(user)
      .where(eq(user.id, userId));

    if (!u || !u.clanId) {
      return null;
    }

    const [c] = await db
      .select()
      .from(clan)
      .where(and(eq(clan.id, u.clanId), eq(clan.isDeleted, false)));
    return { ...c, role: u.clanRole };
  } catch (error) {
    console.error("Failed to get user clan", error);
    return null;
  }
}

export async function getClanById(id: number) {
  return await db.query.clan.findFirst({
    where: and(eq(clan.id, id), eq(clan.isDeleted, false)),
  });
}

export async function getClanByInviteCode(code: string) {
  return await db.query.clan.findFirst({
    where: and(eq(clan.inviteCode, code), eq(clan.isDeleted, false)),
  });
}

export async function getClanMemberCounts(clanId: number) {
  try {
    // Count total members
    const [totalRes] = await db
      .select({ count: count(user.id) })
      .from(user)
      .where(eq(user.clanId, clanId));

    // Count pro members (hasPaid = true)
    const [proRes] = await db
      .select({ count: count(user.id) })
      .from(user)
      .where(and(eq(user.clanId, clanId), eq(user.hasPaid, true)));

    return {
      totalMembers: totalRes?.count ?? 0,
      proMembers: proRes?.count ?? 0,
    };
  } catch (error) {
    console.error("Failed to get clan member counts", error);
    return { totalMembers: 0, proMembers: 0 };
  }
}

export async function getClanMembers(clanId: number) {
  try {
    const members = await db
      .select({
        id: user.id,
        name: user.name,
        telegramId: user.telegramId,
        role: user.clanRole,
        hasPaid: user.hasPaid,
      })
      .from(user)
      .where(eq(user.clanId, clanId))
      .orderBy(desc(user.hasPaid), desc(user.clanRole)); // List paid/owners first

    return members;
  } catch (error) {
    console.error("Failed to get clan members", error);
    return [];
  }
}

export async function getAllTariffs() {
  try {
    return await db.select().from(tariff).where(eq(tariff.isActive, true));
  } catch (error) {
    console.error("Failed to get tariffs", error);
    return [];
  }
}

export async function getTariffBySlug(slug: string) {
  try {
    const [t] = await db.select().from(tariff).where(eq(tariff.slug, slug));
    return t;
  } catch (error) {
    console.error(`Failed to get tariff by slug ${slug}`, error);
    return null;
  }
}

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGoogleUser(email: string, googleId: string) {
  try {
    return await db.insert(user).values({ email, googleId }).returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create google user"
    );
  }
}

export async function linkGoogleAccount(email: string, googleId: string) {
  try {
    return await db
      .update(user)
      .set({ googleId })
      .where(eq(user.email, email))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to link google account"
    );
  }
}

export async function createTelegramUser(
  telegramId: string,
  email?: string,
  startParam?: string,
  tracking?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  }
) {
  try {
    const finalEmail = email || `telegram-${telegramId}@telegram.bot`;
    const createdUsers = await db
      .insert(user)
      .values({
        email: finalEmail,
        telegramId,
        startParam: startParam || null, // Save QR code source
        ...tracking,
      })
      .returning();

    const newUser = createdUsers[0];

    // Auto-Create Clan
    try {
      const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
      const clanName = `My Clan ${randomSuffix}`;
      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const [newClan] = await db
        .insert(clan)
        .values({
          name: clanName,
          inviteCode,
          ownerId: newUser.id, // UUID
        })
        .returning();

      await db
        .update(user)
        .set({ clanId: newClan.id, clanRole: "owner" })
        .where(eq(user.id, newUser.id));
    } catch (e) {
      console.error("Failed to auto-create clan for new user", e);
    }

    return createdUsers;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create telegram user"
    );
  }
}

export async function updateUserTracking(
  userId: string,
  tracking: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  }
) {
  try {
    return await db.update(user).set(tracking).where(eq(user.id, userId));
  } catch (e) {
    console.error("Failed to update user tracking", e);
  }
}

export async function getUserByTelegramId(telegramId: string) {
  try {
    return await db.select().from(user).where(eq(user.telegramId, telegramId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by telegram id"
    );
  }
}

export async function setLastMessageId(userId: string, messageId: string) {
  // ATOMIC UPDATE: Only update if the new ID is strictly greater (or if null)
  // Converting to integer for comparison is safer for Telegram IDs
  try {
    const result = await db
      .update(user)
      .set({ lastMessageId: messageId })
      .where(
        and(
          eq(user.id, userId),
          or(
            isNull(user.lastMessageId),
            sql`${user.lastMessageId}::bigint < ${messageId}::bigint`
          )
        )
      )
      .returning({ id: user.id });

    return result.length > 0; // True if we updated (we won the race), False if duplicate
  } catch (error) {
    // If casting fails (e.g. non-numeric ID somehow), default to true to allow processing
    // But Telegram IDs are numeric.
    console.error("Failed to set last message id", error);
    return true;
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    console.error("Failed to save chat:", error);
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id:", error);
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error("Failed to save messages:", error);
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update title for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

export async function incrementUserRequestCount(userId: string, amount = 1) {
  try {
    await db
      .update(user)
      .set({ requestCount: sql`${user.requestCount} + ${amount}` })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to increment request count", error);
  }
}

export async function resetUserRequestCount(userId: string) {
  try {
    await db
      .update(user)
      .set({ requestCount: 0, lastResetDate: new Date() })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to reset request count", error);
  }
}

export async function incrementWeeklyTextUsage(userId: string, amount: number) {
  try {
    await db
      .update(user)
      .set({ weeklyTextUsage: sql`${user.weeklyTextUsage} + ${amount}` })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to increment weekly text usage", error);
  }
}

export async function incrementWeeklyImageUsage(
  userId: string,
  amount: number
) {
  try {
    await db
      .update(user)
      .set({ weeklyImageUsage: sql`${user.weeklyImageUsage} + ${amount}` })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to increment weekly image usage", error);
  }
}

// Telegram Bot Queries

export async function updateUserSelectedModel(userId: string, model: string) {
  try {
    await db
      .update(user)
      .set({ selectedModel: model })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to update selected model", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user selected model"
    );
  }
}

export async function hasUserConsented(userId: string, consentType: string) {
  try {
    const result = await db
      .select()
      .from(userConsent)
      .where(
        and(
          eq(userConsent.userId, userId),
          eq(userConsent.consentType, consentType)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error("Failed to check user consent", error);
    return false;
  }
}

export async function createUserConsent(
  userId: string,
  consentType: string,
  metadata?: {
    telegramId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  try {
    await db.insert(userConsent).values({
      userId,
      consentType,
      telegramId: metadata?.telegramId,
      email: metadata?.email,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  } catch (error) {
    console.error("Failed to create user consent", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create user consent"
    );
  }
}

interface UserPreferences {
  aspect_ratio?: string;
  video_duration?: number;
  video_aspect?: "portrait" | "landscape";
  video_quality?: "720p" | "1080p";
}

export async function updateUserPreferences(
  userId: string,
  prefs: UserPreferences
) {
  try {
    // First get existing preferences
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!existingUser) {
      return;
    }

    // Merge existing preferences
    const currentPrefs = (existingUser.preferences as UserPreferences) || {};
    const updatedPrefs = { ...currentPrefs, ...prefs };

    await db
      .update(user)
      .set({ preferences: updatedPrefs })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user preferences"
    );
  }
}

// Subscription Queries

import { subscription } from "./schema";

export async function getUserSubscription(userId: string) {
  try {
    const [sub] = await db
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          eq(subscription.status, "active"),
          gt(subscription.endDate, new Date())
        )
      )
      .orderBy(desc(subscription.createdAt))
      .limit(1);

    return sub;
  } catch (error) {
    console.error("Failed to get user subscription", error);
    return null;
  }
}

export async function getLastActiveSubscription(userId: string) {
  try {
    const [sub] = await db
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          eq(subscription.status, "active")
          // We intentionally do NOT check date here, so we can manage expired but still "active" (renewing) subs
        )
      )
      .orderBy(desc(subscription.createdAt))
      .limit(1);

    return sub;
  } catch (error) {
    console.error("Failed to get last active subscription", error);
    return null;
  }
}

export async function cancelUserSubscription(userId: string) {
  try {
    await db
      .update(subscription)
      .set({
        autoRenew: false,
        // status: "cancelled", // Don't cancel immediately, just stop auto-renew
        updatedAt: new Date(),
      })
      .where(
        and(eq(subscription.userId, userId), eq(subscription.status, "active"))
      );
    return true;
  } catch (error) {
    console.error("Failed to cancel subscription", error);
    return false;
  }
}

export async function createStarSubscription(
  userId: string,
  tariffSlug: string,
  durationDays: number
) {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    await db.insert(subscription).values({
      userId,
      tariffSlug,
      paymentMethodId: "telegram_stars",
      status: "active",
      autoRenew: false, // Stars are usually one-time unless recurrent is supported (not implemented yet for Stars here)
      startDate: new Date(),
      endDate,
    });

    return true;
  } catch (error) {
    console.error("Failed to create star subscription", error);
    return false;
  }
}

export async function getExpiringSubscriptions(withinHours = 24) {
  try {
    const checkDate = new Date();
    checkDate.setHours(checkDate.getHours() + withinHours);

    // Get active subscriptions that are auto-renewing and expiring soon
    // We strictly check endDate <= checkDate AND endDate > now (to avoid retrying old ones too far back, or we handle them differently)
    // For simplicity, let's just get everything active & auto-renewing that expires before checkDate.
    // Real-world logic might need to filter out ones already tried today.
    return await db
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.status, "active"),
          eq(subscription.autoRenew, true),
          lte(subscription.endDate, checkDate)
        )
      );
  } catch (error) {
    console.error("Failed to get expiring subscriptions", error);
    return [];
  }
}

export async function extendSubscription(
  subscriptionId: string,
  durationDays: number
) {
  try {
    // 1. Get current subscription to know the current endDate
    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, subscriptionId));

    if (!sub) {
      return false;
    }

    // 2. Calculate new end date
    // If it's already expired, extend from NOW? Or from old endDate?
    // Usually extending from old endDate allows keeping the streak, but if it expired a month ago, we don't want to charge for past time.
    // Let's assume we run this daily, so it's close to expiration.
    const baseDate = sub.endDate < new Date() ? new Date() : sub.endDate;
    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    await db
      .update(subscription)
      .set({
        endDate: newEndDate,
        updatedAt: new Date(),
        status: "active", // Ensure it stays active
      })
      .where(eq(subscription.id, subscriptionId));

    return true;
  } catch (error) {
    console.error("Failed to extend subscription", error);
    return false;
  }
}

export async function disableAutoRenew(subscriptionId: string) {
  try {
    await db
      .update(subscription)
      .set({ autoRenew: false })
      .where(eq(subscription.id, subscriptionId));
  } catch (error) {
    console.error("Failed to disable auto renew", error);
  }
}

// --- Admin & Model Queries ---

export async function setUserDetails({
  userId,
  isAdmin,
  hasPaid,
  requestCount,
  isActive,
}: {
  userId: string;
  isAdmin?: boolean;
  hasPaid?: boolean;
  requestCount?: number;
  isActive?: boolean;
}) {
  try {
    const updateData: any = {};
    if (isAdmin !== undefined) {
      updateData.isAdmin = isAdmin;
    }
    if (hasPaid !== undefined) {
      updateData.hasPaid = hasPaid;
    }
    if (requestCount !== undefined) {
      updateData.requestCount = requestCount;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    return await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, userId))
      .returning();
  } catch (error) {
    console.error("Failed to set user details", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set user details"
    );
  }
}

export async function getAiModels() {
  try {
    return await db.select().from(aiModel).orderBy(asc(aiModel.name));
  } catch (error) {
    console.error("Failed to get AI models", error);
    throw new ChatSDKError("bad_request:database", "Failed to get AI models");
  }
}

export async function upsertAiModel(
  modelData: Partial<AiModel> & { modelId: string }
) {
  try {
    return await db
      .insert(aiModel)
      .values({
        id: modelData.id || generateUUID(),
        modelId: modelData.modelId,
        name: modelData.name || modelData.modelId,
        provider: modelData.provider || "openai",
        type: modelData.type || "text",
        cost: modelData.cost || 1,
        isPremium: modelData.isPremium || false,
        isPro: modelData.isPro || false,
        isEnabled: modelData.isEnabled || true,
        requiredClanLevel: modelData.requiredClanLevel || 1,
      })
      .onConflictDoUpdate({
        target: aiModel.modelId,
        set: { ...modelData, updatedAt: new Date() },
      })
      .returning();
  } catch (error) {
    console.error("Failed to upsert AI model", error);
    throw new ChatSDKError("bad_request:database", "Failed to upsert AI model");
  }
}

// --- Clan Levels ---

export async function getClanLevels() {
  try {
    return await db.select().from(clanLevel).orderBy(asc(clanLevel.level));
  } catch (error) {
    console.error("Failed to get clan levels", error);
    throw new ChatSDKError("bad_request:database", "Failed to get clan levels");
  }
}

export async function getClanLevelByLevel(level: number) {
  try {
    const [result] = await db
      .select()
      .from(clanLevel)
      .where(eq(clanLevel.level, level));
    return result;
  } catch (error) {
    console.error("Failed to get clan level", error);
    throw new ChatSDKError("bad_request:database", "Failed to get clan level");
  }
}

// --- Payment Processing ---

export async function processSuccessfulPayment({
  telegramId,
  tariffSlug,
  paymentMethodId,
}: {
  telegramId: string;
  tariffSlug: string;
  paymentMethodId?: string;
}) {
  try {
    // 1. Find User
    const [userRecord] = await db
      .select()
      .from(user)
      .where(eq(user.telegramId, telegramId));

    if (!userRecord) {
      console.error(`User with telegramId ${telegramId} not found`);
      return false;
    }

    // 2. Find Tariff (if applicable) or determine duration from slug
    // We'll try to find a tariff in the DB, or parse the slug for duration if using hardcoded logic
    // Common pattern: premium_1 (1 month), premium_12 (12 months)
    let durationDays = 30; // default
    if (tariffSlug.endsWith("_12")) {
      durationDays = 365;
    } else if (tariffSlug.endsWith("_6")) {
      durationDays = 180;
    } else if (tariffSlug.endsWith("_3")) {
      durationDays = 90;
    }

    // Also check Tariff table if you use it dynamically
    /*
    const [tariffRecord] = await db.select().from(tariff).where(eq(tariff.slug, tariffSlug));
    if (tariffRecord && tariffRecord.durationDays) {
       durationDays = tariffRecord.durationDays;
    }
    */

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);

    // 2.5 Cancel Previous Active Subscriptions (to avoid duplicates)
    await db
      .update(subscription)
      .set({
        status: "cancelled",
        autoRenew: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscription.userId, userRecord.id),
          eq(subscription.status, "active")
        )
      );

    // 3. Create Subscription
    await db.insert(subscription).values({
      userId: userRecord.id,
      tariffSlug,
      paymentMethodId, // Save the recurring token!
      status: "active",
      autoRenew: !!paymentMethodId, // If we have a token, auto-renew is possible
      startDate,
      endDate,
    });

    // 4. Update User Status
    // Unlock premium features
    await db
      .update(user)
      .set({
        hasPaid: true,
        // Optional: Reset request count on new subscription start?
        // requestCount: 0,
        // lastResetDate: new Date()
      })
      .where(eq(user.id, userRecord.id));

    console.log(
      `processed payment for user ${userRecord.id}, tariff ${tariffSlug}`
    );
    return true;
  } catch (error) {
    console.error("Failed to process payment", error);
    return false;
  }
}

export async function updateClanName(clanId: number, name: string) {
  try {
    const [updatedClan] = await db
      .update(clan)
      .set({ name })
      .where(eq(clan.id, clanId))
      .returning();
    return updatedClan;
  } catch (error) {
    console.error("Failed to update clan name", error);
    throw error;
  }
}

export const resetWeeklyLimits = async () => {
  const result = await db
    .update(user)
    .set({
      weeklyTextUsage: 0,
      weeklyImageUsage: 0,
      lastResetDate: new Date(),
    })
    .where(eq(user.hasPaid, false))
    .returning({ id: user.id });

  return result.length;
};

export async function addExtraRequests(userId: string, amount: number) {
  try {
    await db
      .update(user)
      .set({ extraRequests: sql`${user.extraRequests} + ${amount}` })
      .where(eq(user.id, userId));
    return true;
  } catch (error) {
    console.error("Failed to add extra requests", error);
    return false;
  }
}

export async function consumeExtraRequests(userId: string, amount: number) {
  try {
    // Optimistic update: Decrement only if enough balance
    const result = await db
      .update(user)
      .set({ extraRequests: sql`${user.extraRequests} - ${amount}` })
      .where(and(eq(user.id, userId), gte(user.extraRequests, amount)))
      .returning({ id: user.id });

    return result.length > 0;
  } catch (error) {
    console.error("Failed to consume extra requests", error);
    return false;
  }
}
