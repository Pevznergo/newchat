"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface FollowUpRuleItemProps {
	rule: any;
	template: any;
}

export default function FollowUpRuleItem({
	rule,
	template,
}: FollowUpRuleItemProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this rule?")) {
			return;
		}

		setIsDeleting(true);
		try {
			const res = await fetch(`/api/admin/messages/follow-ups/${rule.id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				router.refresh();
			} else {
				alert("Failed to delete rule");
			}
		} catch (error) {
			console.error("Failed to delete rule:", error);
			alert("Error deleting rule");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:shadow-lg transition-all backdrop-blur-sm hover:border-zinc-700">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3 mb-2">
						<h3 className="text-lg font-semibold text-zinc-200">
							{template.name}
						</h3>
						{rule.isActive ? (
							<span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
								Active
							</span>
						) : (
							<span className="px-2 py-1 text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-md">
								Inactive
							</span>
						)}
						<span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
							Priority: {rule.priority}
						</span>
					</div>

					<p className="text-sm text-zinc-400 mb-4">
						Trigger:{" "}
						<span className="font-medium text-zinc-300">
							{rule.triggerType}
						</span>
						<span className="mx-2">•</span>
						Delay:{" "}
						<span className="font-medium text-zinc-300">
							{rule.triggerDelayHours}h
						</span>
					</p>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div>
							<p className="text-sm text-zinc-500">Audience</p>
							<p className="font-medium text-zinc-300">
								{rule.targetAudience || template.targetAudience}
							</p>
						</div>

						<div>
							<p className="text-sm text-zinc-500">Priority</p>
							<p className="font-medium text-zinc-300">{rule.priority}</p>
						</div>
						<div>
							<p className="text-sm text-zinc-500">Max Sends</p>
							<p className="font-medium text-zinc-300">
								{rule.maxSendsPerUser}
							</p>
						</div>
					</div>

					{!!rule.conditions &&
						Object.keys(rule.conditions as object).length > 0 && (
							<div className="mt-4 pt-4 border-t border-zinc-800/50">
								<p className="text-xs text-zinc-500 mb-1">Conditions:</p>
								<pre className="text-xs text-zinc-400 bg-zinc-950/50 p-2 rounded-lg inline-block border border-zinc-800">
									{JSON.stringify(rule.conditions, null, 2)}
								</pre>
							</div>
						)}
				</div>

				<div className="flex flex-col gap-2 ml-4">
					<Link
						className="px-4 py-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 hover:text-zinc-200 transition-colors text-center"
						href={`/admin/messages/follow-ups/${rule.id}`}
					>
						Edit
					</Link>
					<button
						className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
						disabled={isDeleting}
						onClick={handleDelete}
						type="button"
					>
						{isDeleting ? "..." : "Delete"}
					</button>
				</div>
			</div>
		</div>
	);
}
