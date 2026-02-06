"use client";

import BroadcastForm from "@/components/admin/messages/BroadcastForm";

export default function NewBroadcastPage() {
	return (
		<div className="max-w-4xl text-zinc-100">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-white">
					Create Broadcast Campaign
				</h2>
				<p className="text-zinc-400 mt-1">
					Send a message to multiple users based on audience filters
				</p>
			</div>

			<BroadcastForm />
		</div>
	);
}
