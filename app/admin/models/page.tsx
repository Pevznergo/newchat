"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteModel, getModels, upsertModel } from "../actions";

// Disable static generation for this page
export const dynamic = "force-dynamic";

export default function AdminModelsPage() {
	const [models, setModels] = useState<any[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadModels is stable
	useEffect(() => {
		loadModels();
	}, []);

	async function loadModels() {
		setLoading(true);
		const data = await getModels();
		setModels(data);
		setLoading(false);
	}

	function handleAddNew() {
		const newModel = {
			id: "new",
			modelId: "",
			name: "",
			provider: "openai",
			type: "text",
			cost: 1,
			apiModelId: "",
			requiredClanLevel: 1,
			isEnabled: true,
			description: "",
		};
		setModels([newModel, ...models]);
		setEditingId("new");
	}

	function handleEditClick(model: any) {
		setEditingId(model.id);
	}

	function handleCancel() {
		if (editingId === "new") {
			setModels(models.filter((m) => m.id !== "new"));
		}
		setEditingId(null);
	}

	async function handleDelete(id: string) {
		// biome-ignore lint/suspicious/noAlert: Admin tool
		if (confirm("Are you sure?")) {
			await deleteModel(id);
			loadModels();
		}
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		const formData = new FormData(e.target as HTMLFormElement);
		const data = {
			id: editingId === "new" ? undefined : editingId,
			modelId: formData.get("modelId") as string,
			name: formData.get("name") as string,
			provider: formData.get("provider") as string,
			type: formData.get("type") as string,
			cost: Number(formData.get("cost")),
			apiModelId: formData.get("apiModelId") as string,
			requiredClanLevel: Number(formData.get("requiredClanLevel") || 1),
			isEnabled: formData.get("isEnabled") === "on",
			description: formData.get("description") as string,
		};

		if (!data.modelId || !data.name || !data.type) {
			// biome-ignore lint/suspicious/noAlert: Admin tool
			alert("Please fill required fields");
			return;
		}

		// Optimistic update for UI stability before reload
		setEditingId(null);
		await upsertModel(data as any);
		loadModels();
	}

	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
			<div className="max-w-7xl mx-auto">
				<div className="flex justify-between items-center mb-8">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-white mb-2">
							🤖 AI Models
						</h1>
						<p className="text-zinc-400">
							Manage availability, pricing, and provider settings.
						</p>
					</div>
					<button
						className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={editingId === "new"}
						onClick={handleAddNew}
						type="button"
					>
						<span className="text-lg">+</span> Add Model
					</button>
				</div>

				<div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
					<form onSubmit={handleSave}>
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="border-b border-zinc-800 bg-zinc-900/80">
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Model Name
										</th>
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Description
										</th>
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Provider
										</th>
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Internal ID
										</th>
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											API ID
										</th>
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
											Lvl
										</th>
										<th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
											Cost
										</th>
										<th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-800/50">
									{models.map((model) => {
										const isEditing = editingId === model.id;
										return (
											<tr
												className={`group transition-colors ${
													isEditing
														? "bg-blue-500/5"
														: "hover:bg-zinc-800/40 cursor-pointer"
												}`}
												key={model.id}
												onDoubleClick={() =>
													!isEditing && handleEditClick(model)
												}
											>
												{isEditing ? (
													<>
														<td className="px-4 py-3">
															<input
																autoFocus
																className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
																defaultValue={model.name}
																name="name"
																placeholder="Display Name"
																required
															/>
														</td>
														<td className="px-4 py-3">
															<input
																className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600"
																defaultValue={model.description || ""}
																name="description"
																placeholder="Short description"
															/>
														</td>
														<td className="px-4 py-3">
															<select
																className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 outline-none"
																defaultValue={model.provider}
																name="provider"
															>
																<option value="openai">OpenAI</option>
																<option value="openrouter">OpenRouter</option>
																<option value="google">Google</option>
																<option value="anthropic">Anthropic</option>
																<option value="perplexity">Perplexity</option>
																<option value="xai">xAI</option>
																<option value="other">Other</option>
															</select>
														</td>
														<td className="px-4 py-3">
															<input
																className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-blue-500 outline-none"
																defaultValue={model.modelId}
																name="modelId"
																placeholder="model_id"
																required
															/>
															<input
																name="type"
																type="hidden"
																value={model.type || "text"}
															/>
															<input
																name="isEnabled"
																type="hidden"
																value="on"
															/>
														</td>
														<td className="px-4 py-3">
															<input
																className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-blue-500 outline-none placeholder:text-zinc-700"
																defaultValue={model.apiModelId}
																name="apiModelId"
																placeholder="default"
															/>
														</td>
														<td className="px-4 py-3 text-center">
															<input
																className="w-16 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-center text-zinc-100 focus:border-blue-500 outline-none"
																defaultValue={model.requiredClanLevel}
																max="10"
																min="1"
																name="requiredClanLevel"
																type="number"
															/>
														</td>
														<td className="px-4 py-3 text-center">
															<input
																className="w-16 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-center text-zinc-100 focus:border-blue-500 outline-none"
																defaultValue={model.cost}
																name="cost"
																type="number"
															/>
														</td>
														<td className="px-6 py-3 whitespace-nowrap text-right">
															<div className="flex justify-end gap-2">
																<button
																	className="p-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors"
																	title="Save"
																	type="submit"
																>
																	<Check size={16} />
																</button>
																<button
																	className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
																	onClick={handleCancel}
																	title="Cancel"
																	type="button"
																>
																	<X size={16} />
																</button>
															</div>
														</td>
													</>
												) : (
													<>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="flex items-center gap-3">
																<div
																	className={`w-2 h-2 rounded-full ${
																		model.isEnabled
																			? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
																			: "bg-zinc-600"
																	}`}
																/>
																<span className="font-medium text-zinc-200">
																	{model.name}
																</span>
															</div>
														</td>
														<td
															className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400 max-w-[200px] truncate"
															title={model.description}
														>
															{model.description || "-"}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
															<span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300">
																{model.provider}
															</span>
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500 font-mono">
															{model.modelId}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500 font-mono">
															{model.apiModelId ? (
																<span className="text-zinc-400">
																	{model.apiModelId.length > 20
																		? `${model.apiModelId.slice(0, 20)}...`
																		: model.apiModelId}
																</span>
															) : (
																<span className="text-zinc-600 italic">
																	Default
																</span>
															)}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm text-center">
															{model.requiredClanLevel > 1 ? (
																<span className="text-amber-500 font-medium">
																	Lvl {model.requiredClanLevel}
																</span>
															) : (
																<span className="text-zinc-600">-</span>
															)}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm text-center">
															{model.cost > 0 ? (
																<span className="font-semibold text-zinc-300">
																	{model.cost}
																</span>
															) : (
																<span className="text-emerald-500">Free</span>
															)}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-right">
															<div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
																<button
																	className="text-zinc-500 hover:text-blue-400 transition-colors"
																	onClick={() => handleEditClick(model)}
																	title="Edit"
																	type="button"
																>
																	<Pencil size={16} />
																</button>
																<button
																	className="text-zinc-500 hover:text-red-400 transition-colors"
																	onClick={() => handleDelete(model.id)}
																	title="Delete"
																	type="button"
																>
																	<Trash2 size={16} />
																</button>
															</div>
														</td>
													</>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</form>
					{models.length === 0 && !loading && (
						<div className="p-12 text-center text-zinc-500">
							No models found. Click "Add Model" to create one.
						</div>
					)}
					{loading && (
						<div className="p-12 text-center text-zinc-400 animate-pulse">
							Loading models...
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
