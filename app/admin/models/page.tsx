"use client";

import { useEffect, useState } from "react";
import { deleteModel, getModels, upsertModel } from "../actions";

// Disable static generation for this page
export const dynamic = "force-dynamic";

export default function AdminModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadModels is stable
  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    const data = await getModels();
    setModels(data);
    setLoading(false);
  }

  function handleEdit(model: any) {
    setEditingModel(model);
    setIsDialogOpen(true);
  }

  function handleAddNew() {
    setEditingModel({});
    setIsDialogOpen(true);
  }

  async function handleDelete(id: string) {
    // biome-ignore lint/suspicious/noAlert: Admin tool
    if (confirm("Are you sure?")) {
      await deleteModel(id);
      loadModels();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      id: editingModel?.id,
      modelId: formData.get("modelId") as string,
      name: formData.get("name") as string,
      provider: formData.get("provider") as string,
      type: formData.get("type") as string,
      cost: Number(formData.get("cost")),
      apiModelId: formData.get("apiModelId") as string,
      requiredClanLevel: Number(formData.get("requiredClanLevel") || 1),
      isEnabled: formData.get("isEnabled") === "on",
    };

    if (!data.modelId || !data.name || !data.type) {
      // biome-ignore lint/suspicious/noAlert: Admin tool
      alert("Please fill required fields");
      return;
    }

    await upsertModel(data);
    setIsDialogOpen(false);
    loadModels();
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Models Management</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={handleAddNew}
          type="button"
        >
          Add New Model
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название (кнопка в боте)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Провайдер
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                API ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Уровень клана
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Стоимость
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {models.map((model) => (
              <tr key={model.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {model.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {model.provider || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {model.apiModelId || (
                    <span className="text-yellow-500 italic">Default</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {model.requiredClanLevel ?? 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {model.cost}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                    onClick={() => handleEdit(model)}
                    type="button"
                  >
                    Изменить
                  </button>
                  <button
                    className="text-red-600 hover:text-red-900"
                    onClick={() => handleDelete(model.id)}
                    type="button"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {models.length === 0 && !loading && (
              <tr>
                <td className="px-6 py-4 text-center text-gray-500" colSpan={6}>
                  Модели не найдены.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-6 py-4 text-center text-gray-500" colSpan={6}>
                  Загрузка...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {editingModel.id ? "Edit Model" : "Add Model"}
            </h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="modelId"
                >
                  Internal Model ID (Unique)
                </label>
                <input
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  defaultValue={editingModel.modelId}
                  id="modelId"
                  name="modelId"
                  placeholder="e.g. model_gpt5nano"
                  required
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="name"
                >
                  Display Name
                </label>
                <input
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  defaultValue={editingModel.name}
                  id="name"
                  name="name"
                  placeholder="e.g. GPT-5 Nano"
                  required
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
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  defaultValue={editingModel.type || "text"}
                  id="type"
                  name="type"
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="provider"
                >
                  Service Provider
                </label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  defaultValue={editingModel.provider || "openai"}
                  id="provider"
                  name="provider"
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="google">Google</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="apiModelId"
                >
                  API Model ID (Real Provider ID)
                </label>
                <input
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  defaultValue={editingModel.apiModelId}
                  id="apiModelId"
                  name="apiModelId"
                  placeholder="e.g. openai/gpt-5-nano-2025-08-07"
                />
                <p className="text-xs text-gray-500">
                  If empty, bot uses default hardcoded map.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="cost"
                  >
                    Cost (Credits)
                  </label>
                  <input
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    defaultValue={editingModel.cost || 1}
                    id="cost"
                    name="cost"
                    required
                    type="number"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="requiredClanLevel"
                  >
                    Required Clan Level
                  </label>
                  <input
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    defaultValue={editingModel.requiredClanLevel || 1}
                    id="requiredClanLevel"
                    max="10"
                    min="1"
                    name="requiredClanLevel"
                    required
                    type="number"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  defaultChecked={editingModel.isEnabled ?? true}
                  id="isEnabled"
                  name="isEnabled"
                  type="checkbox"
                />
                <label htmlFor="isEnabled">Enabled</label>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  onClick={() => setIsDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                  type="submit"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
