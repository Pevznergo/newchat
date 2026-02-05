"use client";

import { useState } from "react";

export default function AdminPage() {
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const handleSendStats = async () => {
		setLoading(true);
		setMessage("");
		try {
			const res = await fetch("/api/cron/stats");
			const data = await res.json();
			if (res.ok) {
				setMessage("✅ Stats sent successfully!");
			} else {
				setMessage(`❌ Error: ${data.error}`);
			}
		} catch (_e) {
			setMessage("❌ Network error");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-8 font-sans">
			<h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

			<div className="p-6 border rounded-lg shadow-sm bg-white max-w-sm w-full text-center">
				<h2 className="text-lg font-semibold mb-4">Daily Statistics</h2>
				<p className="text-sm text-gray-500 mb-6">
					Send the daily user growth and tariff report to{" "}
					<b>pevznergo@gmail.com</b>.
				</p>

				<button
					className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					disabled={loading}
					onClick={handleSendStats}
					type="button"
				>
					{loading ? "Sending..." : "Send Stats Now"}
				</button>

				{message && <div className="mt-4 text-sm font-medium">{message}</div>}
			</div>
		</div>
	);
}
