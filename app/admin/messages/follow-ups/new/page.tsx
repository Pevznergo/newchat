"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewFollowUpRulePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [templates, setTemplates] = useState<any[]>([]);
	const [formData, setFormData] = useState({
		templateId: "",
		triggerType: "after_registration",
		triggerDelayHours: 24,
		targetAudience: "",
		maxSendsPerUser: 1,
		priority: 0,
		conditions: "",
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

			const response = await fetch("/api/admin/messages/follow-ups", {
				method: "POST",
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
				alert("Failed to create follow-up rule");
			}
		} catch (error) {
			console.error("Error creating follow-up rule:", error);
			alert("Error creating follow-up rule");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-4xl">
			<div className="mb-6">
				<h2 className="text-2xl font-bold">Create Follow-up Rule</h2>
				<p className="text-gray-600 mt-1">
					Set up an automated message triggered by user behavior
				</p>
			</div>

			<form
				className="space-y-6 bg-white rounded-lg shadow p-6"
				onSubmit={handleSubmit}
			>
				{/* Template Selection */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Message Template *
					</label>
					<select
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						onChange={(e) =>
							setFormData({ ...formData, templateId: e.target.value })
						}
						required
						value={formData.templateId}
					>
						<option value="">Select a template...</option>
						{templates.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name} ({t.targetAudience})
							</option>
						))}
					</select>
					{templates.length === 0 && (
						<p className="text-sm text-gray-500 mt-1">
							No follow-up templates found.{" "}
							<a
								className="text-blue-600 hover:underline"
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
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Trigger Type *
						</label>
						<select
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Delay (hours) *
						</label>
						<input
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
						<p className="text-xs text-gray-500 mt-1">
							Send message X hours after trigger event
						</p>
					</div>
				</div>

				{/* Audience Override */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Target Audience (Override)
					</label>
					<select
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						onChange={(e) =>
							setFormData({ ...formData, targetAudience: e.target.value })
						}
						value={formData.targetAudience}
					>
						<option value="">Use template's audience</option>
						<option value="all">All Users</option>
						<option value="free">Free Users Only</option>
						<option value="premium">Premium Users Only</option>
					</select>
				</div>

				{/* Advanced Settings */}
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Max Sends Per User *
						</label>
						<input
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
						<p className="text-xs text-gray-500 mt-1">
							Prevent spam - limit sends to same user
						</p>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Priority
						</label>
						<input
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
							onChange={(e) =>
								setFormData({ ...formData, priority: Number(e.target.value) })
							}
							placeholder="0"
							type="number"
							value={formData.priority}
						/>
						<p className="text-xs text-gray-500 mt-1">
							Higher priority rules execute first
						</p>
					</div>
				</div>

				{/* Conditions (JSON) */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Conditions (JSON, optional)
					</label>
					<textarea
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
						onChange={(e) =>
							setFormData({ ...formData, conditions: e.target.value })
						}
						placeholder='{"has_subscription": false, "max_messages_sent": 5}'
						rows={4}
						value={formData.conditions}
					/>
					<p className="text-xs text-gray-500 mt-1">
						Additional filtering conditions as JSON object
					</p>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-between pt-6 border-t">
					<button
						className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
						onClick={() => router.back()}
						type="button"
					>
						Cancel
					</button>
					<button
						className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
						disabled={loading || !formData.templateId}
						type="submit"
					>
						{loading ? "Creating..." : "Create Follow-up Rule"}
					</button>
				</div>
			</form>
		</div>
	);
}
