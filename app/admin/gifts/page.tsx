"use client";

import { Check, Copy, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface GiftCode {
	id: string;
	code: string;
	codeType: string;
	durationDays: number;
	isActive: boolean;
	maxUses: number;
	currentUses: number;
	campaignName?: string;
	expiresAt?: string;
	createdAt: string;
	activationCount?: number;
	activatedTelegramId?: string;
}

export default function GiftsPage() {
	const [codes, setCodes] = useState<GiftCode[]>([]);
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);

	// Form state
	const [codeType, setCodeType] = useState("premium_month");
	const [quantity, setQuantity] = useState(1);
	const [campaignName, setCampaignName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [priceRub, setPriceRub] = useState("");
	const [showUsed, setShowUsed] = useState(false);

	// Fetch codes
	const fetchCodes = async () => {
		setLoading(true);
		try {
			const query = new URLSearchParams();
			if (showUsed) query.set("showUsed", "true");

			const res = await fetch(`/api/admin/gifts?${query.toString()}`);
			const data = await res.json();
			setCodes(data.codes || []);
		} catch (error) {
			console.error("Failed to fetch codes:", error);
			alert("Ошибка загрузки кодов");
		} finally {
			setLoading(false);
		}
	};

	// Reload when showUsed changes
	useEffect(() => {
		fetchCodes();
	}, [showUsed]);

	// Generate codes
	const handleGenerate = async (e: React.FormEvent) => {
		e.preventDefault();
		setGenerating(true);

		try {
			const durationMap: Record<string, number> = {
				premium_week: 7,
				premium_month: 30,
				premium_3months: 90,
				premium_6months: 180,
				premium_year: 365,
			};

			const res = await fetch("/api/admin/gifts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					codeType,
					durationDays: durationMap[codeType],
					quantity,
					campaignName: campaignName || undefined,
					expiresAt: expiresAt || undefined,
					priceRub: priceRub ? Number.parseInt(priceRub) : undefined,
				}),
			});

			if (!res.ok) {
				throw new Error("Failed to generate codes");
			}

			const data = await res.json();
			alert(`Создано ${data.codes.length} кодов!`);
			fetchCodes(); // Refresh list
		} catch (error) {
			console.error("Generation error:", error);
			alert("Ошибка создания кодов");
		} finally {
			setGenerating(false);
		}
	};

	// Deactivate code
	const handleDeactivate = async (id: string) => {
		if (!confirm("Деактивировать этот код?")) return;

		try {
			const res = await fetch(`/api/admin/gifts?id=${id}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Failed to deactivate");

			alert("Код деактивирован");
			fetchCodes();
		} catch (error) {
			console.error("Deactivation error:", error);
			alert("Ошибка деактивации");
		}
	};

	// Copy link
	const copyLink = (code: string) => {
		const link = `https://t.me/aporto_bot?start=gift_${code}`;
		navigator.clipboard.writeText(link);
		setCopiedCode(code);
		setTimeout(() => setCopiedCode(null), 2000);
	};

	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
			<div className="max-w-7xl mx-auto">
				<div className="flex justify-between items-center mb-8">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-white mb-2">
							🎁 Gift Codes
						</h1>
						<p className="text-zinc-400">
							Create and manage promotional subscription codes
						</p>
					</div>
				</div>

				{/* Generation Form */}
				<div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8 shadow-2xl backdrop-blur-sm">
					<h2 className="text-xl font-semibold mb-4 text-white">
						Create New Codes
					</h2>
					<form onSubmit={handleGenerate} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2 text-zinc-300">
									Subscription Type
								</label>
								<select
									value={codeType}
									onChange={(e) => setCodeType(e.target.value)}
									className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
								>
									<option value="premium_week">Week</option>
									<option value="premium_month">Month</option>
									<option value="premium_3months">3 Months</option>
									<option value="premium_6months">6 Months</option>
									<option value="premium_year">Year</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2 text-zinc-300">
									Quantity
								</label>
								<input
									type="number"
									min="1"
									max="1000"
									value={quantity}
									onChange={(e) => setQuantity(Number.parseInt(e.target.value))}
									className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2 text-zinc-300">
									Campaign Name
								</label>
								<input
									type="text"
									value={campaignName}
									onChange={(e) => setCampaignName(e.target.value)}
									placeholder="Black Friday"
									className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2 text-zinc-300">
									Expiration Date (Optional)
								</label>
								<input
									type="datetime-local"
									value={expiresAt}
									onChange={(e) => setExpiresAt(e.target.value)}
									className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2 text-zinc-300">
									Sale Price (₽, Optional)
								</label>
								<input
									type="number"
									value={priceRub}
									onChange={(e) => setPriceRub(e.target.value)}
									placeholder="990"
									className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={generating}
							className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{generating ? "Creating..." : "Create Codes"}
						</button>
					</form>
				</div>

				{/* Codes List */}
				<div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
					<div className="p-6 border-b border-zinc-800 flex justify-between items-center">
						<h2 className="text-xl font-semibold text-white">
							Gift Codes List
						</h2>
						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-300">
								<input
									type="checkbox"
									checked={showUsed}
									onChange={(e) => {
										setShowUsed(e.target.checked);
										// Trigger fetch on next effect or let user click refresh?
										// Better to just let them click refresh or add effect.
										// Let's rely on Refresh button for now or auto-refresh:
										// For simplicity, user clicks refresh or I recall fetchCodes.
										// Actually, better to just set state and let user click refresh
										// OR wrap fetchCodes in useEffect dependent on showUsed?
										// The current code calls fetchCodes manually.
									}}
									className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-blue-500/20"
								/>
								Show used
							</label>
							<button
								onClick={fetchCodes}
								disabled={loading}
								className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
							>
								<RefreshCw
									size={16}
									className={loading ? "animate-spin" : ""}
								/>
								{loading ? "Loading..." : "Refresh"}
							</button>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-zinc-800 bg-zinc-900/80">
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
										Code
									</th>
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
										Type
									</th>
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
										Uses
									</th>
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
										Campaign
									</th>
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
										Activated By
									</th>
									<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800/50">
								{codes.map((code) => (
									<tr
										key={code.id}
										className="group hover:bg-zinc-800/40 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-zinc-300">
											{code.code}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
											<span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300">
												{code.codeType}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
											{code.currentUses}/{code.maxUses}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
											{code.campaignName || "-"}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 py-1 text-xs rounded-md font-medium ${
													code.isActive
														? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
														: "bg-red-500/10 text-red-400 border border-red-500/20"
												}`}
											>
												{code.isActive ? "Active" : "Deactivated"}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
											{code.activatedTelegramId ? (
												<span className="font-mono text-zinc-300 bg-zinc-800/50 px-1.5 py-0.5 rounded">
													{code.activatedTelegramId}
												</span>
											) : code.currentUses > 0 ? (
												<span className="text-zinc-600 italic">Unknown</span>
											) : (
												"-"
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-right">
											<div className="flex justify-end gap-2">
												<button
													type="button"
													onClick={() => copyLink(code.code)}
													className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors"
													title="Copy link"
												>
													{copiedCode === code.code ? (
														<Check size={16} className="text-green-400" />
													) : (
														<Copy size={16} />
													)}
												</button>
												{code.isActive && (
													<button
														type="button"
														onClick={() => handleDeactivate(code.id)}
														className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
														title="Deactivate"
													>
														<Trash2 size={16} />
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>

						{codes.length === 0 && !loading && (
							<div className="text-center py-12 text-zinc-500">
								No codes created yet
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
