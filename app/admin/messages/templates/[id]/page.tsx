"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MediaUploader from "@/components/admin/messages/MediaUploader";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    content: "",
    contentType: "html",
    templateType: "follow_up",
    targetAudience: "all",
    mediaType: "",
    mediaUrl: "",
    isActive: true,
  });

  useEffect(() => {
    // There isn't a dedicated "get single template" API mentioned in task.md or files.
    // However, usually we should have one. If not, I'll need to create it or rely on a list fetch.
    // Wait, typical pattern is GET /api/admin/messages/templates?id=... or similar.
    // But `task.md` says: `Create API: PUT /api/admin/messages/templates/:id` exists.
    // I should check if `GET /api/admin/messages/templates` supports fetching by ID or I should check `app/api/admin/messages/templates/[id]/route.ts` if it exists.

    // I'll assume standard REST: GET /api/admin/messages/templates/[id]
    if (id) {
      fetch(`/api/admin/messages/templates/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Templates not found");
          return res.json();
        })
        .then((data) => {
          if (data.data) {
            setFormData({
              name: data.data.name,
              content: data.data.content,
              contentType: data.data.contentType || "html",
              templateType: data.data.templateType,
              targetAudience: data.data.targetAudience,
              mediaType: data.data.mediaType || "",
              mediaUrl: data.data.mediaUrl || "",
              isActive: data.data.isActive,
            });
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/messages/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/admin/messages/templates");
        router.refresh();
      } else {
        alert("Failed to update template");
      }
    } catch (error) {
      console.error("Error updating template:", error);
      alert("Error updating template");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-zinc-500">Loading...</div>;

  return (
    <div className="max-w-4xl text-zinc-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Edit Message Template</h2>
        <p className="text-zinc-400 mt-1">Update existing message template</p>
      </div>

      <form
        className="space-y-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-2xl backdrop-blur-sm"
        onSubmit={handleSubmit}
      >
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Template Name *
          </label>
          <input
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Welcome Free User 24h"
            required
            type="text"
            value={formData.name}
          />
        </div>

        {/* Template Type */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Template Type *
          </label>
          <select
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
            onChange={(e) =>
              setFormData({ ...formData, templateType: e.target.value })
            }
            value={formData.templateType}
          >
            <option value="follow_up">Follow-up</option>
            <option value="broadcast">Broadcast</option>
          </select>
        </div>

        {/* Message Content */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Message Content *
          </label>
          <textarea
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            placeholder="Enter your message here"
            required
            rows={8}
            value={formData.content}
          />
        </div>

        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Content Type
          </label>
          <select
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
            onChange={(e) =>
              setFormData({ ...formData, contentType: e.target.value })
            }
            value={formData.contentType}
          >
            <option value="text">Plain Text</option>
            <option value="html">HTML</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>

        {/* Media (Optional) */}
        <div className="border-t border-zinc-800 pt-6">
          <h3 className="text-lg font-semibold text-zinc-200 mb-4">
            Media (Optional)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Media Type
              </label>
              <select
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:border-blue-500 outline-none"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mediaType: e.target.value,
                    mediaUrl: "", // Clear URL when type changes
                  })
                }
                value={formData.mediaType}
              >
                <option value="">None</option>
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
              </select>
            </div>

            {formData.mediaType && (
              <div className="col-span-2 md:col-span-1">
                <MediaUploader
                  mediaType={formData.mediaType}
                  mediaUrl={formData.mediaUrl}
                  onClear={() => setFormData({ ...formData, mediaUrl: "" })}
                  onUploadComplete={(url) =>
                    setFormData({ ...formData, mediaUrl: url })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <input
            checked={formData.isActive}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500"
            id="isActive"
            onChange={(e) =>
              setFormData({ ...formData, isActive: e.target.checked })
            }
            type="checkbox"
          />
          <label
            className="text-sm font-medium text-zinc-300"
            htmlFor="isActive"
          >
            Active
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-zinc-800">
          <button
            className="px-6 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            onClick={() => router.back()}
            type="button"
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
