---
tipo: mapa
tags: [moc, ingenieria]
---

# 🛠 Ingeniería — MOC

Dónde vive cada cosa y cómo llega a producción. ← [[Inicio]]

## Notas propias

- 

## Documentos fuente

Los archivos de fuera del vault se enlazan con rutas `file:///…`, que los abren
con la aplicación por defecto. Ver [[Cómo usar este cerebro]].

- 


## 2026-11-03 — Catálogo operativo y deuda vigente

El catálogo administrativo deja de importar indiscriminadamente todas las fichas Hecom: exige vínculo de usuario Ads o pago exitoso. Se leen ambas fuentes con paginación y conteo completos; errores o cambios de conteo fallan explícitamente. El acceso del cliente conserva el filtro por email existente. Un vínculo no demuestra por sí solo modalidad ni deuda.

Motor compartido con Hecom: corte de cobranza octubre de 2026 confirmado por el usuario para todos los créditos; meses previos conservados como histórico saldado, mes abierto como consumo, sin garantías ni excedentes entre períodos. Evidencia válida de recarga wallet excluye deuda automática; modalidad mixta requiere revisión. No se modifica ningún pago ni usuario. Auditoría identificable sólo en artefacto privado fuera del repositorio.

Validación: typecheck, settlement, render y pruebas de catálogo con más de una página, fallo e incompletitud aprobados. Publicación pendiente al escribir este corte.


Cierre: `6607ce6c` publicado en main; GitHub/Vercel confirma Deployment has completed / success. Typecheck, lint de archivos TypeScript modificados y pruebas locales aprobados. No se automatizó una sesión autenticada productiva de catálogo, ni se escribieron datos reales.


## 2026-11-03 — Suspensión de nuevo crédito del grupo revisado

Instrucción del usuario: revisar el grupo indicado, quitar capacidad de crédito y verificar accesos Ads para una decisión posterior de altas prepago. No autoriza conceder nuevos accesos por inferencia ni borrar deuda o pagos.

La auditoría distingue acceso Auth/membresía, recargas verificadas, excepciones de crédito del guardián, aprobación credit_lock_profiles y procedencia de asignaciones. Recarga de cartera no prueba ausencia de crédito; una asignación agency_bm sin puente puede usar fondos ya existentes y tampoco prueba por sí sola préstamo. Un grupo conserva fondeos directos antiguos sin origen conciliado. Los datos identificables y respaldos quedan en archivos privados fuera de Git.

Implementación: credit-suspension.ts suspende nuevo fondeo de agencia y aprobación de crédito del grupo, por cliente y advertisers mapeados. Se valida antes de asignar, importar cupo a cartera o transferir, incluso con bypass de staff o candado global apagado. Las excepciones antiguas del guardián no prevalecen sobre suspensión explícita. No cambia acceso ni concede prepago; el flujo de saldo existente mantiene su regla de ledger. Dos cuentas con saldo financiado exclusivamente por puentes de agencia reciben bloqueo staff para impedir recarga/reactivación automática. El resto de saldos no se reclasifica ni retira sin evidencia suficiente.

Pruebas: rechazo ejecutando los handlers internos antes de cualquier efecto en ledger/TikTok, aprobación bloqueada, protección con cuenta espejo sin etiqueta, alcance por cliente y advertiser, saldo ordinario y clientes ajenos sin alterar; typecheck y lint. Retirada TikTok y publicación pendientes en este corte.


Cierre parcial operativo: `d3dc73dd` main / Vercel success. Retirado el cash de dos cuentas financiadas exclusivamente con puente de agencia: TikTok code 0, relectura cash cero y cero campañas activas. Respaldo privado y dos audit_logs operativos registrados. No se alteraron asientos de deuda, pagos ni accesos. Los saldos antiguos con origen ambiguo y cuentas mixtas permanecen pendientes de evidencia; no se afirma bloqueo integral de todo gasto ni revocación de permisos externos de BC.


## 2026-11-03 — Confirmación del origen del saldo pendiente

El usuario confirma, en nombre de la responsable consultada, que el saldo cargado de las cuatro fichas pendientes es crédito de agencia. Esa confirmación resuelve la incertidumbre de origen para este subconjunto, sin extenderse a otras identidades homónimas ni a clientes mixtos. Se amplía el bloqueo staff por identificador exacto de cliente y sus cuentas mapeadas: impide nuevas asignaciones y reactivación automática por sync, sin revocar login. Lectura completa del alcance antes de operar, respaldo privado, retirada de disponibilidad con las operaciones existentes de freno de gasto y relectura por cuenta. Regresión de bloqueo por cliente, espejo sin metadata, sync y separación de identidad homónima aprobada. Publicación y ejecución pendientes en este corte.


Cierre: 030d9c36 y c1209b32 publicados en main y Vercel success. Se detectó/corrigió residuo binario de centavo al fijar presupuesto y devolver cash, probado con funciones reales y proveedor simulado. Operación del subconjunto confirmado: pausa comprobada; devolución sólo donde TikTok aceptó, rechazo de cuentas sancionadas y retención parcial documentados en respaldo privado y cuatro audit_logs. No se presentan como devueltos los saldos retenidos.

Rectificación de clasificación: el usuario pide diferenciar crédito real y acceso, sin deducir prepago del catálogo. Se mantiene separada la prueba Auth/perfil/membresía/login de recargas y financiación de agencia. resolveHecomBillingModality=prepago e isAgencyCreditCliente=false son valores por defecto, no prueba de contrato; un préstamo histórico tampoco acredita deuda actual. Informe revisado por cliente fuera de Git. No se ejecutan nuevas retiradas por clasificar a quien recarga como exclusivamente prepago. La regla automática de exclusión de deuda por recarga requiere revisión; no se inventa otra clasificación ni se reabren saldos.
