import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	index,
	integer,
	json,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const clan = pgTable("clans", {
	id: serial("id").primaryKey(), // Integer ID
	name: varchar("name", { length: 255 }).unique().notNull(),
	inviteCode: varchar("invite_code", { length: 50 }).unique().notNull(),
	level: integer("level").default(1).notNull(),
	ownerId: uuid("owner_id").notNull(), // Mapped to owner_id
	createdAt: timestamp("created_at").defaultNow().notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(), // Migrated column
});

export type Clan = InferSelectModel<typeof clan>;

export const user = pgTable(
	"User",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		email: varchar("email", { length: 64 }), // nullable for Telegram users
		password: varchar("password", { length: 64 }),
		googleId: varchar("googleId", { length: 255 }),
		telegramId: varchar("telegramId", { length: 255 }),

		// Clan fields
		clanId: integer("clan_id").references(() => clan.id),
		clanRole: varchar("clan_role", { enum: ["owner", "admin", "member"] })
			.default("member")
			.notNull(),

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
		lastResetDate: timestamp("last_reset_date"), // Tracks when the weekly limit was last reset
		lastVisit: timestamp("last_visit").defaultNow(),

		// Weekly Usage Tracking (New Limit System)
		// Weekly Usage Tracking (New Limit System)
		weeklyTextUsage: integer("weekly_text_usage").default(0),
		weeklyImageUsage: integer("weekly_image_usage").default(0),

		// Free Resources
		freeImagesCount: integer("free_images_count").default(0),

		// Purchased Extra Requests
		extraRequests: integer("extra_requests").default(0),

		// Purchased Extra Requests

		// User status fields
		isActive: boolean("is_active").default(false),
		isAdmin: boolean("is_admin").default(false),
		hasPaid: boolean("has_paid").default(false),
		phone: varchar("phone", { length: 50 }),
		lastMessageId: varchar("last_message_id", { length: 50 }), // For idempotency
		requestCount: integer("request_count").default(0), // Keeping for historical/total stats? Or deprecating? Let's keep for total.

		// Bot preferences
		selectedModel: varchar("selected_model", { length: 100 }).default(
			"model_gpt4omini",
		),
		preferences: json("preferences"), // For storing user preferences like aspect_ratio

		// Standard fields
		name: varchar("name", { length: 255 }),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => {
		return {
			createdAtIdx: index("user_created_at_idx").on(table.createdAt),
			lastVisitIdx: index("user_last_visit_idx").on(table.lastVisit),
			hasPaidIdx: index("user_has_paid_idx").on(table.hasPaid),
			telegramIdIdx: index("user_telegram_id_idx").on(table.telegramId),
		};
	},
);

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
	},
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
	},
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
	},
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
	}),
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
	}),
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
	modelId: varchar("model_id", { length: 255 }).unique().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	provider: varchar("provider_id", { length: 100 }).notNull(), // openai, openrouter, etc
	type: varchar("type", { length: 50 }).notNull(), // text, image, video
	cost: integer("cost").notNull().default(1),
	isPremium: boolean("is_premium").default(false),
	isPro: boolean("is_pro").default(false),
	isEnabled: boolean("is_enabled").default(true),
	apiModelId: varchar("api_model_id", { length: 255 }),
	requiredClanLevel: integer("required_clan_level").default(1),
	description: text("description"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiModel = InferSelectModel<typeof aiModel>;

export const clanLevel = pgTable("ClanLevel", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	level: integer("level").unique().notNull(),
	minUsers: integer("min_users").notNull().default(1),
	minPro: integer("min_pro").notNull().default(0),
	maxFreeToPaidRatio: integer("max_free_to_paid_ratio"), // null = unlimited
	weeklyTextCredits: integer("weekly_text_credits").notNull().default(15),
	weeklyImageGenerations: integer("weekly_image_generations")
		.notNull()
		.default(1),
	unlimitedModels: text("unlimited_models").array(), // Array of model IDs
	description: text("description"),
	isEnabled: boolean("is_enabled").default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClanLevel = InferSelectModel<typeof clanLevel>;
export const shortLinks = pgTable("short_links", {
	id: serial("id").primaryKey(),
	code: varchar("code", { length: 50 }).unique().notNull(), // The start param
	targetUrl: varchar("target_url", { length: 500 }).notNull(), // Context URL
	clicksCount: integer("clicks_count").default(0),
	stickerTitle: varchar("sticker_title", { length: 255 }),
	stickerFeatures: varchar("sticker_features", { length: 255 }),
	stickerPrizes: varchar("sticker_prizes", { length: 255 }),
	status: varchar("status", { length: 50 }).default("active"), // active, archived, printed
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ShortLink = InferSelectModel<typeof shortLinks>;

// =========================================================================
// MESSAGING SYSTEM
// =========================================================================

export const messageTemplate = pgTable("MessageTemplate", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),

	// Template Info
	name: varchar("name", { length: 255 }).notNull(),
	content: text("content").notNull(),
	contentType: varchar("content_type", { length: 20 }).default("text"), // text, html, markdown

	// Media attachments (optional)
	mediaType: varchar("media_type", { length: 20 }), // photo, video, document
	mediaUrl: text("media_url"),

	// Inline keyboard (optional) - stored as JSON array
	inlineKeyboard: json("inline_keyboard"), // [{text: "Button", callback_data: "action"}, ...]

	// Template type
	templateType: varchar("template_type", { length: 50 }).notNull(), // 'follow_up', 'broadcast'

	// Targeting
	targetAudience: varchar("target_audience", { length: 20 }).default("all"), // 'all', 'free', 'premium'

	// Status
	isActive: boolean("is_active").default(true),

	// Metadata
	createdBy: uuid("created_by").references(() => user.id),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MessageTemplate = InferSelectModel<typeof messageTemplate>;

export const followUpRule = pgTable("FollowUpRule", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),

	// Template reference
	templateId: uuid("template_id")
		.notNull()
		.references(() => messageTemplate.id, { onDelete: "cascade" }),

	// Trigger configuration
	triggerType: varchar("trigger_type", { length: 50 }).notNull(), // 'after_registration', 'after_last_message', 'inactive_user', 'limit_reached'
	triggerDelayHours: integer("trigger_delay_hours").notNull(), // Delay after trigger event

	// Conditions (JSON for flexibility)
	conditions: json("conditions"), // {min_messages: 0, max_messages: 5, has_subscription: false, ...}

	// Targeting (inherited from template but can override)
	targetAudience: varchar("target_audience", { length: 20 }), // null = use template's audience

	// Limits
	maxSendsPerUser: integer("max_sends_per_user").default(1), // How many times to send this rule to same user

	// Schedule
	sendTimeStart: varchar("send_time_start", { length: 5 }), // HH:MM format
	sendTimeEnd: varchar("send_time_end", { length: 5 }), // HH:MM format
	daysOfWeek: json("days_of_week"), // ["mon", "tue", ...]

	// Status
	isActive: boolean("is_active").default(true),
	priority: integer("priority").default(0), // Higher priority rules execute first

	// Metadata
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FollowUpRule = InferSelectModel<typeof followUpRule>;

export const messageSend = pgTable("MessageSend", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),

	// References
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	templateId: uuid("template_id").references(() => messageTemplate.id, {
		onDelete: "set null",
	}),
	followUpRuleId: uuid("follow_up_rule_id").references(() => followUpRule.id, {
		onDelete: "set null",
	}),
	broadcastId: uuid("broadcast_id"), // For broadcast sends

	// Send info
	sendType: varchar("send_type", { length: 20 }).notNull(), // 'follow_up', 'broadcast'
	status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'sent', 'failed', 'delivered', 'read'

	// Telegram message details
	telegramMessageId: varchar("telegram_message_id", { length: 50 }),
	telegramChatId: varchar("telegram_chat_id", { length: 50 }),

	// Error tracking
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0),

	// Timestamps
	scheduledAt: timestamp("scheduled_at"),
	sentAt: timestamp("sent_at"),
	deliveredAt: timestamp("delivered_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),

	// Mixpanel tracking
	mixpanelEventId: varchar("mixpanel_event_id", { length: 255 }),
	mixpanelTracked: boolean("mixpanel_tracked").default(false),
});

export type MessageSend = InferSelectModel<typeof messageSend>;

export const broadcastCampaign = pgTable("BroadcastCampaign", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),

	// Campaign info
	name: varchar("name", { length: 255 }).notNull(),
	templateId: uuid("template_id").references(() => messageTemplate.id),

	// Targeting
	targetAudience: varchar("target_audience", { length: 20 }).notNull(), // 'all', 'free', 'premium'

	// Advanced filters (optional)
	filters: json("filters"), // {min_messages: 10, last_activity_days: 7, clan_level: [1,2], ...}

	// Scheduling
	scheduledAt: timestamp("scheduled_at"),
	status: varchar("status", { length: 20 }).default("draft"), // 'draft', 'scheduled', 'sending', 'completed', 'cancelled'

	// Stats
	totalRecipients: integer("total_recipients").default(0),
	sentCount: integer("sent_count").default(0),
	failedCount: integer("failed_count").default(0),

	// Metadata
	createdBy: uuid("created_by").references(() => user.id),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	startedAt: timestamp("started_at"),
	completedAt: timestamp("completed_at"),
});

export type BroadcastCampaign = InferSelectModel<typeof broadcastCampaign>;

export const cachedAssets = pgTable("cached_assets", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	url: text("url").unique().notNull(), // The source URL (e.g. https://.../video.mp4)
	fileId: varchar("file_id", { length: 255 }).notNull(), // Telegram File ID
	fileType: varchar("file_type", { length: 50 }).notNull(), // photo, video, document
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CachedAsset = InferSelectModel<typeof cachedAssets>;

// =========================================================================
// GIFT CODE SYSTEM
// =========================================================================

export const giftCode = pgTable(
	"gift_code",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),

		// Code Properties
		code: varchar("code", { length: 32 }).unique().notNull(), // e.g. "GIFT-XMAS-2024-ABC123"
		codeType: varchar("code_type", { length: 20 }).notNull(), // 'premium_week', 'premium_month', 'premium_year'

		// Activation Details
		durationDays: integer("duration_days").notNull(), // 7, 30, 365

		// Usage Tracking
		isActive: boolean("is_active").default(true),
		maxUses: integer("max_uses").default(1), // Usually 1, but can be reusable
		currentUses: integer("current_uses").default(0),

		// Monetization (for future sales)
		priceRub: integer("price_rub"), // Price when sold
		campaignName: varchar("campaign_name", { length: 100 }), // e.g. "Black Friday 2024"

		// Metadata
		createdBy: varchar("created_by", { length: 255 }), // Admin user who created it
		createdAt: timestamp("created_at").defaultNow().notNull(),
		expiresAt: timestamp("expires_at"), // Optional: code expiration date

		// Single-use tracking (for max_uses = 1)
		activatedBy: uuid("activated_by").references(() => user.id),
		activatedAt: timestamp("activated_at"),
	},
	(table) => ({
		codeIdx: index("gift_code_code_idx").on(table.code),
		activeIdx: index("gift_code_active_idx").on(
			table.isActive,
			table.expiresAt,
		),
		campaignIdx: index("gift_code_campaign_idx").on(table.campaignName),
	}),
);

export type GiftCode = InferSelectModel<typeof giftCode>;

export const giftCodeActivation = pgTable(
	"gift_code_activation",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),

		// Relations
		giftCodeId: uuid("gift_code_id")
			.notNull()
			.references(() => giftCode.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id),

		// Activation details
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
		subscriptionId: uuid("subscription_id").references(() => subscription.id),

		// Analytics
		userTelegramId: varchar("user_telegram_id", { length: 255 }),
		userSource: varchar("user_source", { length: 50 }), // 'link', 'qr', 'manual'
	},
	(table) => ({
		uniqueActivation: index("gift_activation_unique_idx").on(
			table.giftCodeId,
			table.userId,
		),
		codeIdx: index("gift_activation_code_idx").on(table.giftCodeId),
		userIdx: index("gift_activation_user_idx").on(table.userId),
	}),
);

export type GiftCodeActivation = InferSelectModel<typeof giftCodeActivation>;
