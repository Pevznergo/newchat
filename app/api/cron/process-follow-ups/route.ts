import { type NextRequest, NextResponse } from "next/server";
import {
  getActiveFollowUpRules,
  getUsersForFollowUp,
  hasReceivedFollowUp,
  scheduleMessage,
} from "@/lib/db/messaging-queries";

// Cron job to process follow-up rules
// Schedule: Every 10 minutes via Vercel Cron or external scheduler

export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await getActiveFollowUpRules();
    let totalProcessed = 0;

    for (const ruleRow of rules) {
      if (!ruleRow.FollowUpRule || !ruleRow.MessageTemplate) continue;

      const rule = ruleRow.FollowUpRule;
      const template = ruleRow.MessageTemplate;

      // Find eligible users for this rule
      const usersToTarget = await getUsersForFollowUp({
        triggerType: rule.triggerType,
        triggerDelayHours: rule.triggerDelayHours,
        targetAudience:
          rule.targetAudience || template.targetAudience || undefined,
        conditions: rule.conditions,
      });

      // Schedule messages for eligible users
      for (const user of usersToTarget) {
        // Check if already received this follow-up
        const alreadyReceived = await hasReceivedFollowUp(user.id, rule.id);

        if (!alreadyReceived) {
          await scheduleMessage({
            userId: user.id,
            templateId: template.id,
            followUpRuleId: rule.id,
            sendType: "follow_up",
            scheduledAt: new Date(),
          });

          totalProcessed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      rulesChecked: rules.length,
    });
  } catch (error) {
    console.error("Follow-up processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
