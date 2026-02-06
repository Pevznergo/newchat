import { type NextRequest, NextResponse } from "next/server";
import {
  getFollowUpRule,
  updateFollowUpRule,
} from "@/lib/db/messaging-queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rule = await getFollowUpRule(id);

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error("Error fetching rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch rule" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateFollowUpRule(id, {
      templateId: body.templateId,
      triggerType: body.triggerType,
      triggerDelayHours: body.triggerDelayHours,
      conditions: body.conditions,
      targetAudience: body.targetAudience,
      maxSendsPerUser: body.maxSendsPerUser,
      priority: body.priority,
      isActive: body.isActive,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating rule:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}
