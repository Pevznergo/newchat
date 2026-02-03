"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createShortLink, getShortLinks } from "./actions";

// Helper to generate random code
function generateRandomCode(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function AdminLinksClient() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Search is currently static, kept for future use if needed
  const [search] = useState("");
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    code: "", // e.g. promo_summer
    targetUrl: "https://t.me/aporto_bot",
    stickerTitle: "ЧАТ СОСЕДЕЙ",
    stickerFeatures: "СКИДКИ/ЗНАКОМСТВА",
    stickerPrizes: "IPHONE/OZON",
  });

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const res = await getShortLinks(currentPage, limit, search);
    if (res.success && res.data) {
      setLinks(res.data);
      if (typeof res.total === "number") {
        setTotal(res.total);
      }
    }
    setLoading(false);
  }, [search, currentPage]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleCreate = async () => {
    setIsCreating(true);

    let codeToUse = formData.code;
    if (!codeToUse) {
      codeToUse = generateRandomCode();
      // Update state for UI consistency, though we use the local var for the API call
      setFormData((prev) => ({ ...prev, code: codeToUse }));
    }

    const res = await createShortLink({
      ...formData,
      code: codeToUse,
      targetUrl: `https://t.me/aporto_bot?start=${codeToUse}`,
    });

    setIsCreating(false);
    if (res.success) {
      toast.success("✅ Link created!");
      setFormData({
        code: "",
        targetUrl: "https://t.me/aporto_bot",
        stickerTitle: "ЧАТ СОСЕДЕЙ",
        stickerFeatures: "СКИДКИ/ЗНАКОМСТВА",
        stickerPrizes: "IPHONE/OZON",
      });
      fetchLinks();
    } else {
      toast.error(`❌ Error: ${res.error}`);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              🔗 Link Manager
            </h1>
            <p className="text-slate-500 mt-1">
              Manage QR codes and campaigns for stickers
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
            onClick={fetchLinks}
            type="button"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Create Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Plus className="text-indigo-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Create New Campaign
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label
                className="block text-xs font-semibold uppercase text-slate-500 tracking-wider"
                htmlFor="code"
              >
                Code (start_param)
              </label>
              <input
                className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                id="code"
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="Auto-generated if empty"
                value={formData.code}
              />
              <p className="text-[10px] text-slate-400">
                Leave empty to auto-generate
              </p>
            </div>
            <div className="space-y-2">
              <label
                className="block text-xs font-semibold uppercase text-slate-500 tracking-wider"
                htmlFor="title"
              >
                Sticker Title
              </label>
              <input
                className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                id="title"
                onChange={(e) =>
                  setFormData({ ...formData, stickerTitle: e.target.value })
                }
                placeholder="e.g. ЧАТ СОСЕДЕЙ"
                value={formData.stickerTitle}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-xs font-semibold uppercase text-slate-500 tracking-wider"
                htmlFor="features"
              >
                Features
              </label>
              <input
                className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                id="features"
                onChange={(e) =>
                  setFormData({ ...formData, stickerFeatures: e.target.value })
                }
                placeholder="e.g. СКИДКИ"
                value={formData.stickerFeatures}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-xs font-semibold uppercase text-slate-500 tracking-wider"
                htmlFor="prizes"
              >
                Prizes
              </label>
              <input
                className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                id="prizes"
                onChange={(e) =>
                  setFormData({ ...formData, stickerPrizes: e.target.value })
                }
                placeholder="e.g. IPHONE"
                value={formData.stickerPrizes}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isCreating}
              onClick={handleCreate}
              type="button"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Creating...
                </span>
              ) : (
                "Create Link"
              )}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-2">CODE</div>
            <div className="col-span-4">CAMPAIGN DETAILS</div>
            <div className="col-span-2 text-center">CLICKS</div>
            <div className="col-span-2">CREATED</div>
            <div className="col-span-2 text-right">ACTIONS</div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              links.map((link) => <LinkRow key={link.id} link={link} />)
            )}

            {!loading && links.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <div className="mb-2">📭</div>
                No links found. Create one above to get started.
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing {(currentPage - 1) * limit + 1} to{" "}
                {Math.min(currentPage * limit, total)} of {total} results
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 bg-white border border-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-slate-700 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="p-2 bg-white border border-slate-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkRow({ link }: { link: any }) {
  const [qrUrl, setQrUrl] = useState("");
  const botLink = `https://t.me/aporto_bot?start=${link.code}`;

  useEffect(() => {
    // Generate QR with good quality
    QRCodeLib.toDataURL(botLink, {
      width: 1024, // High res for download
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setQrUrl)
      .catch(console.error);
  }, [botLink]);

  const handleDownload = () => {
    if (!qrUrl) {
      return;
    }

    const linkElem = document.createElement("a");
    linkElem.href = qrUrl;
    linkElem.download = `${link.code}.png`;
    document.body.appendChild(linkElem);
    linkElem.click();
    document.body.removeChild(linkElem);
    toast.success("QR Code downloaded!");
  };

  return (
    <div className="p-4 grid grid-cols-12 gap-4 items-center text-sm hover:bg-slate-50 transition-colors group">
      <div className="col-span-2">
        <div
          className="font-mono font-bold text-indigo-600 truncate bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-100"
          title={link.code}
        >
          {link.code}
        </div>
      </div>
      <div className="col-span-4 truncate">
        <div className="font-semibold text-slate-800">{link.stickerTitle}</div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
          {link.stickerFeatures && (
            <span className="bg-slate-100 px-1.5 py-0.5 rounded">
              {link.stickerFeatures}
            </span>
          )}
          {link.stickerPrizes && (
            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded">
              {link.stickerPrizes}
            </span>
          )}
        </div>
      </div>
      <div className="col-span-2 text-center">
        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-full text-xs">
          {link.clicksCount} clicks
        </span>
      </div>
      <div className="col-span-2 text-xs text-slate-500">
        {new Date(link.createdAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        {/* Preview small QR */}
        {qrUrl && (
          <div className="relative group/qr">
            <Image
              alt="QR"
              className="w-8 h-8 border rounded p-0.5 bg-white object-contain"
              height={32}
              src={qrUrl}
              width={32}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/qr:block bg-white p-2 rounded shadow-lg border z-10 w-32">
              <Image
                alt="QR Large"
                className="w-full h-auto"
                height={128}
                src={qrUrl}
                width={128}
              />
            </div>
          </div>
        )}

        <button
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all text-xs font-medium"
          onClick={handleDownload}
          title="Download generic PNG"
          type="button"
        >
          <Download size={14} />
          PNG
        </button>
      </div>
    </div>
  );
}
