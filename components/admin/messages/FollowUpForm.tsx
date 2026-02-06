"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface FollowUpFormProps {
	initialData?: any;
}

export default function FollowUpForm({ initialData }: FollowUpFormProps) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [templates, setTemplates] = useState<any[]>([]);
	const [formData, setFormData] = useState({
		templateId: initialData?.templateId || "",
		triggerType: initialData?.triggerType || "after_registration",
		triggerDelayHours: initialData?.triggerDelayHours || 24,
		targetAudience: initialData?.targetAudience || "all",
		maxSendsPerUser: initialData?.maxSendsPerUser || 1,
		priority: initialData?.priority || 0,
		conditions: initialData?.conditions
			? JSON.stringify(initialData.conditions, null, 2)
			: "",
	});

	useEffect(() => {
		// Fetch templates for select dropdown
		fetch("/api/admin/messages/templates?type=follow_up")
			.then((res) => res.json())
			.then((data) => setTemplates(data.data || []));
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			// Parse conditions if provided
			let parsedConditions = null;
			if (formData.conditions.trim()) {
				try {
					parsedConditions = JSON.parse(formData.conditions);
				} catch {
					alert("Invalid JSON in conditions field");
					setLoading(false);
					return;
				}
			}

			const url = initialData
				? `/api/admin/messages/follow-ups/${initialData.id}`
				: "/api/admin/messages/follow-ups";

			const method = initialData ? "PUT" : "POST";

			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					conditions: parsedConditions,
					triggerDelayHours: Number(formData.triggerDelayHours),
					maxSendsPerUser: Number(formData.maxSendsPerUser),
					priority: Number(formData.priority),
				}),
			});

			if (response.ok) {
				router.push("/admin/messages/follow-ups");
			} else {
				alert("Failed to save follow-up rule");
			}
		} catch (error) {
			console.error("Error saving follow-up rule:", error);
			alert("Error saving follow-up rule");
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			className="space-y-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-2xl backdrop-blur-sm"
			onSubmit={handleSubmit}
		>
			{/* Template Selection */}
			<div>
				<label className="block text-sm font-medium text-zinc-400 mb-2">
					Message Template *
				</label>
				<select
					className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
					onChange={(e) =>
						setFormData({ ...formData, templateId: e.target.value })
					}
					required
					value={formData.templateId}
				>
					<option value="">Select a template...</option>
					{templates.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
				{templates.length === 0 && (
					<p className="text-sm text-zinc-500 mt-1">
						No follow-up templates found.{" "}
						<a
							className="text-blue-400 hover:text-blue-300 hover:underline"
							href="/admin/messages/templates/new"
						>
							Create one first
						</a>
					</p>
				)}
			</div>

			{/* Trigger Configuration */}
			<div className="grid grid-cols-2 gap-4">
				<div>
					<label className="block text-sm font-medium text-zinc-400 mb-2">
						Trigger Type *
					</label>
					<select
						className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
						onChange={(e) =>
							setFormData({ ...formData, triggerType: e.target.value })
						}
						value={formData.triggerType}
					>
						<option value="after_registration">After Registration</option>
						<option value="after_last_message">After Last Message</option>
						<option value="inactive_user">Inactive User</option>
						<option value="limit_reached">Limit Reached</option>
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-zinc-400 mb-2">
						Delay (hours) *
					</label>
					<input
						className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600"
						min="1"
						onChange={(e) =>
							setFormData({
								...formData,
								triggerDelayHours: Number(e.target.value),
							})
						}
						placeholder="24"
						required
						type="number"
						value={formData.triggerDelayHours}
					/>
					<p className="text-xs text-zinc-500 mt-1">
						Send message X hours after trigger event
					</p>
				</div>
			</div>

			{/* Audience */}
			<div>
				<label className="block text-sm font-medium text-zinc-400 mb-2">
					Target Audience
				</label>
				<select
					className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
					onChange={(e) =>
						setFormData({ ...formData, targetAudience: e.target.value })
					}
					value={formData.targetAudience}
				>
					<option value="all">All Users</option>
					<option value="free">Free Users Only</option>
					<option value="premium">Premium Users Only</option>
				</select>
			</div>

			{/* Advanced Settings */}
			<div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-6 mt-2">
				<div>
					<label className="block text-sm font-medium text-zinc-400 mb-2">
						Max Sends Per User *
					</label>
					<input
						className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600"
						min="1"
						onChange={(e) =>
							setFormData({
								...formData,
								maxSendsPerUser: Number(e.target.value),
							})
						}
						required
						type="number"
						value={formData.maxSendsPerUser}
					/>
					<p className="text-xs text-zinc-500 mt-1">
						Prevent spam - limit sends to same user
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium text-zinc-400 mb-2">
						Priority
					</label>
					<input
						className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600"
						onChange={(e) =>
							setFormData({ ...formData, priority: Number(e.target.value) })
						}
						placeholder="0"
						type="number"
						value={formData.priority}
					/>
					<p className="text-xs text-zinc-500 mt-1">
						Higher priority rules execute first
					</p>
				</div>
			</div>

			{/* Conditions (JSON) */}
			<div className="border-t border-zinc-800 pt-6">
				<label className="block text-sm font-medium text-zinc-400 mb-2">
					Conditions (JSON, optional)
				</label>
				<textarea
					className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
					onChange={(e) =>
						setFormData({ ...formData, conditions: e.target.value })
					}
					placeholder='{"has_subscription": false, "max_messages_sent": 5}'
					rows={4}
					value={formData.conditions}
				/>
				<p className="text-xs text-zinc-500 mt-1">
					Additional filtering conditions as JSON object
				</p>
			</div>

			{/* Actions */}
			<div className="flex items-center justify-between pt-6 border-t border-zinc-800">
				<button
					className="px-6 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
					onClick={() => router.back()}
					type="button"
				>
					Cancel
				</button>
				<button
					className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading || !formData.templateId}
					type="submit"
				>
					{loading
						? "Saving..."
						: initialData
							? "Update Rule"
							: "Create Follow-up Rule"}
				</button>
			</div>
		</form>
	);
}
