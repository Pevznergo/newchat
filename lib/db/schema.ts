import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }), // nullable for Telegram users
  password: varchar("password", { length: 64 }),
  googleId: varchar("googleId", { length: 255 }),
  telegramId: varchar("telegramId", { length: 255 }),

  // Tracking fields for QR codes and UTM
  startParam: varchar("start_param", { length: 50 }), // QR code source tracking
  utmSource: varchar("utm_source", { length: 255 }),
  utmMedium: varchar("utm_medium", { length: 255 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  utmContent: varchar("utm_content", { length: 255 }),

  // Telegram-specific fields
  balance: varchar("balance", { length: 255 }).default("0"), // Token balance for AI requests
  points: varchar("points", { length: 255 }).default("0"),
  spinsCount: varchar("spins_count", { length: 255 }).default("0"),
  dailyStreak: varchar("daily_streak", { length: 255 }).default("0"),
  lastDailyClaim: timestamp("last_daily_claim"),
  lastVisit: timestamp("last_visit").defaultNow(),

  // User status fields
  isActive: boolean("is_active").default(false),
  hasPaid: boolean("has_paid").default(false),
  phone: varchar("phone", { length: 50 }),
  lastMessageId: varchar("last_message_id", { length: 50 }), // For idempotency
  requestCount: integer("request_count").default(0),

  // Bot preferences
  selectedModel: varchar("selected_model", { length: 100 }).default(
    "model_gpt4omini"
  ),
  preferences: json("preferences"), // For storing user preferences like aspect_ratio

  // Standard fields
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const userConsent = pgTable("UserConsent", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  consentType: varchar("consent_type", { length: 100 }).notNull(),
  telegramId: varchar("telegram_id", { length: 32 }),
  email: varchar("email", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserConsent = InferSelectModel<typeof userConsent>;

export const tariff = pgTable("Tariff", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // subscription, packet
  priceRub: integer("price_rub").notNull(),
  priceStars: integer("price_stars").notNull(),
  durationDays: integer("duration_days"),
  requestLimit: integer("request_limit"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Tariff = InferSelectModel<typeof tariff>;

export const subscription = pgTable("Subscription", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tariffSlug: varchar("tariff_slug", { length: 100 }).notNull(),
  paymentMethodId: varchar("payment_method_id", { length: 255 }), // Saved card ID from YooKassa
  status: varchar("status", { length: 50 }).default("active"), // active, cancelled, expired
  autoRenew: boolean("auto_renew").default(true),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Subscription = InferSelectModel<typeof subscription>;

export const aiModel = pgTable("AiModel", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  modelId: varchar("model_id", { length: 100 }).unique().notNull(), // e.g. model_gpt4omini
  name: varchar("name", { length: 255 }).notNull(), // e.g. GPT-4o Mini
  providerId: varchar("provider_id", { length: 255 }).notNull(), // e.g. openai/gpt-4o-mini
  type: varchar("type", { length: 50 }).notNull().default("text"), // text, image, video, audio
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiModel = InferSelectModel<typeof aiModel>;

export const modelLimit = pgTable("ModelLimit", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => aiModel.id, { onDelete: "cascade" }),
  userRole: varchar("user_role", { length: 50 }).notNull(), // free, premium, premium_x2, regular
  limitCount: integer("limit_count").notNull(),
  limitPeriod: varchar("limit_period", { length: 50 }).notNull(), // daily, monthly, total
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ModelLimit = InferSelectModel<typeof modelLimit>;
