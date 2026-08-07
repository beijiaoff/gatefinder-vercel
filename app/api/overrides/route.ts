import { isEditorPasswordValid } from "@/lib/auth";
import { listOverrides, saveOverrides } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const prefix = new URL(request.url).searchParams.get("prefix") ?? "";
    const overrides = await listOverrides(prefix);
    return Response.json({ overrides });
  } catch (error) {
    console.error("Failed to load cell overrides", error);
    return Response.json({ overrides: [], error: "修改数据暂时不可用" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const password = request.headers.get("x-editor-password") ?? "";
  if (!(await isEditorPasswordValid(password))) {
    return Response.json({ error: "编辑已锁定，请重新解锁" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => ({}))) as {
    changes?: Array<{ recordId: string; fieldKey: string; value: string }>;
  };
  const changes = payload.changes ?? [];
  if (!changes.length || changes.length > 5000) {
    return Response.json(
      { error: "没有可保存的修改，或单次修改数量过多" },
      { status: 400 },
    );
  }
  try {
    await saveOverrides(changes);
    return Response.json({ saved: changes.length });
  } catch (error) {
    console.error("Failed to save cell overrides", error);
    return Response.json({ error: "保存失败，请稍后再试" }, { status: 503 });
  }
}
