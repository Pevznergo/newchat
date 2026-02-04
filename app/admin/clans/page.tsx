"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getClanLevels, upsertClanLevel } from "../actions";

// Disable static generation for this page
export const dynamic = "force-dynamic";

export default function AdminClansPage() {
  const [levels, setLevels] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadLevels is stable
  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    setLoading(true);
    const data = await getClanLevels();
    setLevels(data);
    setLoading(false);
  }

  function handleEditClick(level: any) {
    setEditingId(level.id);
  }

  function handleCancel() {
    setEditingId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      id: editingId as string,
      level: Number(formData.get("level")),
      minUsers: Number(formData.get("minUsers")),
      minPro: Number(formData.get("minPro")),
      description: formData.get("description") as string,
    };

    // Optimistic update
    setEditingId(null);
    await upsertClanLevel(data);
    loadLevels();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              🏰 Clan Levels
            </h1>
            <p className="text-zinc-400">
              Manage clan level requirements and descriptions.
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSave}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
                      Level
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
                      Min Users
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
                      Min Premium
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {levels.map((level) => {
                    const isEditing = editingId === level.id;
                    return (
                      <tr
                        className={`group transition-colors ${
                          isEditing
                            ? "bg-blue-500/5"
                            : "hover:bg-zinc-800/40 cursor-pointer"
                        }`}
                        key={level.id}
                        onDoubleClick={() =>
                          !isEditing && handleEditClick(level)
                        }
                      >
                        {isEditing ? (
                          <>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-xl text-zinc-300">
                                {level.level}
                              </span>
                              <input
                                name="level"
                                type="hidden"
                                value={level.level}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                autoFocus
                                className="w-20 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-center text-zinc-100 focus:border-blue-500 outline-none"
                                defaultValue={level.minUsers}
                                name="minUsers"
                                type="number"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                className="w-20 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-center text-zinc-100 focus:border-blue-500 outline-none"
                                defaultValue={level.minPro}
                                name="minPro"
                                type="number"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <textarea
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:border-blue-500 outline-none min-h-[80px] resize-y"
                                defaultValue={level.description || ""}
                                name="description"
                                placeholder="Description (one benefit per line)"
                              />
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  className="p-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors"
                                  title="Save"
                                  type="submit"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                                  onClick={handleCancel}
                                  title="Cancel"
                                  type="button"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-200 font-bold border border-zinc-700">
                                {level.level}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-zinc-300 font-mono">
                              {level.minUsers}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-zinc-300 font-mono">
                              {level.minPro}
                            </td>
                            <td className="px-6 py-4 whitespace-pre-wrap text-sm text-zinc-400 min-w-[300px]">
                              {level.description || (
                                <span className="text-zinc-600 italic">
                                  No description
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="text-zinc-500 hover:text-blue-400 transition-colors"
                                  onClick={() => handleEditClick(level)}
                                  title="Edit"
                                  type="button"
                                >
                                  <Pencil size={16} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
          {levels.length === 0 && !loading && (
            <div className="p-12 text-center text-zinc-500">
              No clan levels found.
            </div>
          )}
          {loading && (
            <div className="p-12 text-center text-zinc-400 animate-pulse">
              Loading levels...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
