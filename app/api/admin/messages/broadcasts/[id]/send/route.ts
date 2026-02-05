import { type NextRequest, NextResponse } from "next/server";
import { startBroadcastCampaign } from "@/lib/db/messaging-queries";

// POST /api/admin/messages/broadcasts/[id]/send
// Start sending a broadcast campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const campaign = await startBroadcastCampaign(id);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found or failed to start" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: campaign,
      message: `Campaign started. Sending to ${campaign.totalRecipients} users.`,
    });
  } catch (error) {
    console.error(
      `POST /api/admin/messages/broadcasts/${id}/send error:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to start campaign" },
      { status: 500 }
    );
  }
}
