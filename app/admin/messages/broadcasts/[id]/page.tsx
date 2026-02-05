"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BroadcastDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/admin/messages/broadcasts/${params.id}/stats`
      );
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats every 5 seconds if sending
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [params.id]);

  const handleStartSending = async () => {
    if (!confirm("Start sending this campaign to all recipients?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/messages/broadcasts/${params.id}/send`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        alert("Campaign started successfully!");
        fetchStats();
      } else {
        alert("Failed to start campaign");
      }
    } catch (error) {
      console.error("Error starting campaign:", error);
      alert("Error starting campaign");
    } finally {
      setLoading(false);
    }
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Loading campaign details...</div>
      </div>
    );
  }

  const progress =
    stats.total > 0
      ? Math.round(((stats.sent + stats.failed) / stats.total) * 100)
      : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            className="text-blue-600 hover:text-blue-800 mb-2 text-sm"
            onClick={() => router.back()}
          >
            ← Back to Campaigns
          </button>
          <h2 className="text-2xl font-bold">Campaign Progress</h2>
        </div>
        {stats.pending > 0 && (
          <button
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            disabled={loading}
            onClick={handleStartSending}
          >
            {loading ? "Starting..." : "Start Sending"}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard color="blue" label="Total Recipients" value={stats.total} />
        <StatCard color="green" label="Sent" value={stats.sent} />
        <StatCard color="red" label="Failed" value={stats.failed} />
        <StatCard color="yellow" label="Pending" value={stats.pending} />
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Progress</h3>
            <span className="text-sm text-gray-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {stats.sent + stats.failed} of {stats.total} messages processed
          </p>
        </div>
      )}

      {/* Status Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Campaign Status</h3>
        <div className="space-y-3">
          {stats.pending > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-sm">
                {stats.pending} messages waiting to be sent
              </span>
            </div>
          )}
          {stats.sent > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm">
                {stats.sent} messages delivered successfully
              </span>
            </div>
          )}
          {stats.failed > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-sm">
                {stats.failed} messages failed to deliver
              </span>
            </div>
          )}
          {stats.pending === 0 && stats.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-sm font-semibold">Campaign completed!</span>
            </div>
          )}
        </div>
      </div>

      {/* Auto-refresh Notice */}
      {stats.pending > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            📊 Stats auto-refresh every 5 seconds
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p
        className={`text-3xl font-bold ${colors[color as keyof typeof colors]}`}
      >
        {value}
      </p>
    </div>
  );
}
