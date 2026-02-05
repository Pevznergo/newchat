import Link from "next/link";
import { getBroadcastCampaigns } from "@/lib/db/messaging-queries";

export default async function BroadcastsPage() {
  const campaignsData = await getBroadcastCampaigns();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Broadcast Campaigns</h2>
          <p className="text-gray-600 mt-1">
            Create and manage manual mass messaging campaigns
          </p>
        </div>
        <Link
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          href="/admin/messages/broadcasts/new"
        >
          + New Campaign
        </Link>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaignsData.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📢</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No broadcast campaigns yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first broadcast campaign to send messages to multiple
              users at once
            </p>
            <Link
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              href="/admin/messages/broadcasts/new"
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          campaignsData.map((row) => {
            const campaign = row.BroadcastCampaign;
            const template = row.MessageTemplate;

            if (!campaign) return null;

            return (
              <div
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                key={campaign.id}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                      <StatusBadge status={campaign.status || "draft"} />
                    </div>

                    {template && (
                      <p className="text-sm text-gray-600 mb-4">
                        Template: {template.name}
                      </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Audience</p>
                        <p className="font-medium">{campaign.targetAudience}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Recipients</p>
                        <p className="font-medium">
                          {campaign.totalRecipients || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Sent</p>
                        <p className="font-medium">{campaign.sentCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Failed</p>
                        <p className="font-medium text-red-600">
                          {campaign.failedCount || 0}
                        </p>
                      </div>
                    </div>

                    {campaign.scheduledAt && (
                      <p className="text-xs text-gray-500 mt-4">
                        Scheduled for:{" "}
                        {new Date(campaign.scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {campaign.status === "draft" && (
                      <Link
                        className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        Start Sending
                      </Link>
                    )}
                    {campaign.status === "sending" && (
                      <Link
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        View Progress
                      </Link>
                    )}
                    {campaign.status === "completed" && (
                      <Link
                        className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                        href={`/admin/messages/broadcasts/${campaign.id}`}
                      >
                        View Report
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">
          💡 Broadcast Campaigns
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Send messages to multiple users based on audience filters</li>
          <li>• Track real-time progress and delivery statistics</li>
          <li>• Schedule campaigns for later or send immediately</li>
          <li>• Messages are sent by the cron job every minute</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    draft: "bg-gray-100 text-gray-800",
    scheduled: "bg-yellow-100 text-yellow-800",
    sending: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded ${colors[status as keyof typeof colors] || colors.draft}`}
    >
      {status}
    </span>
  );
}
