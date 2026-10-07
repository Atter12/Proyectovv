# Alianzas: contrato en PDF, firma con FirmEasy y sección del cliente

Flujo armado el 07/10/2026. Toca dos repos: Hecom (`hecom.club/hecom-club`) y Ads Holistic (este repo).

## Cómo funciona

1. **Hecom → Alianzas → ficha de la alianza.**
   - En «Acuerdo» se elige el cliente. El selector pone arriba a los **activos**, que son los que gastaron en los últimos 30 días según `gastos`.
   - En «Contrato para firmar» se sube el PDF. Se guarda **tal cual** en el bucket privado `alianzas-contratos` y se registra como versión 1, 2, …
2. **Enviar a firmar.**
   - Se eligen la página y la posición de la firma.
   - Hecom manda ese mismo PDF a FirmEasy (`POST /v1/documents`, `document_pdf_base64`) con un solo firmante: el cliente, leído en vivo de `clientes`.
   - Queda el link de firma con el botón «Copiar link». FirmEasy también manda un correo.
3. **Firma.**
   - FirmEasy avisa al webhook de Hecom (`/api/credito-contratos-webhook-firmeasy`). Los contratos de alianza llevan `external_id = alianza:<id>`.
   - Hecom vuelve a pedir el documento a FirmEasy y no confía en el aviso. Si está firmado:
     - el contrato pasa a `signed`;
     - el PDF firmado se guarda en el bucket como `…-firmado.pdf`;
     - la alianza pasa a `active`;
     - el paso «Firma» queda hecho;
     - **Hecom llama a Ads** (`POST /api/internal/hecom/partner` con `hecomClienteId` y `contractSignedAt`).
   - Si el aviso no llega, el botón «Revisar firma» hace lo mismo a mano.
   - Si la persona rechaza el contrato, la versión vuelve a «Listo para enviar» y se muestra el motivo.
4. **Ads Holistic.**
   - El aliado queda con `partners.hecom_cliente_id` y `contract_signed_at`.
   - Recién ahí el cliente ve «Alianzas» en el menú (`getSignedPartnerForCliente` en el layout). Antes, ningún cliente la ve.
   - En `/alianzas` el cliente:
     - edita su landing `/a/<link>`: logo, foto, nombre, color, fondo claro u oscuro, título, subtítulo y WhatsApp, con vista previa en vivo;
     - copia su link;
     - ve visitas, registros, clientes que pagan y comisión.
   - El staff sigue viendo el panel de gerente.

## Migraciones

| Repo | Archivo | Qué hace |
|---|---|---|
| Hecom | `sql/305_alianzas_contrato_pdf.sql` | Columnas del PDF y de la firma en `alliance_contracts`, y bucket privado `alianzas-contratos`. Aplicada el 07/10. |
| Ads | `supabase/migrations/054_partners_cliente_branding.sql` | `partners.hecom_cliente_id`, `contract_signed_at`, `theme`, y bucket público `partner-assets` para los logos. |

## Archivos clave

**Hecom**
- `api/_alianzasPdf.js`: Storage: subida firmada, validación del PDF y conteo de páginas.
- `api/_alianzasSign.js`: arma el pedido a FirmEasy, el teléfono y la posición de la firma.
- `api/_alianzasSignSync.js`: estado de la firma y descarga del PDF firmado.
- `api/_alianzasSigned.js`: lo que pasa al firmar, incluida la llamada a Ads.
- Acciones en `api/alianzas.js`: `pdf_upload_url`, `pdf_register`, `send_sign`, `sync_sign` y `GET ?pdf=`.
- Tests: `qa/tests/alianzas-*.test.mjs`.

**Ads**
- `lib/partners/partners.server.ts` (`getSignedPartnerForCliente`).
- `features/partners/my-partner-actions.ts`.
- `features/partners/components/MiAlianza.client.tsx`.
- `app/(dashboard)/alianzas/page.tsx`.
- `app/a/[slug]/page.tsx`: tema y color de texto legible.
- `lib/partners/hecom-alliance-bridge.server.ts`.

## Ojo

- Las credenciales de FirmEasy están solo en Vercel de Hecom. En local no se puede probar el envío real.
- El webhook de FirmEasy apunta a Hecom. El aviso también llega a Ads, que ignora los documentos que no conoce.
- Los clientes sin celular en Hecom no se pueden enviar a firmar, porque FirmEasy lo exige.
