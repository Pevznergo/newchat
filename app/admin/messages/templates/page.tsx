import Link from "next/link";
import { getMessageTemplates } from "@/lib/db/queries";

export default async function TemplatesListPage() {
  const templates = await getMessageTemplates({ isActive: true });

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Message Templates</h2>
          <p className="text-zinc-400 mt-1">
            Create and manage reusable message templates
          </p>
        </div>
        <Link
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all font-medium"
          href="/admin/messages/templates/new"
        >
          + New Template
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <FilterButton active label="All" />
        <FilterButton label="Follow-up" />
        <FilterButton label="Broadcast" />
        <FilterButton label="Free Users" />
        <FilterButton label="Premium Users" />
      </div>

      {/* Templates List */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
        {templates.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <div className="text-6xl mb-4 grayscale opacity-50">📝</div>
            <h3 className="text-xl font-semibold text-zinc-200 mb-2">
              No templates yet
            </h3>
            <p className="text-zinc-400 mb-6">
              Create your first message template to start sending automated
              messages
            </p>
            <Link
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all font-medium"
              href="/admin/messages/templates/new"
            >
              Create Template
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-800">
              <thead className="bg-zinc-900/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Audience
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {templates.map((template) => (
                  <tr
                    className="hover:bg-zinc-800/40 transition-colors"
                    key={template.id}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="font-medium text-zinc-200">
                            {template.name}
                          </div>
                          <div className="text-sm text-zinc-500 truncate max-w-md">
                            {template.content.substring(0, 80)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                        {template.templateType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                      {template.targetAudience}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {template.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        className="text-blue-400 hover:text-blue-300 mr-4 transition-colors"
                        href={`/admin/messages/templates/${template.id}`}
                      >
                        Edit
                      </Link>
                      <button
                        className="text-red-400 hover:text-red-300 transition-colors"
                        type="button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
          : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
      type="button"
    >
      {label}
    </button>
  );
}
