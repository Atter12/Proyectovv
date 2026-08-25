import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session.server";
import {
  completeHecomOtpSession,
  isHecomOtpLoginEnabled,
} from "@/lib/auth/hecom-otp.server";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";

export async function POST() {
  if (!isHecomOtpLoginEnabled()) {
    logHecomOtp("warn", "provision_disabled", {});
    return NextResponse.json({ error: "OTP Hecom deshabilitado." }, { status: 403 });
  }

  const user = await getAuthUser();
  if (!user?.email) {
    logHecomOtp("warn", "provision_unauthenticated", {});
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const emailMasked = maskEmail(user.email);
  logHecomOtp("info", "provision_start", { email: emailMasked });

  try {
    const { accountReady, accountError, provisioned } =
      await completeHecomOtpSession(user);
    logHecomOtp("info", "provision_ok", {
      email: emailMasked,
      nextPath: provisioned.nextPath,
      isStaff: provisioned.isStaff,
      needsPicker: provisioned.needsPicker,
      clienteCount: provisioned.clienteIds.length,
      autoSelected: provisioned.autoSelected?.id ?? null,
      accountReady,
    });
    return NextResponse.json({
      ok: true,
      accountReady,
      accountError: accountReady ? undefined : accountError,
      clienteIds: provisioned.clienteIds,
      clientes: provisioned.clientes,
      autoSelected: provisioned.autoSelected,
      needsPicker: provisioned.needsPicker,
      nextPath: accountReady ? provisioned.nextPath : "/account-setup",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo vincular Hecom.";
    logHecomOtp("error", "provision_fail", { email: emailMasked, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
