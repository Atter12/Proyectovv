# Alianzas: contrato en PDF, firma con FirmEasy y sección del cliente

Flujo armado el 07/10/2026. Toca dos repos: Hecom (`hecom.club/hecom-club`) y Ads Holistic (este repo).

## Cómo funciona

1. **Hecom → Alianzas.** El contrato solo sale de Hecom, por uno de dos caminos (al crear la alianza o desde su ficha):
   - **Con el formulario:** se llenan cliente, % de comisión, días y fechas, se elige una plantilla «Lista para generar» y Hecom arma el PDF (`api/_alianzasDraftPdf.js`). La firma del cliente queda donde FirmEasy la estampa por defecto.
   - **Con un PDF propio:** se sube el PDF y se guarda **tal cual** en el bucket privado `alianzas-contratos`, como versión 1, 2, …
   - En los dos casos el contrato queda en «Contrato para firmar», listo para enviar. Sin % de comisión en el acuerdo no se genera ni se envía.
   - **No se aceptan contratos firmados por fuera.** La alianza no se puede poner «Activa» a mano, el paso «Firma del contrato» no se marca a mano y el aliado en Ads ya no se crea con un botón: todo eso llega solo con la firma en FirmEasy.
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
     - **Hecom llama a Ads** (`POST /api/internal/hecom/partner` con `hecomClienteId`, `contractSignedAt`, `commissionPercent` y `commissionDays` del acuerdo).
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
| Hecom | `sql/307_alianzas_plantilla_base.sql` | Plantilla base «Contrato de alianza (referidos)» como borrador. Hay que revisarla y dejarla «Lista para generar». |
| Ads | `supabase/migrations/054_partners_cliente_branding.sql` | `partners.hecom_cliente_id`, `contract_signed_at`, `theme`, y bucket público `partner-assets` para los logos. |

## Archivos clave

**Hecom**
- `api/_alianzasDraftPdf.js`: arma el PDF desde la plantilla y el acuerdo (opción formulario).
- `api/_alianzasPdf.js`: Storage: subida firmada, validación del PDF y conteo de páginas.
- `api/_alianzasSign.js`: arma el pedido a FirmEasy, el teléfono y la posición de la firma.
- `api/_alianzasSignSync.js`: estado de la firma y descarga del PDF firmado.
- `api/_alianzasSigned.js`: lo que pasa al firmar, incluida la llamada a Ads.
- Acciones en `api/alianzas.js`: `generate` (formulario → PDF), `pdf_upload_url`, `pdf_register`, `send_sign`, `sync_sign` y `GET ?pdf=`.
- Si cambian el % o los días en la ficha, Hecom los manda a Ads (`syncAgreement`); Ads los aplica a las comisiones que se generen desde ahí.
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
