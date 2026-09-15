import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { hasServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";
const SECRET_NAME = "luma_openai_api_key";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspace_id") || "";
    const ctx = await getServerContext(workspaceId);
    const configured = await hasServerSecret(ctx.admin, SECRET_NAME);
    return NextResponse.json({ ok: true, configured, source: process.env.OPENAI_API_KEY ? "vercel" : configured ? "secure-vault" : "none", can_configure: ctx.platformAdmin });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to read OpenAI integration status." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const apiKey = String(body.api_key || "").trim();
    const ctx = await getServerContext(workspaceId);
    if (!ctx.platformAdmin) return NextResponse.json({ ok: false, error: "Hanya platform admin yang dapat mengubah OpenAI API key." }, { status: 403 });
    if (!apiKey || apiKey.length < 20) return NextResponse.json({ ok: false, error: "API key tidak valid." }, { status: 400 });

    const { error } = await ctx.admin.rpc("luma_set_server_secret", {
      p_name: SECRET_NAME,
      p_secret: apiKey,
      p_description: "LUMA OpenAI API key",
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, configured: true, source: "secure-vault" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to save OpenAI API key." }, { status: 400 });
  }
}
