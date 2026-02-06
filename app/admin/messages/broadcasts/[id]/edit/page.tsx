"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BroadcastForm from "@/components/admin/messages/BroadcastForm";

export default function EditBroadcastPage() {
	const params = useParams();
	const id = params?.id as string;
	const [initialData, setInitialData] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!id) return;

		fetch(`/api/admin/messages/broadcasts/${id}`)
			.then((res) => res.json())
			.then((data) => {
				setInitialData(data.data);
			})
			.catch((err) => console.error("Failed to load campaign", err))
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) {
		return <div className="p-8 text-center text-zinc-400">Loading...</div>;
	}

	if (!initialData) {
		return (
			<div className="p-8 text-center text-red-400">Campaign not found</div>
		);
	}

	// Only allow editing drafts
	if (initialData.status !== "draft") {
		return (
			<div className="p-8 text-center">
				<p className="text-zinc-400 mb-4">
					Only draft campaigns can be edited. This campaign is{" "}
					{initialData.status}.
				</p>
				<a
					className="text-blue-400 hover:underline"
					href="/admin/messages/broadcasts"
				>
					Back to list
				</a>
			</div>
		);
	}

	return (
		<div className="max-w-4xl text-zinc-100">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-white">
					Edit Broadcast Campaign
				</h2>
				<p className="text-zinc-400 mt-1">
					Update campaign details and settings
				</p>
			</div>

			<BroadcastForm initialData={initialData} />
		</div>
	);
}
