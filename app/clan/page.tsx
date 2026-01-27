"use client";

import { Check, Copy, Pencil, Share2, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Mock Data
const MOCK_CLAN = {
  name: "My Awesome Clan",
  level: 1,
  members: 12,
  proMembers: 1,
  nextLevel: 2,
  progress: 60,
  nextLevelRequirements: "NEED 3 MORE USERS",
  inviteCode: "CLAN-X1Y2Z3",
  isOwner: true, // Mock owner status
};

const LEVELS = [
  {
    level: 1,
    benefits: [
      { text: "15 Free Requests / week", icon: "⚡" },
      { text: "Basic Models Access", icon: "🤖" },
      { text: "7 colors for clan name", icon: "🎨" },
    ],
  },
  {
    level: 2,
    benefits: [
      { text: "30 Free Requests / week", icon: "⚡" },
      { text: "Priority Queue", icon: "🚀" },
      { text: "7 color schemes for links", icon: "🔗" },
    ],
  },
  {
    level: 3,
    benefits: [
      { text: "50 Free Requests / week", icon: "⚡" },
      { text: "3 Image Generations", icon: "🎨" },
      { text: "Auto-translate messages", icon: "🌐" },
    ],
  },
  {
    level: 5,
    benefits: [
      { text: "Unlimited GPT-5 Nano", icon: "♾️" },
      { text: "Unlimited Gemini Flash", icon: "♾️" },
      { text: "10 Image Generations", icon: "🎨" },
    ],
  },
];

export default function ClanPage() {
  const [clan, _setClan] = useState(MOCK_CLAN);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(clan.name);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `https://t.me/GPTaporto_bot?start=clan_${clan.inviteCode}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.switchInlineQuery(clan.inviteCode, [
        "users",
        "groups",
        "channels",
      ]);
    } else {
      const url = `https://t.me/share/url?url=https://t.me/GPTaporto_bot?start=clan_${clan.inviteCode}&text=Join my clan!`;
      window.open(url, "_blank");
    }
  };

  const saveName = () => {
    // In real app, call API here
    _setClan((prev) => ({ ...prev, name: editedName }));
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white font-sans overflow-x-hidden selection:bg-blue-500/30">
      {/* Header */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {/* Custom Abstract Icon mostly matching the 'white geometric shape' in screenshot */}
          <div className="relative w-16 h-16">
            <Zap
              className="w-16 h-16 text-white rotate-12 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              fill="currentColor"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Title / Edit */}
        <div className="flex items-center justify-center gap-2 mb-2 w-full max-w-sm">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 bg-[#2c2c2e] rounded-lg p-1 ring-2 ring-blue-500">
              <input
                autoFocus
                className="bg-transparent border-none outline-none text-xl font-bold text-center w-full px-2"
                onChange={(e) => setEditedName(e.target.value)}
                type="text"
                value={editedName}
              />
              <button
                className="p-2 bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
                onClick={saveName}
                type="button"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-center leading-tight tracking-tight">
                {clan.name}
              </h1>
              {clan.isOwner && (
                <button
                  className="p-1.5 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10"
                  onClick={() => setIsEditing(true)}
                  type="button"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        <p className="text-gray-400 text-sm text-center max-w-xs mx-auto mb-8 leading-relaxed">
          Clan members boost the group level and unlock additional
          possibilities.
        </p>

        {/* Level Stats Bar */}
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-blue-300 font-medium mb-2 px-1">
            <span>Level {clan.level}</span>
            <span>Level {clan.nextLevel}</span>
          </div>

          {/* Progress Track */}
          <div className="h-[6px] bg-[#2c2c2e] rounded-full overflow-hidden w-full relative">
            {/* Active Progress */}
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(96,165,250,0.5)]"
              style={{ width: `${clan.progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 px-1">
            <div className="flex gap-3">
              <span>~{clan.members} Members</span>
              <span>~{clan.proMembers} Pro</span>
            </div>
            <span>{clan.nextLevelRequirements}</span>
          </div>
        </div>
      </div>

      {/* Benefits List */}
      <div className="px-4 pb-32 max-w-sm mx-auto">
        <div className="space-y-8">
          {LEVELS.map((lvl) => (
            <div
              className={cn(
                "transition-opacity duration-300",
                clan.level >= lvl.level
                  ? "opacity-100"
                  : "opacity-50 grayscale-[0.5]"
              )}
              key={lvl.level}
            >
              {/* Pill Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#2c2c2e]" />
                <div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-[#7059e3] to-[#9c71e8] text-white text-xs font-bold shadow-lg shadow-purple-900/40">
                  Available at Level {lvl.level}:
                </div>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#2c2c2e]" />
              </div>

              {/* Benefits Items */}
              <div className="space-y-4 px-2">
                {lvl.benefits.map((benefit) => (
                  <div
                    className="flex items-start gap-4"
                    key={`${lvl.level}-${benefit.text}`}
                  >
                    <div className="w-6 h-6 rounded-full border border-blue-400/30 flex items-center justify-center bg-blue-500/10 shrink-0">
                      {/* Placeholder for specific icons, using emoji for now as per design text */}
                      <span className="text-xs">{benefit.icon}</span>
                      {/* Alternatively can use Lucide icons dynamically if mapped */}
                    </div>
                    <div className="text-sm font-medium leading-tight pt-1">
                      {benefit.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Invite */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1c1c1e] border-t border-[#2c2c2e]/50 backdrop-blur-xl z-10 pb-8">
        <div className="max-w-md mx-auto space-y-3">
          <div className="bg-[#2c2c2e] p-1 rounded-xl flex items-center gap-2 pr-2">
            <div className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-300 truncate font-mono outline-none">
              t.me/GPTaporto_bot?start=clan_{clan.inviteCode}
            </div>
            {/* Circle Button for Copy */}
            <button
              className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
              onClick={handleCopy}
              type="button"
            >
              {copied ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Copy className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          <button
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)] active:scale-[0.98]"
            onClick={handleShare}
            type="button"
          >
            <Share2 className="w-5 h-5" />
            Share Link
          </button>

          <div className="text-center">
            <button
              className="text-[11px] text-[#5e8ee0] hover:text-blue-300 transition-colors flex items-center justify-center gap-1 mx-auto"
              type="button"
            >
              <Zap className="w-3 h-3" fill="currentColor" />
              Voices in exchange for gifts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global declaration for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        switchInlineQuery: (query: string, types?: string[]) => void;
      };
    };
  }
}
