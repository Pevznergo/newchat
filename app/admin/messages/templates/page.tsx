import Link from "next/link";
import { getMessageTemplates } from "@/lib/db/queries";

export default async function TemplatesListPage() {
	const templates = await getMessageTemplates({ isActive: true });

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Message Templates</h2>
					<p className="text-gray-600 mt-1">
						Create and manage reusable message templates
					</p>
				</div>
				<Link
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					href="/admin/messages/templates/new"
				>
					+ New Template
				</Link>
			</div>

			{/* Filters */}
			<div className="flex gap-4">
				<FilterButton active label="All" />
				<FilterButton label="Follow-up" />
				<FilterButton label="Broadcast" />
				<FilterButton label="Free Users" />
				<FilterButton label="Premium Users" />
			</div>

			{/* Templates List */}
			<div className="bg-white rounded-lg shadow">
				{templates.length === 0 ? (
					<div className="p-12 text-center">
						<div className="text-6xl mb-4">📝</div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">
							No templates yet
						</h3>
						<p className="text-gray-600 mb-6">
							Create your first message template to start sending automated
							messages
						</p>
						<Link
							className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							href="/admin/messages/templates/new"
						>
							Create Template
						</Link>
					</div>
				) : (
					<div className="overflow-hidden">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Name
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Type
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Audience
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Created
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{templates.map((template) => (
									<tr className="hover:bg-gray-50" key={template.id}>
										<td className="px-6 py-4">
											<div className="flex items-center">
												<div>
													<div className="font-medium text-gray-900">
														{template.name}
													</div>
													<div className="text-sm text-gray-500 truncate max-w-md">
														{template.content.substring(0, 80)}...
													</div>
												</div>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
												{template.templateType}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{template.targetAudience}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											{template.isActive ? (
												<span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
													Active
												</span>
											) : (
												<span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
													Inactive
												</span>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{new Date(template.createdAt).toLocaleDateString()}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
											<Link
												className="text-blue-600 hover:text-blue-900 mr-4"
												href={`/admin/messages/templates/${template.id}`}
											>
												Edit
											</Link>
											<button className="text-red-600 hover:text-red-900">
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

function FilterButton({
	label,
	active = false,
}: {
	label: string;
	active?: boolean;
}) {
	return (
		<button
			className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
				active
					? "bg-blue-600 text-white"
					: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
			}`}
		>
			{label}
		</button>
	);
}
