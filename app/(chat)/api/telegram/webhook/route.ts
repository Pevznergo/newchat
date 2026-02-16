import path from "node:path";
import { generateText, tool } from "ai";
import { eq } from "drizzle-orm";
import { Bot, InputFile, webhookCallback } from "grammy";
import OpenAI from "openai";
import { z } from "zod";
import {
	CONTEXT_COST_RUBRIC,
	FEATURE_COSTS,
	MODEL_COSTS,
	MODEL_LIMITS,
} from "@/lib/ai/cost-models";
import {
	entitlementsByUserType,
	SUBSCRIPTION_LIMITS,
} from "@/lib/ai/entitlements";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createClan, joinClan, leaveClan } from "@/lib/clan/actions";
import { NANO_BANANA_ID } from "@/lib/clan/config";
import {
	calculateClanLevel,
	getLevelConfig,
	getNextLevelRequirements,
} from "@/lib/clan/logic";
import { SCENARIOS } from "@/lib/content/scenarios";
import { db } from "@/lib/db";
import { getImageModels } from "@/lib/db/image-models-queries";
import {
	addExtraRequests,
	cancelUserSubscription,
	checkAndResetWeeklyLimits, // added
	consumeExtraRequests,
	createStarSubscription,
	createTelegramUser,
	createUserConsent,
	decrementUserFreeImages, // added
	getAiModels,
	getAllTariffs,
	getChatsByUserId,
	getClanByInviteCode,
	getClanLevels, // added
	getClanMemberCounts, // added
	getLastActiveSubscription,
	getMessagesByChatId,
	getTariffBySlug,
	getUserByTelegramId,
	getUserClan, // added
	hasUserConsented,
	incrementUserRequestCount,
	incrementWeeklyImageUsage, // added
	incrementWeeklyTextUsage, // added
	saveChat,
	saveMessages,
	setLastMessageId,
	setUserDetails,
	updateUserPreferences,
	updateUserSelectedModel,
	updateUserTracking,
	upsertAiModel,
} from "@/lib/db/queries";
import { cachedAssets, shortLinks } from "@/lib/db/schema";
import { createYookassaPayment } from "@/lib/payment";
import { generateUUID } from "@/lib/utils";
import {
	identifyBackendUser,
	trackBackendEvent,
} from "../../../../../lib/mixpanel";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
	throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

import { autoRetry } from "@grammyjs/auto-retry";

const bot = new Bot(token);
bot.api.config.use(autoRetry());

export const maxDuration = 60;

// --- Constants & Helpers ---

const FREE_MODELS = [
	"model_gpt5nano",
	"model_gpt4omini",
	"model_image_nano_banana",
	"model_deepseek_v3",
];

const MODEL_NAMES: Record<string, string> = {
	model_gpt52: "GPT-5.2",
	model_o3: "OpenAI o3",
	model_gpt41: "GPT-4.1",
	model_gpt5nano: "GPT-5 Nano",
	model_gpt4omini: "GPT-4o Mini",
	model_claude45sonnet: "Claude 3.5 Sonnet",
	model_claude45thinking: "Claude 3 Opus",
	model_deepseek_v3: "DeepSeek V3",
	model_deepseek_r1: "DeepSeek R1",
	model_gemini_pro: "Gemini 3 Pro",
	model_gemini_flash: "Gemini 3 Flash",
	model_grok41: "Grok 4.1",
	model_deepresearch: "Deep Research",
	model_perplexity: "Perplexity",
	model_image_nano_banana: "Nano Banana",
	model_image_banana_pro: "Nano Banana Pro",
	model_image_gpt_images_1_5: "GPT Images 1.5",
	model_image_flux: "FLUX 2",
	model_video_veo: "Veo",
	model_video_sora: "Sora",
	model_video_kling: "Kling",
	model_video_pika: "Pika",
	model_video_hailuo: "Hailuo",
};

const PROVIDER_MAP: Record<string, string> = {
	model_gpt52: "openai/gpt-5.2-2025-12-11",
	model_o3: "openai/o3-deep-research-2025-06-26",
	model_gpt41: "openai/gpt-4.1-2025-04-14",
	model_gpt5nano: "openai/gpt-5-nano-2025-08-07",
	model_gpt4omini: "openai/gpt-4o-mini-2024-07-18",
	model_claude45sonnet: "openrouter/anthropic/claude-3.5-sonnet",
	model_claude45thinking: "openrouter/anthropic/claude-3.7-sonnet",
	model_deepseek_v3: "openrouter/deepseek/deepseek-chat",
	model_deepseek_r1: "openrouter/deepseek/deepseek-r1",
	model_gemini_pro: "openrouter/google/gemini-pro-1.5",
	model_gemini_flash: "openrouter/google/gemini-3-flash-preview",
	model_grok41: "xai/grok-2-vision-1212",
	model_perplexity: "perplexity/sonar-pro",

	// Web Search Variants
	model_gpt52_web: "openai/gpt-5.2-2025-12-11",
	model_claude45sonnet_web: "openrouter/anthropic/claude-3.5-sonnet",
	model_gemini_pro_web: "google/gemini-1.5-pro-latest", // Use native Google provider for grounding
	model_gemini_flash_web: "google/gemini-1.5-flash-latest",
	model_grok41_web: "xai/grok-2-vision-1212",
	model_deepresearch: "openai/o3-deep-research-2025-06-26", // Already search-capable logic?
	// Image/Video models
	model_image_nano_banana: "openai/chatgpt-image-latest",
	model_image_banana_pro: "openai/dall-e-3",
	model_image_midjourney: "openai/gpt-4o",
	model_image_flux: "openai/gpt-4o",
	model_video_veo: "openai/gpt-4o",
	model_video_sora: "openai/gpt-4o",
	model_video_kling: "openai/gpt-4o",
	model_video_pika: "openai/gpt-4o",
	model_video_hailuo: "openai/gpt-4o",
};

const PRANK_SCENARIOS = [
	{
		id: "shattered_screen",
		name: "1. 📱 Я разбил экран",
		description:
			"Сфотографируйте свой телевизор или монитор (выключенный, черный экран) фронтально. В кадре должно быть видно немного комнаты.",
		prompt:
			"Change the screen to look completely shattered with spiderweb cracks, glowing glitch lines, and broken LCD leakage.",
	},
	{
		id: "flooded_floor",
		name: "2. 💧 Меня топят соседи",
		description:
			"Сфотографируйте пол в коридоре или на кухне. Желательно захватить плинтус или ножку мебели.",
		prompt:
			"Add a large realistic water puddle covering the floor, with reflections of the room lights on the water surface, looking like a severe pipe leak.",
	},
	{
		id: "broken_limb",
		name: "3. 🤕 Сломал руку / ногу",
		description:
			"Сделайте фото своей руки (предплечья) или ноги, лежащей на кровати или диване. Важно: рука/нога должна быть в фокусе.",
		prompt:
			"Put a heavy white orthopedic plaster cast, realistic medical texture, looking like a treatment for a broken bone.",
	},
	{
		id: "name_tattoo",
		name: "4. ✍️ Имя на запястье",
		description:
			"Фото внутренней стороны запястья. Можно держать в руке чашку или телефон.",
		prompt:
			'Add a handwritten tattoo of the name "Настя" on the wrist, messy cursive font, black fresh ink, swollen red skin.',
	},
	{
		id: "door_vandalism",
		name: "5. 🎨 Вандализм на двери",
		description: "Фото вашей входной двери снаружи.",
		prompt:
			"Add messy red spray paint graffiti scribbles on the door surface, looking like aggressive vandalism.",
	},
];

const KLING_MOTIONS = [
	{
		id: "dance",
		title: "Тот самый танец",
		video: "1.mp4",
		label: "🌟 Тот самый танец",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "color_mix",
		title: "Color Mix",
		video: "2.mp4",
		label: "Color Mix",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "emoji",
		title: "Эмодзи-челендж",
		video: "3.mp4",
		label: "Эмодзи-челлендж",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "crash",
		title: "Краш",
		video: "4.mp4",
		label: "Краш",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "kungfu",
		title: "Кунг-фу Мастер",
		video: "5.mp4",
		label: "Кунг-фу Мастер",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "love",
		title: "Love you",
		video: "6.mp4",
		label: "Love You",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "vroom",
		title: "Врум-Врум",
		video: "7.mp4",
		label: "Врум-Врум",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "kemusan",
		title: "Кемусан",
		video: "8.mp4",
		label: "Кемусан",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "shuffle",
		title: "Шаффл",
		video: "9.mp4",
		label: "Шаффл",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "shaolin",
		title: "Шаолинь",
		video: "10.mp4",
		label: "Шаолинь",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "run",
		title: "Бег",
		video: "11.mp4",
		label: "Бег",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
	{
		id: "popping",
		title: "Поппинг",
		video: "12.mp4",
		label: "Поппинг",
		description:
			"Отправьте изображение, которое хотите «оживить». Kling Motion перенесет на него выбранное движение.",
	},
];

function getKlingMotionKeyboard() {
	const buttons: any[][] = [];
	for (let i = 0; i < KLING_MOTIONS.length; i += 2) {
		const row = KLING_MOTIONS.slice(i, i + 2).map((m) => ({
			text: m.title,
			callback_data: `set_kling_motion_${m.id}`,
		}));
		buttons.push(row);
	}
	buttons.push([{ text: "🔙 Назад", callback_data: "menu_video" }]);
	return { inline_keyboard: buttons };
}

function getModelKeyboard(
	selectedModel: string,
	isPremium: boolean,
	clanLevel = 1,
) {
	const config = getLevelConfig(clanLevel, CACHED_CLAN_LEVELS || []);
	const unlimitedModels = config.benefits.unlimitedModels || [];

	const getLabel = (id: string, defaultName: string) => {
		const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === id);
		const name = dbModel?.name || defaultName;
		const requiredLevel = dbModel?.requiredClanLevel || 1;

		let prefix = "";
		let suffix = "";

		// Check availability
		if (!isPremium && clanLevel < requiredLevel) {
			prefix = "🔒 ";
		} else if (selectedModel === id) {
			prefix = "✅ ";
		} else if (!isPremium && !unlimitedModels.includes(id)) {
			// Not selected, Not Premium, Not Unlimited in Clan
			// Show Cost
			// Not selected, Not Premium, Not Unlimited in Clan
			// Show Cost
			// const cost = dbModel?.cost ?? (MODEL_COSTS[id] || 1);
			// suffix = ` (💰${cost})`;
			// User requested to remove cost display
			suffix = "";
		} else if (!isPremium && unlimitedModels.includes(id)) {
			// Free via Clan
			prefix = "🏰 ";
			suffix = " (Free)";
		}

		return `${prefix}${name}${suffix}`;
	};

	return {
		inline_keyboard: [
			[
				{
					text: getLabel("model_gpt52", "GPT-5.2"),
					callback_data: "model_gpt52",
				},
				{
					text: getLabel("model_o3", "OpenAI o3"),
					callback_data: "model_o3",
				},
				{
					text: getLabel("model_gpt41", "GPT-4.1"),
					callback_data: "model_gpt41",
				},
			],
			[
				{
					text: getLabel("model_gpt5nano", "GPT-5 Nano"),
					callback_data: "model_gpt5nano",
				},
				{
					text: getLabel("model_gpt4omini", "GPT-4o mini"),
					callback_data: "model_gpt4omini",
				},
			],
			[
				{
					text: getLabel("model_claude45sonnet", "Claude 4.5 Sonnet"),
					callback_data: "model_claude45sonnet",
				},
				{
					text: getLabel("model_claude45thinking", "Claude 4.5 Thinking"),
					callback_data: "model_claude45thinking",
				},
			],
			[
				{
					text: getLabel("model_gemini_pro", "Gemini 3 Pro"),
					callback_data: "model_gemini_pro",
				},
				{
					text: getLabel("model_gemini_flash", "Gemini 3 Flash"),
					callback_data: "model_gemini_flash",
				},
			],
			[
				{
					text: getLabel("model_deepseek_v3", "DeepSeek V3"),
					callback_data: "model_deepseek_v3",
				},
				{
					text: getLabel("model_deepseek_r1", "DeepSeek R1"),
					callback_data: "model_deepseek_r1",
				},
			],
			[
				{
					text: "🔙 Назад",
					callback_data: "menu_start", // or delete message
				},
			],
		],
	};
}

async function getImageModelKeyboard(
	selectedModel: string | undefined,
	isPremium: boolean,
	clanLevel = 1,
) {
	const IMAGE_MODELS = await getImageModels();
	const buttons: any[][] = [];

	// Helper to generate button for a model
	const getModelBtn = (key: string, labelOverride?: string) => {
		const model = IMAGE_MODELS[key];
		if (!model) return null;

		const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === key);
		const requiredLevel = dbModel?.requiredClanLevel || 1;
		const name = labelOverride || dbModel?.name || model.name;

		const isSelected = selectedModel === key;
		const isFree = FREE_MODELS.includes(key);

		let isLocked = false;
		if (!isPremium && !isFree) {
			if (clanLevel < requiredLevel) {
				isLocked = true;
			}
		}

		const status = isLocked ? "🔒" : isSelected ? "✅" : "";
		return {
			text: `${status} ${name}`,
			callback_data: key,
		};
	};

	// Row 1: Top 10 Pranks + GPT Images 1.5
	const row1 = [];
	row1.push({ text: "🎭 Топ 5 Пранков", callback_data: "menu_top_pranks" });

	const gptBtn = getModelBtn("model_image_gpt_images_1_5", "GPT Images 1.5");
	if (gptBtn) row1.push(gptBtn);

	buttons.push(row1);

	// Row 2: Nano Banana
	const nanoBtn = getModelBtn("model_image_nano_banana", "Nano Banana");
	if (nanoBtn) buttons.push([nanoBtn]);

	// Row 3: Nano Banana Pro
	const nanoProBtn = getModelBtn("model_image_banana_pro", "Nano Banana Pro");
	if (nanoProBtn) buttons.push([nanoProBtn]);

	// Row 4: FLUX 2 Pro
	const fluxBtn = getModelBtn("model_image_flux", "FLUX 2 Pro");
	if (fluxBtn) buttons.push([fluxBtn]);

	// Row 5: Back
	buttons.push([{ text: "🔙 Назад", callback_data: "menu_start" }]);

	return { inline_keyboard: buttons };
}

export function getTopPranksKeyboard() {
	const buttons: any[][] = [];
	for (let i = 1; i <= 10; i++) {
		if (i % 2 !== 0) {
			buttons.push([
				{ text: `Пранк ${i}`, callback_data: `prank_${i}` },
				{ text: `Пранк ${i + 1}`, callback_data: `prank_${i + 1}` },
			]);
		}
	}
	buttons.push([{ text: "🔙 Назад", callback_data: "menu_image" }]);
	return { inline_keyboard: buttons };
}

function getVideoModelKeyboard(
	selectedModel: string,
	_isPremium: boolean,
	_clanLevel = 1,
) {
	const isVeoSelected = selectedModel?.startsWith("model_video_veo");
	const isSoraSelected = selectedModel?.startsWith("model_video_sora");
	const isKlingSelected = selectedModel === "model_video_kling";

	const veoLabel = isVeoSelected ? "✅ Veo" : "Veo";
	const soraLabel = isSoraSelected ? "✅ Sora" : "Sora";
	const klingLabel = isKlingSelected ? "✅ 🎬 Kling Motion" : "🎬 Kling Motion";
	const pikaLabel = "Pika (Soon)";
	const hailuoLabel = "Hailuo (Soon)";

	return {
		inline_keyboard: [
			[
				{ text: veoLabel, callback_data: "menu_video_veo" },
				{ text: soraLabel, callback_data: "menu_video_sora" },
			],
			[{ text: klingLabel, callback_data: "menu_video_kling_motion" }],
			[
				{ text: pikaLabel, callback_data: "menu_video_pika" },
				{ text: hailuoLabel, callback_data: "menu_video_hailuo" },
			],
			[{ text: "🔙 Назад", callback_data: "menu_start" }],
		],
	};
}

function getVeoVariantKeyboard(
	selectedModel: string,
	isPremium: boolean,
	clanLevel = 1,
) {
	const getLabel = (id: string, defaultName: string) => {
		const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === id);
		const name = dbModel?.name || defaultName;
		const requiredLevel = dbModel?.requiredClanLevel || 1;

		const isSel = selectedModel === id ? "✅ " : "";
		let isLock = "";

		if (!isPremium && !FREE_MODELS.includes(id) && clanLevel < requiredLevel) {
			isLock = "🔒 ";
		}
		return `${isLock}${isSel}${name}`;
	};

	return {
		inline_keyboard: [
			[
				{
					text: getLabel("model_video_veo", "Veo 3.1"),
					callback_data: "configure_video_veo",
				},
				{
					text: getLabel("model_video_veo_fast", "Veo 3.1 Fast"),
					callback_data: "configure_video_veo_fast",
				},
			],
			[{ text: "🔙 Назад", callback_data: "menu_video" }],
		],
	};
}

function getSoraVariantKeyboard(
	selectedModel: string,
	isPremium: boolean,
	clanLevel = 1,
) {
	const getLabel = (id: string, defaultName: string) => {
		const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === id);
		const name = dbModel?.name || defaultName;
		const requiredLevel = dbModel?.requiredClanLevel || 1;

		const isSel = selectedModel === id ? "✅ " : "";
		let isLock = "";

		if (!isPremium && !FREE_MODELS.includes(id) && clanLevel < requiredLevel) {
			isLock = "🔒 ";
		}
		return `${isLock}${isSel}${name}`;
	};

	return {
		inline_keyboard: [
			[
				{
					text: getLabel("model_video_sora", "Sora 2"),
					callback_data: "configure_video_sora",
				},
				{
					text: getLabel("model_video_sora_pro", "Sora 2 Pro"),
					callback_data: "configure_video_sora_pro",
				},
			],
			[{ text: "🔙 Назад", callback_data: "menu_video" }],
		],
	};
}

function getVideoDurationKeyboard(modelId: string, duration?: number) {
	const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === modelId);
	// Fallback to defaults if cache missing. Veo: 10/5. Sora: 43/213.
	let defaultCost = 10;
	if (modelId.includes("sora")) {
		defaultCost = 43;
	}
	if (modelId.includes("sora_pro")) {
		defaultCost = 213;
	}
	if (modelId.includes("veo_fast")) {
		defaultCost = 5;
	}

	const costPerSec = dbModel?.cost || defaultCost;

	// Determine available durations
	const options = modelId.includes("veo") ? [4, 8] : [4, 8, 12];
	const backCallback = modelId.includes("veo")
		? "menu_video_veo"
		: "menu_video_sora";

	const getBtn = (sec: number) => {
		const cost = costPerSec * sec;
		const label = `${sec} сек (${cost} кр.)`;
		const check = duration === sec ? "✅ " : "";
		return {
			text: `${check}${label}`,
			callback_data: `set_duration_${modelId}_${sec}`,
		};
	};

	const keyboard = options.map((sec) => [getBtn(sec)]);

	return {
		inline_keyboard: [
			...keyboard,
			[{ text: "🔙 Назад", callback_data: backCallback }],
		],
	};
}

function getVideoAspectKeyboard(modelId: string, currentAspect?: string) {
	const isPortrait = currentAspect === "portrait";
	const isLandscape = currentAspect === "landscape";

	return {
		inline_keyboard: [
			[
				{
					text: `${isPortrait ? "✅ " : ""}Портрет (9:16)`,
					callback_data: "set_video_aspect_portrait",
				},
				{
					text: `${isLandscape ? "✅ " : ""}Ландшафт (16:9)`,
					callback_data: "set_video_aspect_landscape",
				},
			],
			[
				{
					text: "🔙 Назад",
					callback_data: `configure_video_${modelId.replace("model_video_", "")}`,
				},
			],
		],
	};
}

function getSearchModelKeyboard(
	selectedModel: string,
	isPremium: boolean,
	clanLevel = 1,
) {
	const isSelected = (id: string) => (selectedModel === id ? "✅ " : "");

	const getLabel = (id: string, defaultName: string) => {
		const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === id);
		const name = dbModel?.name || defaultName;
		const requiredLevel = dbModel?.requiredClanLevel || 1;

		let isLock = "";
		if (!isPremium && !FREE_MODELS.includes(id) && clanLevel < requiredLevel) {
			isLock = "🔒 ";
		}
		return `${isLock}${isSelected(id)}${name}`;
	};

	return {
		inline_keyboard: [
			[
				{
					text: getLabel("model_gpt52_web", "GPT 5.2"),
					callback_data: "model_gpt52_web",
				},
			],
			[
				{
					text: getLabel("model_gpt41_web", "GPT 4.1"),
					callback_data: "model_gpt41_web",
				},
				{
					text: getLabel("model_gpt_4osearch_web", "GPT-4o Search"),
					callback_data: "model_gpt_4osearch_web",
				},
			],
			[{ text: "Закрыть", callback_data: "menu_close" }],
		],
	};
}

function getPremiumKeyboard() {
	return {
		inline_keyboard: [
			[{ text: "💎 Premium", callback_data: "open_premium_subs" }],
			[{ text: "📦 Пакеты запросов", callback_data: "open_packets" }],
			[{ text: "👥 Клан PRO", callback_data: "open_clan_pro" }],
			[{ text: "💬 Проблемы с оплатой", url: "https://t.me/GoPevzner" }],
		],
	};
}

async function getSubscriptionKeyboard(plan: "premium" | "premium_x2") {
	const allTariffs = await getAllTariffs();

	// Dictionary to store prices: { "1": price, "3": price }
	const prices: Record<string, number> = {};

	// Filter tariffs for this plan type
	// Slug format: premium_1, premium_3, premium_x2_1, etc.
	// Note: premium_x2_1 starts with premium_ but we need to distinguish
	const prefix = `${plan}_`;

	for (const t of allTariffs) {
		if (t.slug.startsWith(prefix)) {
			// Correctly filter out "premium_x2" if we are looking for just "premium"
			if (plan === "premium" && t.slug.includes("premium_x2")) {
				continue;
			}

			// Extract months from slug end
			const parts = t.slug.split("_");
			const months = parts.at(-1);
			if (months) {
				prices[months] = t.priceRub;
			}
		}
	}

	// Helpers to get price safely
	const p1 = prices["1"] || 0;
	const p3 = prices["3"] || 0;
	const p6 = prices["6"] || 0;
	const p12 = prices["12"] || 0;

	return {
		inline_keyboard: [
			[
				{
					text: `1 месяц – ${p1}₽`,
					callback_data: `pay_${plan}_1`,
				},
			],
			[
				{
					text: `3 месяца – ${p3}₽ (-20%)`,
					callback_data: `pay_${plan}_3`,
				},
			],
			[
				{
					text: `6 месяцев – ${p6}₽ (-35%)`,
					callback_data: `pay_${plan}_6`,
				},
			],
			[
				{
					text: `12 месяцев – ${p12}₽ (-50%)`,
					callback_data: `pay_${plan}_12`,
				},
			],
			[{ text: "🔙 Назад", callback_data: "premium_back" }],
		],
	};
}

function getMusicGenerationKeyboard() {
	return {
		inline_keyboard: [
			[
				{ text: "🥁 Простой", callback_data: "music_mode_simple" },
				{ text: "🎸 Расширенный", callback_data: "music_mode_advanced" },
			],
			[{ text: "Закрыть", callback_data: "menu_close" }],
		],
	};
}

// --- Constants & Helpers ---

async function safeAnswerCallbackQuery(ctx: any, text?: string, options?: any) {
	try {
		// Construct the payload to match what works: ctx.answerCallbackQuery({ text: "...", show_alert: true })
		const payload = { ...options };
		if (text) {
			payload.text = text;
		}
		await ctx.answerCallbackQuery(payload);
	} catch (error: any) {
		const msg = error?.message || "";
		if (
			msg.includes("query is too old") ||
			msg.includes("query ID is invalid")
		) {
			// Ignore these specific errors
			console.warn("Suppressed answerCallbackQuery error:", msg);
		} else {
			console.error("answerCallbackQuery failed:", error);
		}
	}
}

// --- Menu Helpers ---

// --- Global Cache for Models & Levels ---
let CACHED_MODELS: any[] | null = null;
let CACHED_CLAN_LEVELS: any[] | null = null;
let CACHE_TIMESTAMP = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function ensureDataLoaded() {
	const now = Date.now();
	if (
		!CACHED_MODELS ||
		!CACHED_CLAN_LEVELS ||
		now - CACHE_TIMESTAMP > CACHE_TTL
	) {
		try {
			const [models, levels] = await Promise.all([
				getAiModels(),
				getClanLevels(),
			]);
			CACHED_MODELS = models;
			CACHED_CLAN_LEVELS = levels;
			CACHE_TIMESTAMP = now;
		} catch (e) {
			console.error("Failed to load models/levels for cache", e);
			// Fallback: don't crash, just use hardcoded defaults if possible or empty
		}
	}
}

// --- Cost & Limit Helpers ---

async function calculateRequestCost(
	modelId: string,
	contextLength = 0,
	_videoDurationSec = 0,
	_isEditing = false,
): Promise<number> {
	await ensureDataLoaded();

	// Find in DB cache
	const dbModel = CACHED_MODELS?.find((m) => m.modelId === modelId);

	let finalCost = dbModel ? dbModel.cost : MODEL_COSTS[modelId] || 1;

	// Heuristic for Feature/Special costs if not found in DB or using FEATURE_COSTS directly
	// logic: if modelId is a "feature key" like "image_recognition", logic below handles it?

	// Context Length Multiplier for Text Models
	if (contextLength > CONTEXT_COST_RUBRIC.threshold) {
		const extraBlocks = Math.ceil(
			(contextLength - CONTEXT_COST_RUBRIC.threshold) /
				CONTEXT_COST_RUBRIC.step,
		);
		// "For 6001-12000 will be x2, 12001-18000 x3"
		// If base is 1, and we have 1 block over, we want x2.
		// logic: multiplier = 1 + extraBlocks
		const multiplier = CONTEXT_COST_RUBRIC.baseMultiplier + extraBlocks;
		finalCost *= multiplier;
	}

	// Video/Image Special Logic overrides
	// (Ideally precise logic maps specific internal model IDs to cost features)

	return finalCost;
}

// Check if user's clan meets model's clan level requirement
async function checkClanLevelRequirement(
	ctx: any,
	user: any,
	modelId: string,
): Promise<boolean> {
	// Premium users bypass clan level requirement
	if (user.hasPaid) {
		return true;
	}

	await ensureDataLoaded();

	const dbModel = CACHED_MODELS?.find((m) => m.modelId === modelId);
	const requiredLevel = dbModel?.requiredClanLevel || 1;
	console.log(
		`[CheckClanLevel] Model: ${modelId}, Required: ${requiredLevel}, DBModel:`,
		dbModel,
	);

	// Fix: Always allow Nano Banana if limits allow (level 1+ has limits)
	if (
		modelId === "model_image_nano_banana" ||
		modelId === "openai/chatgpt-image-latest"
	) {
		return true;
	}

	if (requiredLevel <= 1) {
		return true; // No special requirement
	}

	const clanData = await getUserClan(user.id);
	if (!clanData) {
		// User not in clan, but model requires clan level > 1
		await ctx.reply(
			`⚠️ <b>Доступ к модели ограничен</b>\n\nДля использования этой модели поднимите уровень Клана до ${requiredLevel} или оформите Премиум подписку.`,
			{
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "🏰 Мой Клан",
								web_app: { url: "https://aporto.tech/app" },
							},
							{
								text: "⭐ Премиум",
								callback_data: "premium_menu",
							},
						],
					],
				},
			},
		);
		return false;
	}

	const counts = await getClanMemberCounts(clanData.id);
	const clanLevel = calculateClanLevel(
		counts.totalMembers,
		counts.proMembers,
		CACHED_CLAN_LEVELS || [],
	);

	if (clanLevel < requiredLevel) {
		await ctx.reply(
			`🔒 Эта модель требует клан уровня ${requiredLevel}, а у вас уровень ${clanLevel}.\n\nПовысьте уровень клана, чтобы отправить запрос.\nИли перейдите на Премиум.`,
			{
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "🏰 Мой Клан",
								web_app: { url: "https://aporto.tech/app" },
							},
							{
								text: "⭐ Премиум",
								callback_data: "premium_menu",
							},
						],
					],
				},
			},
		);
		return false;
	}

	return true;
}

// Check limits and return true if allowed, false if blocked (and sends message)
async function checkAndEnforceLimits(
	ctx: any,
	user: any,
	cost: number,
	modelId?: string,
): Promise<boolean> {
	// For premium users: Check and reset monthly limits (1500/month)
	if (user.hasPaid) {
		const { checkAndResetMonthlyPremiumLimits } = await import(
			"@/lib/db/premium-limits"
		);
		await checkAndResetMonthlyPremiumLimits(user.id, user.lastResetDate);
		// Refresh user data after potential reset
		const [updatedUser] = await getUserByTelegramId(user.telegramId);
		if (updatedUser) {
			user = updatedUser;
		}
	}

	let limit = 0;
	let currentUsage = 0;
	let isUnlimited = false;
	let effectiveCost = cost;

	// Determine Clan Level
	let clanLevel = 1;
	if (!user.hasPaid && user.clanId) {
		const clanData = await getUserClan(user.id);
		if (clanData) {
			const counts = await getClanMemberCounts(clanData.id);
			clanLevel = calculateClanLevel(
				counts.totalMembers,
				counts.proMembers,
				CACHED_CLAN_LEVELS || [],
			);
		}
	}
	const config = getLevelConfig(clanLevel, CACHED_CLAN_LEVELS || []);

	// Determine if image request based on modelId or cost logic?
	// Ideally passed modelId helps.
	// We can assume image if cost > some threshold OR check known IDs?
	// Better: check model type if possible. But we don't have dbModel here easily.
	// Quick hack: NANO_BANANA_ID or other image models.
	// For now, let's track separately.
	// We need to know if it's image to check image usage.
	const isImage =
		modelId === NANO_BANANA_ID ||
		modelId?.includes("image") ||
		modelId?.includes("midjourney") ||
		modelId?.includes("ideogram");

	if (user.hasPaid) {
		// 1. Paid User Logic
		limit = 1500; // Default Premium (monthly)
		// Try to find tariff limit.
		// Ideally we fetch subscription -> tariff -> requestLimit.
		// For MVP, we use hardcoded 3000/6000 logic or simply fetch User.requestCount < User.limit ?
		// But User table doesn't have custom limit column.
		// Let's rely on checking `user.balance`? No, using credits.
		// Actually, plan says: "Use Tariff Limit (3000/6000)".
		// We assume 3000 unless we detect 'premium_x2' in tariff slug?
		// Since we don't have tariff slug readily available on `user`, we might need a query `getLastActiveSubscription`.
		// Existing code has `getLastActiveSubscription`.
		const sub = await getLastActiveSubscription(user.id);
		if (sub?.tariffSlug.includes("x2")) {
			limit = 6000;
		}

		currentUsage = user.requestCount || 0; // Usage is stored in requestCount for Paid? Yes.
	} else {
		// 2. Free User Logic
		if (
			modelId &&
			(modelId.includes("video") ||
				modelId.includes("sora") ||
				modelId.includes("kling"))
		) {
			// Video models allowed for Premium OR Clan Level 5+
			if (clanLevel < 5) {
				await ctx.reply(
					"🔒 Видео-модели доступны только в Premium подписке или в Клане 5-го уровня.",
					{
						reply_markup: {
							inline_keyboard: [
								[
									{
										text: "🏰 Мой Клан",
										web_app: { url: "https://aporto.tech/app" },
									},
									{
										text: "💎 Premium",
										callback_data: "open_premium_subs",
									},
								],
							],
						},
					},
				);
				return false;
			}
		}

		if (isImage) {
			limit = config.benefits.weeklyImageGenerations * 15; // Convert image limit to "Credits" or just Count?
			// Plan: "Weekly Image Limits: 3 Gen".
			// User table has `weeklyImageUsage`.
			// We count Items, not Cost? "3 Gen".
			// Let's use `weeklyImageUsage` as count.
			limit = config.benefits.weeklyImageGenerations;
			currentUsage = user.weeklyImageUsage || 0;
		}
		// 		effectiveCost = 1; // 1 generation
		// 	} else {
		// 		// Text
		// 		limit = config.benefits.weeklyTextCredits;
		// 		currentUsage = user.weeklyTextUsage || 0;

		// 		// Check L5 Unlimited
		// 		if (
		// 			clanLevel === 5 &&
		// 			config.benefits.unlimitedModels?.includes(modelId || "")
		// 		) {
		// 			isUnlimited = true;
		// 			effectiveCost = 0;
		// 		}
		// 	}
		// }

		// REFACTOR: Use cost from DB for images too
		if (isImage) {
			limit = config.benefits.weeklyImageGenerations;
			currentUsage = user.weeklyImageUsage || 0;

			// Fetch cost from cached models
			const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === modelId);
			effectiveCost = dbModel ? dbModel.cost : 1;
		} else {
			// Text
			limit = config.benefits.weeklyTextCredits;
			currentUsage = user.weeklyTextUsage || 0;

			// Check L5 Unlimited
			if (
				clanLevel === 5 &&
				config.benefits.unlimitedModels?.includes(modelId || "")
			) {
				isUnlimited = true;
				effectiveCost = 0;
			}
		}
	}

	// Check Limit
	let isAllowed = false;

	// Logic:
	// If Unlimited -> Allowed.
	// If Image:
	//    Check Clan Usage < Clan Limit -> Allowed
	//    Check Free Images > 0 -> Allowed
	//    Check Standard Limit (Paid or Free Text) -> Allowed
	if (isUnlimited) {
		isAllowed = true;
	} else if (isImage) {
		// Image Priority Logic for CHECK
		const clanLimit = config.benefits.weeklyImageGenerations;
		const clanUsage = user.weeklyImageUsage || 0;

		if (clanUsage < clanLimit) {
			isAllowed = true;
		} else if ((user.freeImagesCount || 0) >= effectiveCost) {
			isAllowed = true;
		} else if (user.hasPaid) {
			// Fallback to Paid Request Limit
			// Check Subscription Limit (Monthly)
			const sub = await getLastActiveSubscription(user.id);
			const subLimit = sub?.tariffSlug.includes("x2") ? 6000 : 1500;
			// Note: Video models often have 0 limit in standard sub?
			// But here we rely on "Credit" system.

			if ((user.requestCount || 0) + effectiveCost <= subLimit) {
				isAllowed = true;
			}
		} else {
			// Free User, No Clan, No Free Images -> Blocked
			isAllowed = false;
		}
	} else if (currentUsage + effectiveCost <= limit) {
		// Text Logic (Standard)
		isAllowed = true;
	}

	if (!isAllowed) {
		// Try to consume from extraRequests
		const consumed = await consumeExtraRequests(user.id, effectiveCost);
		if (consumed) {
			// Consumed from extra pack, allow proceed
			return true;
		}

		let message = "";
		let buttons: any[] = [];

		// Track Limit Exceeded
		trackBackendEvent("Limit Exceeded", user.telegramId, {
			timestamp: Date.now(),
			is_premium: user.hasPaid,
			limit_type: user.hasPaid ? "monthly_premium" : "weekly_free",
			limit_amount: limit,
			attempted_cost: effectiveCost,
		});

		if (user.hasPaid) {
			// Paid User Reached Limit
			message = `⚡️ <b>Лимит тарифа исчерпан! (${limit})</b>\n\nДокупите пакет запросов, чтобы продолжить.`;
			buttons = [
				[{ text: "📦 Купить запросы", callback_data: "open_packets" }],
			];
		} else {
			// Free User Logic & Upsell
			const clanData = await getUserClan(user.id);
			let dynamicMessage =
				"🛑 <b>Лимиты на эту неделю исчерпаны.</b>\n\nДля увеличения перейдите на Pro или вступите в клан.";

			if (clanData) {
				buttons = [
					[{ text: "💎 Pro (400₽)", callback_data: "open_premium" }],
					[{ text: "📦 Купить запросы", callback_data: "open_packets" }],
					[
						{
							text: "🏰 Мой Клан",
							web_app: { url: "https://aporto.tech/app" },
						},
					],
				];

				// Calculate dynamic requirements
				try {
					const counts = await getClanMemberCounts(clanData.id);
					const dynamicLevels = await getClanLevels();
					const currentLevel = calculateClanLevel(
						counts.totalMembers,
						counts.proMembers,
						dynamicLevels,
					);
					const nextLevelReqs = getNextLevelRequirements(
						currentLevel,
						counts.totalMembers,
						counts.proMembers,
						dynamicLevels,
					);

					if (nextLevelReqs) {
						const n = nextLevelReqs.neededUsers;
						const currentConfig = getLevelConfig(currentLevel, dynamicLevels);
						const nextConfig = getLevelConfig(
							nextLevelReqs.nextLevel,
							dynamicLevels,
						);

						const x =
							nextConfig.benefits.weeklyTextCredits -
							currentConfig.benefits.weeklyTextCredits;
						const y =
							nextConfig.benefits.weeklyImageGenerations -
							currentConfig.benefits.weeklyImageGenerations;

						dynamicMessage = `🛑 <b>Лимиты на эту неделю исчерпаны.</b>\n\nДля увеличения перейдите на Pro или добавьте <b>${n}</b> друзей в клан, чтобы получить дополнительно <b>${x}</b> запросов и <b>${y}</b> генераций изображений в неделю.`;
					} else {
						// Max level
						dynamicMessage =
							"🛑 <b>Лимиты на эту неделю исчерпаны.</b>\n\nВаш клан достиг максимума! Перейдите на Pro для безлимита.";
					}
				} catch (e) {
					console.error(
						"Failed to calculate dynamic clan stats for message",
						e,
					);
				}
				message = dynamicMessage;
			} else {
				buttons = [
					[{ text: "💎 Pro (400₽)", callback_data: "open_premium" }],
					[{ text: "📦 Купить запросы", callback_data: "open_packets" }],
					[
						{
							text: "🛡 Найти / Создать Клан",
							web_app: { url: "https://aporto.tech/app" },
						},
					],
				];
				message = dynamicMessage;
			}
		}

		await ctx.reply(message, {
			parse_mode: "HTML",
			reply_markup: { inline_keyboard: buttons },
		});
		return false;
	}

	// Increment Usage - MOVED TO HANDLERS TO AVOID DOUBLE COUNTING
	// Logic: checkAndEnforceLimits should only CHECK.
	// The caller is responsible for calling increment functions upon success.
	// BUT: logic was mixed. Now we rely on checkAndEnforceLimits doing the check,
	// and we MUST ensure the caller increments.
	//
	// WAIT: If I remove it here, I need to add it consistently everywhere else.
	// The user reported "Double Charge".
	// ONE charge was likely here.
	// THE OTHER charge was likely in the handler (e.g. handleTextMessage line ~2678).
	//
	// FIX: I will KEEP it here (centralized) and REMOVE it from handlers.
	// This is safer to ensure all paths are counted.
	//
	// Correction: The user complained about double charge.
	// I removed the one in `handleTextMessage` (lines ~2678) in the previous step.
	// So this one SHOULD STAY to ensure we charge at least once.
	//
	// However, `checkAndEnforceLimits` is called BEFORE generation.
	// If generation fails, user is charged?
	// Ideally we charge AFTER generation.
	// But strictly speaking, for "Access Control", we often deduct first or reserve.
	// Given complexity, I will KEEP it here for now as the "Source of Truth" for charging,
	// and ensure NO other places charge.

	// Increment Usage
	if (isImage) {
		const clanLimit = config.benefits.weeklyImageGenerations; // Assuming simple count
		const clanUsage = user.weeklyImageUsage || 0;

		// 1. Clan Limits (Available for Free & Paid)
		if (clanUsage < clanLimit) {
			await incrementWeeklyImageUsage(user.id, effectiveCost);
		}
		// 2. Free Image Pack (Bonus)
		else if ((user.freeImagesCount || 0) >= effectiveCost) {
			await decrementUserFreeImages(user.id, effectiveCost);
		}
		// 3. Paid / Credits
		else if (user.hasPaid) {
			await incrementUserRequestCount(user.id, effectiveCost);
		}
		// 4. Free User Fallback (Blocked or consuming extra, but check logic blocked it earlier usually)
		else {
			// Logic for Free User over limit is usually blocked in CHECK phase.
			// But if we are here, means we allowed it (e.g. via extra requests or logic gap).
			// If we are here, increment standard usage to keep track?
			await incrementWeeklyImageUsage(user.id, effectiveCost);
		}
	} else {
		// TEXT REQUEST PRIORITY:
		// 1. Clan free limits (for ALL users, including premium)
		// 2. Premium subscription credits
		// 3. Extra purchased requests

		const clanLimit = config.benefits.weeklyTextCredits;
		const clanUsage = user.weeklyTextUsage || 0;

		if (clanUsage < clanLimit) {
			// Use clan free limits FIRST
			await incrementWeeklyTextUsage(user.id, effectiveCost);
		} else if (user.hasPaid) {
			// THEN use premium subscription credits
			await incrementUserRequestCount(user.id, effectiveCost);
		} else if ((user.extraRequests || 0) >= effectiveCost) {
			// THEN use extra purchased requests
			await consumeExtraRequests(user.id, effectiveCost);
		} else {
			// No resources available - should have been blocked in CHECK phase
			// But track it anyway to maintain data consistency
			await incrementWeeklyTextUsage(user.id, effectiveCost);
		}
	}

	return true;
}

function getPaymentMethodKeyboard(payUrl: string) {
	return {
		inline_keyboard: [
			[{ text: "Карта 💳", url: payUrl }],
			[{ text: "СБП 🏛", url: payUrl }],
			// Optional: Add stars payment if desired, but user request specifically mentioned SBP/Card leading to gateway.
			// Re-reading user request: "и кнопки с выбором формы оплаты - СБП или По карте, которые ведут в наш платежный шлюз"
			[{ text: "🔙 Назад", callback_data: "buy_gpt_images" }],
		],
	};
}

async function showModelMenu(ctx: any, user: any) {
	await ensureDataLoaded();
	const currentModel = user?.selectedModel || "model_gpt4omini";

	const modelInfo = `В боте доступны ведущие модели ChatGPT, Claude, Gemini и DeepSeek:

⭐️ GPT-5.2 — новая топ-модель OpenAI
🔥 GPT-4.1 — универсальная модель
✔️ GPT-5 mini — быстрая модель
🍓 OpenAI o3 — рассуждающая модель

🚀 Claude 4.5 Sonnet — для кодинга
💬 Claude 4.5 Thinking — рассуждающий режим

🐼 DeepSeek-V3.2 — текстовая модель
🐳 DeepSeek-V3.2 Thinking — для сложных задач

🤖 Gemini 3 Pro — топ-модель Google
⚡️ Gemini 3 Flash — быстрая модель

GPT-5 mini, Gemini 3 Flash и DeepSeek доступны бесплатно`;

	// Calculate Clan Level for Visual Locks
	const clanData = await getUserClan(user.id);
	let clanLevel = 1;
	if (clanData) {
		const counts = await getClanMemberCounts(clanData.id);
		clanLevel = calculateClanLevel(
			counts.totalMembers,
			counts.proMembers,
			CACHED_CLAN_LEVELS || [],
		);
	}

	await ctx.reply(modelInfo, {
		reply_markup: getModelKeyboard(currentModel, user?.hasPaid, clanLevel),
	});
}

async function showImageMenu(ctx: any, user: any) {
	await ensureDataLoaded();
	const hasConsented = await hasUserConsented(user.id, "image_generation");

	if (!hasConsented) {
		const termsText = `Вы переходите в раздел редактирования изображений.

Запрещается:
• загружать обнаженные фото
• использовать для провокации, обмана, шантажа

Продолжая, вы соглашаетесь с условиями использования сервиса.`;

		await ctx.reply(termsText, {
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: "Соглашаюсь с условиями",
							callback_data: "confirm_terms_image",
						},
					],
				],
			},
		});
		return;
	}

	const currentModel = user.selectedModel?.startsWith("model_image_")
		? user.selectedModel
		: undefined;

	// Calculate Clan Level for Visual Locks
	const clanData = await getUserClan(user.id);
	let clanLevel = 1;
	if (clanData) {
		const counts = await getClanMemberCounts(clanData.id);
		clanLevel = calculateClanLevel(
			counts.totalMembers,
			counts.proMembers,
			CACHED_CLAN_LEVELS || [],
		);
	}

	await ctx.reply(
		"🌠 GPT Image 1.5 от OpenAI – генерация и редактирование изображений.\n\n" +
			"🍌 Nano Banana – ИИ-фотошоп от Google.\n\n" +
			"🌅 FLUX 2 – создание изображений по вашему описанию.",
		{
			reply_markup: await getImageModelKeyboard(
				currentModel,
				user?.hasPaid,
				clanLevel,
			),
		},
	);
}

async function showSearchMenu(ctx: any, user: any) {
	await ensureDataLoaded();
	const currentModel = user?.selectedModel || "model_gemini_flash"; // Default to free model

	const searchText = `Выберите модель поиска или оставьте выбранную модель по-умолчанию

ℹ️ Режим Deep Research готовит детально проработанные ответы, поэтому занимает больше времени

Чтобы начать поиск отправьте в чат ваш запрос 👇`;

	// Calculate Clan Level for Visual Locks
	const clanData = await getUserClan(user.id);
	let clanLevel = 1;
	if (clanData) {
		const counts = await getClanMemberCounts(clanData.id);
		clanLevel = calculateClanLevel(
			counts.totalMembers,
			counts.proMembers,
			CACHED_CLAN_LEVELS || [],
		);
	}

	await ctx.reply(searchText, {
		reply_markup: getSearchModelKeyboard(
			currentModel,
			!!user.hasPaid,
			clanLevel,
		),
	});
}

async function showVideoMenu(ctx: any, user: any) {
	await ensureDataLoaded();
	const currentModel = user.selectedModel || "model_video_kling";

	const videoMenuText = `Выберите сервис для создания ролика:

🎬 Veo 3.1, Sora 2 — видео по описанию или фото
🌟 Kling Motion — оживление фото пресетами`;

	// Calculate Clan Level for Visual Locks
	const clanData = await getUserClan(user.id);
	let clanLevel = 1;
	if (clanData) {
		const counts = await getClanMemberCounts(clanData.id);
		clanLevel = calculateClanLevel(
			counts.totalMembers,
			counts.proMembers,
			CACHED_CLAN_LEVELS || [],
		);
	}

	await ctx.reply(videoMenuText, {
		reply_markup: getVideoModelKeyboard(currentModel, user?.hasPaid, clanLevel),
	});
}

async function showMusicMenu(ctx: any) {
	const musicMenuText = `Выберите режим генерации песни:

🥁 Простой режим — опишите о чем песня
🎸 Расширенный — свой текст и жанр`;

	await ctx.reply(musicMenuText, {
		reply_markup: getMusicGenerationKeyboard(),
	});
}

const PREMIUM_MENU_TEXT = `🚀 <b>PREMIUM PRO</b>
Один доступ — топовые нейросети мира у тебя в кармане.

Что внутри:
✅ <b>ПОЛНЫЙ ФАРШ:</b> GPT-5.2, Claude 4.5, Gemini 3 Pro, DeepSeek R1.
✅ <b>ГРАФИКА:</b> GPT Images 1.5, FLUX 2 и Nano Banana Pro.
✅ <b>КИНОСТУДИЯ:</b> Создание видео в Sora 2, Kling, Veo 3.1 и Hailuo.
✅ <b>УМНЫЙ ПОИСК:</b> Доступ в интернет через Perplexity и OpenAI o3.

<b>Лимиты:</b>
В подписку включено 1500 универсальных запросов на месяц. Этого объема более чем достаточно для активной работы, создания десятков фото и видео.

💰 <b>ЦЕНА: 400 ₽ / мес</b>
(Дешевле двух чашек кофе!)

👥 <b>В КЛАНЕ PRO:</b> от 238 ₽ за аккаунт
🚀 Объединяйтесь до 15 человек — это самая выгодная цена на рынке.`;

async function showPremiumMenu(ctx: any) {
	await ctx.reply(PREMIUM_MENU_TEXT, {
		parse_mode: "HTML",
		link_preview_options: { is_disabled: true },
		reply_markup: getPremiumKeyboard(),
	});
}

// --- Profile Helpers ---

function getProfileKeyboard(isPremium = false) {
	const mainButton = isPremium
		? { text: "📦 Дополнительные запросы", callback_data: "open_packets" }
		: { text: "🚀 Подключить Премиум", callback_data: "open_premium" };

	return {
		inline_keyboard: [
			[mainButton],
			[{ text: "🔙 Назад", callback_data: "menu_start" }],
		],
	};
}

async function showAccountInfo(ctx: any, user: any) {
	const isPremium = !!user.hasPaid;
	let usageText = "";
	let clanInfoText = "";

	// ALWAYS fetch clan data (for both premium and free users)
	const clanData = await getUserClan(user.id);
	let clanLevel = 1;
	let role = "";

	if (clanData) {
		const counts = await getClanMemberCounts(clanData.id);
		clanLevel = calculateClanLevel(counts.totalMembers, counts.proMembers);
		role =
			clanData.role === "owner"
				? "Глава"
				: clanData.role === "admin"
					? "Админ"
					: "Участник";

		clanInfoText = `\n🏰 Клан: ${clanData.name} (Ур. ${clanLevel})\nРоль: ${role}`;
	}

	// Get clan benefits config from DB (use cached levels if available)
	let clanTextLimit = 15; // defaults
	let clanImageLimit = 0;

	if (clanData && CACHED_CLAN_LEVELS) {
		const levelData = CACHED_CLAN_LEVELS.find((l) => l.level === clanLevel);
		if (levelData) {
			clanTextLimit = levelData.weeklyTextCredits;
			clanImageLimit = levelData.weeklyImageGenerations;
		}
	} else {
		// Fallback to hardcoded config if DB not available
		const config = getLevelConfig(clanLevel);
		clanTextLimit = config.benefits.weeklyTextCredits;
		clanImageLimit = config.benefits.weeklyImageGenerations;
	}

	// Get Plan Name
	let planName = isPremium ? "Премиум 🚀" : "Стандартный";

	if (isPremium) {
		// Paid: Track credits (requestCount) vs Subscription Limit (Default 3000)
		const sub = await getLastActiveSubscription(user.id);
		const limit = sub?.tariffSlug.includes("x2") ? 6000 : 1500;
		const used = user.requestCount || 0;
		usageText = `💎 Премиум: ${used}/${limit} кредитов`;

		if (user.selectedModel?.includes("video")) {
			usageText += "\n(Видео: отдельные пакеты)";
		}

		// ADD: Show clan free limits for premium users
		const clanTextUsed = user.weeklyTextUsage || 0;
		const clanImageUsed = user.weeklyImageUsage || 0;

		usageText += `\n🎁 Клан (бесплатно): ${clanTextUsed}/${clanTextLimit} запросов/нед`;
		if (clanImageLimit > 0) {
			usageText += `\n🎁 Клан (бесплатно): ${clanImageUsed}/${clanImageLimit} генераций изображений/нед`;
		}
	} else {
		// Free: Track weekly text usage vs Clan Level Limit
		const used = user.weeklyTextUsage || 0;
		usageText = `${used}/${clanTextLimit} кредитов (нед.)`;
		planName = `Free (Клан Ур. ${clanLevel})`;

		// Show image usage for free users
		if (clanImageLimit > 0) {
			const fnImageUsed = user.weeklyImageUsage || 0;
			usageText += `\n🎁 Клан (бесплатно): ${fnImageUsed}/${clanImageLimit} генераций изображений/нед`;
		}
	}

	// Free Images Display (bonus packs)

	// Free Images Display (bonus packs)
	if ((user.freeImagesCount || 0) > 0) {
		usageText += `\n🎁 Бонусные генерации: ${user.freeImagesCount}`;
	}

	// Extra requests display
	if ((user.extraRequests || 0) > 0) {
		usageText += `\n📦 Доп. запросы: ${user.extraRequests}`;
	}

	// Get neat model name
	const currentModelKey = user.selectedModel || "model_gpt4omini";
	const currentModelName = MODEL_NAMES[currentModelKey] || currentModelKey;

	// Conditional promotion text based on subscription status
	let promotionText = "";
	if (isPremium) {
		promotionText = `
💎 Нужно еще больше? Купить дополнительные запросы!
`;
	} else {
		promotionText = `
Нужно больше? Подключите /premium или развивайте Клан!

🚀 <b>Подписка Премиум</b>:
 └ 1500 кредитов
 └ Доступ ко всем моделям
 └ Приоритетная скорость
 `;
	}

	const text = `👤 <b>Мой профиль</b>:
ID: ${user.telegramId || "N/A"}
Подписка: ${planName}
Выбрана модель: ${currentModelName} /model${clanInfoText}

📊 <b>Статистика использования</b>
${usageText}${promotionText}
🏰 <b>Мой Клан</b>: /clan
`;

	await ctx.reply(text, {
		parse_mode: "HTML",
		reply_markup: getProfileKeyboard(isPremium),
	});
}

async function showSettingsMenu(ctx: any) {
	await ctx.reply(
		"⚙️ Настройки:\n\nЗдесь можно будет настроить параметры генерации.",
	);
}

async function showHelp(ctx: any) {
	await ctx.reply(`🎱 Список команд:

/start - Перезапустить бота
/model - Выбрать нейросеть
/photo - Создать изображение
/video - Создать видео
/suno - Создать музыку
/s - Поиск в интернете
/account - Профиль
/premium - Премиум
/clear - Очистить контекст
/settings - Настройки
/privacy - Условия использования`);
}

async function showPrivacy(ctx: any) {
	await ctx.reply(
		"📄 Условия использования:\n\nИспользуя бота, вы соглашаетесь с правилами обработки данных и условиями сервиса.",
	);
}

async function safeDeleteMessage(ctx: any) {
	try {
		await ctx.deleteMessage();
	} catch {
		// ignore error (e.g. message too old or missing perms)
	}
}

// --- Commands ---

bot.command("start", async (ctx) => {
	console.log("Received /start command");
	try {
		const telegramId = ctx.from?.id.toString();
		if (!telegramId) {
			console.warn("No Telegram ID found in context");
			return;
		}

		// Update Commands Menu
		await ctx.api.setMyCommands([
			{ command: "start", description: "👋 О нас" },
			{ command: "account", description: "👤 Профиль" },
			{ command: "premium", description: "🚀 Премиум" },
			{ command: "deletecontext", description: "💬 Очистить контекст" },
			{ command: "photo", description: "🌅 Создать изображение" },
			{ command: "video", description: "🎬 Создать видео" },
			{ command: "s", description: "🔎 Поиск в интернете" },
			{ command: "model", description: "📝 Выбрать модель" },
			{ command: "settings", description: "⚙️ Настройки" },
			{ command: "help", description: "🎱 Список команд" },
			{ command: "privacy", description: "📄 Условия использования" },
		]);

		// ... inside bot.command("start")

		// Extract payload from /start command (QR code source)
		const payload = ctx.match;
		const startParam =
			payload && typeof payload === "string" ? payload.trim() : undefined;

		// Handle Gift Code Activation
		if (startParam?.startsWith("gift_")) {
			const giftCode = startParam.replace("gift_", "");
			console.log(`Gift code activation attempt: ${giftCode}`);

			// Import gift queries
			const { activateGiftCode } = await import("@/lib/db/gift-queries");
			const { getUserByTelegramId, createTelegramUser } = await import(
				"@/lib/db/queries"
			);

			// Get or create user
			let [user] = await getUserByTelegramId(telegramId);
			if (!user) {
				[user] = await createTelegramUser(telegramId);
			}

			// Activate gift code
			const result = await activateGiftCode(
				giftCode,
				user.id,
				telegramId,
				"link",
			);

			if (result.success) {
				const durationText = result.subscription?.endDate
					? new Date(result.subscription.endDate).toLocaleDateString("ru-RU")
					: "неизвестно";

				await ctx.reply(
					`🎁 Поздравляем! Подарок активирован!\n\n` +
						`✨ Премиум подписка активна\n` +
						`📅 Действует до: ${durationText}\n\n` +
						`Теперь вам доступны все возможности бота!`,
				);

				// Track in Mixpanel
				trackBackendEvent("Gift Code: Activated", telegramId, {
					code: giftCode,
					source: "deep_link",
				});
			} else {
				await ctx.reply(
					`❌ Не удалось активировать код\n\n` +
						`Причина: ${result.error}\n\n` +
						`Если проблема повторяется, обратитесь в поддержку.`,
				);

				// Track failed activation
				trackBackendEvent("Gift Code: Failed", telegramId, {
					code: giftCode,
					error: result.error,
					source: "deep_link",
				});
			}

			return; // Exit after handling gift code
		}

		// Analytics: Determine Source and Campaign
		let sourceType = "Organic";
		let campaignTracking: any = {};

		if (startParam) {
			if (startParam.startsWith("qr_")) {
				sourceType = "QR Code";
			} else if (startParam.startsWith("sticker_")) {
				sourceType = "Sticker";
			} else if (
				startParam.startsWith("clan_") ||
				startParam.startsWith("ref_")
			) {
				sourceType = "Referral";
			} else {
				// Check Short Links DB
				try {
					const [link] = await db
						.select()
						.from(shortLinks)
						.where(eq(shortLinks.code, startParam))
						.limit(1);

					if (link) {
						sourceType = link.stickerTitle || "QR Campaign"; // Use Sticker Title as Source
						// Set Tracking Params
						campaignTracking = {
							utmSource: link.stickerTitle || "qr",
							utmMedium: "qr", // Standard for this flow
							utmCampaign: link.stickerFeatures,
							utmContent: link.stickerPrizes,
						};

						// Increment Clicks (Async - fire and forget)
						db.update(shortLinks)
							.set({ clicksCount: (link.clicksCount || 0) + 1 })
							.where(eq(shortLinks.id, link.id))
							.then(() => console.log(`Incremented clicks for ${link.code}`))
							.catch((e) => console.error("Failed to increment clicks", e));
					} else {
						sourceType = "Other Ref";
					}
				} catch (e) {
					console.error("Failed to check short links", e);
					sourceType = "Other Ref";
				}
			}
		}

		const userIdStr = telegramId.toString();

		// Create user in DB FIRST if not exists (Critical for Join Clan)
		let [user] = await getUserByTelegramId(telegramId);
		if (user) {
			// If user exists, but came from new campaign, should we update tracking?
			// Let's update if we have new tracking info.
			if (Object.keys(campaignTracking).length > 0) {
				await updateUserTracking(user.id, campaignTracking);
			}
		} else {
			[user] = await createTelegramUser(
				telegramId,
				undefined,
				startParam,
				campaignTracking,
			);

			// Identify newly created user
			identifyBackendUser(userIdStr, {
				$name: `User ${userIdStr}`,
				$email: user.email,
				source: sourceType,
				start_param: startParam,
				...campaignTracking,
			});

			trackBackendEvent("User: Register", userIdStr, {
				source: sourceType,
				start_param: startParam,
				...campaignTracking,
			});
		}

		// Ensure we Identify existing users too if they have new UTM tracking
		if (Object.keys(campaignTracking).length > 0) {
			identifyBackendUser(userIdStr, campaignTracking);
		}

		trackBackendEvent("User: Start", userIdStr, {
			source: sourceType,
			start_param: startParam,
			...campaignTracking,
		});

		trackBackendEvent("Bot: Launch", userIdStr, { source: sourceType });

		// Reset model to default on start
		await updateUserSelectedModel(user.id, "model_gpt5nano");

		const welcomeMessage = `Привет! Ты в ИИ-боте №1 — здесь собраны все топовые нейросети мира для работы, учебы и творчества. 🚀

🎁 ТВОЙ БОНУС: У нас есть бесплатный доступ! Чем выше уровень твоего Клана, тем больше лимитов.

100 вопросов в неделю (на 5 уровне клана) на ChatGPT, DeepSeek, Gemini и умный поиск Perplexity.

ИИ-фотошоп и генератор графики тоже включены!

💎 В /PREMIUM (для профи): Самые мощные модели планеты: GPT-5.2, Claude, GPT Images 1.5.

С чего начать?

✍️ НАПИШИ ЛЮБОЙ ВОПРОС — бот ответит мгновенно. Можно даже скинуть фото (например, задачу или конспект).

🔎 ПОИСК В СЕТИ (/s): Актуальные новости и факты из интернета в режиме реального времени.

 КАРТИНКИ (/photo): Создавай шедевры или редактируй свои фото через «Nano Banana».

// 🎬 ВИДЕО (/video): Оживляй свои идеи и создавай ролики в один клик.

⚙️ ВЫБОР МОЗГОВ: Нажми /model, чтобы сменить нейросеть.

Собери свой Клан и пользуйся ИИ на максимум!`;

		// Sanitize URL and force HTTPS
		let baseUrl = (
			process.env.NEXTAUTH_URL || "https://aporto.tech/app"
		).replace(/\/$/, "");
		if (
			!baseUrl.startsWith("https://") &&
			!baseUrl.startsWith("http://localhost")
		) {
			baseUrl = baseUrl.replace(/^http:\/\//, "https://");
		}

		// Debug command
		if (ctx.message?.text === "/debug") {
			await ctx.reply(
				`Base URL: ${baseUrl}\nButton URL: https://t.me/aporto_bot/app?startapp=app`,
			);
			return;
		}

		// Auto-Pin Clan Message (FIRST)
		try {
			const pinMsg = await ctx.reply(
				"👑 <b>Объединяйтесь в кланы!</b>\n\nРазвивайте своё комьюнити вместе с друзьями и забирайте крутые привилегии для каждого участника:\n\n• Дополнительные кредиты каждую неделю\n• Безлимитный доступ к нейросетям (на 5 уровне)\n• Генерация картинок\n\n👇 Жми кнопку ниже, чтобы войти в игру и создать свой клан!",
				{
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: "🏰 Мой Клан",
									url: "https://t.me/aporto_bot/app",
								},
							],
						],
					},
				},
			);
			await ctx.api.pinChatMessage(ctx.chat.id, pinMsg.message_id);
		} catch (e) {
			console.error("Failed to auto-pin clan message:", e);
		}

		// Add delay to ensure order (Clan -> Welcome)
		await new Promise((resolve) => setTimeout(resolve, 500));

		await ctx.reply(welcomeMessage, {
			reply_markup: {
				keyboard: [
					["📝 Выбрать модель", "🎨 Создать картинку"],
					["🛠 Готовые сценарии"],
					["🔎 Интернет-поиск", "🎬 Создать видео"],
					["🚀 Премиум", "👤 Мой профиль"],
				],
				resize_keyboard: true,
				is_persistent: true,
			},
		});
		console.log("Welcome message sent");

		// CLAN INVITE HANDLING (Moved to end so it's the last message)
		if (startParam?.startsWith("clan_")) {
			const inviteCode = startParam.replace("clan_", "").trim();
			if (inviteCode) {
				const clan = await getClanByInviteCode(inviteCode);
				if (clan) {
					// Add small delay to ensure it arrives last
					await new Promise((resolve) => setTimeout(resolve, 300));

					await ctx.reply(
						`🏰 <b>Приглашение в клан</b>\n\nВы были приглашены в клан <b>${clan.name}</b>.\nВступите, чтобы получать бонусы и доступ к новым моделям!`,
						{
							parse_mode: "HTML",
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: `✅ Вступить в ${clan.name}`,
											callback_data: `join_clan_${inviteCode}`,
										},
									],
									[{ text: "❌ Отмена", callback_data: "delete_message" }],
								],
							},
						},
					);
				} else {
					// Silent fail or late error?
					// If we are here, welcome message is already sent.
					// Let's send specific error if code was invalid but user is new/existing.
					await ctx.reply("❌ Клан с таким кодом не найден.");
				}
			}
		}
	} catch (error) {
		console.error("Error in /start command:", error);
		await ctx.reply("Sorry, I encountered an error. Please try again later.");
	}
});

bot.command("pin_clan", async (ctx) => {
	await safeDeleteMessage(ctx);
	try {
		const message = await ctx.reply(
			"👑 <b>Объединяйтесь в кланы!</b>\n\nРазвивайте своё комьюнити вместе с друзьями и забирайте крутые привилегии для каждого участника:\n\n• Дополнительные кредиты каждую неделю\n• Безлимитный доступ к нейросетям (на 5 уровне)\n• Генерация картинок\n\n👇 Жми кнопку ниже, чтобы войти в игру и создать свой клан!",
			{
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "🏰 Мой Клан",
								url: "https://t.me/aporto_bot/app",
							},
						],
					],
				},
			},
		);

		await ctx.api.pinChatMessage(ctx.chat.id, message.message_id);
		console.log("Clan message pinned");
	} catch (error) {
		console.error("Error pinning clan message:", error);
		await ctx.reply("Не удалось закрепить сообщение.");
	}
});

// --- Clan Callbacks ---
bot.callbackQuery(/^join_clan_(.+)$/, async (ctx) => {
	const inviteCode = ctx.match[1];
	const telegramId = ctx.from.id.toString();

	try {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await ctx.answerCallbackQuery("Пользователь не найден. Нажмите /start");
			return;
		}

		const res = await joinClan(user.id, inviteCode);

		if (res.success) {
			await safeDeleteMessage(ctx);
			// Try to pin clan message?
		} else {
			let errorMsg = "Не удалось вступить в клан.";
			if (res.error === "clan_not_found") {
				errorMsg = "Клан не найден.";
			}
			if (res.error === "already_in_this_clan") {
				errorMsg = "Вы уже в этом клане.";
			}
			if (res.error === "clan_full_redirect") {
				errorMsg = "Этот клан переполнен.";
			}

			await ctx.answerCallbackQuery(errorMsg);
			await ctx.reply(errorMsg);
		}
	} catch (e) {
		console.error("Join clan callback error", e);
		await ctx.answerCallbackQuery("Произошла ошибка.");
	}
});

bot.callbackQuery("delete_message", async (ctx) => {
	try {
		await ctx.deleteMessage();
	} catch {
		// ignore
	}
});

bot.command("clan", async (ctx) => {
	await safeDeleteMessage(ctx);
	await ctx.reply("Откройте приложение клана:", {
		reply_markup: {
			inline_keyboard: [
				[
					{
						text: "🏰 Открыть Клан",
						web_app: { url: "https://aporto.tech/app" },
					},
				],
			],
		},
	});
});

bot.hears("⚔️ Мой клан", async (ctx) => {
	// If this handler triggers, the user has cached text-only button
	// Refresh keyboard to WebApp version
	await ctx.reply(
		"Обновляю меню... Нажмите на кнопку еще раз, чтобы открыть приложение.",
		{
			reply_markup: {
				keyboard: [
					["📝 Выбрать модель", "🎨 Создать картинку"],
					["🔎 Интернет-поиск", "🎬 Создать видео"],
					[
						{
							text: "⚔️ Мой клан",
							web_app: {
								url: "https://aporto.tech/app",
							},
						},
					],
					["🚀 Премиум", "👤 Мой профиль"],
				],
				resize_keyboard: true,
				is_persistent: true,
			},
		},
	);

	// Send clan button as inline keyboard
	await ctx.reply("Или откройте приложение клана:", {
		reply_markup: {
			inline_keyboard: [
				[
					{
						text: "🏰 Открыть Клан",
						web_app: { url: "https://aporto.tech/app" },
					},
				],
			],
		},
	});
});

bot.callbackQuery("clan_create", async (ctx) => {
	await ctx.reply(
		"Введите название для нового клана в ответ на это сообщение:",
		{
			reply_markup: { force_reply: true },
		},
	);
	await safeAnswerCallbackQuery(ctx);
});

bot.callbackQuery("clan_join", async (ctx) => {
	await ctx.reply(
		"Введите код приглашения (например CLAN-X1Y2Z3) в ответ на это сообщение:",
		{
			reply_markup: { force_reply: true },
		},
	);
	await safeAnswerCallbackQuery(ctx);
});

bot.callbackQuery("clan_leave", async (ctx) => {
	const [user] = await getUserByTelegramId(ctx.from?.id.toString() || "");
	if (!user) {
		return;
	}
	const result = await leaveClan(user.id);
	if (result.success) {
		await ctx.reply("Вы покинули клан.");
		await showClanMenu(ctx, user);
	} else {
		await ctx.reply(`Ошибка: ${result.error}`);
	}
	await safeAnswerCallbackQuery(ctx);
});

bot.callbackQuery("clan_invite_link", async (ctx) => {
	const [user] = await getUserByTelegramId(ctx.from?.id.toString() || "");
	const clanData = await getUserClan(user?.id);
	if (clanData) {
		const link = `https://t.me/${ctx.me.username}?start=clan_${clanData.inviteCode}`;
		await ctx.reply(
			`Ваша ссылка для приглашения:\n${link}\n\nКод: ${clanData.inviteCode}`,
		);
	}
	await safeAnswerCallbackQuery(ctx);
});

async function showClanMenu(ctx: any, user: any) {
	const clanData = await getUserClan(user.id);

	if (clanData) {
		// In Clan
		const counts = await getClanMemberCounts(clanData.id);
		const level = calculateClanLevel(counts.totalMembers, counts.proMembers);
		const config = getLevelConfig(level);
		const nextReq = getNextLevelRequirements(
			level,
			counts.totalMembers,
			counts.proMembers,
		);

		let nextLevelText = "Максимальный уровень!";
		if (nextReq) {
			nextLevelText = `До уровня ${nextReq.nextLevel}: ${nextReq.description}`;
		}

		const roleName =
			clanData.role === "owner"
				? "Глава"
				: clanData.role === "admin"
					? "Админ"
					: "Участник";

		const text = `🏰 <b>${clanData.name}</b>\n
Уровень: ${level}
Участников: ${counts.totalMembers} (Pro: ${counts.proMembers})
Ваша роль: ${roleName}

🏆 <b>Бонусы уровня ${level}</b>:
• ${config.benefits.weeklyTextCredits} кредитов/неделю каждому
• ${config.benefits.weeklyImageGenerations} картинок
${level === 5 ? "• Безлимит на GPT-5 Nano и GPT-4o mini\n" : ""}
📈 <b>Прогресс</b>:
${nextLevelText}

Код приглашения: <code>${clanData.inviteCode}</code>`;

		const buttons: any[] = [
			[{ text: "📨 Пригласить друзей", callback_data: "clan_invite_link" }],
			[{ text: "🚪 Покинуть клан", callback_data: "clan_leave" }],
		];

		await ctx.reply(text, {
			parse_mode: "HTML",
			reply_markup: { inline_keyboard: buttons },
		});
	} else {
		// No Clan
		const text =
			"🏰 <b>Кланеры</b>\n\nВступайте в Клан или создайте свой, чтобы получать бонусы!\n\n💎 Бонусы клана:\n• Больше бесплатных кредитов\n• Доступ к GPT-5 Nano и GPT-4o mini безлимитно (на 5 уровне)\n• Генерация картинок";
		await ctx.reply(text, {
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[{ text: "✨ Создать клан", callback_data: "clan_create" }],
					[{ text: "🛡 Вступить по коду", callback_data: "clan_join" }],
				],
			},
		});
	}
}

// --- Scenarios Handlers ---

// 1. Show Scenarios Menu
bot.hears("🛠 Готовые сценарии", async (ctx) => {
	const buttons: any[][] = [];

	// Group by 2
	for (let i = 0; i < SCENARIOS.length; i += 2) {
		const row = SCENARIOS.slice(i, i + 2).map((cat) => ({
			text: `${cat.emoji} ${cat.title}`,
			callback_data: `scenarios_cat_${cat.id}`,
		}));
		buttons.push(row);
	}

	// Add "Close" or "Back"
	buttons.push([{ text: "🔙 Закрыть", callback_data: "menu_close" }]);

	await ctx.reply("🛠 <b>Готовые сценарии</b>\n\nВыберите категорию:", {
		parse_mode: "HTML",
		reply_markup: {
			inline_keyboard: buttons,
		},
	});
});

// 2. Handle Category Selection
bot.callbackQuery(/^scenarios_cat_(.+)$/, async (ctx) => {
	const catId = ctx.match[1];
	const category = SCENARIOS.find((c) => c.id === catId);

	if (!category) {
		await ctx.answerCallbackQuery("Категория не найдена");
		return;
	}

	const buttons = category.items.map((item) => [
		{
			text: item.title,
			callback_data: `scenario_item_${item.id}`,
		},
	]);

	buttons.push([
		{ text: "🔙 Назад к категориям", callback_data: "scenarios_back" },
	]);

	await ctx.editMessageText(
		`<b>${category.emoji} ${category.title}</b>\n\nВыберите сценарий:`,
		{
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: buttons,
			},
		},
	);
	await safeAnswerCallbackQuery(ctx);
});

// 3. Handle Item Selection (Show Prompt)
bot.callbackQuery(/^scenario_item_(.+)$/, async (ctx) => {
	const itemId = ctx.match[1];

	// Flatten search
	let foundItem: any = null;

	for (const cat of SCENARIOS) {
		const item = cat.items.find((i) => i.id === itemId);
		if (item) {
			foundItem = item;

			// Auto-switch model logic
			const telegramId = ctx.from?.id.toString();
			if (telegramId) {
				const [user] = await getUserByTelegramId(telegramId);
				if (user) {
					// Default to text model
					let targetModel = "model_gpt5nano";

					// If category implies image generation
					if (cat.id === "create_image" || cat.id === "improve_photo") {
						targetModel = "model_image_nano_banana";
					}

					if (user.selectedModel !== targetModel) {
						await updateUserSelectedModel(user.id, targetModel);
					}
				}
			}
			break;
		}
	}

	if (!foundItem) {
		await ctx.answerCallbackQuery("Сценарий не найден");
		return;
	}

	const instruction = foundItem.description
		? `\nℹ️ <i>${foundItem.description}</i>`
		: "";

	const responseText = `<b>${foundItem.title}</b>${instruction}\n\nНажмите на текст ниже, чтобы скопировать, и отправьте боту:\n\n<code>${foundItem.prompt}</code>`;

	// We send a NEW message so user can see it easily and copy.
	// We can also edit the current one but then context is lost?
	// User asked to "fill input", we simulate this by making it easy to copy.
	// We keep the menu open? Or better, send new message and keep menu?
	// Let's Edit if it's navigation, but here it's "Result".
	// If we Edit, user might lose the menu.
	// Let's send a new message and answer callback.

	await ctx.reply(responseText, { parse_mode: "HTML" });
	await safeAnswerCallbackQuery(ctx, "Скопируйте текст и отправьте боту");
});

// 4. Back Button Handler
bot.callbackQuery("scenarios_back", async (ctx) => {
	// Re-render main categories
	const buttons: any[][] = [];
	for (let i = 0; i < SCENARIOS.length; i += 2) {
		const row = SCENARIOS.slice(i, i + 2).map((cat) => ({
			text: `${cat.emoji} ${cat.title}`,
			callback_data: `scenarios_cat_${cat.id}`,
		}));
		buttons.push(row);
	}
	buttons.push([{ text: "🔙 Закрыть", callback_data: "menu_close" }]);

	await ctx.editMessageText(
		"🛠 <b>Готовые сценарии</b>\n\nВыберите категорию:",
		{
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: buttons,
			},
		},
	);
	await safeAnswerCallbackQuery(ctx);
});

bot.command("clear", async (ctx) => {
	await safeDeleteMessage(ctx);
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}

	try {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await ctx.reply("Сначала нужно начать диалог командой /start");
			return;
		}

		// Create a new chat to "clear" history context
		const chatId = generateUUID();
		await saveChat({
			id: chatId,
			userId: user.id,
			title: "Telegram Chat (Cleared)",
			visibility: "private",
		});

		// Reset model to default
		await updateUserSelectedModel(user.id, "model_gpt5nano");

		await ctx.reply(
			"🧹 История очищена! Я забыл всё, о чём мы говорили ранее.\nГотов к новому диалогу! 🚀",
		);
	} catch (error) {
		console.error("Error in /clear command:", error);
		await ctx.reply("Не удалось очистить историю. Попробуйте позже.");
	}
});

bot.command("account", async (ctx) => {
	await safeDeleteMessage(ctx);
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}
	const [user] = await getUserByTelegramId(telegramId);
	await showAccountInfo(ctx, user);
});

bot.command("premium", async (ctx) => {
	await safeDeleteMessage(ctx);
	await showPremiumMenu(ctx);
});

bot.command("unsubscribe", async (ctx) => {
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}

	try {
		await safeDeleteMessage(ctx);

		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await ctx.reply("❌ Пользователь не найден. Нажмите /start");
			return;
		}

		const sub = await getLastActiveSubscription(user.id);

		// Debug logging to help trace if needed
		console.log(`[Unsubscribe Command] User: ${user.id}, Sub: ${sub?.id}`);

		if (!sub) {
			await ctx.reply("❌ У вас нет активной подписки.");
			return;
		}

		if (!sub.autoRenew) {
			const dateStr = sub.endDate.toLocaleDateString("ru-RU");
			await ctx.reply(
				`✅ Автопродление уже отключено.\nВаша подписка действует до ${dateStr}.`,
			);
			return;
		}

		const tariffName = sub.tariffSlug.includes("premium_x2")
			? "Premium X2"
			: "Premium";

		await ctx.reply(
			`Вы хотите отменить автоматическое списание по подписке <b>${tariffName}</b>?`,
			{
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "✅ Подтвердить",
								callback_data: "unsubscribe_confirm",
							},
						],
						[
							{
								text: "🔙 Назад",
								callback_data: "unsubscribe_back",
							},
						],
					],
				},
			},
		);
	} catch (error) {
		console.error("Error in /unsubscribe:", error);
		await ctx.reply("Произошла ошибка. Попробуйте позже.");
	}
});

bot.command("deletecontext", async (ctx) => {
	await safeDeleteMessage(ctx);
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}

	try {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await ctx.reply("Сначала нужно начать диалог командой /start");
			return;
		}
		const chatId = generateUUID();
		await saveChat({
			id: chatId,
			userId: user.id,
			title: "Telegram Chat (Cleared)",
			visibility: "private",
		});

		// Reset model to default
		await updateUserSelectedModel(user.id, "model_gpt5nano");

		await ctx.reply(
			"🧹 История очищена! Я забыл всё, о чём мы говорили ранее.\nГотов к новому диалогу! 🚀",
		);
	} catch (error) {
		console.error("Error in /deletecontext command:", error);
		await ctx.reply("Не удалось очистить историю. Попробуйте позже.");
	}
});

bot.command("photo", async (ctx) => {
	await safeDeleteMessage(ctx);
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}
	const [user] = await getUserByTelegramId(telegramId);
	if (user) {
		await showImageMenu(ctx, user);
	}
});

bot.command("video", async (ctx) => {
	await safeDeleteMessage(ctx);
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}
	const [user] = await getUserByTelegramId(telegramId);
	if (user) {
		await showVideoMenu(ctx, user);
	}
});

bot.command("s", async (ctx) => {
	await safeDeleteMessage(ctx);
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}
	const [user] = await getUserByTelegramId(telegramId);
	if (user) {
		await showSearchMenu(ctx, user);
	}
});

bot.command("model", async (ctx) => {
	await safeDeleteMessage(ctx);
	await ensureDataLoaded();
	const telegramId = ctx.from?.id.toString();
	if (!telegramId) {
		return;
	}
	const [user] = await getUserByTelegramId(telegramId);
	if (user) {
		await showModelMenu(ctx, user);
	}
});

bot.command("settings", async (ctx) => {
	await safeDeleteMessage(ctx);
	await showSettingsMenu(ctx);
});

bot.command("help", async (ctx) => {
	await safeDeleteMessage(ctx);
	await showHelp(ctx);
});

bot.command("privacy", async (ctx) => {
	await safeDeleteMessage(ctx);
	await showPrivacy(ctx);
});

// --- Callback Query Handler ---

bot.on("callback_query:data", async (ctx) => {
	const telegramId = ctx.from.id.toString();
	const data = ctx.callbackQuery.data;

	// Ensure models are loaded for any label lookups
	await ensureDataLoaded();

	// Handle menu navigation
	if (data === "menu_start" || data === "menu_close") {
		await ctx.deleteMessage();
		await safeAnswerCallbackQuery(ctx);
		return;
	}

	// --- Video Menu Logic ---
	if (
		data === "menu_video" ||
		data === "menu_video_veo" ||
		data === "menu_video_sora" ||
		data === "menu_video_kling_motion" ||
		data.startsWith("configure_video_") ||
		data.startsWith("set_duration_") ||
		data.startsWith("set_kling_motion_")
	) {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		// Calculate Clan Level for Visual Locks & Enforcement
		const clanData = await getUserClan(user.id);
		let clanLevel = 1;
		if (clanData) {
			const counts = await getClanMemberCounts(clanData.id);
			clanLevel = calculateClanLevel(
				counts.totalMembers,
				counts.proMembers,
				CACHED_CLAN_LEVELS || [],
			);
		}

		const currentModelId = user.selectedModel || "";

		if (data === "menu_video_kling_motion") {
			try {
				await ctx.deleteMessage();
			} catch {
				// ignore
			}
			await ctx.reply(
				"<b>🎬 Kling Motion</b>\n\nВыберите видео с нужным движением:",
				{
					parse_mode: "HTML",
					reply_markup: getKlingMotionKeyboard(),
				},
			);
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		if (data === "menu_video_pika" || data === "menu_video_hailuo") {
			await safeAnswerCallbackQuery(ctx, "Этот сервис скоро появится! ⏳");
			return;
		}

		if (data.startsWith("set_kling_motion_")) {
			const motionId = data.replace("set_kling_motion_", "");
			const motion = KLING_MOTIONS.find((m) => m.id === motionId);

			if (!motion) {
				await safeAnswerCallbackQuery(ctx, "Пресет не найден");
				return;
			}

			try {
				await ctx.deleteMessage();
			} catch {
				// ignore
			}

			// 2. Check Cache for Video
			const videoPathReference = `kling_motion_${motion.id}`; // Unique key for this local file asset
			let videoToSend: string | InputFile = "";
			let isCached = false;

			try {
				const [cached] = await db
					.select()
					.from(cachedAssets)
					.where(eq(cachedAssets.url, videoPathReference))
					.limit(1);

				if (cached) {
					console.log(`[Bot] Using cached asset for ${videoPathReference}`);
					videoToSend = cached.fileId;
					isCached = true;
				}
			} catch (e) {
				console.error("Cache lookup failed:", e);
			}

			if (!isCached) {
				const videoPath = path.join(process.cwd(), "public", motion.video);

				// Try to upload to Storage Channel first if configured
				const storageChannelId = process.env.TELEGRAM_STORAGE_CHANNEL_ID;
				if (storageChannelId) {
					try {
						console.log(
							`[Bot] Uploading ${videoPathReference} to storage channel: ${storageChannelId}`,
						);
						const storageMessage = await ctx.api.sendVideo(
							storageChannelId,
							new InputFile(videoPath),
							{
								caption: `Cache: ${videoPathReference}`,
							},
						);

						if (storageMessage.video) {
							videoToSend = storageMessage.video.file_id;
							isCached = true; // technically it's now "cached" in Telegram via storage channel

							// Save to DB immediately
							await db
								.insert(cachedAssets)
								.values({
									url: videoPathReference,
									fileId: storageMessage.video.file_id,
									fileType: "video",
								})
								.onConflictDoNothing();
							console.log(
								`[Bot] Cached asset ${videoPathReference} -> ${storageMessage.video.file_id} (from Storage Channel)`,
							);
						}
					} catch (storageError) {
						console.error(
							"[Bot] Failed to upload to storage channel:",
							storageError,
						);
						// Fallback to local file
						videoToSend = new InputFile(videoPath);
					}
				} else {
					videoToSend = new InputFile(videoPath);
				}
			}

			try {
				const sentMessage = await ctx.replyWithVideo(videoToSend, {
					caption: `Движение: <b>${motion.label}</b>\n\n${motion.description}`,
					parse_mode: "HTML",
				});

				// Save to Cache if not cached (and wasn't saved via storage channel)
				if (!isCached && sentMessage.video) {
					try {
						await db
							.insert(cachedAssets)
							.values({
								url: videoPathReference,
								fileId: sentMessage.video.file_id,
								fileType: "video",
							})
							.onConflictDoNothing();
						console.log(
							`[Bot] Cached asset ${videoPathReference} -> ${sentMessage.video.file_id}`,
						);
					} catch (saveError) {
						console.error("[Bot] Failed to save asset to cache:", saveError);
					}
				}

				// 3. Send instructions
				await ctx.reply(
					"1. Выберите видео с нужным движением\n2. Отправьте свое изображение",
					{
						reply_markup: {
							inline_keyboard: [
								[
									{
										text: "🔙 Назад к меню",
										callback_data: "menu_video_kling_motion",
									},
								],
							],
						},
					},
				);

				// 4. Update user state
				await updateUserSelectedModel(user.id, "model_video_kling");
				await updateUserPreferences(user.id, {
					kling_motion: motion.id,
				});

				await safeAnswerCallbackQuery(ctx, "Инструкции отправлены!");
			} catch (err) {
				console.error("Failed to send Kling Motion reference video:", err);
				await ctx.reply(
					"❌ Ошибка: видео-референс не найден на сервере. Пожалуйста, сообщите администратору.",
				);
				await safeAnswerCallbackQuery(ctx);
			}
			return;
		}

		if (data === "menu_video") {
			await ctx.editMessageText(
				"Выберите сервис для создания ролика:\n\n🎬 Veo 3.1, Sora 2 — видео по описанию или фото\n🌟 Kling Motion — оживление фото пресетами",
				{
					reply_markup: getVideoModelKeyboard(
						currentModelId,
						!!user.hasPaid,
						clanLevel,
					),
				},
			);
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		if (data === "menu_video_veo") {
			await ctx.editMessageText("Выберите версию Veo:", {
				reply_markup: getVeoVariantKeyboard(
					currentModelId,
					!!user.hasPaid,
					clanLevel,
				),
			});
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		if (data === "menu_video_sora") {
			await ctx.editMessageText("Выберите версию Sora:", {
				reply_markup: getSoraVariantKeyboard(
					currentModelId,
					!!user.hasPaid,
					clanLevel,
				),
			});
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		if (data.startsWith("configure_video_")) {
			let modelId = "";
			let name = "";

			if (data.includes("_sora_pro")) {
				modelId = "model_video_sora_pro";
				name = "Sora 2 Pro";
			} else if (data.includes("_sora")) {
				modelId = "model_video_sora";
				name = "Sora 2";
			} else if (data.includes("_veo_fast")) {
				modelId = "model_video_veo_fast";
				name = "Veo 3.1 Fast";
			} else if (data.includes("_veo")) {
				modelId = "model_video_veo";
				name = "Veo 3.1";
			}

			if (modelId) {
				// ENFORCE CLAN LEVEL LIMITS
				await ensureDataLoaded();
				const dbModel = CACHED_MODELS?.find((m) => m.modelId === modelId);
				const requiredLevel = dbModel?.requiredClanLevel || 1;
				const isFree = FREE_MODELS.includes(modelId);

				if (!user.hasPaid && !isFree && clanLevel < requiredLevel) {
					await ctx.editMessageText(
						`⚠️ <b>Доступ ограничен</b>\n\nМодель <b>${name}</b> доступна с ${requiredLevel} уровня Клана.\nПоднимите уровень клана или оформите Премиум, чтобы пользоваться ей без ограничений.`,
						{
							parse_mode: "HTML",
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: "🏰 Мой Клан",
											web_app: { url: "https://aporto.tech/app" },
										},
									],
									[
										{
											text: "🚀 Подключить премиум",
											callback_data: "open_premium",
										},
									],
									[{ text: "🔙 Назад", callback_data: "menu_video" }],
								],
							},
						},
					);
					await safeAnswerCallbackQuery(ctx);
					return;
				}

				const currentDuration = (user.preferences as any)?.video_duration;
				await ctx.editMessageText(
					`Настройка ${name}.\nВыберите длительность видео:`,
					{ reply_markup: getVideoDurationKeyboard(modelId, currentDuration) },
				);
				await safeAnswerCallbackQuery(ctx);
				return;
			}
		}

		if (data.startsWith("set_duration_")) {
			// Format: set_duration_model_video_sora_4
			const parts = data.split("_");
			const secs = Number.parseInt(parts.pop() || "4", 10);
			const modelId = parts.slice(2).join("_");

			// Update User Preferences & Model
			await updateUserPreferences(user.id, {
				video_duration: secs,
			});
			await updateUserSelectedModel(user.id, modelId);

			const aspect = (user.preferences as any)?.video_aspect; // Use explicit or user's
			await safeAnswerCallbackQuery(ctx, `✅ ${secs} сек`);

			// NEXT STEP: Aspect Ratio
			await ctx.editMessageText(
				`✅ Длительность: ${secs} сек.\nТеперь выберите формат видео:`,
				{
					reply_markup: getVideoAspectKeyboard(modelId, aspect),
				},
			);
			return;
		}

		if (data.startsWith("set_video_aspect_")) {
			const aspect = data.replace("set_video_aspect_", "") as
				| "portrait"
				| "landscape";
			const modelId = user.selectedModel || "model_video_veo";

			// Save Aspect
			await updateUserPreferences(user.id, {
				video_aspect: aspect,
			});

			// Default quality if not set
			let quality = (user.preferences as any)?.video_quality;
			if (!quality) {
				quality = "720p";
				await updateUserPreferences(user.id, { video_quality: "720p" });
			}

			await safeAnswerCallbackQuery(
				ctx,
				`✅ ${aspect === "portrait" ? "9:16" : "16:9"}`,
			);

			// Skip explicit Quality step -> Go straight to "Ready"
			// User requested "message that now enter prompt"

			const duration = (user.preferences as any)?.video_duration || 5;

			// Calculate final cost
			await ensureDataLoaded();
			const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === modelId);
			const costPerSec = dbModel?.cost || 10;
			const totalCost = costPerSec * duration;

			await ctx.editMessageText(
				`✅ <b>Настройки видео готовы!</b>
        
📹 Модель: <b>${dbModel?.name || "Video Model"}</b>
⏱ Длительность: <b>${duration} сек</b>
📐 Формат: <b>${aspect === "portrait" ? "Портрет (9:16)" : "Ландшафт (16:9)"}</b>
📺 Качество: <b>${quality}</b>

💎 Стоимость: <b>${totalCost} кр.</b>

👇 <b>Напишите описание видео, чтобы начать генерацию...</b>`,
				{
					parse_mode: "HTML",
					reply_markup: getVideoModelKeyboard(modelId, !!user.hasPaid),
				},
			);
			return;
		}

		if (data === "back_to_video_aspect") {
			const modelId = user.selectedModel || "model_video_veo";
			const aspect = (user.preferences as any)?.video_aspect;
			await ctx.editMessageText("Выберите формат видео:", {
				reply_markup: getVideoAspectKeyboard(modelId, aspect),
			});
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		if (data.startsWith("set_video_quality_")) {
			const quality = data.replace("set_video_quality_", "") as
				| "720p"
				| "1080p";
			const modelId = user.selectedModel || "model_video_veo";

			await updateUserPreferences(user.id, {
				video_quality: quality,
			});

			// FINISH
			await safeAnswerCallbackQuery(ctx, "✅ Настройки сохранены!");

			const duration = (user.preferences as any)?.video_duration || 5;
			const aspect = (user.preferences as any)?.video_aspect || "landscape";

			// Calculate final cost for display
			const dbModel = CACHED_MODELS?.find((m: any) => m.modelId === modelId);
			const costPerSec = dbModel?.cost || 10;
			const totalCost = costPerSec * duration;

			await ctx.editMessageText(
				`✅ <b>Настройки видео готовы!</b>

📹 Модель: <b>${dbModel?.name}</b>
⏱ Длительность: <b>${duration} сек</b>
📐 Формат: <b>${aspect === "portrait" ? "Портрет (9:16)" : "Ландшафт (16:9)"}</b>
📺 Качество: <b>${quality}</b>

💎 Стоимость: <b>${totalCost} кр.</b>

<i>Напишите описание видео, чтобы начать генерацию...</i>`,
				{
					parse_mode: "HTML",
					reply_markup: getVideoModelKeyboard(modelId, !!user.hasPaid),
				},
			);
			return;
		}
	}
	// --- End Video Menu Logic ---

	// Handle Unsubscribe Confirm
	if (data === "unsubscribe_confirm") {
		await safeAnswerCallbackQuery(ctx, "Отменяю подписку...");

		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await ctx.editMessageText("❌ Пользователь не найден.");
			return;
		}

		const sub = await getLastActiveSubscription(user.id);
		if (!sub) {
			await ctx.editMessageText("❌ Подписка не найдена.");
			return;
		}

		await cancelUserSubscription(user.id);

		// Create detailed success message
		const dateStr = sub.endDate.toLocaleDateString("ru-RU");
		const successMsg = `✅ <b>Автопродление отключено</b>
    
Ваша подписка остается активной до <b>${dateStr}</b>.
После этой даты списаний не будет.`;

		await ctx.editMessageText(successMsg, { parse_mode: "HTML" });
		return;
	}

	// Handle Unsubscribe Back
	if (data === "unsubscribe_back") {
		await safeAnswerCallbackQuery(ctx);
		try {
			await ctx.deleteMessage();
		} catch {
			// Ignore delete errors
		}
		// Optionally return to profile or main menu, or just delete.
		// User requested "Back", usually means "Cancel the action".
		return;
	}

	// Handle model selection
	if (data.startsWith("model_")) {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			await safeAnswerCallbackQuery(ctx);
			return;
		}

		const isFreeModel = FREE_MODELS.includes(data);

		// Fetch DB config for this model
		await ensureDataLoaded();
		const targetModel = CACHED_MODELS?.find((m: any) => m.modelId === data);
		const requiredLevel = targetModel?.requiredClanLevel || 1;
		const modelName =
			MODEL_NAMES[data] || targetModel?.name || "Selected Model";

		// 1. If Locked by Premium/Free check, verify if Clan Level allows access
		if (!user.hasPaid && !isFreeModel) {
			if (requiredLevel > 1) {
				// Model CAN be unlocked by Clan Level
				const clanData = await getUserClan(user.id);
				let clanLevel = 1;
				if (clanData) {
					const counts = await getClanMemberCounts(clanData.id);
					clanLevel = calculateClanLevel(
						counts.totalMembers,
						counts.proMembers,
						CACHED_CLAN_LEVELS || [],
					);
				}

				if (clanLevel < requiredLevel) {
					// Blocked by Level -> Show Upsell with Clan Option
					await ctx.editMessageText(
						`⚠️ <b>Доступ ограничен</b>\n\nМодель <b>${modelName}</b> доступна с ${requiredLevel} уровня Клана.\nПоднимите уровень клана или оформите Премиум, чтобы пользоваться ей без ограничений.`,
						{
							parse_mode: "HTML",
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: "🏰 Мой Клан",
											web_app: { url: "https://aporto.tech/app" },
										},
									],
									[
										{
											text: "🚀 Подключить премиум",
											callback_data: "open_premium",
										},
									],
									[{ text: "🔙 Назад", callback_data: "menu_start" }],
								],
							},
						},
					);
					await safeAnswerCallbackQuery(ctx);
					return;
				}
				// If clanLevel >= requiredLevel, we PROCEED (Allowed!)
				// If clanLevel >= requiredLevel, we PROCEED (Allowed!)
			} else {
				// Required Level <= 1.
				// If Model is Premium/Paid, we allow selection so user can use Credits (Pay-Per-Use).
				// The checkAndEnforceLimits function will handle credit deduction or blocking if out of credits.
				// So we do NOTHING here (allow proceed).
			}
		}

		// Update selection
		await updateUserSelectedModel(user.id, data);

		// Create a new chat to "clear" history context when model changes
		const chatId = generateUUID();
		await saveChat({
			id: chatId,
			userId: user.id,
			title: "Telegram Chat (New Model)",
			visibility: "private",
		});

		// Notify about high cost models
		await ensureDataLoaded();
		const dbModel = CACHED_MODELS?.find((m) => m.modelId === data);
		const cost = dbModel ? dbModel.cost : MODEL_COSTS[data] || 1;

		if (cost > 0 && !isFreeModel) {
			const modelName = dbModel?.name || MODEL_NAMES[data] || data;

			let prefix = "Чат";
			if (data.includes("video") || dbModel?.type === "video") {
				prefix = "Видео";
			} else if (
				data.includes("image") ||
				dbModel?.type === "image" ||
				data.includes("midjourney") ||
				data.includes("gpt_images") ||
				data.includes("flux") ||
				data.includes("banana")
			) {
				prefix = "Изображение";
			}

			let plural = "генераций";
			const lastDigit = cost % 10;
			const lastTwo = cost % 100;

			if (lastDigit === 1 && lastTwo !== 11) {
				plural = "генерацию";
			} else if (
				[2, 3, 4].includes(lastDigit) &&
				![12, 13, 14].includes(lastTwo)
			) {
				plural = "генерации";
			}

			let message = `${prefix} с моделью ${modelName} расходует\n${cost} ${plural}`;

			if (dbModel?.description) {
				message = `${dbModel.description} расходует\n${cost} ${plural}`;
			}

			await safeAnswerCallbackQuery(ctx, message, { show_alert: true });
		}

		// Special handling for Nano Banana (Free)
		if (data === "model_image_nano_banana") {
			try {
				await ctx.deleteMessage();
			} catch (_e) {
				/* ignore */
			}

			await ctx.replyWithPhoto(
				new InputFile(
					path.join(process.cwd(), "public", "nano_banana_intro.jpg"),
				),
				{
					caption:
						"Создавайте и редактируйте изображения прямо в чате.\n\nГотовы начать?\nОтправьте изображение, которое вы хотите изменить, или напишите в чат, что нужно создать",
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: "🎨 ТОП 50 промптов",
									url: "https://teletype.in/@pevzner/50prompts",
								},
							],
							[{ text: "🔙 Назад", callback_data: "menu_start" }],
						],
					},
				},
			);
			await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
			return;
		}

		// Special handling for Nano Banana Pro
		if (data === "model_image_banana_pro") {
			try {
				await ctx.deleteMessage();
			} catch (_e) {
				/* ignore */
			}

			await ctx.replyWithPhoto(
				new InputFile(
					path.join(process.cwd(), "public", "nano_banana_intro.jpg"),
				),
				{
					caption:
						"Создавайте и редактируйте изображения прямо в чате.\n\nГотовы начать?\nОтправьте изображение, которое вы хотите изменить, или напишите в чат, что нужно создать",
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: "🎨 ТОП 50 промптов",
									url: "https://teletype.in/@pevzner/50prompts",
								},
							],
							[{ text: "🔙 Назад", callback_data: "menu_start" }],
						],
					},
				},
			);
			await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
			return;
		}

		// Special handling for GPT Images 1.5
		if (data === "model_image_gpt_images_1_5") {
			try {
				await ctx.deleteMessage();
			} catch (_e) {
				/* ignore */
			}

			await ctx.replyWithPhoto(
				new InputFile(
					path.join(process.cwd(), "public", "gpt_images_intro.jpg"),
				),
				{
					caption:
						"Создавайте и редактируйте изображения прямо в чате.\n\nГотовы начать?\nОтправьте изображение, которые вы хотите изменить, или напишите в чат, что нужно создать",
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: "📖 Инструкция",
									url: "https://teletype.in/@pevzner/guidegptimages",
								},
							],
							[{ text: "🔙 Назад", callback_data: "menu_start" }],
						],
					},
				},
			);
			await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
			return;
		}

		// Special handling for FLUX
		if (data === "model_image_flux") {
			try {
				await ctx.deleteMessage();
			} catch (_e) {
				/* ignore */
			}

			await ctx.replyWithPhoto(
				new InputFile(path.join(process.cwd(), "public", "flux_intro.jpg")),
				{
					caption:
						"Для запуска генерации напишите в чат, какое изображение вы хотите создать 👇",
					reply_markup: {
						inline_keyboard: [
							[{ text: "🔙 Назад", callback_data: "menu_start" }],
						],
					},
				},
			);
			await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
			return;
		}

		// Special handling for Internet Search Models
		if (
			data === "model_gpt52_web" ||
			data === "model_gpt41_web" ||
			data === "model_gpt_4osearch_web"
		) {
			try {
				await ctx.deleteMessage();
			} catch (_e) {
				/* ignore */
			}
			await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
			return;
		}

		// Determine which keyboard to use based on model type
		// Calculate Clan Level for Visual Locks
		const clanData = await getUserClan(user.id);
		let clanLevel = 1;
		if (clanData) {
			if (clanData.level) {
				// Optimization: Use stored level if available/reliable
				// But logic usually recalculates.
				// Let's rely on cached member counts for speed if possible, or just raw count.
				// Or simpler: Reuse the calculation helper.
				const counts = await getClanMemberCounts(clanData.id);
				clanLevel = calculateClanLevel(
					counts.totalMembers,
					counts.proMembers,
					CACHED_CLAN_LEVELS || [],
				);
			} else {
				// Likely fallback
				const counts = await getClanMemberCounts(clanData.id);
				clanLevel = calculateClanLevel(
					counts.totalMembers,
					counts.proMembers,
					CACHED_CLAN_LEVELS || [],
				);
			}
		}

		try {
			let keyboard: { inline_keyboard: any[][] };
			if (data.startsWith("model_image_")) {
				keyboard = await getImageModelKeyboard(data, !!user.hasPaid, clanLevel);
			} else if (data.startsWith("model_video_")) {
				keyboard = getVideoModelKeyboard(data, !!user.hasPaid, clanLevel);
			} else if (
				["model_perplexity", "model_grok41", "model_deepresearch"].includes(
					data,
				)
			) {
				keyboard = getSearchModelKeyboard(data, !!user.hasPaid, clanLevel);
			} else {
				keyboard = getModelKeyboard(data, !!user.hasPaid, clanLevel);
			}

			await ctx.editMessageReplyMarkup({
				reply_markup: keyboard,
			});
			await safeAnswerCallbackQuery(ctx, "Модель выбрана!");
		} catch (_e) {
			await safeAnswerCallbackQuery(ctx);
		}
		return;
	}

	// Handle consent confirmation
	if (data === "confirm_terms_image") {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			return;
		}

		try {
			await createUserConsent(user.id, "image_generation", {
				telegramId,
			});

			await ctx.deleteMessage();

			const currentModel = user.selectedModel?.startsWith("model_image_")
				? user.selectedModel
				: "model_image_nano_banana";

			await ctx.reply(
				"🌠 GPT Image 1.5 от OpenAI – генерация и редактирование изображений.\n\n" +
					"🍌 Nano Banana – ИИ-фотошоп от Google.\n\n" +
					"🌅 FLUX 2 – создание изображений по вашему описанию.",
				{
					reply_markup: await getImageModelKeyboard(
						currentModel,
						!!user?.hasPaid,
					),
				},
			);
			await safeAnswerCallbackQuery(ctx, "Условия приняты!");
		} catch (e) {
			console.error("Consent error:", e);
			await safeAnswerCallbackQuery(ctx, undefined, {
				text: "Ошибка сохранения согласия. Попробуйте позже.",
				show_alert: true,
			});
		}
		return;
	}

	// Handle full premium menu display (replace mode)
	if (data === "open_premium") {
		await ctx.editMessageText(PREMIUM_MENU_TEXT, {
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
			reply_markup: getPremiumKeyboard(),
		});
		await safeAnswerCallbackQuery(ctx);
		return;
	}

	// Handle premium menu navigation
	if (data === "buy_premium") {
		await ctx.editMessageReplyMarkup({
			reply_markup: await getSubscriptionKeyboard("premium"),
		});
		await safeAnswerCallbackQuery(ctx);
		return;
	}
	if (data === "buy_premium_x2") {
		await ctx.editMessageReplyMarkup({
			reply_markup: await getSubscriptionKeyboard("premium_x2"),
		});
		await safeAnswerCallbackQuery(ctx);
		return;
	}
	if (data === "premium_back") {
		await ctx.editMessageReplyMarkup({ reply_markup: getPremiumKeyboard() });
		await safeAnswerCallbackQuery(ctx);
		return;
	}

	// Handle payment creation
	if (data.startsWith("pay_")) {
		const rawArgs = data.replace("pay_", "");

		// Detect Stars Payment
		const isStars = rawArgs.startsWith("stars_");
		const cleanArgs = isStars ? rawArgs.replace("stars_", "") : rawArgs;

		let planKey: "premium" | "premium_x2" = "premium";
		let months = 1;

		if (cleanArgs.startsWith("premium_x2_")) {
			planKey = "premium_x2";
			months = Number.parseInt(cleanArgs.replace("premium_x2_", ""), 10);
		} else {
			planKey = "premium";
			months = Number.parseInt(cleanArgs.replace("premium_", ""), 10);
		}

		const tariffSlug = `${planKey}_${months}`;

		// Fetch tariff from DB
		const tariff = await getTariffBySlug(tariffSlug);
		if (!tariff) {
			await safeAnswerCallbackQuery(ctx, "Тариф не найден.", {
				show_alert: true,
			});
			return;
		}

		const description = tariff.name; // or construct: `${planKey === "premium_x2" ? "Premium X2" : "Premium"} (${months} мес)`;
		const priceRub = tariff.priceRub;
		const priceStars = tariff.priceStars;

		if (isStars) {
			if (!priceStars) {
				await safeAnswerCallbackQuery(ctx, "Error: Price not found");
				return;
			}

			await safeAnswerCallbackQuery(ctx, "Создаю инвойс...");
			// sendInvoice(chat_id, title, description, payload, provider_token, currency, prices)
			await ctx.replyWithInvoice(
				description, // title
				`Оплата подписки ${description}`, // description
				tariffSlug, // payload
				"XTR", // currency
				[{ label: description, amount: priceStars }], // prices
			);
			return;
		}

		// Existing YooKassa Logic
		const price = priceRub; // From DB tariff

		if (!price) {
			await safeAnswerCallbackQuery(ctx, "Error: Invalid plan");
			return;
		}

		await safeAnswerCallbackQuery(ctx, "Создаю счет...");
		try {
			await ctx.deleteMessage();
		} catch {
			// ignore
		}

		const placeholder = await ctx.reply("⏳ Создаю платеж...");

		const payment = await createYookassaPayment(
			price,
			description,
			telegramId,
			tariffSlug,
			placeholder.message_id,
		);

		if (payment?.confirmation?.confirmation_url) {
			const payUrl = payment.confirmation.confirmation_url;
			const days = months * 30;
			const requestLimit = planKey === "premium_x2" ? 200 : 100;
			const title = planKey === "premium_x2" ? "Premium X2" : "Premium";

			const messageText = `Вы оформляете подписку ${title} с регулярным списанием раз в ${days} календарных дней.
Вам будет доступно ${requestLimit} запросов в день.
Стоимость - ${price} ₽.

Отменить можно по команде /unsubscribe.

Оформляя оплату Вы даете согласие на условия оферты рекуррентных платежей, политики обработки персональных данных и тарифа.

Если у вас есть вопросы по подписке или оплате, напишите нам @GoPevzner .`;

			await ctx.api.editMessageText(
				placeholder.chat.id,
				placeholder.message_id,
				messageText,
				{
					parse_mode: "HTML",
					link_preview_options: { is_disabled: true },
					reply_markup: {
						inline_keyboard: [
							[{ text: "Карта 💳", url: payUrl }],
							[{ text: "СБП 🏛", url: payUrl }],
							[
								{
									text: "Оплатить Telegram Stars",
									callback_data: `pay_stars_${planKey}_${months}`,
								},
							],
						],
					},
				},
			);
		} else {
			await ctx.api.editMessageText(
				placeholder.chat.id,
				placeholder.message_id,
				"❌ Ошибка создания платежа. Попробуйте позже или свяжитесь с поддержкой.",
			);
		}
		return;
	}

	// Handle Pack Selection
	if (data === "open_packets") {
		const packs = [
			{ name: "1500 запросов", price: "400₽", slug: "pack_requests_1500" },
			{ name: "3000 запросов", price: "750₽", slug: "pack_requests_3000" },
			{ name: "7000 запросов", price: "2000₽", slug: "pack_requests_7000" },
		];

		const buttons = packs.map((framework) => [
			{
				text: `${framework.name} - ${framework.price}`,
				callback_data: `select_pack_${framework.slug}`,
			},
		]);
		buttons.push([{ text: "🔙 Назад", callback_data: "open_premium" }]);

		await ctx.editMessageText(
			"<b>📦 Пакеты запросов</b>\n\nЕсли 1500 лимитов в месяц тебе мало — просто докупи пакет расширения. Дополнительные запросы не сгорают в конце месяца и будут ждать, пока ты их используешь!",
			{
				parse_mode: "HTML",
				reply_markup: { inline_keyboard: buttons },
			},
		);
		return;
	}

	// Handle Pack Payment Init
	if (data.startsWith("select_pack_")) {
		const slug = data.replace("select_pack_", "");
		const tariff = await getTariffBySlug(slug);

		if (!tariff) {
			await safeAnswerCallbackQuery(ctx, "Тариф не найден");
			return;
		}

		await safeAnswerCallbackQuery(ctx, "Создаю счет...");

		const placeholder = await ctx.reply("⏳ Создаю платеж...");
		const payment = await createYookassaPayment(
			tariff.priceRub,
			tariff.description || tariff.name,
			telegramId,
			tariff.slug,
			placeholder.message_id,
		);

		if (payment?.confirmation?.confirmation_url) {
			await ctx.api.editMessageText(
				placeholder.chat.id,
				placeholder.message_id,
				`Оплата тарифа: <b>${tariff.name}</b>\nСумма: ${tariff.priceRub}₽`,
				{
					parse_mode: "HTML",
					reply_markup: getPaymentMethodKeyboard(
						payment.confirmation.confirmation_url,
					),
				},
			);
		} else {
			await ctx.api.editMessageText(
				placeholder.chat.id,
				placeholder.message_id,
				"Ошибка платежа.",
			);
		}
		return;
	}

	// Handle Subscription Selection (sub_pro_*)
	if (data.startsWith("sub_")) {
		const slug = data;
		const tariff = await getTariffBySlug(slug);

		if (!tariff) {
			await safeAnswerCallbackQuery(ctx, "Тариф не найден");
			return;
		}

		await safeAnswerCallbackQuery(ctx, "Создаю счет...");

		const placeholder = await ctx.reply("⏳ Создаю платеж...");
		const payment = await createYookassaPayment(
			tariff.priceRub,
			tariff.description || tariff.name,
			telegramId,
			tariff.slug,
			placeholder.message_id,
		);

		if (payment?.confirmation?.confirmation_url) {
			await ctx.api.editMessageText(
				placeholder.chat.id,
				placeholder.message_id,
				`Подписка: <b>${tariff.name}</b>\nСумма: ${tariff.priceRub}₽`,
				{
					parse_mode: "HTML",
					reply_markup: getPaymentMethodKeyboard(
						payment.confirmation.confirmation_url,
					),
				},
			);
		} else {
			await ctx.api.editMessageText(
				placeholder.chat.id,
				placeholder.message_id,
				"Ошибка платежа.",
			);
		}
		return;
	}

	// Handle Premium Sub-menu
	if (data === "open_premium_subs") {
		await ctx.editMessageText("Выберите период подписки:", {
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "1 мес. (400₽)", callback_data: "sub_pro_1" },
						{ text: "3 мес. (1080₽) -10%", callback_data: "sub_pro_3" },
					],
					[
						{ text: "6 мес. (2040₽) -15%", callback_data: "sub_pro_6" },
						{ text: "12 мес. (3840₽) -20%", callback_data: "sub_pro_12" },
					],
					[{ text: "🔙 Назад", callback_data: "open_premium" }],
				],
			},
		});
		return;
	}

	// Handle Clan Pro Stub
	if (data === "open_clan_pro") {
		const clanProOptions = [
			{ text: "1 Месяц - 4200₽", callback_data: "clan_pro_stub" },
			{ text: "3 Месяца -5%", callback_data: "clan_pro_stub" },
			{ text: "6 Месяцев -10%", callback_data: "clan_pro_stub" },
			{ text: "12 Месяцев -15%", callback_data: "clan_pro_stub" },
		];
		const buttons = clanProOptions.map((o) => [o]);
		buttons.push([{ text: "🔙 Назад", callback_data: "open_premium" }]);

		await ctx.editMessageText(
			"👥 <b>Подписка для Клана</b>\n\nДо 15 участников. Оплата единым счетом.\nВыгоднее, чем покупать отдельно каждому!",
			{
				parse_mode: "HTML",
				reply_markup: { inline_keyboard: buttons },
			},
		);
		return;
	}

	if (data === "clan_pro_stub") {
		await ctx.answerCallbackQuery({
			text: "Напишите нам для подключения: @GoPevzner",
			show_alert: true,
		});
		return;
	}

	// Handle other "buy_" buttons (placeholders for Packs)
	if (
		data === "/premium" ||
		data === "/pro" ||
		data.startsWith("buy_") ||
		data.startsWith("music_mode_")
	) {
		await safeAnswerCallbackQuery(ctx, "В разработке...");
		await ctx.reply(
			"Выбор пакетов (Video, MJ, Suno) скоро появится. Пока доступна только подписка Premium.",
		);
		return;
	}

	await safeAnswerCallbackQuery(ctx);
	await safeAnswerCallbackQuery(ctx);
});

// Checkout Handlers for Stars
bot.on("pre_checkout_query", async (ctx) => {
	await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
	const payment = ctx.message.successful_payment;
	const tariffSlug = payment.invoice_payload;
	const telegramId = ctx.from.id.toString();
	const totalAmount = payment.total_amount;

	console.log(
		`Successful Stars payment: ${totalAmount} XTR for ${tariffSlug} from user ${telegramId}`,
	);

	try {
		const [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			console.error(`User not found for payment: ${telegramId}`);
			return;
		}

		if (tariffSlug.startsWith("pack_")) {
			// Request Pack
			const tariff = await getTariffBySlug(tariffSlug);
			if (tariff?.requestLimit) {
				await addExtraRequests(user.id, tariff.requestLimit);
				await ctx.reply(
					`✅ Оплата прошла успешно!\nДобавлено ${tariff.requestLimit} запросов.`,
				);
			} else {
				await ctx.reply(
					"✅ Оплата прошла, но тариф не найден. Напишите в поддержку.",
				);
			}
		} else {
			// Subscription
			const parts = tariffSlug.split("_");
			const months = Number.parseInt(parts.at(-1) ?? "1", 10);
			const durationDays = months * 30;

			await createStarSubscription(user.id, tariffSlug, durationDays);

			await ctx.reply(
				`✅ Оплата прошла успешно!\nПодписка активирована на ${months} мес.`,
			);
		}
	} catch (error) {
		console.error("Error processing successful_payment:", error);
		await ctx.reply("⚠️ Оплата принята, но произошла ошибка активации.");
	}
});

// --- Message Handlers ---

bot.on("message:text", async (ctx) => {
	const telegramId = ctx.from.id.toString();
	const text = ctx.message.text;
	await ensureDataLoaded();

	// --- Clan Inputs Handler ---
	const replyText = ctx.message.reply_to_message?.text;
	if (replyText) {
		if (replyText.includes("Введите название для нового клана")) {
			const [user] = await getUserByTelegramId(telegramId);
			if (user) {
				const result = await createClan(user.id, text.trim());
				if (result.success) {
					await ctx.reply(`Клан "${text}" создан!`);
					await showClanMenu(ctx, user);
				} else {
					await ctx.reply(
						`Ошибка: ${result.error === "name_taken" ? "Имя занято" : result.error}`,
					);
				}
			}
			return;
		}
		if (replyText.includes("Введите код приглашения")) {
			const [user] = await getUserByTelegramId(telegramId);
			if (user) {
				const result = await joinClan(user.id, text.trim().toUpperCase()); // codes usually uppercase
				if (result.success) {
					await ctx.reply("Вы вступили в клан!");
					await showClanMenu(ctx, user);
				} else {
					await ctx.reply(
						`Ошибка: ${result.error === "clan_not_found" ? "Клан не найден" : result.error}`,
					);
				}
			}
			return;
		}
	}

	// Helper for button handling
	const handleButton = async (action: (user: any) => Promise<void>) => {
		try {
			await ctx.deleteMessage();
		} catch (_e) {
			// ignore
		}
		const [user] = await getUserByTelegramId(telegramId);
		if (user) {
			await checkAndResetWeeklyLimits(user.id, user.lastResetDate); // added
			await action(user);
		}
	};

	if (text === "📝 Выбрать модель") {
		await handleButton((user) => showModelMenu(ctx, user));
		return;
	}

	if (text === "🎨 Создать картинку") {
		await handleButton((user) => showImageMenu(ctx, user));
		return;
	}

	if (text === "🔎 Интернет-поиск") {
		await handleButton((user) => showSearchMenu(ctx, user));
		return;
	}

	if (text === "🎬 Создать видео") {
		await handleButton((user) => showVideoMenu(ctx, user));
		return;
	}

	if (text === "🎸 Создать песню") {
		try {
			await ctx.deleteMessage();
		} catch (_e) {
			// ignore
		}
		await showMusicMenu(ctx);
		return;
	}

	// --- Admin Commands ---
	if (text.startsWith("/")) {
		const parts = text.split(" ");
		const command = parts[0];

		// Helper: Check Admin
		const isAdmin = async () => {
			const [user] = await getUserByTelegramId(telegramId);
			// Bootstrap: If ID matches hardcoded owner (replace with real ID if known) OR user.isAdmin
			const OWNER_ID = "YOUR_TELEGRAM_ID_HERE"; // Replace or rely on DB
			return user?.isAdmin || telegramId === OWNER_ID; // Fallback for first run
		};

		if (command === "/admin" && (await isAdmin())) {
			const targetId = parts[1] || telegramId;
			const [target] = await getUserByTelegramId(targetId);
			if (!target) {
				await ctx.reply("User not found.");
				return;
			}
			await ctx.reply(
				`👤 <b>User Report</b>
ID: <code>${target.telegramId}</code>
Role: <b>${target.hasPaid ? "Premium/Pro" : "Free"}</b>
Admin: ${target.isAdmin ? "✅" : "❌"}
Requests: ${target.requestCount}
Limit: ${target.hasPaid ? SUBSCRIPTION_LIMITS.premium : SUBSCRIPTION_LIMITS.free}
Last Reset: ${target.lastResetDate ? target.lastResetDate.toISOString() : "Never"}`,
				{ parse_mode: "HTML" },
			);
			return;
		}

		if (command === "/set_premium" && (await isAdmin())) {
			const targetId = parts[1];
			const status = parts[2] === "on";
			if (!targetId) {
				await ctx.reply("Usage: /set_premium [tg_id] [on/off]");
				return;
			}

			const [target] = await getUserByTelegramId(targetId);
			if (target) {
				await setUserDetails({
					userId: target.id,
					hasPaid: status,
					isActive: true,
				});
				await ctx.reply(`User ${targetId} premium set to ${status}`);
			} else {
				await ctx.reply(
					"User not found via Telegram ID. Ensure they have started the bot.",
				);
			}
			return;
		}

		if (command === "/set_limit" && (await isAdmin())) {
			const targetId = parts[1];
			const amount = Number.parseInt(parts[2], 10);
			if (!targetId || Number.isNaN(amount)) {
				await ctx.reply("Usage: /set_limit [tg_id] [amount]");
				return;
			}

			const [target] = await getUserByTelegramId(targetId);
			if (target) {
				await setUserDetails({ userId: target.id, requestCount: amount });
				await ctx.reply(`User ${targetId} request count set to ${amount}`);
			}
			return;
		}

		if (command === "/make_admin" && (await isAdmin())) {
			const targetId = parts[1];
			if (!targetId) {
				await ctx.reply("Usage: /make_admin [tg_id]");
				return;
			}
			const [target] = await getUserByTelegramId(targetId);
			if (target) {
				await setUserDetails({ userId: target.id, isAdmin: true });
				await ctx.reply(`User ${targetId} is now an Admin.`);
			}
			return;
		}

		// Secret Seeding Command
		if (command === "/seed_models" && (await isAdmin())) {
			await ctx.reply("Seeding models...");
			let count = 0;

			// Seed MODEL_COSTS
			for (const [id, cost] of Object.entries(MODEL_COSTS)) {
				await upsertAiModel({
					modelId: id,
					name: id,
					provider: id.split("/")[0] || "unknown",
					type: id.includes("image") ? "image" : "text",
					cost,
					isEnabled: true,
				});
				count++;
			}

			// Seed FEATURE_COSTS (as pseudo-models)
			for (const [key, cost] of Object.entries(FEATURE_COSTS)) {
				await upsertAiModel({
					modelId: key,
					name: key,
					provider: "feature",
					type: "feature",
					cost,
					isEnabled: true,
				});
				count++;
			}
			await ctx.reply(`Seeded ${count} models/features.`);
			return;
		}
	}

	if (text === "🚀 Премиум" || text === "/premium") {
		try {
			await ctx.deleteMessage();
		} catch (_e) {
			// ignore
		}
		await showPremiumMenu(ctx);
		return;
	}

	if (text === "👤 Мой профиль") {
		await handleButton((user) => showAccountInfo(ctx, user));
		return;
	}

	// Handle /unsubscribe is done via bot.command("unsubscribe")

	// Regular message processing
	// Regular message processing
	try {
		// 0. Drop Stale Updates
		const messageDate = ctx.message.date;
		const now = Math.floor(Date.now() / 1000);

		if (now - messageDate > 60) {
			console.warn(
				`Dropping stale update from user ${telegramId} (delay: ${now - messageDate}s)`,
			);
			return;
		}

		// 1. Get or Create User
		let [user] = await getUserByTelegramId(telegramId);
		if (!user) {
			[user] = await createTelegramUser(telegramId);
		}

		// 1.1 Idempotency Check
		const isNew = await setLastMessageId(
			user.id,
			ctx.message.message_id.toString(),
		);
		if (!isNew) {
			console.warn(
				`Dropping duplicate/concurrent processing for message ${ctx.message.message_id}`,
			);
			return;
		}

		// --- ENFORCEMENT START ---
		const userType: "pro" | "regular" = user.hasPaid ? "pro" : "regular";
		const entitlements = entitlementsByUserType[userType];

		// A. Character Limit
		// Use Model Limit if defined, otherwise fallback to entitlement
		const selectedId = user.selectedModel || "model_gpt4omini";
		const modelLimit = MODEL_LIMITS[selectedId] || entitlements.charLimit;

		if (text.length > modelLimit) {
			await ctx.reply(
				`⚠️ Сообщение слишком длинное. Лимит модели: ${modelLimit} символов.`,
			);
			return;
		}

		// B. Cost & Subscription Limit
		const cost = await calculateRequestCost(
			user.selectedModel || "model_gpt4omini",
			text.length,
		);

		// Check clan level requirement first
		const hasAccess = await checkClanLevelRequirement(
			ctx,
			user,
			user.selectedModel || "model_gpt4omini",
		);
		if (!hasAccess) {
			return;
		}

		const allowed = await checkAndEnforceLimits(
			ctx,
			user,
			cost,
			user.selectedModel || "model_gpt4omini",
		);
		if (!allowed) {
			return;
		}

		// --- ENFORCEMENT END ---

		// 2. Find active chat or create new one
		const { chats } = await getChatsByUserId({
			id: user.id,
			limit: 1,
			startingAfter: null,
			endingBefore: null,
		});

		let chatId: string;

		if (chats.length > 0) {
			chatId = chats[0].id;
		} else {
			chatId = generateUUID();
			await saveChat({
				id: chatId,
				userId: user.id,
				title: "Telegram Chat",
				visibility: "private",
			});
		}

		// 3. Save User Message
		const userMessageId = generateUUID();
		await saveMessages({
			messages: [
				{
					id: userMessageId,
					chatId,
					role: "user",
					parts: [{ type: "text", text }],
					attachments: [],
					createdAt: new Date(),
				},
			],
		});

		// 5. Generate Response using selected model
		const selectedModelId = user.selectedModel || "model_gpt4omini";

		// Track Request (Now safe to use selectedModelId)
		trackBackendEvent("Request: Chat", telegramId, {
			param_model: selectedModelId,
			param_type: "text",
			param_cost: cost,
			param_length: text.length,
		});

		// 4. Fetch History
		const history = await getMessagesByChatId({ id: chatId });
		const aiMessages: any[] = history.map((m) => ({
			role: m.role,
			content: (m.parts as any[]).map((p) => p.text).join("\n"),
		}));

		// --- Image Generation Flow ---
		if (selectedModelId?.startsWith("model_image_")) {
			const IMAGE_MODELS = await getImageModels();
			const imageModelConfig = IMAGE_MODELS[selectedModelId];

			if (!imageModelConfig || !imageModelConfig.enabled) {
				await ctx.reply(
					"⚠️ Эта модель пока недоступна или находится в разработке.",
				);
				return;
			}

			// Check clan level requirement first
			const hasAccess = await checkClanLevelRequirement(
				ctx,
				user,
				selectedModelId,
			);
			if (!hasAccess) {
				return;
			}

			// Enforce Limits
			const allowed = await checkAndEnforceLimits(
				ctx,
				user,
				1, // Cost 1? Or look up model cost? Usually 1 generation = 1 credit or handled by isImage logic in check function
				selectedModelId,
			);

			if (!allowed) {
				return;
			}

			await ctx.replyWithChatAction("upload_photo");
			await ctx.reply(`🎨 Генерирую (${imageModelConfig.name}): "${text}"...`);

			trackBackendEvent("Model: Request", telegramId, {
				model: selectedModelId,
				type: "image",
				status: "attempt",
				prompt_length: text.length,
			});

			try {
				// SWITCH PROVIDER LOGIC
				switch (imageModelConfig.provider) {
					case "openai": {
						const { experimental_generateImage } = await import("ai");
						const { openai } = await import("@ai-sdk/openai");

						// Strip "openai/" prefix if present
						// const modelId = imageModelConfig.id.replace(/^openai\//, "");

						const { image } = await experimental_generateImage({
							model: openai.image("dall-e-3"),
							prompt: text,
							n: 1,
							size: "1024x1024",
							providerOptions: {
								openai: { quality: "standard" },
							},
						});

						if (image?.base64) {
							const buffer = Buffer.from(image.base64, "base64");
							await ctx.replyWithPhoto(
								new InputFile(buffer, `image_${Date.now()}.png`),
								{
									caption: "Сделано в @aporto_bot",
								},
							);
						} else {
							throw new Error("No image data returned from OpenAI");
						}
						break;
					}

					case "openrouter": {
						const apiKey = process.env.OPENROUTER_API_KEY;
						if (!apiKey) {
							throw new Error("Missing OPENROUTER_API_KEY");
						}

						// Direct fetch to OpenRouter Chat Completions for Image Generation
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60 seconds timeout

						const response = await fetch(
							"https://openrouter.ai/api/v1/chat/completions",
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${apiKey}`,
									"Content-Type": "application/json",
									"HTTP-Referer": "https://aporto.tech", // Optional, encouraged by OpenRouter
									"X-Title": "Aporto Bot", // Optional
								},
								body: JSON.stringify({
									model: imageModelConfig.id,
									messages: [{ role: "user", content: text }],
									// Explicitly request image and text capabilities
									modalities: ["image", "text"],
								}),
								signal: controller.signal,
							},
						);

						clearTimeout(timeoutId);

						if (!response.ok) {
							const err = await response.text();
							console.error("OpenRouter API Error:", response.status, err);
							throw new Error(
								`OpenRouter API Error: ${response.status} - ${err}`,
							);
						}

						const data = await response.json();
						console.log("OpenRouter Response:", JSON.stringify(data, null, 2));

						// Check for Safety Failures (Google/Gemini)
						if (
							data.choices?.[0]?.native_finish_reason === "IMAGE_SAFETY" ||
							data.choices?.[0]?.finish_reason === "content_filter"
						) {
							console.warn("OpenRouter Image Safety Triggered");
							await ctx.reply(
								"⚠️ <b>Генерация остановлена фильтром безопасности.</b>\n\nМодель посчитала ваш запрос небезопасным или нарушающим правила. Пожалуйста, измените промпт или выберите другую модель.",
								{ parse_mode: "HTML" },
							);
							return;
						}

						// OpenRouter returns images in message.images array, not in content
						const message = data.choices?.[0]?.message;

						if (!message) {
							throw new Error("No message from OpenRouter");
						}

						// Check if images array exists and has content
						if (message.images && message.images.length > 0) {
							const imageUrl = message.images[0].image_url?.url;

							if (!imageUrl) {
								throw new Error("No image URL in OpenRouter response");
							}

							if (imageUrl.startsWith("data:image")) {
								const base64Data = imageUrl.split(",")[1];
								const buffer = Buffer.from(base64Data, "base64");
								await ctx.replyWithPhoto(
									new InputFile(buffer, `image_${Date.now()}.png`),
									{
										caption: "Сделано в @aporto_bot",
									},
								);
							} else if (imageUrl.startsWith("http")) {
								await ctx.replyWithPhoto(imageUrl, {
									caption: "Сделано в @aporto_bot",
								});
							} else {
								throw new Error("Unknown image URL format");
							}
						} else {
							// Fallback to old content parsing if no images array
							const content = message.content;

							if (!content) {
								throw new Error("No content or images from OpenRouter");
							}

							// Extract Base64 or URL from content
							let imageUrl = "";
							const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
							if (mdMatch) {
								imageUrl = mdMatch[1];
							} else {
								imageUrl = content.trim();
							}

							if (imageUrl.startsWith("data:image")) {
								const base64Data = imageUrl.split(",")[1];
								const buffer = Buffer.from(base64Data, "base64");
								await ctx.replyWithPhoto(
									new InputFile(buffer, `image_${Date.now()}.png`),
									{
										caption: "Сделано в @aporto_bot",
									},
								);
							} else if (imageUrl.startsWith("http")) {
								await ctx.replyWithPhoto(imageUrl, {
									caption: "Сделано в @aporto_bot",
								});
							} else {
								await ctx.reply(
									`Could not extract image. Response:\n\n${content.substring(0, 200)}...`,
								);
							}
						}
						break;
					}

					case "google": {
						const { experimental_generateImage } = await import("ai");
						const { google } = await import("@ai-sdk/google");

						// Strip "google/" prefix if present
						const modelId = imageModelConfig.id.replace(/^google\//, "");

						const { image } = await experimental_generateImage({
							model: google.image(modelId),
							prompt: text,
							n: 1,
							providerOptions: {
								google: {
									aspectRatio: "1:1",
									safetySettings: [],
								},
							},
						});

						if (image?.base64) {
							const buffer = Buffer.from(image.base64, "base64");
							await ctx.replyWithPhoto(
								new InputFile(buffer, `image_${Date.now()}.png`),
								{
									caption: "Сделано в @aporto_bot",
								},
							);
						} else {
							throw new Error("No image data returned from Google");
						}
						break;
					}

					case "midjourney": // Keep for legacy
					case "replicate":
					case "other":
						// Placeholder for future implementations
						await ctx.reply(
							"🛠 Интеграция с этим провайдером в процессе настройки.",
						);
						break;

					default:
						await ctx.reply("❌ Неизвестный провайдер модели.");
				}
			} catch (error) {
				console.error("Image Gen Error:", error);
				await ctx.reply(
					"Произошла ошибка при генерации изображения. Попробуйте другой запрос.",
				);
			}
			return;
		}

		// --- Video Generation Flow ---
		if (selectedModelId?.startsWith("model_video_")) {
			const dbModel = CACHED_MODELS?.find((m) => m.modelId === selectedModelId);
			const modelName = dbModel?.name || "Video Model";

			// Determine Duration
			let duration = 5; // default for Veo/Kling
			if (selectedModelId.includes("sora")) {
				duration = 4; // default for Sora
			}

			const prefs = user.preferences as any;
			if (prefs?.video_duration) {
				duration = prefs.video_duration;
			}

			// Calculate Cost
			// cost in DB is per second
			const costPerSec =
				dbModel?.cost || (selectedModelId.includes("sora") ? 43 : 10);
			const cost = costPerSec * duration;

			// Check access
			const hasAccess = await checkClanLevelRequirement(
				ctx,
				user,
				selectedModelId,
			);
			if (!hasAccess) {
				return;
			}

			// Enforce Limits & Deduct
			const allowed = await checkAndEnforceLimits(
				ctx,
				user,
				cost,
				selectedModelId,
			);

			if (!allowed) {
				return;
			}

			await ctx.replyWithChatAction("upload_video");
			const aspect = prefs?.video_aspect || "landscape";
			const quality = prefs?.video_quality || "720p";

			await ctx.reply(
				`🎬 <b>Генерация видео запущена!</b>

📹 Модель: <b>${modelName}</b>
⏱ Длительность: <b>${duration} сек</b>
📐 Формат: <b>${aspect === "portrait" ? "Портрет (9:16)" : "Ландшафт (16:9)"}</b>
📺 Качество: <b>${quality}</b>

💎 Списано: <b>${cost} кредитов</b>

⏳ <i>Ожидайте, процесс может занять несколько минут...</i>`,
				{ parse_mode: "HTML" },
			);

			trackBackendEvent("Model: Request", telegramId, {
				model: selectedModelId,
				type: "video",
				status: "attempt",
				prompt_length: text.length,
				cost,
			});

			// Placeholder for actual API call
			// In a real implementation, call provider specific API here.
			return;
		}

		// --- Text Generation Flow ---
		// Resolve API Model ID from DB if available
		const dbModel = CACHED_MODELS?.find((m) => m.modelId === selectedModelId);
		const apiModelId =
			dbModel?.apiModelId || PROVIDER_MAP[selectedModelId] || selectedModelId;
		const realModelId = apiModelId;

		await ctx.replyWithChatAction("typing");

		trackBackendEvent("Model: Request", telegramId, {
			model: realModelId,
			type: "text",
			status: "attempt",
			prompt_length: text.length,
		});

		let response: any;
		const isWebMode =
			selectedModelId.endsWith("_web") ||
			selectedModelId === "model_deepresearch" ||
			selectedModelId.includes("perplexity");

		// 1. OpenAI Native Web Search (Experimental)
		// Only applies if the model supports it and we have standard OpenAI API key
		// AND if the user selected a web-enabled model variant
		if (
			isWebMode &&
			(realModelId.includes("gpt-5") ||
				realModelId.includes("deep-research") ||
				realModelId.includes("gpt-4o-search")) &&
			!realModelId.startsWith("openrouter/")
		) {
			try {
				const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

				const result = await openai.responses.create({
					model: realModelId.replace("openai/", ""), // strip prefix if present
					tools: [{ type: "web_search" }],
					input: text, // Responses API uses 'input' string or array
				});

				// Mocking a standard Vercel AI SDK response structure for compatibility
				response = {
					text:
						result.output_text ||
						(result as any).content ||
						"No response content",
					toolCalls: [],
				};
			} catch (e: any) {
				console.warn(
					"OpenAI Responses API failed, falling back to standard:",
					e.message,
				);
				// Fallback to standard flow below
			}
		}

		// 2. Gemini Grounding (Google Search)
		if (!response && isWebMode && realModelId.startsWith("google/")) {
			try {
				// Vercel AI SDK Google provider support for grounding
				// We pass it via providerOptions or custom request if supported.
				// Currently, standard generateText with @ai-sdk/google might explicitly need useSearchGrounding
				// But since the API signature varies, we'll try to pass it via options.
				response = await generateText({
					model: getLanguageModel(realModelId),
					system: systemPrompt({
						selectedChatModel: realModelId,
						requestHints: {
							latitude: undefined,
							longitude: undefined,
							city: undefined,
							country: undefined,
						},
					}),
					messages: aiMessages,

					providerOptions: {
						google: {
							useSearchGrounding: true,
						},
					},
					tools: {
						generateImage: tool({
							description: "Generate an image...",
							inputSchema: z.object({ prompt: z.string() }),
						}),
					},
				});
			} catch (_e) {
				// Fallback or error
			}
		}

		// 3. Standard Generation (Default)
		if (!response) {
			// Some models don't support tool use (e.g. DeepSeek R1, o1 reasoning models)
			const supportsTools =
				!realModelId.includes("deepseek-r1") &&
				!realModelId.includes("o1-") &&
				!realModelId.includes("o1-preview") &&
				!realModelId.includes("o1-mini");

			response = await generateText({
				model: getLanguageModel(realModelId),
				system: systemPrompt({
					selectedChatModel: realModelId,
					requestHints: {
						latitude: undefined,
						longitude: undefined,
						city: undefined,
						country: undefined,
					},
				}),
				messages: aiMessages,
				...(supportsTools && {
					tools: {
						generateImage: tool({
							description:
								"Generate an image, picture, or drawing. Use this tool when the user asks to 'draw', 'create', 'generate' or 'make' an image/picture (keywords: нарисуй, создай, сгенерируй, сделай картинку/изображение).",
							inputSchema: z.object({
								prompt: z
									.string()
									.describe("The description of the image to generate"),
							}),
						}),
					},
				}),
			});
		}

		// Handle Tool Calls (specifically Image Generation)
		if (response.toolCalls && response.toolCalls.length > 0) {
			const imageToolCall = response.toolCalls.find(
				(tc: any) => tc.toolName === "generateImage",
			);

			if (imageToolCall) {
				const call = imageToolCall as any;
				const prompt = call.args.prompt;
				const targetModelId = "model_image_nano_banana"; // Default efficient model

				// Check Limits
				const allowed = await checkAndEnforceLimits(
					ctx,
					user,
					1,
					targetModelId,
				);
				if (!allowed) {
					return;
				}

				await ctx.replyWithChatAction("upload_photo");
				await ctx.reply(`🎨 Рисую: "${prompt}"...`);

				try {
					const { experimental_generateImage } = await import("ai");
					const { openai } = await import("@ai-sdk/openai");

					// Use Nano Banana (DALL-E 3 disguised or standard)
					// standard openai.image maps to dall-e-3
					const { image } = await experimental_generateImage({
						model: openai.image("dall-e-3"),
						prompt,
						n: 1,
						size: "1024x1024",
						providerOptions: {
							openai: { quality: "standard" },
						},
					});

					if (image?.base64) {
						const buffer = Buffer.from(image.base64, "base64");
						await ctx.replyWithPhoto(
							new InputFile(buffer, `image_${Date.now()}.png`),
							{
								caption: `🎨 ${prompt}\n\nСделано в @aporto_bot`,
							},
						);

						// Track
						trackBackendEvent("Model: Request", ctx.from.id.toString(), {
							model: targetModelId,
							type: "image",
							status: "attempt",
							prompt_length: prompt.length,
						});
					}
				} catch (e) {
					console.error("Tool Image Gen Error:", e);
					await ctx.reply(
						"Не удалось сгенестрировать изображение. Попробуйте еще раз.",
					);
				}
				return;
			}
		}

		// 6. Send Response
		let responseText = response.text;

		if (responseText.length > 20_000) {
			responseText = `${responseText.substring(0, 20_000)}\n\n[Message truncated due to length]`;
		}

		const MAX_LENGTH = 4000;

		for (let i = 0; i < responseText.length; i += MAX_LENGTH) {
			await ctx.reply(responseText.substring(i, i + MAX_LENGTH));
		}

		// 7. Save Assistant Message
		const botMessageId = generateUUID();
		await saveMessages({
			messages: [
				{
					id: botMessageId,
					chatId,
					role: "assistant",
					parts: [{ type: "text", text: response.text }],
					attachments: [],
					createdAt: new Date(),
				},
			],
		});
	} catch (error) {
		console.error("Telegram Webhook Error:", error);
		await ctx.reply("Sorry, something went wrong processing your message.");
	}
});

// --- Photo Message Handler ---
bot.on("message:photo", async (ctx) => {
	const telegramId = ctx.from.id.toString();
	const caption = ctx.message.caption || ""; // Text accompanying the photo

	try {
		// 0. Drop Stale Updates
		const messageDate = ctx.message.date;
		const now = Math.floor(Date.now() / 1000);

		if (now - messageDate > 60) {
			console.warn(
				`Dropping stale photo update from user ${telegramId} (delay: ${now - messageDate}s)`,
			);
			return;
		}

		// 1. Get or Create User
		let [user] = await getUserByTelegramId(telegramId);
		if (user) {
			await checkAndResetWeeklyLimits(user.id, user.lastResetDate); // added
		} else {
			[user] = await createTelegramUser(telegramId);
		}

		// 1.1 Idempotency Check
		const isNew = await setLastMessageId(
			user.id,
			ctx.message.message_id.toString(),
		);
		if (!isNew) {
			console.warn(
				`Dropping duplicate/concurrent processing for photo message ${ctx.message.message_id}`,
			);
			return;
		}

		// Check if user is using an image model
		const selectedModelId = user.selectedModel || "model_gpt4omini";
		const preferences = user.preferences as any;

		// --- KLING MOTION SPECIAL HANDLING ---
		if (selectedModelId === "model_video_kling" && preferences?.kling_motion) {
			const motionId = preferences.kling_motion;
			const motion = KLING_MOTIONS.find((m) => m.id === motionId);

			if (!motion) {
				await ctx.reply(
					"❌ Пресет движения не найден. Попробуйте выбрать заново в меню Видео.",
				);
				return;
			}

			// Cost for Kling Motion
			await ensureDataLoaded();
			const dbModel = CACHED_MODELS?.find(
				(m) => m.modelId === "model_video_kling",
			);
			const cost = dbModel?.cost || 50;

			const allowed = await checkAndEnforceLimits(
				ctx,
				user,
				cost,
				selectedModelId,
			);
			if (!allowed) {
				return;
			}

			await ctx.replyWithChatAction("upload_video");
			await ctx.reply(
				`🎬 <b>К Kling Motion подключено!</b>\n\nДвижение: <b>${motion.label}</b>\n\n⏳ <i>Генерация видео запущена, это может занять до 5 минут. По завершении я отправлю готовый ролик!</i>`,
				{ parse_mode: "HTML" },
			);

			trackBackendEvent("Model: Request", telegramId, {
				model: "model_video_kling",
				type: "video_motion",
				motion: motion.id,
				status: "attempt",
				cost,
			});

			await incrementUserRequestCount(user.id, cost);

			// Clear motion state after trigger? User requested "1. select video 2. send image".
			// Maybe keep it for multiple images? Let's keep it for now.
			return;
		}

		// --- COST CALCULATION & ENFORCEMENT ---
		let cost = 10; // Default Vision Cost
		if (selectedModelId.startsWith("model_image_")) {
			// Heuristic for Image Edit cost
			// "gpt-image-1-edit" = 20. default to 20.
			cost = 20;

			// --- PRANK COST OVERRIDE ---
			if (
				selectedModelId === "model_image_nano_banana" &&
				(user.preferences as any)?.prank_id
			) {
				const prank = PRANK_SCENARIOS.find(
					(p) => p.id === (user.preferences as any).prank_id,
				);
				if (prank) {
					cost = 15;
				}
			}
			// ---------------------------

			// If we want precise mapping:
			// const key = selectedModelId.replace("model_", "").replace(/_/g, "-") + "-edit";
			// cost = FEATURE_COSTS[key] || 20;
		} else {
			cost = FEATURE_COSTS.image_recognition || 10;
		}

		const allowed = await checkAndEnforceLimits(
			ctx,
			user,
			cost,
			selectedModelId,
		);
		if (!allowed) {
			return;
		}

		// If it is an image model, proceed with Image Editing flow
		if (selectedModelId.startsWith("model_image_")) {
			const IMAGE_MODELS = await getImageModels();
			const imageModelConfig = IMAGE_MODELS[selectedModelId];

			if (!imageModelConfig || !imageModelConfig.enabled) {
				await ctx.reply("⚠️ Эта модель пока недоступна.");
				return;
			}
			// ... Proceed to image editing (lines 1702+)
		} else {
			// It is a Text Model -> Treat as Vision Request
			// 1. Download photo
			const photo = ctx.message.photo.at(-1);
			if (!photo) {
				await ctx.reply("Не удалось получить изображение.");
				return;
			}

			await ctx.replyWithChatAction("typing");

			const file = await ctx.api.getFile(photo.file_id);
			const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

			// 2. Prepare context
			const realModelId = PROVIDER_MAP[selectedModelId] || "openai/gpt-4o-mini";

			trackBackendEvent("Model: Request", telegramId, {
				model: realModelId,
				type: "vision",
				status: "attempt",
				caption_length: caption.length,
			});

			// 3. Generate Text with Vision
			try {
				// We need 'generateText' which is imported at top.

				// Download image to buffer/base64 not strictly needed if we pass URL,
				// but 'ai' sdk often handles URLs. Let's start with URL if possible or fetch.
				// Vercel AI SDK 'user' content can take { type: 'image', image: ... }.
				// image can be URL or base64. Telegram URL might be private/require token?
				// Yes, `fileUrl` contains token. It should be accessible by the server.

				// Get history
				// 4. Find active chat or create new one (Reuse logic or refactor? Copy-paste safe for now)
				const { chats } = await getChatsByUserId({
					id: user.id,
					limit: 1,
					startingAfter: null,
					endingBefore: null,
				});

				let chatId: string;
				if (chats.length > 0) {
					chatId = chats[0].id;
				} else {
					chatId = generateUUID();
					await saveChat({
						id: chatId,
						userId: user.id,
						title: "Telegram Chat",
						visibility: "private",
					});
				}

				// Fetch history
				const history = await getMessagesByChatId({ id: chatId });
				const aiMessages: any[] = history.map((m) => ({
					role: m.role,
					content:
						m.role === "user"
							? // Simple text mapping for history, preserving images might be complex in this DB schema
								// if parts are not stored fully. Assuming parts has text.
								(m.parts as any[]).map((p) => p.text).join("\n")
							: (m.parts as any[]).map((p) => p.text).join("\n"),
				}));

				// Fetch image to pass as Uint8Array or Buffer to be safe?
				// AI SDK supports fetchable URLs.
				const imageResponse = await fetch(fileUrl);
				const imageBuffer = await imageResponse.arrayBuffer();

				const response = await generateText({
					model: getLanguageModel(realModelId),
					messages: [
						...aiMessages,
						{
							role: "user",
							content: [
								{ type: "text", text: caption || "Что на этом изображении?" },
								{ type: "image", image: imageBuffer },
							],
						},
					],
				});

				const responseText = response.text;

				// Reply
				const MAX_LENGTH = 4000;
				for (let i = 0; i < responseText.length; i += MAX_LENGTH) {
					await ctx.reply(responseText.substring(i, i + MAX_LENGTH));
				}

				// Save
				const userMessageId = generateUUID();
				await saveMessages({
					messages: [
						{
							id: userMessageId,
							chatId,
							role: "user",
							parts: [{ type: "text", text: `[Image] ${caption}` }], // Store as text placeholder for now
							attachments: [],
							createdAt: new Date(),
						},
						{
							id: generateUUID(),
							chatId,
							role: "assistant",
							parts: [{ type: "text", text: responseText }],
							attachments: [],
							createdAt: new Date(),
						},
					],
				});

				await incrementUserRequestCount(user.id, cost); // Charge for Vision
			} catch (e) {
				console.error("Vision Error:", e);
				await ctx.reply(
					"Произошла ошибка при анализе изображения. Возможно, эта модель не поддерживает зрение.",
				);
			}
			return;
		}

		const IMAGE_MODELS = await getImageModels();
		const imageModelConfig = IMAGE_MODELS[selectedModelId];

		if (!imageModelConfig || !imageModelConfig.enabled) {
			await ctx.reply("⚠️ Эта модель пока недоступна.");
			return;
		}

		// Download the photo from Telegram
		const photo = ctx.message.photo.at(-1); // Get largest photo

		if (!photo) {
			await ctx.reply("Не удалось получить изображение.");
			return;
		}

		const file = await ctx.api.getFile(photo.file_id);
		const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

		// Download and convert to base64
		const imageResponse = await fetch(fileUrl);
		const imageBuffer = await imageResponse.arrayBuffer();
		const base64Image = Buffer.from(imageBuffer).toString("base64");
		const mimeType = "image/jpeg"; // Telegram usually sends JPEG

		await ctx.replyWithChatAction("upload_photo");
		await ctx.reply(`🎨 Обрабатываю изображение (${imageModelConfig.name})...`);

		// Handle OpenRouter image models
		if (imageModelConfig.provider === "openrouter") {
			const apiKey = process.env.OPENROUTER_API_KEY;
			if (!apiKey) {
				throw new Error("Missing OPENROUTER_API_KEY");
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 60_000);

			const response = await fetch(
				"https://openrouter.ai/api/v1/chat/completions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
						"HTTP-Referer": "https://aporto.tech",
						"X-Title": "Aporto Bot",
					},
					body: JSON.stringify({
						model: imageModelConfig.id,
						messages: [
							{
								role: "user",
								content: [
									{
										type: "image_url",
										image_url: {
											url: `data:${mimeType};base64,${base64Image}`,
										},
									},
									{
										type: "text",
										text: caption || "Опиши это изображение",
									},
								],
							},
						],
						modalities: ["image", "text"],
					}),
					signal: controller.signal,
				},
			);

			clearTimeout(timeoutId);

			if (!response.ok) {
				const err = await response.text();
				console.error("OpenRouter API Error:", response.status, err);
				throw new Error(`OpenRouter API Error: ${response.status} - ${err}`);
			}

			const data = await response.json();
			console.log("OpenRouter Photo Response:", JSON.stringify(data, null, 2));

			const message = data.choices?.[0]?.message;

			if (!message) {
				throw new Error("No message from OpenRouter");
			}

			// Check if response contains images
			if (message.images && message.images.length > 0) {
				const imageUrl = message.images[0].image_url?.url;

				if (imageUrl?.startsWith("data:image")) {
					const base64Data = imageUrl.split(",")[1];
					const buffer = Buffer.from(base64Data, "base64");
					await ctx.replyWithPhoto(
						new InputFile(buffer, `edited_${Date.now()}.png`),
						{
							caption: "Сделано в @aporto_bot",
						},
					);
				} else if (imageUrl?.startsWith("http")) {
					await ctx.replyWithPhoto(imageUrl, {
						caption: "Сделано в @aporto_bot",
					});
				}
			} else if (message.content) {
				// If no image, send text response
				await ctx.reply(message.content);
			} else {
				throw new Error("No content or images in response");
			}
		} else if (imageModelConfig.provider === "openai") {
			// Stub for GPT Images/Flux/etc - Only allow Nano Banana (if it's OpenAI)
			if (imageModelConfig.id !== "model_image_nano_banana") {
				await ctx.reply(
					"⚠️ Для редактирования изображения используйте модель <b>Nano Banana</b>.",
					{ parse_mode: "HTML" },
				);
				return;
			}

			// NANO BANANA (OpenAI Implementation - Remix)
			const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
			const { experimental_generateImage } = await import("ai");
			const { openai } = await import("@ai-sdk/openai");

			await ctx.reply(`🎨 Обрабатываю изображение (Nano Banana)...`);

			// 1. Use GPT-4o to describe the image
			const visionResponse = await openaiClient.chat.completions.create({
				model: "gpt-4o",
				messages: [
					{
						role: "user",
						content: [
							{
								type: "image_url",
								image_url: { url: `data:${mimeType};base64,${base64Image}` },
							},
							{
								type: "text",
								text: "Describe this image in detail focusing on visual style, composition, and subjects. Keep it concise.",
							},
						],
					},
				],
			});

			const description = visionResponse.choices?.[0]?.message?.content;
			if (!description) {
				throw new Error("Failed to analyze image with GPT-4o");
			}

			// 2. Generate new image using description + prompt
			const prompt = caption
				? `${caption}. Based on image description: ${description}`
				: `Remix of image: ${description}`;

			// Strip "openai/" prefix if present
			const modelId = imageModelConfig.id.replace(/^openai\//, "");

			const { image } = await experimental_generateImage({
				model: openai.image(modelId),
				prompt: prompt,
				n: 1,
				size: "1024x1024",
				providerOptions: {
					openai: { quality: "standard", style: "vivid" }, // Nano Banana settings
				},
			});

			if (image?.base64) {
				const buffer = Buffer.from(image.base64, "base64");
				await ctx.replyWithPhoto(
					new InputFile(buffer, `remix_${Date.now()}.png`),
					{
						caption: "Сделано в @aporto_bot (Nano Banana)",
					},
				);
			} else {
				throw new Error("No image data returned from OpenAI generation");
			}
		} else if (imageModelConfig.provider === "google") {
			// NANO BANANA (Google Implementation - Native Edit)
			const { GoogleGenerativeAI } = await import("@google/generative-ai");
			const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

			// Use the correct model ID (usually gemini-2.5-flash-image)
			// Strip prefix just in case
			const modelId =
				imageModelConfig.id.replace(/^google\//, "") ||
				"gemini-2.5-flash-image";

			const model = genAI.getGenerativeModel({ model: modelId });

			// --- PRANK LOGIC START ---
			let promptToSend = caption || "Edit this image";
			const prankId = (user.preferences as any)?.prank_id;
			if (prankId) {
				const prank = PRANK_SCENARIOS.find((p) => p.id === prankId);
				if (prank) {
					promptToSend = prank.prompt;
					cost = 15; // Prank specific cost
					await ctx.reply(`🎭 Применяю пранк: <b>${prank.name}</b>...`, {
						parse_mode: "HTML",
					});

					// Optional: Clear prank after use?
					// User flow: "Select prank -> Send photo".
					// If they send another photo, should it still be prank?
					// Usually "State" persists until changed or cleared.
					// Let's keep it persistent as per "checkbox" UI implies state.
				}
			}
			// --- PRANK LOGIC END ---

			const result = await model.generateContent([
				{
					inlineData: {
						data: base64Image,
						mimeType: "image/jpeg",
					},
				},
				promptToSend,
			]);

			const response = await result.response;

			// Check for image in response
			let imageData: string | null = null;
			for (const part of response.candidates?.[0]?.content?.parts || []) {
				if (part.inlineData) {
					imageData = part.inlineData.data;
					break;
				}
			}

			if (imageData) {
				const buffer = Buffer.from(imageData, "base64");
				await ctx.replyWithPhoto(
					new InputFile(buffer, `edited_${Date.now()}.png`),
					{ caption: "Сделано в @aporto_bot" },
				);
			} else if (response.text()) {
				await ctx.reply(response.text());
			} else {
				throw new Error("No response from Google");
			}
		} else {
			// Other providers (including Flux)
			await ctx.reply(
				"⚠️ Для редактирования изображения используйте модель <b>Nano Banana</b>.",
				{ parse_mode: "HTML" },
			);
			return;
		}
		await incrementUserRequestCount(user.id, cost); // Charge for Image Edit
	} catch (error) {
		console.error("Photo Processing Error:", error);
		await ctx.reply(
			"Произошла ошибка при обработке изображения. Попробуйте позже.",
		);
	}
});

// --- Photo as Document Handler ---
bot.on("message:document", async (ctx) => {
	const doc = ctx.message.document;
	const telegramId = ctx.from.id.toString();
	const caption = ctx.message.caption || "";

	// Only process images sent as files
	if (!doc.mime_type?.startsWith("image/")) {
		return;
	}

	try {
		// 0. Drop Stale Updates
		const messageDate = ctx.message.date;
		const now = Math.floor(Date.now() / 1000);

		if (now - messageDate > 60) {
			console.warn(
				`Dropping stale document update from user ${telegramId} (delay: ${now - messageDate}s)`,
			);
			return;
		}

		// 1. Get or Create User
		let [user] = await getUserByTelegramId(telegramId);
		if (user) {
			await checkAndResetWeeklyLimits(user.id, user.lastResetDate);
		} else {
			[user] = await createTelegramUser(telegramId);
		}

		// 1.1 Idempotency Check
		const isNew = await setLastMessageId(
			user.id,
			ctx.message.message_id.toString(),
		);
		if (!isNew) {
			return;
		}

		// Check if user is using an image model
		const selectedModelId = user.selectedModel || "model_gpt4omini";

		// --- COST CALCULATION & ENFORCEMENT ---
		let cost = 10; // Default Vision Cost
		if (selectedModelId.startsWith("model_image_")) {
			// Heuristic for Image Edit cost
			cost = 20;

			// --- PRANK COST OVERRIDE ---
			if (
				selectedModelId === "model_image_nano_banana" &&
				(user.preferences as any)?.prank_id
			) {
				const prank = PRANK_SCENARIOS.find(
					(p) => p.id === (user.preferences as any).prank_id,
				);
				if (prank) {
					cost = 15;
				}
			}
			// ---------------------------
		} else {
			cost = FEATURE_COSTS.image_recognition || 10;
		}

		const allowed = await checkAndEnforceLimits(
			ctx,
			user,
			cost,
			selectedModelId,
		);
		if (!allowed) {
			return;
		}

		// If it is an image model, proceed with Image Editing flow
		if (selectedModelId.startsWith("model_image_")) {
			const IMAGE_MODELS = await getImageModels();
			const imageModelConfig = IMAGE_MODELS[selectedModelId];

			if (!imageModelConfig || !imageModelConfig.enabled) {
				await ctx.reply("⚠️ Эта модель пока недоступна.");
				return;
			}

			// Download the photo from Telegram
			const file = await ctx.api.getFile(doc.file_id);
			const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

			// Download and convert to base64
			const imageResponse = await fetch(fileUrl);
			const imageBuffer = await imageResponse.arrayBuffer();
			const base64Image = Buffer.from(imageBuffer).toString("base64");
			const mimeType = doc.mime_type || "image/jpeg";

			await ctx.replyWithChatAction("upload_photo");

			// --- STUB LOGIC FOR NON-NANO BANANA ---
			// If provider is OpenAI (except Nano Banana) or Other/Flux -> Stub
			const isNanoBanana = imageModelConfig.id === "model_image_nano_banana";

			// If it's pure Google provider, likely Nano Banana
			// const isGoogle = imageModelConfig.provider === "google";

			// OpenRouter logic is separate and likely allows editing if supported?
			// But for now, align with photo handler logic:
			// If OpenAI and NOT Nano Banana -> Stub.
			// If Other -> Stub.

			if (imageModelConfig.provider === "openai" && !isNanoBanana) {
				await ctx.reply(
					"⚠️ Для редактирования изображения используйте модель <b>Nano Banana</b>.",
					{ parse_mode: "HTML" },
				);
				return;
			}

			if (
				imageModelConfig.provider === "other" ||
				imageModelConfig.id === "model_image_flux"
			) {
				await ctx.reply(
					"⚠️ Для редактирования изображения используйте модель <b>Nano Banana</b>.",
					{ parse_mode: "HTML" },
				);
				return;
			}

			await ctx.reply(
				`🎨 Обрабатываю файл как изображение (${imageModelConfig.name})...`,
			);

			// Handle OpenRouter image models
			if (imageModelConfig.provider === "openrouter") {
				const apiKey = process.env.OPENROUTER_API_KEY;
				if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 60_000);

				const body = {
					model: imageModelConfig.id.replace(/^openrouter\//, ""),
					messages: [
						{
							role: "user",
							content: [
								{
									type: "image_url",
									image_url: {
										url: `data:${mimeType};base64,${base64Image}`,
										detail: "low",
									},
								},
								{
									type: "text",
									text: caption || "Опиши это изображение",
								},
							],
						},
					],
					modalities: ["image", "text"], // Restore modalities for Gemini
				};
				console.log("OpenRouter Request Body:", JSON.stringify(body, null, 2));

				const response = await fetch(
					"https://openrouter.ai/api/v1/chat/completions",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": "application/json",
							"HTTP-Referer": "https://aporto.tech",
							"X-Title": "Aporto Bot",
						},
						body: JSON.stringify(body),
						signal: controller.signal,
					},
				);
				clearTimeout(timeoutId);

				if (!response.ok) {
					const err = await response.text();
					throw new Error(`OpenRouter API Error: ${response.status} - ${err}`);
				}

				const data = await response.json();
				const message = data.choices?.[0]?.message;

				if (message?.images && message.images.length > 0) {
					const imageUrl = message.images[0].image_url?.url;
					if (imageUrl?.startsWith("data:image")) {
						const base64Data = imageUrl.split(",")[1];
						const buffer = Buffer.from(base64Data, "base64");
						await ctx.replyWithPhoto(
							new InputFile(buffer, `edited_${Date.now()}.png`),
							{ caption: "Сделано в @aporto_bot" },
						);
					} else if (imageUrl?.startsWith("http")) {
						await ctx.replyWithPhoto(imageUrl, {
							caption: "Сделано в @aporto_bot",
						});
					}
				} else if (message?.content) {
					await ctx.reply(message.content);
				}
			} else if (imageModelConfig.provider === "openai") {
				// NANO BANANA (OpenAI Implementation - Remix)
				const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
				const { experimental_generateImage } = await import("ai");
				const { openai } = await import("@ai-sdk/openai");

				// 1. Use GPT-4o to describe
				const visionResponse = await openaiClient.chat.completions.create({
					model: "gpt-4o",
					messages: [
						{
							role: "user",
							content: [
								{
									type: "image_url",
									image_url: { url: `data:${mimeType};base64,${base64Image}` },
								},
								{
									type: "text",
									text: "Describe this image in detail focusing on visual style, composition, and subjects. Keep it concise.",
								},
							],
						},
					],
				});

				const description = visionResponse.choices?.[0]?.message?.content;
				if (!description)
					throw new Error("Failed to analyze image with GPT-4o");

				// 2. Remix
				const prompt = caption
					? `${caption}. Based on image description: ${description}`
					: `Remix of image: ${description}`;
				const modelId = imageModelConfig.id.replace(/^openai\//, "");

				const { image } = await experimental_generateImage({
					model: openai.image(modelId),
					prompt: prompt,
					n: 1,
					size: "1024x1024",
					providerOptions: { openai: { quality: "standard", style: "vivid" } },
				});

				if (image?.base64) {
					const buffer = Buffer.from(image.base64, "base64");
					await ctx.replyWithPhoto(
						new InputFile(buffer, `remix_${Date.now()}.png`),
						{ caption: "Сделано в @aporto_bot (Nano Banana)" },
					);
				}
			} else if (imageModelConfig.provider === "google") {
				// NANO BANANA (Google Implementation)
				const { GoogleGenerativeAI } = await import("@google/generative-ai");
				const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
				const modelId =
					imageModelConfig.id.replace(/^google\//, "") ||
					"gemini-2.5-flash-image";
				const model = genAI.getGenerativeModel({ model: modelId });

				// --- PRANK LOGIC START ---
				let promptToSend = caption || "Edit this image";
				const prankId = (user.preferences as any)?.prank_id;
				if (prankId) {
					const prank = PRANK_SCENARIOS.find((p) => p.id === prankId);
					if (prank) {
						promptToSend = prank.prompt;
						cost = 15; // Prank specific cost
						await ctx.reply(`🎭 Применяю пранк: <b>${prank.name}</b>...`, {
							parse_mode: "HTML",
						});
					}
				}
				// --- PRANK LOGIC END ---

				const result = await model.generateContent([
					{ inlineData: { data: base64Image, mimeType: mimeType } },
					promptToSend,
				]);
				const response = await result.response;

				let imageData: string | null = null;
				for (const part of response.candidates?.[0]?.content?.parts || []) {
					if (part.inlineData) {
						imageData = part.inlineData.data;
						break;
					}
				}

				if (imageData) {
					const buffer = Buffer.from(imageData, "base64");
					await ctx.replyWithPhoto(
						new InputFile(buffer, `edited_${Date.now()}.png`),
						{ caption: "Сделано в @aporto_bot" },
					);
				} else if (response.text()) {
					await ctx.reply(response.text());
				}
			} else {
				await ctx.reply(
					"⚠️ Для редактирования изображения используйте модель <b>Nano Banana</b>.",
					{ parse_mode: "HTML" },
				);
			}
		} else {
			// It is a Text Model -> Treat as Vision Request
			// (Using fileId instead of photo array)
			await ctx.replyWithChatAction("typing");

			const file = await ctx.api.getFile(doc.file_id);
			const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

			const realModelId = PROVIDER_MAP[selectedModelId] || "openai/gpt-4o-mini";

			trackBackendEvent("Model: Request", telegramId, {
				model: realModelId,
				type: "vision",
				status: "attempt",
				caption_length: caption.length,
			});

			try {
				const { chats } = await getChatsByUserId({
					id: user.id,
					limit: 1,
					startingAfter: null,
					endingBefore: null,
				});
				const chatId = chats.length > 0 ? chats[0].id : generateUUID();
				if (chats.length === 0)
					await saveChat({
						id: chatId,
						userId: user.id,
						title: "Telegram Chat",
						visibility: "private",
					});

				const history = await getMessagesByChatId({ id: chatId });
				const aiMessages: any[] = history.map((m) => ({
					role: m.role,
					content:
						m.role === "user"
							? (m.parts as any[]).map((p) => p.text).join("\n")
							: (m.parts as any[]).map((p) => p.text).join("\n"),
				}));

				const imageResponse = await fetch(fileUrl);
				const imageBuffer = await imageResponse.arrayBuffer();

				const response = await generateText({
					model: getLanguageModel(realModelId),
					messages: [
						...aiMessages,
						{
							role: "user",
							content: [
								{ type: "text", text: caption || "Что на этом изображении?" },
								{ type: "image", image: imageBuffer },
							],
						},
					],
				});
				await ctx.reply(response.text);
				await incrementUserRequestCount(user.id, cost); // Charge for Vision
			} catch (e) {
				console.error("Vision Error:", e);
				await ctx.reply("Произошла ошибка при анализе изображения.");
			}
		}

		await incrementUserRequestCount(user.id, cost); // Charge for Image Edit (if fell through)
	} catch (error) {
		console.error("Document Photo Processing Error:", error);
		await ctx.reply("Произошла ошибка при обработке файла. Попробуйте позже.");
	}
});

export const POST = webhookCallback(bot, "std/http");
