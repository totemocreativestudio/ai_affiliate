import { redirect } from "next/navigation";

export default function LegacyLoginRoute() {
  redirect("/app.lumaway/login");
}
