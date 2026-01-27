"use client";

import { Copy, Share2, Star, Users, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Mock Data (Replace with real data fetching later)
const MOCK_CLAN = {
  name: "My Awesome Clan",
  level: 1,
  members: 12,
  proMembers: 1,
  nextLevel: 2,
  progress: 60, // Percentage to next level
  nextLevelRequirements: "Need +3 Users",
  inviteCode: "CLAN-X1Y2Z3",
};

const LEVELS = [
  {
    level: 1,
    benefits: [
      { text: "15 Free Requests / week", icon: "⚡" },
      { text: "Basic Models Access", icon: "🤖" },
    ],
  },
  {
    level: 2,
    benefits: [
      { text: "30 Free Requests / week", icon: "⚡" },
      { text: "Priority Queue", icon: "🚀" },
    ],
  },
  {
    level: 3,
    benefits: [
      { text: "50 Free Requests / week", icon: "⚡" },
      { text: "3 Image Generations", icon: "🎨" },
      { text: "Access to GPT-4o mini", icon: "✨" },
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
  // In a real app, we would use Telegram WebApp initData to fetch user's clan
  const [clan, _setClan] = useState(MOCK_CLAN);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `https://t.me/GPTaporto_bot?start=clan_${clan.inviteCode}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    // Check if Telegram WebApp is available
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.switchInlineQuery(clan.inviteCode, [
        "users",
        "groups",
        "channels",
      ]);
    } else {
      // Fallback
      const url = `https://t.me/share/url?url=https://t.me/GPTaporto_bot?start=clan_${clan.inviteCode}&text=Join my clan!`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white p-4 font-sans">
      {/* Header */}
      <div className="flex flex-col items-center pt-8 pb-6">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
          <Zap className="w-10 h-10 text-white fill-white" />
        </div>
        <h1 className="text-2xl font-bold mb-1">{clan.name}</h1>
        <p className="text-gray-400 text-sm">Level {clan.level} Clan</p>
      </div>

      {/* Stats Card */}
      <div className="bg-[#2c2c2e] rounded-xl p-4 mb-6">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-3xl font-bold">{clan.level}</span>
            <span className="text-gray-400 text-sm ml-2">Current Level</span>
          </div>
          <div className="text-blue-400 text-sm font-medium">
            Level {clan.nextLevel}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-[#3a3a3c] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${clan.progress}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-[#3a3a3c]/50 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Members</div>
            <div className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              {clan.members}
            </div>
          </div>
          <div className="bg-[#3a3a3c]/50 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Pro Members</div>
            <div className="font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              {clan.proMembers}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500 text-center">
          {clan.nextLevelRequirements} to reach Level {clan.nextLevel}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="mb-8">
        <h3 className="text-gray-400 text-xs uppercase font-semibold mb-3 tracking-wider ml-1">
          Clan Benefits
        </h3>

        <div className="space-y-4">
          {LEVELS.map((lvl) => (
            <div
              className={cn(
                "relative border-l-2 pl-4 pb-4 last:pb-0",
                clan.level >= lvl.level ? "border-blue-500" : "border-[#3a3a3c]"
              )}
              key={lvl.level}
            >
              {/* Timeline Dot */}
              <div
                className={cn(
                  "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px]",
                  clan.level >= lvl.level
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-[#2c2c2e] border-[#3a3a3c] text-gray-500"
                )}
              >
                {clan.level >= lvl.level ? "✓" : lvl.level}
              </div>

              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    clan.level >= lvl.level ? "text-white" : "text-gray-500"
                  )}
                >
                  Level {lvl.level}
                </span>
                {clan.level >= lvl.level && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                    Unlocked
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {lvl.benefits.map((benefit) => (
                  <div
                    className="flex items-center gap-3 text-sm"
                    key={`${lvl.level}-${benefit.text}`}
                  >
                    <span className="text-base">{benefit.icon}</span>
                    <span
                      className={cn(
                        clan.level >= lvl.level
                          ? "text-gray-200"
                          : "text-gray-600"
                      )}
                    >
                      {benefit.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Link Section */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1c1c1e]/90 backdrop-blur-md border-t border-[#2c2c2e]">
        <div className="flex gap-2 mb-2">
          <div className="flex-1 bg-[#2c2c2e] rounded-lg px-3 py-3 text-sm text-gray-300 truncate font-mono">
            t.me/GPTaporto_bot?start=clan_{clan.inviteCode}
          </div>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-lg flex items-center justify-center transition-colors"
            onClick={handleCopy}
            type="button"
          >
            {copied ? "Copied!" : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <button
          className="w-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-blue-400 font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          onClick={handleShare}
          type="button"
        >
          <Share2 className="w-5 h-5" />
          Invite Friends
        </button>
      </div>

      {/* Padding for fixed bottom */}
      <div className="h-32" />
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
