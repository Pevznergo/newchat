"use client";

import { useState } from "react";

export default function ProcessQueueButton() {
  const [loading, setLoading] = useState(false);

  const handleForceRun = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/send-messages");
      const data = await res.json();
      alert(`Processed: ${data.sent} sent, ${data.failed} failed`);
      window.location.reload();
    } catch (e) {
      alert("Failed to run cron");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-all text-sm"
      disabled={loading}
      onClick={handleForceRun}
    >
      {loading ? "Processing..." : "⚡ Process Queue"}
    </button>
  );
}
