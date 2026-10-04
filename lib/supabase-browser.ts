import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // ponytail: placeholder cegah crash prerender; upgrade path: fail-fast bila env kosong di runtime non-build.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "placeholder",
  );
}