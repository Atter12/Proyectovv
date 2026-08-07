import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/** Auto-registro público deshabilitado: solo login. */
export default function RegisterPage() {
  redirect(routes.login);
}
