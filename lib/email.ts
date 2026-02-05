import { Resend } from "resend";
import type { DailyStats } from "./stats";

const resend = new Resend(
	process.env.RESEND_API_KEY || "re_6wsXoaT7_3Bju3UzLcsxxN88CkqcRWojs",
); // Use env or fallback provided by user

export async function sendDailyStatsEmail(stats: DailyStats) {
	try {
		const {
			totalUsers,
			newUsers24h,
			activeUsers24h,
			clicks24h,
			clickHistory,
			growthHistory,
			tariffBreakdown,
		} = stats;

		// Generate Chart URL (Dual Axis: Users & Clicks)
		const chartConfig = {
			type: "bar",
			data: {
				labels: ["-6d", "-5d", "-4d", "-3d", "-2d", "Yesterday", "Today"],
				datasets: [
					{
						type: "line",
						label: "User Growth",
						borderColor: "#10b981",
						borderWidth: 2,
						fill: false,
						data: growthHistory,
						yAxisID: "y-users",
					},
					{
						type: "bar",
						label: "Clicks (Scan)",
						backgroundColor: "rgba(59, 130, 246, 0.5)",
						data: clickHistory,
						yAxisID: "y-clicks",
					},
				],
			},
			options: {
				legend: { display: true },
				title: { display: true, text: "Weekly Growth & Scans" },
				scales: {
					yAxes: [
						{
							id: "y-users",
							type: "linear",
							position: "left",
							ticks: { beginAtZero: true, fontColor: "#10b981" },
						},
						{
							id: "y-clicks",
							type: "linear",
							position: "right",
							ticks: { beginAtZero: true, fontColor: "#3b82f6" },
							gridLines: { drawOnChartArea: false },
						},
					],
				},
			},
		};
		const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
			JSON.stringify(chartConfig),
		)}&w=500&h=300`;

		// Simple HTML content
		const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333;">📊 Daily Bot Statistics</h2>
        <p style="color: #666; font-size: 14px;">Report for ${new Date().toLocaleDateString()}</p>
        
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #0070f3;">${totalUsers}</div>
            <div style="font-size: 12px; color: #888;">Total Users</div>
          </div>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center;">
             <div style="font-size: 24px; font-weight: bold; color: #10b981;">+${newUsers24h}</div>
             <div style="font-size: 12px; color: #888;">New (24h)</div>
          </div>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center;">
             <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${activeUsers24h}</div>
             <div style="font-size: 12px; color: #888;">Active (24h)</div>
          </div>
        </div>

        <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 10px;">
           <div style="background: #eff6ff; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #dbeafe;">
             <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${clicks24h}</div>
             <div style="font-size: 12px; color: #60a5fa;">QR/UTM Clicks (24h)</div>
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <img src="${chartUrl}" alt="Growth Chart" style="max-width: 100%; border-radius: 8px;" />
        </div>

          <h3 style="margin: 0 0 10px; font-size: 16px;">💎 Tariff Distribution</h3>
          <p style="margin: 5px 0;">Free Users: <b>${tariffBreakdown.free}</b></p>
          <p style="margin: 5px 0;">Premium/Pro: <b>${tariffBreakdown.premium}</b></p>
        </div>

        ${
					stats.sources.length > 0
						? `
        <div style="margin-top: 20px; padding: 15px; background: #fff; border-top: 1px solid #eee;">
          <h3 style="margin: 0 0 10px; font-size: 16px;">🔗 Top Sources (QR/UTM)</h3>
          <table style="width: 100%; text-align: left; font-size: 14px;">
            ${stats.sources
							.map(
								(s) => `
              <tr>
                <td style="padding: 4px 0; color: #555;">${s.source}</td>
                <td style="padding: 4px 0; font-weight: bold; text-align: right;">${s.count}</td>
              </tr>
            `,
							)
							.join("")}
          </table>
        </div>
        `
						: ""
				}

        <div style="margin-top: 30px; font-size: 12px; color: #aaa; text-align: center;">
          Sent via Resend | <a href="#">Unsubscribe</a>
        </div>
      </div>
    `;

		const data = await resend.emails.send({
			from: "Aporto Bot <onboarding@resend.dev>", // Default Resend testing sender. Verified domain required for custom.
			to: ["pevznergo@gmail.com"],
			subject: `📈 Statistics: +${newUsers24h} New Users`,
			html: htmlContent,
		});

		console.log("Email sent successfully:", data);
		return { success: true, data };
	} catch (error) {
		console.error("Failed to send email:", error);
		return { success: false, error };
	}
}
