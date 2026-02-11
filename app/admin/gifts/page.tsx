"use client";

import { useState } from "react";

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
}

export default function GiftsPage() {
	const [codes, setCodes] = useState<GiftCode[]>([]);
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);

	// Form state
	const [codeType, setCodeType] = useState("premium_month");
	const [quantity, setQuantity] = useState(1);
	const [campaignName, setCampaignName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [priceRub, setPriceRub] = useState("");

	// Fetch codes
	const fetchCodes = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/gifts");
			const data = await res.json();
			setCodes(data.codes || []);
		} catch (error) {
			console.error("Failed to fetch codes:", error);
			alert("Ошибка загрузки кодов");
		} finally {
			setLoading(false);
		}
	};

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
		alert("Ссылка скопирована!");
	};

	return (
		<div className="min-h-screen bg-gray-50 p-8">
			<div className="max-w-7xl mx-auto">
				<h1 className="text-3xl font-bold mb-8">Подарочные коды</h1>

				{/* Generation Form */}
				<div className="bg-white rounded-lg shadow p-6 mb-8">
					<h2 className="text-xl font-semibold mb-4">Создать коды</h2>
					<form onSubmit={handleGenerate} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2">
									Тип подписки
								</label>
								<select
									value={codeType}
									onChange={(e) => setCodeType(e.target.value)}
									className="w-full border rounded p-2"
								>
									<option value="premium_week">Неделя</option>
									<option value="premium_month">Месяц</option>
									<option value="premium_3months">3 месяца</option>
									<option value="premium_6months">6 месяцев</option>
									<option value="premium_year">Год</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Количество
								</label>
								<input
									type="number"
									min="1"
									max="1000"
									value={quantity}
									onChange={(e) => setQuantity(Number.parseInt(e.target.value))}
									className="w-full border rounded p-2"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Название кампании
								</label>
								<input
									type="text"
									value={campaignName}
									onChange={(e) => setCampaignName(e.target.value)}
									placeholder="Black Friday"
									className="w-full border rounded p-2"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2">
									Срок действия (опционально)
								</label>
								<input
									type="datetime-local"
									value={expiresAt}
									onChange={(e) => setExpiresAt(e.target.value)}
									className="w-full border rounded p-2"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Цена продажи (₽, опционально)
								</label>
								<input
									type="number"
									value={priceRub}
									onChange={(e) => setPriceRub(e.target.value)}
									placeholder="990"
									className="w-full border rounded p-2"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={generating}
							className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
						>
							{generating ? "Создание..." : "Создать коды"}
						</button>
					</form>
				</div>

				{/* Codes List */}
				<div className="bg-white rounded-lg shadow">
					<div className="p-6 border-b flex justify-between items-center">
						<h2 className="text-xl font-semibold">Список кодов</h2>
						<button
							onClick={fetchCodes}
							disabled={loading}
							className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
						>
							{loading ? "Загрузка..." : "Обновить"}
						</button>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
										Код
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
										Тип
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
										Использований
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
										Кампания
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
										Статус
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
										Действия
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{codes.map((code) => (
									<tr key={code.id} className="hover:bg-gray-50">
										<td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
											{code.code}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											{code.codeType}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											{code.currentUses}/{code.maxUses}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											{code.campaignName || "-"}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 py-1 text-xs rounded ${
													code.isActive
														? "bg-green-100 text-green-800"
														: "bg-red-100 text-red-800"
												}`}
											>
												{code.isActive ? "Активен" : "Деактивирован"}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
											<button
												type="button"
												onClick={() => copyLink(code.code)}
												className="text-blue-600 hover:underline"
											>
												Копировать ссылку
											</button>
											{code.isActive && (
												<button
													type="button"
													onClick={() => handleDeactivate(code.id)}
													className="text-red-600 hover:underline"
												>
													Деактивировать
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>

						{codes.length === 0 && !loading && (
							<div className="text-center py-12 text-gray-500">
								Нет созданных кодов
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
