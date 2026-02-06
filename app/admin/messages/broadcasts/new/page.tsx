"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewBroadcastPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [estimatedRecipients, _setEstimatedRecipients] = useState<
    number | null
  >(null);
  const [formData, setFormData] = useState({
    name: "",
    templateId: "",
    targetAudience: "all",
    scheduledAt: "",
    filters: {
      last_activity_days: "",
    },
  });

  useEffect(() => {
    // Fetch templates
    fetch("/api/admin/messages/templates?type=broadcast")
      .then((res) => res.json())
      .then((data) => setTemplates(data.data || []));
  }, []);

  const handleCreate = async (type: "draft" | "start") => {
    setLoading(true);

    try {
      // Prepare filters
      const filters: any = {};
      if (formData.filters.last_activity_days) {
        filters.last_activity_days = Number(
          formData.filters.last_activity_days
        );
      }

      // Create Campaign
      const response = await fetch("/api/admin/messages/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          scheduledAt: formData.scheduledAt || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const campaignId = data.data.id;

        if (type === "start") {
          // Start sending immediately
          const startResponse = await fetch(
            `/api/admin/messages/broadcasts/${campaignId}/send`,
            {
              method: "POST",
            }
          );

          if (startResponse.ok) {
            router.push(`/admin/messages/broadcasts/${campaignId}`);
          } else {
            alert("Campaign created but failed to start sending");
            router.push("/admin/messages/broadcasts");
          }
        } else {
          router.push("/admin/messages/broadcasts");
        }
      } else {
        alert("Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Error creating campaign");
    } finally {
      setLoading(false);
    }
  };

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

      <form
        className="space-y-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-2xl backdrop-blur-sm"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate("draft");
        }}
      >
        {/* Campaign Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Campaign Name *
          </label>
          <input
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Black Friday Sale Announcement"
            required
            type="text"
            value={formData.name}
          />
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Message Template *
          </label>
          <select
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
            onChange={(e) =>
              setFormData({ ...formData, templateId: e.target.value })
            }
            required
            value={formData.templateId}
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.targetAudience})
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="text-sm text-zinc-500 mt-1">
              No broadcast templates found.{" "}
              <a
                className="text-blue-400 hover:text-blue-300 hover:underline"
                href="/admin/messages/templates/new"
              >
                Create one first
              </a>
            </p>
          )}
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Target Audience *
          </label>
          <select
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
            onChange={(e) =>
              setFormData({ ...formData, targetAudience: e.target.value })
            }
            value={formData.targetAudience}
          >
            <option value="all">All Users</option>
            <option value="free">Free Users Only</option>
            <option value="premium">Premium Users Only</option>
          </select>
        </div>

        {/* Advanced Filters */}
        <div className="border-t border-zinc-800 pt-6">
          <h3 className="text-lg font-semibold text-zinc-200 mb-4">
            Advanced Filters (Optional)
          </h3>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Last Active (days)
            </label>
            <input
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600"
              min="1"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  filters: {
                    ...formData.filters,
                    last_activity_days: e.target.value,
                  },
                })
              }
              placeholder="e.g., 7 to target users active in last 7 days"
              type="number"
              value={formData.filters.last_activity_days}
            />
          </div>
        </div>

        {/* Scheduling */}
        <div className="border-t border-zinc-800 pt-6">
          <h3 className="text-lg font-semibold text-zinc-200 mb-4">
            Scheduling (Optional)
          </h3>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Send At
            </label>
            <input
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none transition-all"
              onChange={(e) =>
                setFormData({ ...formData, scheduledAt: e.target.value })
              }
              type="datetime-local"
              value={formData.scheduledAt}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Leave empty to send immediately after reviewing
            </p>
          </div>
        </div>

        {/* Estimated Recipients */}
        {estimatedRecipients !== null && (
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-200">
              Estimated Recipients: {estimatedRecipients}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-zinc-800">
          <button
            className="px-6 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            onClick={() => router.back()}
            type="button"
          >
            Cancel
          </button>
          <div className="flex gap-4">
            <button
              className="px-6 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                handleCreate("draft");
              }}
              type="button"
            >
              {loading ? "Saving..." : "Create Draft"}
            </button>
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !formData.templateId}
              onClick={(e) => {
                e.preventDefault();
                handleCreate("start");
              }}
              type="button"
            >
              {loading ? "Starting..." : "Create & Start Now"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
