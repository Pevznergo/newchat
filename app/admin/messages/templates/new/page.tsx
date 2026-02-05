"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    contentType: "html",
    templateType: "follow_up",
    targetAudience: "all",
    mediaType: "",
    mediaUrl: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/messages/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/admin/messages/templates");
      } else {
        alert("Failed to create template");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      alert("Error creating template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Create Message Template</h2>
        <p className="text-gray-600 mt-1">
          Design a reusable message template for follow-ups or broadcasts
        </p>
      </div>

      <form
        className="space-y-6 bg-white rounded-lg shadow p-6"
        onSubmit={handleSubmit}
      >
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template Name *
          </label>
          <input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Welcome Free User 24h"
            required
            type="text"
            value={formData.name}
          />
        </div>

        {/* Template Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Type *
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onChange={(e) =>
                setFormData({ ...formData, templateType: e.target.value })
              }
              value={formData.templateType}
            >
              <option value="follow_up">Follow-up</option>
              <option value="broadcast">Broadcast</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience *
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onChange={(e) =>
                setFormData({ ...formData, targetAudience: e.target.value })
              }
              value={formData.targetAudience}
            >
              <option value="all">All Users</option>
              <option value="free">Free Users Only</option>
              <option value="premium">Premium Users Only</option>
            </select>
          </div>
        </div>

        {/* Message Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Content *
          </label>
          <textarea
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            placeholder="Enter your message here. You can use HTML tags if content type is HTML."
            required
            rows={8}
            value={formData.content}
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports HTML formatting. Use &lt;b&gt; for bold, &lt;i&gt; for
            italic, etc.
          </p>
        </div>

        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Type
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Media (Optional)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Media Type
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onChange={(e) =>
                  setFormData({ ...formData, mediaType: e.target.value })
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Media URL
                </label>
                <input
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onChange={(e) =>
                    setFormData({ ...formData, mediaUrl: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                  type="url"
                  value={formData.mediaUrl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <button
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => router.back()}
            type="button"
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "Creating..." : "Create Template"}
          </button>
        </div>
      </form>
    </div>
  );
}
