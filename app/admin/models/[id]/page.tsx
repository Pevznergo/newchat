import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getModelById, getModelLimits } from "@/lib/ai/config";
import type { AiModel, ModelLimit } from "@/lib/db/schema";
import { deleteLimit, saveLimit, saveModel } from "../../actions";

export default async function EditModelPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
  const isNew = params.id === "new";
  let model: AiModel | undefined | null = null;
  let limits: ModelLimit[] = [];

  if (!isNew) {
    model = await getModelById(params.id);
    if (!model) {
      notFound();
    }
    limits = await getModelLimits(params.id); // Assuming returns modelLimit[] via uuid
    // Note: getModelLimits currently expects model ID *string* or UUID?
    // In config.ts I wrote: getModelLimits(modelId: string) { ... where(modelLimit.modelId, modelId) }
    // modelLimit.modelId IS a UUID foreign key. so passing params.id (UUID) is correct.
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">
          {isNew ? "Create New Model" : `Edit ${model?.name}`}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Model Form */}
        <div className="rounded-lg border bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-medium">Model Configuration</h3>
          <form action={saveModel} className="space-y-4">
            <input name="id" type="hidden" value={model?.id || ""} />

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="name"
              >
                Display Name
              </label>
              <input
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                defaultValue={model?.name || ""}
                id="name"
                name="name"
                required
                type="text"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="modelId"
              >
                Model ID (Internal)
              </label>
              <input
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                defaultValue={model?.modelId || ""}
                id="modelId"
                name="modelId"
                placeholder="e.g. model_gpt4omini"
                required
                type="text"
              />
              <p className="mt-1 text-xs text-gray-500">
                Used in code/callbacks.
              </p>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="providerId"
              >
                Provider ID
              </label>
              <input
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                defaultValue={model?.providerId || ""}
                id="providerId"
                name="providerId"
                placeholder="e.g. openai/gpt-4o-mini"
                required
                type="text"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="type"
              >
                Type
              </label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                defaultValue={model?.type || "text"}
                id="type"
                name="type"
              >
                <option value="text">Text / Chat</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="description"
              >
                Description
              </label>
              <textarea
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                defaultValue={model?.description || ""}
                id="description"
                name="description"
                rows={3}
              />
            </div>

            <div className="flex items-center">
              <input
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                defaultChecked={model?.isPremium ?? false}
                id="isPremium"
                name="isPremium"
                type="checkbox"
              />
              <label
                className="ml-2 block text-sm text-gray-900"
                htmlFor="isPremium"
              >
                Requires Premium (Visual Indicator)
              </label>
            </div>

            <div className="pt-4">
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                type="submit"
              >
                Save Model
              </button>
            </div>
          </form>
        </div>

        {/* Limits - Only for existing models */}
        {!isNew && (
          <div className="rounded-lg border bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-medium">Usage Limits</h3>

            <div className="mb-6 space-y-4 rounded-md bg-gray-50 p-4">
              <h4 className="text-sm font-medium text-gray-900">
                Add New Limit
              </h4>
              <form action={saveLimit} className="flex flex-col gap-3">
                <input name="modelId" type="hidden" value={model?.id} />
                <input name="redirectId" type="hidden" value={model?.id} />

                <div className="grid grid-cols-2 gap-3">
                  <select
                    aria-label="User Limit Role"
                    className="rounded border px-2 py-1 text-sm"
                    name="userRole"
                  >
                    <option value="free">Free User</option>
                    <option value="premium">Premium</option>
                    <option value="premium_x2">Premium X2</option>
                    <option value="regular">Regular</option>
                  </select>
                  <select
                    aria-label="Limit Period"
                    className="rounded border px-2 py-1 text-sm"
                    name="limitPeriod"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                    <option value="total">Total</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <input
                    aria-label="Limit Count"
                    className="flex-1 rounded border px-2 py-1 text-sm"
                    name="limitCount"
                    placeholder="Limit (e.g. 5)"
                    required
                    type="number"
                  />
                  <button
                    className="rounded bg-black px-3 py-1 text-sm text-white"
                    type="submit"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-2">
              {limits.length === 0 && (
                <p className="text-sm text-gray-500">No limits defined.</p>
              )}
              {limits.map((l) => (
                <div
                  className="flex items-center justify-between rounded border p-3"
                  key={l.id}
                >
                  <div>
                    <span className="font-medium capitalize">{l.userRole}</span>
                    <span className="mx-2 text-gray-400">|</span>
                    <span>
                      {l.limitCount} per {l.limitPeriod}
                    </span>
                  </div>
                  <form action={deleteLimit.bind(null, l.id)}>
                    <button
                      className="text-sm text-red-600 hover:text-red-800"
                      type="submit"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
