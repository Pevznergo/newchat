import Link from "next/link";
import FollowUpRuleItem from "@/components/admin/messages/FollowUpRuleItem";
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
							<FollowUpRuleItem key={rule.id} rule={rule} template={template} />
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
