# Bot de recargas: prueba real limitada

## Alcance

Solo el chat flotante de soporte. Se activa con «quiero recargar» y consulta con «estado de mi recarga».
No se cambian las vistas Recargas/Pago manual, sus destinos, ni la aprobación manual existente.
La opción `strictCurrency` del lector de comprobantes es optativa y solo la utiliza este bot.

Destino confirmado por el usuario: celular **964290361**, opción **BCP** en Yape, titular **Holistic Marketing PE EIRL**. No se envía QR.

## Activación

1. Aplicar `supabase/migrations/028_support_recharge_bot.sql` en la misma base del proyecto.
2. Configurar únicamente en producción `SUPPORT_RECHARGE_BOT_ENABLED=true` y `SUPPORT_RECHARGE_BOT_PILOT_EMAILS` con el correo del usuario piloto.
3. Conservar `YAPE_MAIL_HOST`, `YAPE_MAIL_USER`, `YAPE_MAIL_PASSWORD`, `YAPE_MAIL_MAILBOX`, `OPENAI_API_KEY`, `CRON_SECRET` y las variables Supabase existentes. No modificar `MANUAL_PAYMENT_BANK_ACCOUNTS`.
4. Publicar un nuevo despliegue de main. La validación usa `/api/jobs/support-recharge`, autenticado con `CRON_SECRET`, cada dos minutos; el chat también consulta mientras está abierto.

Para detener nuevas recargas, establecer el flag en `false` y redesplegar. Antes de hacerlo, revisar pagos pendientes; nunca pedir un segundo pago por una demora de confirmación.

## Controles y límites

- Piloto por correo autorizado, máximo USD 100 por recarga. El total debe superar S/ 10.00. Cinco intenciones/hora y cinco intentos de comprobante/recarga.
- Se reserva un monto exacto en soles por 30 minutos. Los céntimos adicionales se muestran como ajuste de identificación; el monto no se reutiliza durante 24 horas.
- Antes de solicitar la transferencia se verifica la conexión de lectura al buzón.
- Se requiere comprobante con monto exacto, moneda PEN y destinatario reconocido. La IA no autoriza el abono por sí sola; no se admite el modo confianza.
- El aviso de recepción debe tener firma DKIM BCP válida que cubra cuerpo completo y cabeceras relevantes, destinatario de correo correcto, titular y fecha dentro del plazo. Las cabeceras Authentication-Results no son evidencia suficiente.
- Se bloquean recibos repetidos, comprobantes/códigos reutilizados y coincidencias ambiguas con solicitudes manuales.
- La confirmación bancaria, el asiento USD y el marcado de recibo utilizado ocurren en una transacción. RPC y tablas privadas, accesibles solo al servidor.
- No se admite validación general de Plin, transferencias bancarias distintas ni códigos Yape mediante API. Este piloto reconoce exclusivamente el formato verificado de recepción de Yapeo a celular BCP.

## Verificación

`node --test scripts/test-support-recharge.mjs` comprueba firmas reales generadas en las pruebas, falsificaciones, cambios de monto, duplicados y reglas del chat.
`scripts/test-support-recharge.sql` se ejecuta tras la migración dentro de una transacción finalizada con **ROLLBACK**, usando una organización y cartera sintéticas. No ejecutar sus fixtures como pagos reales.
Se verificaron correos de recepción existentes en modo solo lectura y sin marcar mensajes como leídos.

La prueba de punta a punta queda pendiente hasta que el usuario cree una recarga en el chat, transfiera el monto indicado y adjunte su comprobante. No se debe describir un build o un correo histórico como pago real acreditado por este bot.

No es una integración bancaria oficial: depende del formato de correo y su entrega. Si cambia el formato, falta el comprobante, el pago llega fuera del plazo o no hay evidencia inequívoca, no se acredita automáticamente y se necesita soporte. Mantener el piloto restringido antes de ampliar su uso.
