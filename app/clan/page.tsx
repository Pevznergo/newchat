"use client";

import {
	ArrowRight,
	Check,
	Copy,
	Crown,
	Loader2,
	Pencil,
	Plus,
	Share2,
	Shield,
	Star,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
	createClanAction,
	fetchClanData,
	joinClanAction,
	updateClanNameAction,
} from "./actions";

type ClanMember = {
	id: string;
	name: string;
	role: string;
	isPro: boolean;
};

type ClanLevelData = {
	level: number;
	description: string;
	minUsers: number;
	minPro: number;
	weeklyTextCredits: number;
	weeklyImageGenerations: number;
	unlimitedModels: string[];
};

type ClanData = {
	id: number;
	name: string;
	level: number;
	membersCount: number;
	proMembersCount: number;
	nextLevel: number;
	progress: number;
	nextLevelRequirements: string;
	inviteCode: string;
	isOwner: boolean;
	membersList: ClanMember[];
};

export default function ClanPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [clan, setClan] = useState<ClanData | null>(null);
	const [clanLevels, setClanLevels] = useState<ClanLevelData[]>([]);
	const [inClan, setInClan] = useState(false);

	// UI State
	const [activeTab, setActiveTab] = useState<"overview" | "members">(
		"overview",
	);
	const [isEditing, setIsEditing] = useState(false);
	const [editedName, setEditedName] = useState("");
	const [copied, setCopied] = useState(false);

	// Creation / Join State
	const [createName, setCreateName] = useState("");
	const [joinCode, setJoinCode] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	useEffect(() => {
		if (window.Telegram?.WebApp) {
			window.Telegram.WebApp.expand();
		}

		const initData = window.Telegram?.WebApp?.initData;

		async function load() {
			try {
				const res = await fetchClanData(initData || "");

				if (res.error) {
					setError(res.error);
				} else if (res.inClan && res.clan) {
					setInClan(true);
					setClan(res.clan as ClanData);
					setEditedName(res.clan.name);
					// Set clan levels from database
					if (res.clanLevels) {
						setClanLevels(res.clanLevels as ClanLevelData[]);
					}
				} else {
					// Not in clan, show No Clan UI
					setInClan(false);
					// Still load clan levels for display
					if (res.clanLevels) {
						setClanLevels(res.clanLevels as ClanLevelData[]);
					}
				}
			} catch (err) {
				console.error(err);
				setError("Не удалось загрузить данные клана.");
			} finally {
				setLoading(false);
			}
		}

		load();
	}, []);

	const handleCopy = () => {
		if (!clan) {
			return;
		}
		navigator.clipboard.writeText(
			`https://t.me/aporto_bot?start=clan_${clan.inviteCode}`,
		);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleShare = () => {
		if (!clan) {
			return;
		}
		if (window.Telegram?.WebApp) {
			window.Telegram.WebApp.switchInlineQuery(clan.inviteCode, [
				"users",
				"groups",
				"channels",
			]);
		} else {
			const url = `https://t.me/share/url?url=https://t.me/aporto_bot?start=clan_${clan.inviteCode}&text=Вступай в мой клан!`;
			window.open(url, "_blank");
		}
	};

	const saveName = async () => {
		if (!clan || !editedName.trim()) {
			return;
		}
		const oldName = clan.name;
		setClan((prev) => (prev ? { ...prev, name: editedName } : null));
		setIsEditing(false);

		const initData = window.Telegram?.WebApp?.initData || "";
		const res = await updateClanNameAction(initData, editedName);

		if (!res.success) {
			setClan((prev) => (prev ? { ...prev, name: oldName } : null));
			console.error(`Failed to update name: ${res.error || "Unknown error"}`);
		}
	};

	const handleCreateClan = async () => {
		if (!createName.trim()) {
			return;
		}
		setActionLoading(true);
		const initData = window.Telegram?.WebApp?.initData || "";
		const res = await createClanAction(initData, createName);
		setActionLoading(false);

		if (res.success && "clan" in res) {
			window.location.reload();
		} else {
			console.error(`Failed: ${res.error}`);
		}
	};

	const handleJoinClan = async () => {
		if (!joinCode.trim()) {
			return;
		}
		setActionLoading(true);
		const initData = window.Telegram?.WebApp?.initData || "";
		const res = await joinClanAction(initData, joinCode);
		setActionLoading(false);

		if (res.success) {
			window.location.reload();
		} else {
			console.error(`Failed: ${res.error}`);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-[#1c1c1e] flex items-center justify-center text-white">
				<Loader2 className="w-8 h-8 animate-spin text-blue-500" />
			</div>
		);
	}

	// --- No Clan View ---
	if (!inClan && !error) {
		return (
			<div className="min-h-screen bg-[#1c1c1e] text-white font-sans overflow-x-hidden p-6 flex flex-col items-center justify-center">
				<div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
					<Shield className="w-8 h-8 text-blue-400" />
				</div>

				<h1 className="text-2xl font-bold mb-2 text-center">
					Присоединяйтесь к битве
				</h1>
				<p className="text-gray-400 text-center mb-10 max-w-xs text-sm">
					Создайте клан, чтобы получать бонусы, или вступите по коду
					приглашения.
				</p>

				{/* Create Section */}
				<div className="w-full max-w-sm space-y-3 mb-8">
					<input
						className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors"
						onChange={(e) => setCreateName(e.target.value)}
						placeholder="Название клана"
						type="text"
						value={createName}
					/>
					<button
						className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={actionLoading || !createName.trim()}
						onClick={handleCreateClan}
						type="button"
					>
						{actionLoading ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							<Plus className="w-5 h-5" />
						)}
						Создать клан
					</button>
				</div>

				<div className="flex items-center gap-4 w-full max-w-sm mb-8">
					<div className="h-[1px] bg-[#2c2c2e] flex-1" />
					<span className="text-gray-500 text-xs uppercase font-medium">
						ИЛИ
					</span>
					<div className="h-[1px] bg-[#2c2c2e] flex-1" />
				</div>

				{/* Join Section */}
				<div className="w-full max-w-sm space-y-3">
					<div className="relative">
						<input
							className="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors"
							onChange={(e) => setJoinCode(e.target.value)}
							placeholder="Код приглашения (например: CLAN-XYZ)"
							style={{ textTransform: "uppercase" }}
							type="text"
							value={joinCode}
						/>
					</div>
					<button
						className="w-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
						disabled={actionLoading || !joinCode.trim()}
						onClick={handleJoinClan}
						type="button"
					>
						{actionLoading ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							<ArrowRight className="w-5 h-5" />
						)}
						Вступить по коду
					</button>
				</div>

				<div className="mt-8 text-center">
					<p className="text-xs text-gray-500">
						Получили ссылку? <br /> Откройте ее в Telegram для автоматического
						вступления.
					</p>
				</div>
			</div>
		);
	}

	if (error || !clan) {
		return (
			<div className="min-h-screen bg-[#1c1c1e] flex items-center justify-center text-white p-4 text-center">
				<div>
					<p className="mb-4 text-red-400 font-bold">
						{error || "Что-то пошло не так"}
					</p>
					<div className="text-xs text-gray-500 mb-4 bg-black/20 p-2 rounded text-left overflow-auto max-w-[300px] break-all">
						<p>
							URL:{" "}
							{typeof window !== "undefined" ? window.location.href : "N/A"}
						</p>
						<p>
							InitData Length:{" "}
							{typeof window !== "undefined" &&
							window.Telegram?.WebApp?.initData
								? window.Telegram.WebApp.initData.length
								: 0}
						</p>
						<p>
							User ID:{" "}
							{(typeof window !== "undefined" &&
								window.Telegram?.WebApp?.initDataUnsafe?.user?.id) ||
								"Missing"}
						</p>
						<p>
							Platform:{" "}
							{typeof window !== "undefined"
								? window.Telegram?.WebApp?.platform || "Unknown"
								: "N/A"}
						</p>
					</div>
					<p className="text-gray-500 text-sm mb-4">
						Вы открываете это из Telegram?
					</p>
					<button
						className="bg-[#2c2c2e] px-4 py-2 rounded-lg text-sm"
						onClick={() => window.location.reload()}
						type="button"
					>
						Повторить
					</button>
				</div>
			</div>
		);
	}

	// --- Clan View ---
	return (
		<div className="min-h-screen bg-[#1c1c1e] text-white font-sans overflow-x-hidden selection:bg-blue-500/30">
			{/* Header */}
			<div className="flex flex-col items-center pt-10 pb-6 px-4">
				{/* Icon */}
				<div className="flex justify-center mb-6">
					<div className="relative w-16 h-16">
						<Zap
							className="w-16 h-16 text-white rotate-12 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
							fill="currentColor"
							strokeWidth={1.5}
						/>
					</div>
				</div>

				{/* Title / Edit */}
				<div className="flex items-center justify-center gap-2 mb-2 w-full max-w-sm">
					{isEditing ? (
						<div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 bg-[#2c2c2e] rounded-lg p-1 ring-2 ring-blue-500">
							<input
								autoFocus
								className="bg-transparent border-none outline-none text-xl font-bold text-center w-full px-2"
								onChange={(e) => setEditedName(e.target.value)}
								type="text"
								value={editedName}
							/>
							<button
								className="p-2 bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
								onClick={saveName}
								type="button"
							>
								<Check className="w-4 h-4" />
							</button>
						</div>
					) : (
						<>
							<h1 className="text-xl font-bold text-center leading-tight tracking-tight">
								{clan.name}
							</h1>
							{clan.isOwner && (
								<button
									className="p-1.5 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10"
									onClick={() => setIsEditing(true)}
									type="button"
								>
									<Pencil className="w-3.5 h-3.5" />
								</button>
							)}
						</>
					)}
				</div>

				<p className="text-gray-400 text-sm text-center max-w-xs mx-auto mb-8 leading-relaxed">
					Участники клана повышают уровень группы и открывают дополнительные
					возможности.
				</p>

				{/* Level Stats Bar */}
				<div className="w-full max-w-sm">
					<div className="flex justify-between text-xs text-blue-300 font-medium mb-2 px-1">
						<span>Уровень {clan.level}</span>
						<span>Уровень {clan.nextLevel}</span>
					</div>

					{/* Progress Track */}
					<div className="h-[6px] bg-[#2c2c2e] rounded-full overflow-hidden w-full relative">
						{/* Active Progress */}
						<div
							className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(96,165,250,0.5)]"
							style={{ width: `${clan.progress}%` }}
						/>
					</div>

					<div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 px-1">
						<div className="flex gap-3">
							<span>{clan.membersCount} Участников</span>
							<span>{clan.proMembersCount} Pro</span>
						</div>
						<span>{clan.nextLevelRequirements}</span>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex justify-center mb-6 border-b border-[#2c2c2e] max-w-sm mx-auto">
				<button
					className={cn(
						"pb-3 px-6 text-sm font-medium transition-colors relative",
						activeTab === "overview"
							? "text-white"
							: "text-gray-500 hover:text-gray-300",
					)}
					onClick={() => setActiveTab("overview")}
					type="button"
				>
					Обзор
					{activeTab === "overview" && (
						<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
					)}
				</button>
				<button
					className={cn(
						"pb-3 px-6 text-sm font-medium transition-colors relative",
						activeTab === "members"
							? "text-white"
							: "text-gray-500 hover:text-gray-300",
					)}
					onClick={() => setActiveTab("members")}
					type="button"
				>
					Участники
					{activeTab === "members" && (
						<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
					)}
				</button>
			</div>

			{/* Content */}
			<div className="px-4 pb-48 max-w-sm mx-auto">
				{activeTab === "overview" && (
					<div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
						{clanLevels.map((lvl) => (
							<div
								className={cn(
									"transition-opacity duration-300",
									clan.level >= lvl.level
										? "opacity-100"
										: "opacity-50 grayscale-[0.5]",
								)}
								key={lvl.level}
							>
								{/* Pill Header */}
								<div className="flex items-center gap-4 mb-4">
									<div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#2c2c2e]" />
									<div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-[#7059e3] to-[#9c71e8] text-white text-xs font-bold shadow-lg shadow-purple-900/40">
										Доступно на уровне {lvl.level}:
									</div>
									<div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#2c2c2e]" />
								</div>

								{/* Benefits from Database Description */}
								<div className="space-y-4 px-2">
									{lvl.description?.split("\n").map((line, idx) => (
										<div
											className="flex items-start gap-4"
											key={`${lvl.level}-${idx}`}
										>
											<div className="w-6 h-6 rounded-full border border-blue-400/30 flex items-center justify-center bg-blue-500/10 shrink-0">
												<span className="text-xs">✨</span>
											</div>
											<div className="text-sm font-medium leading-tight pt-1">
												{line}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}

				{activeTab === "members" && (
					<div className="space-y-3 animate-in slide-in-from-right-4 fade-in duration-300">
						{clan.membersList.map((member) => (
							<div
								className="flex items-center justify-between bg-[#2c2c2e]/50 p-3 rounded-xl border border-[#3a3a3c] mb-2"
								key={member.id}
							>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold">
										{member.name.substring(0, 2).toUpperCase()}
									</div>
									<div>
										<div className="text-sm font-semibold flex items-center gap-1.5">
											{member.name}
											{member.role === "owner" && (
												<Crown className="w-3 h-3 text-yellow-500 fill-yellow-500" />
											)}
										</div>
										<div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
											{member.role}
										</div>
									</div>
								</div>
								{member.isPro && (
									<div className="bg-purple-500/20 px-2 py-1 rounded text-purple-300 text-[10px] font-bold flex items-center gap-1">
										<Star className="w-3 h-3 fill-purple-300" />
										PRO
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{/* Footer / Invite */}
			<div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1c1c1e] border-t border-[#2c2c2e]/50 backdrop-blur-xl z-10 pb-12">
				<div className="max-w-md mx-auto space-y-3">
					<div className="bg-[#2c2c2e] p-1 rounded-xl flex items-center gap-2 pr-2">
						<div className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-300 truncate font-mono outline-none">
							t.me/aporto_bot?start=clan_{clan.inviteCode}
						</div>
						{/* Circle Button for Copy */}
						<button
							className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
							onClick={handleCopy}
							type="button"
						>
							{copied ? (
								<Check className="w-5 h-5 text-white" />
							) : (
								<Copy className="w-5 h-5 text-white" />
							)}
						</button>
					</div>

					<button
						className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)] active:scale-[0.98]"
						onClick={handleShare}
						type="button"
					>
						<Share2 className="w-5 h-5" />
						Поделиться
					</button>
				</div>
			</div>
		</div>
	);
}

// Global declaration for Telegram WebApp
declare global {
	interface Window {
		Telegram?: {
			WebApp?: {
				initData: string;
				initDataUnsafe: {
					user?: { id: number; first_name: string; username?: string };
					start_param?: string;
				};
				expand: () => void;
				switchInlineQuery: (query: string, types?: string[]) => void;
				platform?: string;
			};
		};
	}
}
