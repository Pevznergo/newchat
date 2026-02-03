"use client";

import { Loader2, Plus, RefreshCw } from "lucide-react";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useState } from "react"; // Added useCallback
import { toast } from "sonner"; // Added sonner
import { createShortLink, getShortLinks } from "./actions";

export default function AdminLinksClient() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search] = useState("");
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
    const res = await getShortLinks(1, 100, search);
    if (res.success && res.data) {
      setLinks(res.data);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]); // Fixed dependency

  const handleCreate = async () => {
    if (!formData.code) {
      toast.error("Code is required");
      return;
    }
    setIsCreating(true);

    const res = await createShortLink({
      ...formData,
      targetUrl: `https://t.me/aporto_bot?start=${formData.code}`,
    });

    setIsCreating(false);
    if (res.success) {
      toast.success("✅ Link created!");
      setFormData({ ...formData, code: "" }); // reset code
      fetchLinks();
    } else {
      toast.error(`❌ Error: ${res.error}`); // Fixed template literal
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">🔗 Link Manager & QR Codes</h1>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded hover:bg-slate-100"
            onClick={fetchLinks}
            type="button"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Create Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Plus size={20} /> Create New Campaign
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="code">
                Code (start_param)
              </label>
              <input
                className="w-full border p-2 rounded"
                id="code"
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="e.g. district_central_1"
                value={formData.code}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="title">
                Sticker Title (Source)
              </label>
              <input
                className="w-full border p-2 rounded"
                id="title"
                onChange={(e) =>
                  setFormData({ ...formData, stickerTitle: e.target.value })
                }
                placeholder="e.g. ЧАТ СОСЕДЕЙ"
                value={formData.stickerTitle}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="features"
              >
                Features (Campaign)
              </label>
              <input
                className="w-full border p-2 rounded"
                id="features"
                onChange={(e) =>
                  setFormData({ ...formData, stickerFeatures: e.target.value })
                }
                placeholder="e.g. СКИДКИ"
                value={formData.stickerFeatures}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="prizes"
              >
                Prizes (Content)
              </label>
              <input
                className="w-full border p-2 rounded"
                id="prizes"
                onChange={(e) =>
                  setFormData({ ...formData, stickerPrizes: e.target.value })
                }
                placeholder="e.g. IPHONE"
                value={formData.stickerPrizes}
              />
            </div>
          </div>
          <button
            className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            disabled={isCreating}
            onClick={handleCreate}
            type="button"
          >
            {isCreating ? "Creating..." : "Create Link"}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-slate-50 font-medium grid grid-cols-12 gap-4 text-sm text-slate-500">
            <div className="col-span-2">CODE</div>
            <div className="col-span-3">TITLE / SOURCE</div>
            <div className="col-span-1 text-center">CLICKS</div>
            <div className="col-span-2">CREATED</div>
            <div className="col-span-2">ACTIONS</div>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="animate-spin text-indigo-500" />
            </div>
          ) : (
            links.map((link) => <LinkRow key={link.id} link={link} />)
          )}

          {!loading && links.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              No links found. Create one above.
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
    QRCodeLib.toDataURL(botLink, { width: 300, margin: 2 })
      .then(setQrUrl)
      .catch(console.error);
  }, [botLink]);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
                <html>
                   <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
                      <h1>${link.stickerTitle}</h1>
                      <img src="${qrUrl}" width="300" />
                      <p>${link.stickerFeatures}</p>
                      <p>${link.code}</p>
                      <script>window.print();</script>
                   </body>
                </html>
             `);
      win.document.close();
    }
  };

  return (
    <div className="p-4 border-b last:border-0 grid grid-cols-12 gap-4 items-center text-sm hover:bg-slate-50 transition-colors">
      <div
        className="col-span-2 font-mono font-bold text-indigo-600 truncate"
        title={link.code}
      >
        {link.code}
      </div>
      <div className="col-span-3 truncate">
        <div className="font-semibold">{link.stickerTitle}</div>
        <div className="text-xs text-slate-500">{link.stickerFeatures}</div>
      </div>
      <div className="col-span-1 text-center font-bold text-slate-700">
        {link.clicksCount}
      </div>
      <div className="col-span-2 text-xs text-slate-500">
        {new Date(link.createdAt).toLocaleDateString()}
      </div>
      <div className="col-span-2 flex gap-2">
        {qrUrl ? (
          // biome-ignore lint/performance/noImgElement: QR code data URI
          <img
            alt="QR"
            className="w-10 h-10 border rounded p-1 bg-white"
            src={qrUrl}
          />
        ) : (
          <div className="w-10 h-10 bg-slate-100 rounded animate-pulse" />
        )}

        <button
          className="p-2 border rounded hover:bg-white bg-slate-50 text-xs"
          onClick={handlePrint}
          type="button"
        >
          Print / View
        </button>
      </div>
    </div>
  );
}
