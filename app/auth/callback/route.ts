import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";

export const runtime = "nodejs";

const PROD_ORIGIN = "https://app.lumaway.online";

function safeNext(value: string | null) {
  const next = String(value || "/dashboard").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function requestOrigin(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return new URL(request.url).origin;
  const forwardedHost = String(request.headers.get("x-forwarded-host") || "").split(",")[0].trim().toLowerCase();
  if (forwardedHost === "app.lumaway.online") return PROD_ORIGIN;
  return PROD_ORIGIN;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const host = String(request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  const code = url.searchParams.get("code");
  // Do not exchange a PKCE code on the marketing origin: the resulting auth
  // cookies would be scoped to www.lumaway.online and disappear on app redirect.
  if (process.env.NODE_ENV !== "development" && host && host !== "app.lumaway.online") {
    const restart = new URL("/app.lumaway/login", PROD_ORIGIN);
    restart.searchParams.set("oauth", "google");
    restart.searchParams.set("error", "oauth_wrong_origin");
    return NextResponse.redirect(restart);
  }
  const next = safeNext(url.searchParams.get("next"));
  const origin = requestOrigin(request);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "oauth_callback_failed");
  errorUrl.searchParams.set("error_description", "Login Google belum dapat diselesaikan. Silakan coba lagi.");
  return NextResponse.redirect(errorUrl);
}
