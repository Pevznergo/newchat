import Link from "next/link";
import { getFollowUpRules } from "@/lib/db/messaging-queries";

export default async function FollowUpRulesPage() {
	const rulesData = await getFollowUpRules({ isActive: true });

	return (
		<div className="space-y-6 text-zinc-100">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-white">Follow-up Rules</h2>
					<p className="text-zinc-400 mt-1">
						Automated messages triggered by user behavior
					</p>
				</div>
				<Link
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all font-medium"
					href="/admin/messages/follow-ups/new"
				>
					+ New Rule
				</Link>
			</div>

			{/* Rules List */}
			<div className="space-y-4">
				{rulesData.length === 0 ? (
					<div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center backdrop-blur-sm">
						<div className="text-6xl mb-4 grayscale opacity-50">⏱️</div>
						<h3 className="text-xl font-semibold text-zinc-200 mb-2">
							No follow-up rules yet
						</h3>
						<p className="text-zinc-400 mb-6">
							Create your first follow-up rule to start sending automated
							messages based on user triggers
						</p>
						<Link
							className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all font-medium"
							href="/admin/messages/follow-ups/new"
						>
							Create Follow-up Rule
						</Link>
					</div>
				) : (
					rulesData.map((row) => {
						const rule = row.FollowUpRule;
						const template = row.MessageTemplate;

						if (!rule || !template) {
							return null;
						}

						return (
							<div
								className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:shadow-lg transition-all backdrop-blur-sm hover:border-zinc-700"
								key={rule.id}
							>
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
												<p className="font-medium text-zinc-300">
													{rule.priority}
												</p>
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
													<p className="text-xs text-zinc-500 mb-1">
														Conditions:
													</p>
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
											className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
											type="button"
										>
											Delete
										</button>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>

			{/* Info Box */}
			<div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
				<h4 className="font-semibold text-blue-400 mb-2">
					💡 How Follow-up Rules Work
				</h4>
				<ul className="text-sm text-blue-300/80 space-y-1">
					<li>• Rules are processed every 10 minutes by the cron job</li>
					<li>• Messages are scheduled based on trigger type and delay</li>
					<li>
						• Each user can receive a message from the same rule up to "Max
						Sends" times
					</li>
					<li>• Use priority to control execution order (higher = first)</li>
				</ul>
			</div>
		</div>
	);
}
