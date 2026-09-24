const ENV_MAP: Record<string,string[]> = {
  // Canonical names first, then backward-compatible aliases already used in Vercel.
  luma_openai_api_key: ["OPENAI_API_KEY", "OPENAI_API", "API_KEY_OPENAI", "API_KEY_OPENAI_ID", "API_Key_OpenAI_ID", "OpenAI_API_Key"],
  luma_xendit_secret_key: ["XENDIT_SECRET_KEY", "XENDIT"],
  luma_xendit_public_key: ["XENDIT_PUBLIC_KEY"],
  luma_xendit_webhook_token: ["XENDIT_WEBHOOK_TOKEN", "XENDIT_WEBHOOK_TOKEN_API"],
  luma_whatsapp_access_token: ["WHATSAPP_ACCESS_TOKEN", "FLOWKIRIM_API"],
  luma_convia_api_key: ["CONVIA_API_KEY", "CONVIA_API"],
  luma_resend_api_key: ["RESEND_API_KEY"],
  luma_mayar_api_key: ["MAYAR_API_KEY", "API_KEY_MAYAR_ID", "API_Key_Mayar_ID"],
  luma_mayar_webhook_token: ["MAYAR_WEBHOOK_TOKEN", "WEBHOOK_TOKEN_MAYAR_ID", "Webhook_Token_Mayar_ID"],
  luma_midtrans_server_key: ["MIDTRANS_SERVER_KEY", "SERVER_KEY_MIDTRANS"],
  luma_midtrans_client_key: ["MIDTRANS_CLIENT_KEY", "CLIENT_KEY_MIDTRANS"],
};
function getEnvironmentSecret(name: string) {const candidates = ENV_MAP[name] || [];for (const envName of candidates) {const value = process.env[envName];if (typeof value === "string" && value.trim()) return value.trim();}return "";}
export function getServerSecretSource(name: string) {const candidates = ENV_MAP[name] || [];for (const envName of candidates) {const value = process.env[envName];if (typeof value === "string" && value.trim()) return `vercel:${envName}`;}return "secure-vault";}
export async function getServerSecret(admin: any, name: string) {const envSecret = getEnvironmentSecret(name);if (envSecret) return envSecret;const { data, error } = await admin.rpc("luma_get_server_secret", { p_name: name });if (error) throw new Error(`Secret lookup failed: ${error.message}`);return typeof data === "string" && data.trim() ? data.trim() : "";}
export async function hasServerSecret(admin: any, name: string) {if (getEnvironmentSecret(name)) return true;const { data, error } = await admin.rpc("luma_server_secret_exists", { p_name: name });if (error) return false;return Boolean(data);}
