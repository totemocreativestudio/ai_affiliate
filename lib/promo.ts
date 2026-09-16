export type PromoTarget="subscription"|"token"|"claim"|"generic";

export async function resolvePromo(admin:any,userId:string,code:string,target:PromoTarget,targetKey:string|number|null,baseAmount=0){
  const normalized=String(code||"").trim().toUpperCase();
  if(!normalized)throw new Error("Kode promo wajib diisi.");
  const {data:promo,error}=await admin.from("luma_promo_codes").select("*").eq("code",normalized).eq("active",true).maybeSingle();
  if(error||!promo)throw new Error("Kode promo tidak valid.");
  const now=Date.now();
  if(promo.starts_at&&new Date(promo.starts_at).getTime()>now)throw new Error("Kode promo belum aktif.");
  if(promo.ends_at&&new Date(promo.ends_at).getTime()<=now)throw new Error("Kode promo sudah berakhir.");
  const [{count:used},{count:userUsed},{count:reservedSubs},{count:reservedTokens},{count:userReservedSubs},{count:userReservedTokens}]=await Promise.all([
    admin.from("luma_promo_redemptions").select("id",{head:true,count:"exact"}).eq("promo_id",promo.id).eq("status","applied"),
    admin.from("luma_promo_redemptions").select("id",{head:true,count:"exact"}).eq("promo_id",promo.id).eq("user_id",userId).eq("status","applied"),
    admin.from("luma_subscription_orders").select("id",{head:true,count:"exact"}).eq("promo_id",promo.id).in("status",["pending","processing"]),
    admin.from("luma_topup_orders").select("id",{head:true,count:"exact"}).eq("promo_id",promo.id).in("status",["pending","processing"]),
    admin.from("luma_subscription_orders").select("id",{head:true,count:"exact"}).eq("promo_id",promo.id).eq("user_id",userId).in("status",["pending","processing"]),
    admin.from("luma_topup_orders").select("id",{head:true,count:"exact"}).eq("promo_id",promo.id).eq("user_id",userId).in("status",["pending","processing"])
  ]);
  const totalUsage=Number(used||0)+Number(reservedSubs||0)+Number(reservedTokens||0);
  const totalUserUsage=Number(userUsed||0)+Number(userReservedSubs||0)+Number(userReservedTokens||0);
  if(promo.max_uses!=null&&totalUsage>=Number(promo.max_uses))throw new Error("Kuota promo sudah habis.");
  if(totalUserUsage>=Number(promo.per_user_limit||1))throw new Error("Kode promo sudah pernah digunakan.");
  const type=String(promo.promo_type);
  if(target==="subscription"){
    if(!["subscription_percent","subscription_amount"].includes(type))throw new Error("Kode promo tidak berlaku untuk langganan.");
    const allowed=(promo.applicable_plan_codes||[]) as string[];
    if(allowed.length&&targetKey&&!allowed.includes(String(targetKey)))throw new Error("Kode promo tidak berlaku untuk paket ini.");
  }
  if(target==="token"){
    if(!["token_percent","token_amount"].includes(type))throw new Error("Kode promo tidak berlaku untuk token.");
    const allowed=(promo.applicable_token_package_ids||[]).map((x:any)=>String(x));
    if(allowed.length&&targetKey!=null&&!allowed.includes(String(targetKey)))throw new Error("Kode promo tidak berlaku untuk paket token ini.");
  }
  if(target==="claim"&&!['free_tokens','extend_days'].includes(type))throw new Error("Kode promo ini digunakan saat checkout.");
  let discount=0,bonusTokens=0,extendDays=0;
  const value=Number(promo.value||0);
  if(type.endsWith("_percent"))discount=Math.min(Number(baseAmount||0),Math.round(Number(baseAmount||0)*Math.min(100,value)/100));
  if(type.endsWith("_amount"))discount=Math.min(Number(baseAmount||0),value);
  if(type==="free_tokens")bonusTokens=Math.max(0,Math.floor(value));
  if(type==="extend_days")extendDays=Math.max(0,Math.floor(value));
  return {promo,effect:{discount_amount:discount,final_amount:Math.max(0,Number(baseAmount||0)-discount),bonus_tokens:bonusTokens,extend_days:extendDays}};
}
