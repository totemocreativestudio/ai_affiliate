import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function getServerContext(workspaceId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !secret) {
    throw new Error("Supabase server environment is incomplete.");
  }

  const cookieStore = await cookies();

  const userClient = createServerClient(url, publishable, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Route may be running in a read-only cookie context.
        }
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required.");
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active) {
    throw new Error("Inactive account.");
  }

  const { data: membership } = await admin
    .from("workspace_members")
    .select("membership_role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const platformAdmin = profile.role === "admin";
  if (!platformAdmin && !membership) {
    throw new Error("Workspace access denied.");
  }

  return {
    user,
    profile,
    membership,
    platformAdmin,
    admin,
    canManage:
      platformAdmin ||
      ["owner", "admin", "manager"].includes(
        membership?.membership_role || ""
      ),
  };
}
