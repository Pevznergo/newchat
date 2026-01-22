import Link from "next/link";
import { getAllModels } from "@/lib/ai/config";
import { toggleModelStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const models = await getAllModels();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">AI Models</h2>
        <Link
          href="/admin/models/new"
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Add New Model
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <table className="w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Provider</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">No models found.</td>
                </tr>
            )}
            {models.map((model) => (
              <tr key={model.id} className="border-b bg-white hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {model.name}
                  {model.isPremium && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      Premium
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">{model.modelId}</td>
                <td className="px-6 py-4">{model.providerId}</td>
                <td className="px-6 py-4 capitalize">{model.type}</td>
                <td className="px-6 py-4">
                  <form action={toggleModelStatus.bind(null, model.id, !model.isActive)}>
                    <button
                        type="submit"
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        model.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                    >
                        {model.isActive ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/admin/models/${model.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
