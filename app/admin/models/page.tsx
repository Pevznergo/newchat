"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteModel, getModels, upsertModel } from "../actions";

// Disable static generation for this page
export const dynamic = "force-dynamic";

export default function AdminModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function handleAddNew() {
    const newModel = {
      id: "new",
      modelId: "",
      name: "",
      provider: "openai",
      type: "text",
      cost: 1,
      apiModelId: "",
      requiredClanLevel: 1,
      isEnabled: true,
    };
    setModels([newModel, ...models]);
    setEditingId("new");
  }

  function handleEditClick(model: any) {
    setEditingId(model.id);
  }

  function handleCancel() {
    if (editingId === "new") {
      setModels(models.filter((m) => m.id !== "new"));
    }
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    // biome-ignore lint/suspicious/noAlert: Admin tool
    if (confirm("Are you sure?")) {
      await deleteModel(id);
      loadModels();
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      id: editingId === "new" ? undefined : editingId,
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

    // Optimistic update for UI stability before reload
    setEditingId(null);
    await upsertModel(data as any);
    loadModels();
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Models Management</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={editingId === "new"}
          onClick={handleAddNew}
          type="button"
        >
          Add New Model
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <form onSubmit={handleSave}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название (кнопка)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Провайдер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Internal ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lvl
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((model) => {
                const isEditing = editingId === model.id;
                return (
                  <tr
                    className={
                      isEditing
                        ? "bg-blue-50"
                        : "hover:bg-gray-50 cursor-pointer"
                    }
                    key={model.id}
                    onDoubleClick={() => !isEditing && handleEditClick(model)}
                  >
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            className="w-full border rounded p-1"
                            defaultValue={model.name}
                            name="name"
                            placeholder="Name"
                            required
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="w-full border rounded p-1"
                            defaultValue={model.provider}
                            name="provider"
                          >
                            <option value="openai">OpenAI</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="google">Google</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="other">Other</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="w-full border rounded p-1 text-xs"
                            defaultValue={model.modelId}
                            name="modelId"
                            placeholder="model_id"
                            required
                          />
                          <input
                            name="type"
                            type="hidden"
                            value={model.type || "text"}
                          />
                          <input name="isEnabled" type="hidden" value="on" />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="w-full border rounded p-1 text-xs"
                            defaultValue={model.apiModelId}
                            name="apiModelId"
                            placeholder="default"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="w-16 border rounded p-1"
                            defaultValue={model.requiredClanLevel}
                            max="10"
                            min="1"
                            name="requiredClanLevel"
                            type="number"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="w-16 border rounded p-1"
                            defaultValue={model.cost}
                            name="cost"
                            type="number"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                          <button
                            className="text-green-600 hover:text-green-800"
                            title="Save"
                            type="submit"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            className="text-gray-600 hover:text-gray-800"
                            onClick={handleCancel}
                            title="Cancel"
                            type="button"
                          >
                            <X size={18} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {model.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {model.provider}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                          {model.modelId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {model.apiModelId || (
                            <span className="text-yellow-500 italic">
                              Default
                            </span>
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
                            onClick={() => handleEditClick(model)}
                            title="Edit"
                            type="button"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDelete(model.id)}
                            title="Delete"
                            type="button"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </form>
        {models.length === 0 && !loading && (
          <div className="p-6 text-center text-gray-500">
            Модели не найдены.
          </div>
        )}
        {loading && (
          <div className="p-6 text-center text-gray-500">Загрузка...</div>
        )}
      </div>
    </div>
  );
}
