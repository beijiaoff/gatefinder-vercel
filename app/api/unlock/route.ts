import { isEditorPasswordValid } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.EDITOR_PASSWORD_HASH) {
    return Response.json(
      { unlocked: false, error: "服务器尚未配置编辑密码" },
      { status: 503 },
    );
  }
  const payload = (await request.json().catch(() => ({}))) as {
    password?: string;
  };
  const valid = await isEditorPasswordValid(payload.password ?? "");
  return Response.json(
    valid ? { unlocked: true } : { unlocked: false, error: "密码不正确" },
    { status: valid ? 200 : 401 },
  );
}
