import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { sendExternalCustomerNotice } from "../../../../lib/customer-notifications";
import { resolvePromo } from "../../../../lib/promo";

export const runtime = "nodejs";

const money = (value: unknown) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function calculateUpgrade(current: any, target: any) {
  const currentPlan = current?.luma_subscription_plans;
  if (!current || !currentPlan || currentPlan.is_trial) return null;
  if (String(current.status).toLowerCase() !== "active") return null;
  if (!current.ends_at || new Date(current.ends_at).getTime() <= Date.now()) return null;

  const currentSort = Number(currentPlan.sort_order || 0);
  const targetSort = Number(target.sort_order || 0);
  const currentPrice = Number(currentPlan.price || 0);
  const targetPrice = Number(target.price || 0);
  const currentDuration = Math.max(1, Number(currentPlan.duration_days || 1));

  if (targetSort <= currentSort || targetPrice <= currentPrice) return null;

  const remainingDays = Math.max(
    0,
    (new Date(current.ends_at).getTime() - Date.now()) / 86_400_000,
  );
  const rawCredit = (currentPrice / currentDuration) * remainingDays;
  const credit = Math.min(targetPrice, Math.max(0, Math.round(rawCredit)));

  return {
    subscription_id: Number(current.id),
    from_plan_id: Number(current.plan_id),
    from_plan_code: String(currentPlan.code || ""),
    from_plan_name: String(currentPlan.name || ""),
    remaining_days: Math.round(remainingDays * 100) / 100,
    credit_amount: credit,
  };
}

export async function POST(req: NextRequest) {
  let ctx: any = null;
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const planId = Number(body.plan_id || 0);
    if (!workspaceId || !planId) throw new Error("invalid request");

    ctx = await getServerContext(workspaceId);

    const { data: plan, error: planError } = await ctx.admin
      .from("luma_subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("status", "active")
      .single();

    if (planError || !plan || plan.is_trial) throw new Error("invalid plan");

    const { data: current } = await ctx.admin
      .from("luma_user_subscriptions")
      .select(
        "id,user_id,workspace_id,plan_id,status,starts_at,ends_at,luma_subscription_plans(id,code,name,price,duration_days,sort_order,is_trial)",
      )
      .eq("user_id", ctx.user.id)
      .in("status", ["trialing", "active"])
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentPlan = current?.luma_subscription_plans;
    const currentIsActivePaid = Boolean(
      current &&
        currentPlan &&
        !currentPlan.is_trial &&
        String(current.status).toLowerCase() === "active" &&
        current.ends_at &&
        new Date(current.ends_at).getTime() > Date.now(),
    );

    if (
      currentIsActivePaid &&
      Number(plan.sort_order || 0) < Number(currentPlan.sort_order || 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Paket aktif tidak dapat diturunkan sebelum masa aktif berakhir. Anda tetap dapat memperpanjang paket yang sama atau upgrade ke tier yang lebih tinggi.",
        },
        { status: 409 },
      );
    }

    const upgrade = calculateUpgrade(current, plan);
    const baseAmount = Number(plan.price || 0);
    const upgradeCredit = Number(upgrade?.credit_amount || 0);
    const subtotal = Math.max(0, baseAmount - upgradeCredit);

    let promo: any = null;
    let promoDiscount = 0;
    if (body.promo_code) {
      const resolved = await resolvePromo(
        ctx.admin,
        ctx.user.id,
        String(body.promo_code),
        "subscription",
        plan.code,
        subtotal,
      );
      promo = resolved.promo;
      promoDiscount = Number(resolved.effect.discount_amount || 0);
    }

    const amount = Math.max(0, subtotal - promoDiscount);
    const orderCode = `SUB-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
    const expiresAt = new Date(Date.now() + 3 * 86_400_000).toISOString();

    const orderRow = {
      user_id: ctx.user.id,
      workspace_id: workspaceId,
      plan_id: plan.id,
      order_code: orderCode,
      base_amount: baseAmount,
      discount_amount: promoDiscount,
      amount,
      status: "pending",
      promo_id: promo?.id || null,
      expires_at: expiresAt,
      upgrade_from_subscription_id: upgrade?.subscription_id || null,
      upgrade_credit_days: Number(upgrade?.remaining_days || 0),
      upgrade_credit_amount: upgradeCredit,
    };

    if (amount <= 0) {
      const { error: insertError } = await ctx.admin.from("luma_subscription_orders").insert({
        ...orderRow,
        payment_provider: "Promo/Credit",
        payment_method: "Covered by promo or upgrade credit",
        provider_payload: { promo_code: promo?.code || null, upgrade },
      });
      if (insertError) throw insertError;

      const { data: result, error: completeError } = await ctx.admin.rpc("luma_complete_subscription", {
        p_order_code: orderCode,
        p_payment_reference: `CREDIT-${promo?.code || "UPGRADE"}`,
        p_provider_payload: { promo_code: promo?.code || null, upgrade },
      });
      if (completeError) throw completeError;

      return NextResponse.json({
        ok: true,
        free: true,
        result,
        pricing: {
          base_amount: baseAmount,
          upgrade_credit_amount: upgradeCredit,
          promo_discount_amount: promoDiscount,
          amount: 0,
          upgrade,
        },
      });
    }

    const key = await getServerSecret(ctx.admin, "luma_xendit_secret_key");
    if (!key) throw new Error("payment gateway unavailable");

    const payload: any = {
      reference_id: orderCode,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount,
      currency: "IDR",
      country: "ID",
      locale: "id",
      expires_at: expiresAt,
      description: upgrade ? `Lumaway upgrade ke ${plan.name}` : `Lumaway ${plan.name}`,
      customer: {
        reference_id: `luma-${ctx.user.id}-${Date.now()}`,
        type: "INDIVIDUAL",
        email: ctx.user.email || undefined,
      },
      items: [
        {
          reference_id: `subscription-${plan.code}`,
          name: upgrade ? `Upgrade Lumaway ${plan.name}` : `Lumaway ${plan.name}`,
          description: upgrade
            ? `Upgrade dengan kredit sisa ${upgrade.remaining_days.toFixed(1)} hari`
            : `Akses Lumaway ${plan.duration_days} hari`,
          type: "DIGITAL_SERVICE",
          category: "SOFTWARE",
          net_unit_amount: amount,
          quantity: 1,
          currency: "IDR",
        },
      ],
      metadata: {
        workspace_id: workspaceId,
        user_id: ctx.user.id,
        plan_code: plan.code,
        upgrade_from_subscription_id: upgrade?.subscription_id ? String(upgrade.subscription_id) : "",
        upgrade_credit_amount: String(upgradeCredit),
      },
    };

    if (origin.startsWith("https://")) {
      payload.success_return_url = `${origin}/#billing`;
      payload.cancel_return_url = `${origin}/#billing`;
    }

    const response = await fetch("https://api.xendit.co/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const x = await response.json();
    if (!response.ok) throw new Error(x?.message || "xendit error");

    const providerExpiry = String(x.expires_at || expiresAt);
    const { error: orderError } = await ctx.admin.from("luma_subscription_orders").insert({
      ...orderRow,
      payment_provider: "Xendit",
      payment_method: "Secure Checkout",
      payment_session_id: x.payment_session_id || null,
      payment_url: x.payment_link_url || null,
      expires_at: providerExpiry,
      provider_payload: {
        status: x.status,
        promo_code: promo?.code || null,
        upgrade,
      },
    });
    if (orderError) throw orderError;

    const expiryText = new Date(providerExpiry).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const priceMessage = upgrade
      ? `Harga ${money(baseAmount)}, kredit sisa paket ${money(upgradeCredit)}, total pembayaran ${money(amount)}.`
      : `Total pembayaran ${money(amount)}.`;

    await sendExternalCustomerNotice(ctx.admin, {
      userId: ctx.user.id,
      workspaceId,
      kind: "subscription_checkout",
      title: upgrade ? "Checkout upgrade langganan dibuat" : "Checkout langganan dibuat",
      message: `${upgrade ? `Upgrade ke ${plan.name}` : `Paket ${plan.name}`} sudah dibuat. ${priceMessage} Selesaikan pembayaran paling lambat ${expiryText} WIB.`,
      actionUrl: x.payment_link_url || `${origin}/#billing`,
    });

    return NextResponse.json({
      ok: true,
      order_code: orderCode,
      payment_url: x.payment_link_url,
      expires_at: providerExpiry,
      amount,
      discount_amount: promoDiscount,
      pricing: {
        base_amount: baseAmount,
        upgrade_credit_amount: upgradeCredit,
        promo_discount_amount: promoDiscount,
        amount,
        upgrade,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 400 });
  }
}
