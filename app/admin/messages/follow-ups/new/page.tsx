"use client";

import FollowUpForm from "@/components/admin/messages/FollowUpForm";

export default function NewFollowUpRulePage() {
	return (
		<div className="max-w-4xl text-zinc-100">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-white">Create Follow-up Rule</h2>
				<p className="text-zinc-400 mt-1">
					Set up an automated message triggered by user behavior
				</p>
			</div>

			<FollowUpForm />
		</div>
	);
}
