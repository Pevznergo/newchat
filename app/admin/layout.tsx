import { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // TODO: Add real auth check here
  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 text-gray-900">
       <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
         <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <nav className="flex gap-4 text-sm font-medium text-gray-600">
                <Link href="/admin/models" className="hover:text-black">AI Models</Link>
                {/* Add more links here */}
            </nav>
         </div>
         <div>
             {/* User info or logout */}
         </div>
       </header>
       <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
