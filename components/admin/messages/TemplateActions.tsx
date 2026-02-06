"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TemplateActionsProps {
	id: string;
}

export default function TemplateActions({ id }: TemplateActionsProps) {
	const router = useRouter();
	const [deleting, setDeleting] = useState(false);

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this template?")) {
			return;
		}

		setDeleting(true);
		try {
			const res = await fetch(`/api/admin/messages/templates/${id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				router.refresh();
			} else {
				alert("Failed to delete template");
			}
		} catch (error) {
			console.error("Delete failed", error);
			alert("Error deleting template");
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className="flex justify-end items-center gap-4">
			<Link
				className="text-blue-400 hover:text-blue-300 transition-colors"
				href={`/admin/messages/templates/${id}`}
			>
				Edit
			</Link>
			<button
				className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
				disabled={deleting}
				onClick={handleDelete}
				type="button"
			>
				{deleting ? "..." : "Delete"}
			</button>
		</div>
	);
}
