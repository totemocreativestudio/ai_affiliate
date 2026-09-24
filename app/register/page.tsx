import { redirect } from "next/navigation";

export default async function LegacyRegisterRoute({
  searchParams,
}:{
  searchParams:Promise<{ref?:string|string[]}>;
}) {
  const params=await searchParams;
  const raw=Array.isArray(params?.ref)?params.ref[0]:params?.ref;
  const ref=String(raw||"").trim().toUpperCase();
  const suffix=/^[A-Z0-9]{12}$/.test(ref)?`?ref=${encodeURIComponent(ref)}`:"";
  redirect(`/app.lumaway/register${suffix}`);
}
