import { type NextRequest, NextResponse } from "next/server";
import {
  deleteMessageTemplate,
  getMessageTemplateById,
  updateMessageTemplate,
} from "@/lib/db/queries";

// GET /api/admin/messages/templates/[id]
// Get a single template by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const template = await getMessageTemplateById(id);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error(`GET /api/admin/messages/templates/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/messages/templates/[id]
// Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const template = await updateMessageTemplate(id, body);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error(`PUT /api/admin/messages/templates/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/messages/templates/[id]
// Soft delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const success = await deleteMessageTemplate(id);

    if (!success) {
      return NextResponse.json(
        { error: "Template not found or delete failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/admin/messages/templates/${id} error:`, error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
