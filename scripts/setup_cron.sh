#!/bin/bash
set -e

echo "⏰ Setting up cron job..."

# SECRET matches the one in deploy.sh
SECRET="a7ab21860984bcb13fbe46841168132b"

# Define commands
STATS_CMD="curl -L -c /tmp/cron_cookies.txt -b /tmp/cron_cookies.txt -H 'Authorization: Bearer $SECRET' -s http://localhost:3000/api/cron/stats >> /dev/null 2>&1"
RENEWAL_CMD="curl -L -c /tmp/cron_cookies.txt -b /tmp/cron_cookies.txt -H 'Authorization: Bearer $SECRET' -s http://localhost:3000/api/cron/subscription-renewal >> /dev/null 2>&1"
SEND_MESSAGES_CMD="curl -L -c /tmp/cron_cookies.txt -b /tmp/cron_cookies.txt -H 'Authorization: Bearer $SECRET' -s http://localhost:3000/api/cron/send-messages >> /dev/null 2>&1"
PROCESS_FOLLOW_UPS_CMD="curl -L -c /tmp/cron_cookies.txt -b /tmp/cron_cookies.txt -H 'Authorization: Bearer $SECRET' -s http://localhost:3000/api/cron/process-follow-ups >> /dev/null 2>&1"

STATS_JOB="0 7,19 * * * $STATS_CMD"
RENEWAL_JOB="0 9 * * * $RENEWAL_CMD"
SEND_MESSAGES_JOB="* * * * * $SEND_MESSAGES_CMD"
FOLLOW_UP_JOB="*/10 * * * * $PROCESS_FOLLOW_UPS_CMD"

# Combine jobs
ALL_JOBS="$STATS_JOB
$RENEWAL_JOB
$SEND_MESSAGES_JOB
$FOLLOW_UP_JOB"

# Update crontab
echo "🔄 Updating crontab..."
# Remove old api/cron jobs and add new ones
(crontab -l 2>/dev/null | grep -v "api/cron/"; echo "$ALL_JOBS") | crontab -

echo "✅ Cron jobs updated successfully."
crontab -l
