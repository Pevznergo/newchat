"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewBroadcastPage() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [templates, setTemplates] = useState<any[]>([]);
	const [estimatedRecipients, _setEstimatedRecipients] = useState<
		number | null
	>(null);
	const [formData, setFormData] = useState({
		name: "",
		templateId: "",
		targetAudience: "all",
		scheduledAt: "",
		filters: {
			last_activity_days: "",
		},
	});

	useEffect(() => {
		// Fetch templates
		fetch("/api/admin/messages/templates?type=broadcast")
			.then((res) => res.json())
			.then((data) => setTemplates(data.data || []));
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			// Prepare filters
			const filters: any = {};
			if (formData.filters.last_activity_days) {
				filters.last_activity_days = Number(
					formData.filters.last_activity_days,
				);
			}

			const response = await fetch("/api/admin/messages/broadcasts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					filters: Object.keys(filters).length > 0 ? filters : undefined,
					scheduledAt: formData.scheduledAt || undefined,
				}),
			});

			if (response.ok) {
				router.push("/admin/messages/broadcasts");
			} else {
				alert("Failed to create campaign");
			}
		} catch (error) {
			console.error("Error creating campaign:", error);
			alert("Error creating campaign");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-4xl">
			<div className="mb-6">
				<h2 className="text-2xl font-bold">Create Broadcast Campaign</h2>
				<p className="text-gray-600 mt-1">
					Send a message to multiple users based on audience filters
				</p>
			</div>

			<form
				className="space-y-6 bg-white rounded-lg shadow p-6"
				onSubmit={handleSubmit}
			>
				{/* Campaign Name */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Campaign Name *
					</label>
					<input
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						placeholder="e.g., Black Friday Sale Announcement"
						required
						type="text"
						value={formData.name}
					/>
				</div>

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
							No broadcast templates found.{" "}
							<a
								className="text-blue-600 hover:underline"
								href="/admin/messages/templates/new"
							>
								Create one first
							</a>
						</p>
					)}
				</div>

				{/* Target Audience */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Target Audience *
					</label>
					<select
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

				{/* Advanced Filters */}
				<div className="border-t pt-6">
					<h3 className="text-lg font-semibold mb-4">
						Advanced Filters (Optional)
					</h3>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Last Active (days)
						</label>
						<input
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
							min="1"
							onChange={(e) =>
								setFormData({
									...formData,
									filters: {
										...formData.filters,
										last_activity_days: e.target.value,
									},
								})
							}
							placeholder="e.g., 7 to target users active in last 7 days"
							type="number"
							value={formData.filters.last_activity_days}
						/>
					</div>
				</div>

				{/* Scheduling */}
				<div className="border-t pt-6">
					<h3 className="text-lg font-semibold mb-4">Scheduling (Optional)</h3>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Send At
						</label>
						<input
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
							onChange={(e) =>
								setFormData({ ...formData, scheduledAt: e.target.value })
							}
							type="datetime-local"
							value={formData.scheduledAt}
						/>
						<p className="text-xs text-gray-500 mt-1">
							Leave empty to send immediately after reviewing
						</p>
					</div>
				</div>

				{/* Estimated Recipients */}
				{estimatedRecipients !== null && (
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<p className="text-sm font-semibold text-blue-900">
							Estimated Recipients: {estimatedRecipients}
						</p>
					</div>
				)}

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
						{loading ? "Creating..." : "Create Campaign"}
					</button>
				</div>
			</form>
		</div>
	);
}
