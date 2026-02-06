import { Plus } from "lucide-react";
import Link from "next/link";
import ProcessQueueButton from "@/components/admin/messages/ProcessQueueButton";
import { getBroadcastCampaigns } from "@/lib/db/messaging-queries";

export default async function BroadcastsPage() {
  const campaignsData = await getBroadcastCampaigns();

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Broadcast Campaigns</h2>
          <p className="text-zinc-400 mt-1">
            Create and manage manual mass messaging campaigns
          </p>
        </div>
        <div className="flex gap-3">
          <ProcessQueueButton />
          <Link
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
            href="/admin/messages/broadcasts/new"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>
      </div>
      <div className="space-y-4">
        {campaignsData.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center backdrop-blur-sm">
            <div className="text-6xl mb-4 grayscale opacity-50">📢</div>
            <h3 className="text-xl font-semibold text-zinc-200 mb-2">
              No broadcast campaigns yet
            </h3>
            <p className="text-zinc-400 mb-6">
              Create your first broadcast campaign to send messages to multiple
              users at once
            </p>
            <Link
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all font-medium"
              href="/admin/messages/broadcasts/new"
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          campaignsData.map((row) => {
            const campaign = row.BroadcastCampaign;
            const template = row.MessageTemplate;

            if (!campaign) {
              return null;
            }

            return (
              <div
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:shadow-lg transition-all backdrop-blur-sm hover:border-zinc-700"
                key={campaign.id}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-zinc-200">
                        {campaign.name}
                      </h3>
                      <StatusBadge status={campaign.status || "draft"} />
                    </div>

                    {template && (
                      <p className="text-sm text-zinc-400 mb-4">
                        Template: {template.name}
                      </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-zinc-500">Audience</p>
                        <p className="font-medium text-zinc-300">
                          {campaign.targetAudience}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Recipients</p>
                        <p className="font-medium text-zinc-300">
                          {campaign.totalRecipients || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Sent</p>
                        <p className="font-medium text-zinc-300">
                          {campaign.sentCount || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Failed</p>
                        <p className="font-medium text-red-400">
                          {campaign.failedCount || 0}
                        </p>
                      </div>
                    </div>

                    {campaign.scheduledAt && (
                      <p className="text-xs text-zinc-500 mt-4">
                        Scheduled for:{" "}
                        {new Date(campaign.scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {campaign.status === "draft" && (
                      <>
                        <Link
                          className="px-4 py-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 hover:text-zinc-200 transition-colors text-center"
                          href={`/admin/messages/broadcasts/${campaign.id}/edit`}
                        >
                          Edit
                        </Link>
                        <Link
                          className="px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm hover:bg-emerald-600/20 transition-colors text-center"
                          href={`/admin/messages/broadcasts/${campaign.id}`}
                        >
                          Manage
                        </Link>
                      </>
                    )}
                    {campaign.status === "scheduled" && (
                      <Link
                        className="px-4 py-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 hover:text-zinc-200 transition-colors text-center"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        Details
                      </Link>
                    )}
                    {(campaign.status === "sending" ||
                      campaign.status === "pending") && (
                      <Link
                        className="px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg text-sm hover:bg-blue-600/20 transition-colors text-center"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        View Progress
                      </Link>
                    )}
                    {campaign.status === "completed" && (
                      <Link
                        className="px-4 py-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 hover:text-zinc-200 transition-colors text-center"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        View Report
                      </Link>
                    )}
                    {campaign.status === "failed" && (
                      <Link
                        className="px-4 py-2 bg-red-800/10 text-red-400 border border-red-700/20 rounded-lg text-sm hover:bg-red-800/20 transition-colors text-center"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        View Errors
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
        <h4 className="font-semibold text-blue-400 mb-2">
          💡 Broadcast Campaigns
        </h4>
        <ul className="text-sm text-blue-300/80 space-y-1">
          <li>• Send messages to multiple users based on audience filters</li>
          <li>• Track real-time progress and delivery statistics</li>
          <li>• Schedule campaigns for later or send immediately</li>
          <li>• Messages are sent by the cron job every minute</li>
        </ul>
      </div>
      ;
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    draft: "bg-zinc-800 text-zinc-400 border-zinc-700",
    scheduled: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    sending: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-md border ${
        colors[status as keyof typeof colors] || colors.draft
      }`}
    >
      {status}
    </span>
  );
}
