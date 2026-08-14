import { getSiteStats, recordSiteStat } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return Response.json(await getSiteStats(), { headers: noStoreHeaders });
  } catch (error) {
    console.error("Failed to load site statistics", error);
    return Response.json({ error: "访问统计暂时不可用" }, { status: 503, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    event?: string;
    newDailyVisitor?: boolean;
  };
  if (payload.event !== "view" && payload.event !== "search") {
    return Response.json({ error: "无效的统计事件" }, { status: 400, headers: noStoreHeaders });
  }
  try {
    const stats = await recordSiteStat(
      payload.event,
      payload.event === "view" && payload.newDailyVisitor === true,
    );
    return Response.json(stats, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Failed to update site statistics", error);
    return Response.json({ error: "访问统计暂时不可用" }, { status: 503, headers: noStoreHeaders });
  }
}
