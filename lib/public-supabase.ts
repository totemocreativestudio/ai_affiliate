import { createClient } from "@supabase/supabase-js";

export function createPublicClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
