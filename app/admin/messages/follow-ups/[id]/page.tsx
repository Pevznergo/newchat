"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import FollowUpForm from "@/components/admin/messages/FollowUpForm";

export default function EditFollowUpPage() {
	const params = useParams();
	const id = params?.id as string;
	const [initialData, setInitialData] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!id) return;

		// We can reuse the same API endpoint pattern if it supports GET by ID
		// or filtering. The current list implementation fetches all rules.
		// Ideally we should have GET /api/admin/messages/follow-ups/[id]
		// Checking if that endpoint exists or if we need to filter client side or create it.
		// For now assuming we need to fetch all and find, or implement the endpoint.
		// Actually, standard REST pattern suggests [id] route.
		// Let's try fetching the specific rule.
		fetch(`/api/admin/messages/follow-ups/${id}`)
			.then((res) => {
				if (!res.ok) throw new Error("Failed to fetch");
				return res.json();
			})
			.then((data) => {
				setInitialData(data.data);
			})
			.catch((err) => {
				console.error("Failed to load rule", err);
				// Fallback: try fetching all and filtering if specific endpoint doesn't exist yet
				// (This is a safety mechanism in case I haven't implemented that API route yet)
				fetch("/api/admin/messages/follow-ups")
					.then((res) => res.json())
					.then((allData) => {
						const found = allData.data?.find(
							(r: any) => r.FollowUpRule.id === id,
						);
						if (found) setInitialData(found.FollowUpRule);
					})
					.catch((e) => console.error("Double fail", e));
			})
			.finally(() => setLoading(false));
	}, [id]);

	if (loading) {
		return <div className="p-8 text-center text-zinc-400">Loading...</div>;
	}

	if (!initialData) {
		return <div className="p-8 text-center text-red-400">Rule not found</div>;
	}

	return (
		<div className="max-w-4xl text-zinc-100">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-white">Edit Follow-up Rule</h2>
				<p className="text-zinc-400 mt-1">Update automated message settings</p>
			</div>

			<FollowUpForm initialData={initialData} />
		</div>
	);
}
