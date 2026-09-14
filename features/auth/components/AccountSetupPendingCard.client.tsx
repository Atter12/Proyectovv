"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { routes } from "@/config/routes";
import { AuthFormHeading, AuthNotice } from "./AuthFormUi";
import styles from "./auth.module.css";

interface AccountSetupPendingCardProps {
  error?: string;
}

export function AccountSetupPendingCard({ error }: AccountSetupPendingCardProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRetry() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <div className="w-full">
      <AuthFormHeading title="Preparando tu cuenta">
        Tu correo ya está verificado. Estamos terminando de configurar tu
        organización y tu cartera en Ads Holistic.
      </AuthFormHeading>

      <div className={styles.form}>
        {error ? (
          <AuthNotice tone="error">
            No pudimos completar la configuración. Espera un momento y vuelve a
            intentarlo.
          </AuthNotice>
        ) : (
          <AuthNotice tone="info">
            Este paso puede tardar unos momentos. Comprueba de nuevo para
            continuar a tu panel.
          </AuthNotice>
        )}

        <button
          type="button"
          className="auth-cta"
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={handleRetry}
        >
          {refreshing ? "Comprobando tu cuenta…" : "Volver a comprobar"}
        </button>
      </div>

      <p className={styles.formFooter}>
        <Link href={routes.login} className={styles.textLink}>
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
