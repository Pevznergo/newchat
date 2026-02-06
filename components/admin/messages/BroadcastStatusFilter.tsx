"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function BroadcastStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";

  const statuses = [
    { value: "all", label: "All Statuses" },
    { value: "draft", label: "Draft" },
    { value: "scheduled", label: "Scheduled" },
    { value: "sending", label: "Sending" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
  ];

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5">
      <span className="text-sm text-zinc-400">Filter:</span>
      <select
        className="bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer"
        onChange={(e) => handleStatusChange(e.target.value)}
        value={currentStatus}
      >
        {statuses.map((status) => (
          <option
            className="bg-zinc-900"
            key={status.value}
            value={status.value}
          >
            {status.label}
          </option>
        ))}
      </select>
    </div>
  );
}
