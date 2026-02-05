import Link from "next/link";
import { getMessageTemplates } from "@/lib/db/queries";

export default async function MessagesAdminDashboard() {
  // Fetch templates for stats
  const allTemplates = await getMessageTemplates();
  const followUpTemplates = allTemplates.filter(
    (t) => t.templateType === "follow_up"
  );
  const broadcastTemplates = allTemplates.filter(
    (t) => t.templateType === "broadcast"
  );
  const activeTemplates = allTemplates.filter((t) => t.isActive);

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon="📝"
          subtitle={`${activeTemplates.length} active`}
          title="Total Templates"
          value={allTemplates.length}
        />
        <StatCard
          icon="⏱️"
          subtitle="Automated messages"
          title="Follow-up Rules"
          value={followUpTemplates.length}
        />
        <StatCard
          icon="📢"
          subtitle="Campaign templates"
          title="Broadcasts"
          value={broadcastTemplates.length}
        />
        <StatCard
          icon="✉️"
          subtitle="Last 24h"
          title="Messages Sent"
          value="—"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionButton
            href="/admin/messages/templates/new"
            icon="📝"
            label="Create Template"
          />
          <ActionButton
            href="/admin/messages/follow-ups/new"
            icon="⏱️"
            label="New Follow-up Rule"
          />
          <ActionButton
            href="/admin/messages/broadcasts/new"
            icon="📢"
            label="New Broadcast"
          />
        </div>
      </div>

      {/* Recent Templates */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Templates</h2>
            <Link
              className="text-sm text-blue-600 hover:text-blue-800"
              href="/admin/messages/templates"
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="p-6">
          {allTemplates.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No templates yet. Create your first template to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {allTemplates.slice(0, 5).map((template) => (
                <div
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  key={template.id}
                >
                  <div>
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-sm text-gray-500">
                      {template.templateType} • {template.targetAudience}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        Inactive
                      </span>
                    )}
                    <Link
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      href={`/admin/messages/templates/${template.id}`}
                    >
                      Edit →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

function ActionButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
      href={href}
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium text-gray-700 group-hover:text-blue-700">
        {label}
      </span>
    </Link>
  );
}
