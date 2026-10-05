import { redirect } from "next/navigation";

const APP_CALLBACK="https://app.lumaway.online/auth/callback";
const APP_LOGIN="https://app.lumaway.online/login";

function first(value:string|string[]|undefined){
  return Array.isArray(value)?value[0]:value;
}

export default async function RootRoute({
  searchParams,
}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}) {
  const params=await searchParams;
  const code=String(first(params.code)||"").trim();
  if(code){
    const callback=new URL(APP_CALLBACK);
    callback.searchParams.set("code",code);
    callback.searchParams.set("next","/dashboard");
    redirect(callback.toString());
  }

  const authError=String(first(params.error)||first(params.error_code)||"").trim();
  if(authError){
    const login=new URL(APP_LOGIN);
    login.searchParams.set("error",authError);
    const description=String(first(params.error_description)||"").trim();
    if(description)login.searchParams.set("error_description",description);
    redirect(login.toString());
  }

  redirect("/web/home");
}
