import Link from "next/link";

export default function MessagesAdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900">
						📨 Messaging System
					</h1>
					<p className="mt-2 text-gray-600">
						Manage message templates, follow-up rules, and broadcast campaigns
					</p>
				</div>

				{/* Navigation Tabs */}
				<div className="border-b border-gray-200 mb-8">
					<nav className="-mb-px flex space-x-8">
						<TabLink href="/admin/messages" label="📊 Dashboard" />
						<TabLink href="/admin/messages/templates" label="📝 Templates" />
						<TabLink href="/admin/messages/follow-ups" label="⏱️ Follow-ups" />
						<TabLink href="/admin/messages/broadcasts" label="📢 Broadcasts" />
					</nav>
				</div>

				{/* Content */}
				{children}
			</div>
		</div>
	);
}

function TabLink({ href, label }: { href: string; label: string }) {
	return (
		<Link
			className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors"
			href={href}
		>
			{label}
		</Link>
	);
}
