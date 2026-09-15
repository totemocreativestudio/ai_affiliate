import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { hasServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";
const SECRET_KEY = "luma_xendit_secret_key";
const WEBHOOK_TOKEN = "luma_xendit_webhook_token";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspace_id") || "";
    const ctx = await getServerContext(workspaceId);
    const [secretConfigured, webhookConfigured] = await Promise.all([
      hasServerSecret(ctx.admin, SECRET_KEY),
      hasServerSecret(ctx.admin, WEBHOOK_TOKEN),
    ]);
    return NextResponse.json({
      ok: true,
      configured: secretConfigured,
      webhook_configured: webhookConfigured,
      source: process.env.XENDIT_SECRET_KEY ? "vercel" : secretConfigured ? "secure-vault" : "none",
      can_configure: ctx.platformAdmin,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to read Xendit integration status." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const secretKey = String(body.secret_key || "").trim();
    const webhookToken = String(body.webhook_token || "").trim();
    const ctx = await getServerContext(workspaceId);
    if (!ctx.platformAdmin) return NextResponse.json({ ok: false, error: "Hanya platform admin yang dapat mengubah payment gateway." }, { status: 403 });
    if (!secretKey || secretKey.length < 20) return NextResponse.json({ ok: false, error: "Xendit secret key tidak valid." }, { status: 400 });

    const saveSecret = ctx.admin.rpc("luma_set_server_secret", { p_name: SECRET_KEY, p_secret: secretKey, p_description: "LUMA Xendit secret API key" });
    const saveWebhook = webhookToken
      ? ctx.admin.rpc("luma_set_server_secret", { p_name: WEBHOOK_TOKEN, p_secret: webhookToken, p_description: "LUMA Xendit webhook verification token" })
      : Promise.resolve({ error: null } as any);
    const [a,b] = await Promise.all([saveSecret,saveWebhook]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    return NextResponse.json({ ok: true, configured: true, webhook_configured: Boolean(webhookToken) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to save Xendit integration." }, { status: 400 });
  }
}
