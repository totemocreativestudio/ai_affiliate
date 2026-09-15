const ENV_MAP: Record<string,string> = {
  luma_openai_api_key: "OPENAI_API_KEY",
  luma_xendit_secret_key: "XENDIT_SECRET_KEY",
  luma_xendit_webhook_token: "XENDIT_WEBHOOK_TOKEN",
  luma_whatsapp_access_token: "WHATSAPP_ACCESS_TOKEN",
};

export async function getServerSecret(admin: any, name: string) {
  const envName = ENV_MAP[name] || "";
  if (envName && process.env[envName]) return process.env[envName] as string;

  const { data, error } = await admin.rpc("luma_get_server_secret", { p_name: name });
  if (error) throw new Error(`Secret lookup failed: ${error.message}`);
  return typeof data === "string" && data.trim() ? data.trim() : "";
}

export async function hasServerSecret(admin: any, name: string) {
  const envName = ENV_MAP[name] || "";
  if (envName && process.env[envName]) return true;
  const { data, error } = await admin.rpc("luma_server_secret_exists", { p_name: name });
  if (error) return false;
  return Boolean(data);
}
