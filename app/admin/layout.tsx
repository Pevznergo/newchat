import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/app/(auth)/auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  noStore();
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.email !== "pevznergo@gmail.com") {
    // Or prompt specific error page
    redirect("/");
  }

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <nav className="flex gap-4 text-sm font-medium text-gray-600">
            <Link className="hover:text-black" href="/admin/models">
              AI Models
            </Link>
            {/* Add more links here */}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{session.user.email}</span>
          {/* Could add logout button form here if needed */}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
