export const DEFAULT_CONVIA_BASE_URL = "https://api.convia.id/api/v1/public";

type ConviaRequestInit = RequestInit & { json?: unknown };

export function normalizeConviaPhone(input: string) {
  let value = String(input || "").trim().replace(/[^0-9+]/g, "");
  if (value.startsWith("08")) value = `+62${value.slice(1)}`;
  else if (value.startsWith("62")) value = `+${value}`;
  else if (!value.startsWith("+")) value = `+${value}`;
  return value;
}

export async function conviaRequest(
  apiKey: string,
  path: string,
  init: ConviaRequestInit = {},
  baseUrl = DEFAULT_CONVIA_BASE_URL
) {
  if (!apiKey) throw new Error("Convia API key belum dikonfigurasi.");
  const root = String(baseUrl || DEFAULT_CONVIA_BASE_URL).replace(/\/$/, "");
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${root}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    cache: "no-store",
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = raw?.message || raw?.error?.message || raw?.error || `Convia error ${response.status}`;
    throw new Error(typeof message === "string" ? message : `Convia error ${response.status}`);
  }
  return raw;
}

export async function conviaSendMessage(
  apiKey: string,
  payload: Record<string, unknown>,
  baseUrl = DEFAULT_CONVIA_BASE_URL
) {
  return conviaRequest(apiKey, "/messages/send", { method: "POST", json: payload }, baseUrl);
}

export async function conviaSendText(
  apiKey: string,
  phone: string,
  content: string,
  options: { baseUrl?: string; whatsappPhoneNumberId?: string; customerName?: string } = {}
) {
  const payload: Record<string, unknown> = {
    channel: "whatsapp",
    message_type: "text",
    phone_number: normalizeConviaPhone(phone),
    content,
  };
  if (options.whatsappPhoneNumberId) payload.whatsapp_phone_number_id = options.whatsappPhoneNumberId;
  if (options.customerName) payload.customer_name = options.customerName;
  return conviaSendMessage(apiKey, payload, options.baseUrl);
}

export async function conviaSendTemplate(
  apiKey: string,
  phone: string,
  template: {
    name: string;
    language?: string;
    components?: unknown[];
  },
  options: { baseUrl?: string; whatsappPhoneNumberId?: string; customerName?: string; autoCreateCustomer?: boolean } = {}
) {
  const payload: Record<string, unknown> = {
    channel: "whatsapp",
    message_type: "template",
    phone_number: normalizeConviaPhone(phone),
    template: {
      name: template.name,
      language: { code: template.language || "id" },
      components: template.components || [],
    },
    auto_create_customer: options.autoCreateCustomer ?? true,
  };
  if (options.whatsappPhoneNumberId) payload.whatsapp_phone_number_id = options.whatsappPhoneNumberId;
  if (options.customerName) payload.customer_name = options.customerName;
  return conviaSendMessage(apiKey, payload, options.baseUrl);
}

export async function conviaGetVerificationPricing(apiKey: string, baseUrl = DEFAULT_CONVIA_BASE_URL) {
  return conviaRequest(apiKey, "/verify/whatsapp/pricing", { method: "GET" }, baseUrl);
}
