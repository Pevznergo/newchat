import Link from "next/link";
import { getFollowUpRules } from "@/lib/db/messaging-queries";

export default async function FollowUpRulesPage() {
  const rulesData = await getFollowUpRules({ isActive: true });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Follow-up Rules</h2>
          <p className="text-gray-600 mt-1">
            Automated messages triggered by user behavior
          </p>
        </div>
        <Link
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          href="/admin/messages/follow-ups/new"
        >
          + New Rule
        </Link>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rulesData.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">⏱️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No follow-up rules yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first follow-up rule to start sending automated
              messages based on user triggers
            </p>
            <Link
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              href="/admin/messages/follow-ups/new"
            >
              Create Follow-up Rule
            </Link>
          </div>
        ) : (
          rulesData.map((row) => {
            const rule = row.FollowUpRule;
            const template = row.MessageTemplate;

            if (!rule || !template) return null;

            return (
              <div
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                key={rule.id}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      {rule.isActive ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          Inactive
                        </span>
                      )}
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        Priority: {rule.priority}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Trigger</p>
                        <p className="font-medium">{rule.triggerType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Delay</p>
                        <p className="font-medium">{rule.triggerDelayHours}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Audience</p>
                        <p className="font-medium">
                          {rule.targetAudience || template.targetAudience}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Max Sends</p>
                        <p className="font-medium">
                          {rule.maxSendsPerUser}x per user
                        </p>
                      </div>
                    </div>

                    {!!rule.conditions && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">
                          <strong>Conditions:</strong>{" "}
                          {JSON.stringify(rule.conditions)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    <button className="text-gray-600 hover:text-gray-800 text-sm font-medium">
                      {rule.isActive ? "Disable" : "Enable"}
                    </button>
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
          💡 How Follow-up Rules Work
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Rules are processed every 10 minutes by the cron job</li>
          <li>• Messages are scheduled based on trigger type and delay</li>
          <li>
            • Each user can receive a message from the same rule up to "Max
            Sends" times
          </li>
          <li>• Use priority to control execution order (higher = first)</li>
        </ul>
      </div>
    </div>
  );
}
