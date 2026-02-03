import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";

const ALLOWED_EMAILS = ["pevznergo@gmail.com"];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!ALLOWED_EMAILS.includes(session.user.email)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
        <p className="text-sm text-gray-500 mt-2">
          Signed in as: {session.user.email}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        <div className="flex gap-4">
          <span className="text-sm opacity-70">{session.user.email}</span>
          <a className="hover:underline" href="/admin/links">
            Links
          </a>
          <a className="hover:underline" href="/admin/models">
            Models
          </a>
          <a className="hover:underline" href="/admin">
            Dashboard
          </a>
        </div>
      </header>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}
