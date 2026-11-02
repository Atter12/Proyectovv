# Vinculación TikTok → Business Center → cuentas ads por QR

Implementado en **Cuentas ads → Vincular TikTok**. Sustituye el panel anterior de importación OAuth de anunciantes. No requiere OpenAI ni que el cliente visite Business Center.

## Experiencia al entrar en Cuentas ads

### Dirección visual de la configuración

La configuración usa un módulo de estilos propio (`TikTokConnection.module.css`) acotado a este flujo, conservando las decisiones vigentes de Holistic del 10/09/2026: Plus Jakarta Sans, acciones principales en carbón `#17150f`, superficies blancas y naranja reservado al acento y al foco. No modifica el tema global ni las pantallas de pagos. Las casillas mantienen un input nativo accesible, con representación visual propia, foco visible, selección parcial y estado deshabilitado. Las pestañas usan una línea de acento, sin botones con bisel. Las filas tienen selección neutra y muestran el estado del vínculo; seleccionar una o más revela una única acción conjunta, que sustituye los botones repetidos por fila. La confirmación de retirada mantiene su tratamiento semántico de peligro. Comprobar conexión queda junto a Listo; la retirada del perfil completo permanece al final.

Se comprobó en escritorio y móvil de 375 px: tipografía efectiva de Jakarta dentro del dashboard, ausencia de desbordamiento, selección con teclado y ratón, casilla general parcial, confirmación y cancelación con foco restaurado, retirada de cinco asignaciones manteniendo el perfil, selección de cuentas disponibles que excluye inactivas y posterior asignación. El asistente QR comparte casillas y botones y conserva la selección opcional sin marcar ninguna cuenta de inicio. Las pruebas visuales usan datos ficticios.

- Los perfiles guardados se cargan al montar la vista y permanecen visibles. No hay que abrir el asistente para descubrirlos. Mientras carga se muestra un estado de carga; una consulta fallida tiene reintento y no se presenta como lista vacía.
- Se verifican automáticamente hasta cinco perfiles, secuencialmente y en segundo plano. Cada fila distingue **Comprobando**, **Vinculado**, **Requiere autorización** y **Guardado · Sin comprobar**. Un fallo de red no equivale a revocación. Se muestra el número de cuentas ads y la hora de la última comprobación correcta.
- **Vincular otro perfil** abre un asistente separado. Se guarda el perfil y se vuelve automáticamente a la lista si todas las asignaciones solicitadas quedaron confirmadas; los fallos parciales conservan el resultado y permiten reintentar. Un guardado sin cuentas ads es un resultado completo.
- **Configurar perfil** es la acción habitual. Separa **Vinculadas** de **Por vincular**, permite buscar por nombre o ID y exige seleccionar las cuentas nuevas. Las cuentas ya vinculadas también tienen selección para retirada múltiple: para quitar solo una se marca esa cuenta y se confirma la acción conjunta. **Conexión del perfil → Desvincular perfil completo** retira el acceso completo tras una confirmación; también está disponible en **Más opciones**. El perfil permanece visible al cerrar el asistente o volver de la configuración, y se restaura el foco.
- La interfaz del cliente no presenta IDs de Business Center, enlaces externos ni instrucciones para entrar al centro. La comprobación y la retirada se ejecutan desde Adsholistic. Los datos técnicos de un error siguen disponibles en los detalles para soporte.
- Después de desvincular, **Volver a vincular con QR** conserva el nombre y el centro del registro, sin preseleccionar cuentas ads. El guardado relee las asignaciones reales: no mezcla los IDs de una autorización anterior. Las respuestas de comprobaciones anteriores se invalidan al iniciar otra operación para evitar sobrescribir un estado reciente.
- Si se revoca el acceso, **Volver a autorizar** precarga el nombre y envía un `reconnectProfileId`; el servidor obtiene su centro del registro del cliente. No se aceptan centros arbitrarios enviados por el navegador. La reautorización conserva el centro original incluso si no hay cuentas ads.
- El asistente muestra el tiempo restante del QR, oculta el código vencido y permite regenerarlo conservando el nombre y las cuentas seleccionadas. Antes de salir con un QR todavía sin guardar, recuerda completar la confirmación si se aceptaron los permisos en el teléfono.
- Los errores de red, respuestas ilegibles y tiempos de espera tienen mensajes concretos. Los datos ingresados y los perfiles existentes se conservan ante errores; los detalles del proveedor siguen disponibles para soporte.
- Tras una creación/asignación de cuenta publicitaria desde los paneles de cliente o gerencia, `ad-accounts:updated` actualiza las opciones del perfil sin recargar la página. Si hay una operación en curso, espera a terminarla. No asigna la cuenta automáticamente: el usuario elige qué cuentas usarán la identidad. El modal de creación conserva el éxito cuando se actualiza el contador del padre y reinicia su estado al cerrarse y abrirse; comprobado con creación ficticia y cambio del contador de 0 a 1.
- Las etiquetas distinguen **perfiles de TikTok** de **cuentas publicitarias TikTok**; el contador de estas últimas puede estar en cero aunque exista un perfil conectado. La lista de cuentas publicitarias vacía no presenta filtros ni otra acción de creación en la barra. El alta conserva la acción de asignar saldo tras el éxito aunque se haya alcanzado el límite de cuentas; solicitar una ampliación queda para el estado sin cupo previo a crear.
- Las acciones principales tienen foco de teclado, anuncios de estado, áreas de pulsación de 44 px y contraste suficiente. La vista móvil permite nombres largos completos y campos de 16 px, sin desbordamiento lateral.

Prueba de interfaz con datos ficticios: perfil visible sin pulsar ningún botón; error de carga y reintento; error de verificación y recuperación; alta con cero cuentas ads y retorno a la lista; cancelación y retirada; detección de revocación; reautorización precargada; QR vencido y regeneración; salida con autorización pendiente; cuentas inactivas explicadas; actualización tras crear una cuenta; escritorio y móvil con nombre largo. Las pruebas no retiran perfiles reales.

## Recorrido

1. El usuario ingresa el nombre visible exacto de su perfil. Elegir cuentas ads es opcional: puede generar y autorizar el QR incluso si no tiene ninguna. Sin selección se utiliza `resolveTikTokCreateBmForCliente`, el mismo centro donde se crearán sus nuevas cuentas (incluye excepciones por cliente).
2. El servidor valida el cliente seleccionado y las cuentas, captura los activos existentes en ese centro y solicita una URL oficial de autorización a TikTok.
3. Adsholistic genera el QR localmente; no envía la URL a servicios externos de generación de códigos.
4. El titular escanea desde TikTok y aprueba acceso a publicaciones existentes y publicación visible solo como anuncios.
5. El servidor consulta los activos y coteja el nombre visible exacto contra el nombre bloqueado en el ticket. Si hay varias coincidencias, detiene el proceso y pide revisión. No expone la lista de perfiles de la agencia al cliente.
6. El usuario confirma y el servidor guarda el perfil de forma persistente por cliente. Si eligió cuentas ads, vincula únicamente las incluidas en la sesión cifrada. Relee las asignaciones para comprobar el resultado; presenta resultados por cuenta y permite reintentos. Sin cuentas, termina guardando el perfil sin llamar a la API de asignación.
7. En **Perfiles de TikTok → Configurar perfil**, podrá ver las cuentas actuales de su cliente y añadir otras posteriormente. **Comprobar conexión** recoge nuevas altas y comprueba el estado real del activo. Este paso usa el perfil guardado, sin ticket QR ni caducidad de diez minutos. Un perfil revocado exige nueva autorización; cuentas en otro centro requieren QR para ese centro.

## Verificación y desvinculación

- El listado consulta TikTok y muestra estado, fecha/hora de comprobación y cuentas ads de ese cliente. Si el activo desapareció externamente, muestra que ya no se confirma su vínculo y deshabilita nuevas asignaciones. Las comprobaciones permanecen dentro de Adsholistic.
- Seleccionar una cuenta y **Desvincular 1 cuenta ads** retira únicamente esa asignación mediante `/bc/asset/advertiser/unassign/`. Exige confirmación, valida cliente y centro, y relee la lista para comprobar que desapareció. Conserva el perfil en el Business Center. Permite retirar asignaciones de cuentas propias inactivas; no permite añadir cuentas inactivas.
- **Desvinculación masiva de cuentas ads:** marcar varias casillas en **Vinculadas** o **Seleccionar todas las vinculadas** → **Desvincular N cuentas ads** → revisar la lista completa y confirmar una vez. Con búsqueda, seleccionar todas afecta solo a las filas visibles; el contador incluye la selección conservada fuera de la búsqueda y la confirmación enumera todos los IDs seleccionados. Limpiar selección no modifica permisos. La casilla general tiene estado parcial cuando corresponde. Una selección para añadir y otra para retirar se mantienen separadas.
- La retirada múltiple coordina solicitudes individuales verificadas, secuencialmente, con el endpoint existente. Evita una solicitud larga por todo el lote y no cambia la autorización ni el aislamiento por cliente del servidor. Muestra avance y exige mantener la página abierta. Un error de una cuenta conserva los éxitos y permite continuar con las demás; un fallo de red, tiempo de espera, respuesta ilegible o sesión interrumpe los siguientes envíos. Al terminar, relee el estado real para reconciliar respuestas inciertas y deja seleccionadas únicamente las pendientes del lote. El coordinador del navegador no reintenta automáticamente las escrituras; un reintento explícito comprueba primero la asignación en el servidor. El perfil sigue guardado aunque queden cero cuentas asignadas.
- **Desvincular perfil completo** prepara una confirmación sin modificar nada. Muestra el perfil y el número de cuentas ads afectadas. Si alguna asignación queda fuera de las cuentas del cliente, bloquea la operación y pide revisión de soporte, sin revelar cuentas ajenas.
- La confirmación utiliza un ticket cifrado de cinco minutos ligado al usuario, cliente, perfil, centro, revisión del registro y asignaciones observadas. Revalida todo antes de actuar. Si cambian las cuentas vinculadas o el perfil se vuelve a autorizar, exige nueva confirmación.
- Tras confirmar, llama a `/bc/asset/admin/delete/` con `asset_type: TT_ACCOUNT` y un solo `asset_id` guardado en el servidor. Solo cambia el estado local después de releer TikTok y comprobar que el activo ya no existe en el centro. Si TikTok devuelve un error o continúa mostrando el activo, conserva el registro y permite reintentar. Si el titular ya revocó el acceso externamente, reconcilia el registro sin llamar al endpoint de retirada.
- El perfil, sus videos y la cuenta de TikTok se conservan; se revoca el acceso del Business Center. Las campañas que usen esa identidad pueden verse afectadas. Se mantiene el historial cifrado y la reclamación de titularidad; se oculta el registro de la lista activa. Un nuevo QR verificado puede reactivarlo para el mismo cliente. Cambiarlo a otro cliente requiere validación de soporte.
- Las lecturas de Storage evitan reutilizar caché mediante `cacheNonce` y `no-store`; las escrituras usan `cacheControl: 0`. Las pruebas reales detectaron que un documento actualizado podía seguir devolviendo su estado previo sin esta protección.

Comprobación manual del perfil del usuario: **Bm Enterprise 300.0 USD**, ID **7680955666005196801** → **Cuentas → Cuentas de TikTok → xchebax → Ver**. En **Cuentas vinculadas → Cuentas publicitarias**, cero cuentas es correcto si aún no se crearon. El token de agencia devuelve rol **ADMIN** para este centro (comprobado por `/bc/get/` el 31/10/2026).

El titular realiza la prueba real de retirada y nueva autorización; el agente solo observa el estado. En la observación del 31/10/2026, 20:45–20:47 UTC, el activo `xchebax` permaneció presente, sus asignaciones pasaron de cinco a cuatro y otra vez a cinco y no cambió la fecha del registro persistente (20:25:49 UTC). Esto confirma una retirada y reposición de una cuenta ads, pero no demuestra una retirada completa ni un nuevo guardado sin asignaciones. Las cinco cuentas publicitarias del cliente deben conservarse: el resultado esperado es cero asignaciones en el perfil, no cero cuentas del cliente.

La prueba ficticia de interfaz sí completó cinco asignaciones → retirada completa → nuevo QR sin casillas seleccionadas → guardado → cero asignaciones, conservando las cinco cuentas disponibles. Incluyó búsqueda, retirada de una sola cuenta, selección explícita, escritorio y móvil de 375 px sin desbordamiento. El permiso de retirada completa permanece pendiente de una operación real; un fallo del proveedor conserva el registro y muestra endpoint, código y referencia.

Prueba ficticia adicional de retirada masiva: selección de cinco cuentas, cancelación sin solicitudes, cuatro retiradas y un rechazo del proveedor, reintento únicamente de la cuenta pendiente y perfil conectado con cero asignaciones. Se comprobó selección limitada a una búsqueda, conservación de selección al limpiar el filtro, estado parcial de la casilla general y móvil de 375 px. La prueba automatizada ejecuta el coordinador real del navegador con respuestas simuladas: deduplicación, progreso, resultados parciales, reintentos solo de pendientes e interrupción de envíos tras perder la conexión. No se retiraron asignaciones reales del cliente para esta prueba.

Los registros del servidor distinguen `disconnect_preview`, `profile_disconnected`, `profile_saved` y `request_failed`, con ID interno, cantidades y referencias de error. No registran tokens, tickets, URLs de autorización ni cuerpos de solicitud. `profile_disconnected` solo se emite tras confirmar la ausencia del activo y guardar el estado; `profile_saved` informa cuentas solicitadas y confirmadas.

El ticket cifrado está ligado al usuario, cliente, centro y selección de cuentas. Vence a los diez minutos. Se vuelve a validar el acceso a las cuentas antes de operar. No se aceptan IDs de perfiles enviados por el navegador.

## Persistencia de perfiles

`profile-links.server.ts` usa el bucket privado `tiktok-profile-links` de Supabase Storage, con documentos cifrados mediante `ENCRYPTION_KEY` y rutas con hashes (sin nombres ni IDs de cliente legibles). Preparar una vez con `node --env-file=.env.local scripts/prepare-tiktok-profile-storage.mjs`, en el mismo proyecto Supabase de producción. Preparado el 31/10/2026; escritura anónima comprobada como bloqueada (403). No requiere migración SQL. La credencial de Management API local estaba vencida; se utiliza el servicio Storage disponible con la credencial del servidor.

Cada par Business Center/asset tiene una reclamación global creada atómicamente con `upsert:false`: dos clientes no pueden guardar el mismo perfil. Los reintentos conservan su ID y reparan el índice por cliente si hubo un fallo parcial. Cada lectura del índice vuelve a comprobar la reclamación global y el cliente autorizado. Los documentos no almacenan tokens de TikTok. No hay acceso directo desde el navegador al bucket. La vinculación guardada no sustituye la autorización de TikTok: se comprueba la presencia del activo antes de añadir cuentas. Conservar `ENCRYPTION_KEY`; una rotación requiere recifrar los documentos.

## Prueba real: 31 de octubre de 2026

Ejecutada con `node --env-file=.env.local scripts/probe-tiktok-qr.mjs`. Evidencia en `output/tiktok-qr-permissions.json`, sin tokens ni URLs de autorización.

| Operación | BM 10, 30, 200, 300 |
| --- | --- |
| `/bc/asset/account/authorization/` | Código 0, devolvió URL para el QR en los cuatro centros |
| `/bc/asset/admin/get/`, TT_ACCOUNT | Código 0 en los cuatro centros |
| `/bc/asset/advertiser/assigned/` | Código 0 en los cuatro centros |
| `/identity/info/`, muestras existentes | BM10/200: 40001, No permission to operate advertiser; BM30/300: 40000, Auth is not enough, cannot get identity |
| `/identity/get/`, muestras existentes | BM10/200: 40001, sin acceso al anunciante; BM30/300: código 0 |
| `/bc/asset/advertiser/assign/` | Solicitud sin IDs, intencionalmente inválida: 40002, advertiser_id obligatorio. No se creó ni modificó ninguna asignación. Esto **no confirma** el permiso de escritura para una vinculación válida. |

Las muestras de identidad usan un anunciante existente del centro; no prueban que todas las cuentas de ese centro estén bloqueadas. El activo del centro no apareció en la lista de identidades del anunciante muestreado: una identidad aún no asignada puede devolver “Auth is not enough”. Ese mensaje por sí solo no demuestra que falte un scope de la app. Por eso el flujo definitivo no depende de identity/get ni identity/info antes de asignar. Usa únicamente los activos del Business Center y sus asignaciones. El flujo con el anunciante que elija el cliente mostrará la respuesta específica.

## Qué revisar o solicitar

En TikTok API for Business → My Apps → app asociada al token de agencia:

- Acceso Marketing API → Business Center → BC Assets para autorización de TikTok accounts, consulta de activos, lectura de asignaciones y asignación a anunciantes.
- Autorización del token para operar los anunciantes elegidos. Ya permite generar QR, leer activos y leer asignaciones en los cuatro centros. La consulta de identidades publicitarias falló en algunas muestras, pero no bloquea este flujo. No se ha confirmado que falte un permiso de BC Assets.
- El usuario que autorizó el token debe ser ADMIN del Business Center. Después de habilitar los accesos de app, volver a autorizar desde un usuario con acceso a los anunciantes necesarios y actualizar `TIKTOK_ACCESS_TOKEN`.

No se inventan scopes ni se añaden a TIKTOK_SCOPES: este flujo usa el token de agencia existente y endpoints de Business Center, no el OAuth del cliente para importar anunciantes. Los errores incluyen endpoint, código y request_id para soporte.

## Límites y comprobación pendiente

- La autorización del teléfono y una asignación válida no se pueden confirmar sin que el titular escanee un QR. La prueba no cambia vínculos de clientes reales.
- Por privacidad, un perfil que ya pertenecía al centro antes de generar el QR solo se admite automáticamente si su nombre de activo coincide con el solicitado y ya está guardado para el cliente en ese centro o asignado a una de sus cuentas elegidas. Otros perfiles existentes necesitan revisión de soporte; nunca se lista todo el centro al cliente. Los perfiles nuevos ya asignados a cuentas fuera de la selección también requieren revisión. Guardar el perfil exige la confirmación explícita del usuario; consultar el estado del QR no lo guarda por sí solo.
- TikTok entrega un QR del centro, sin un ID de callback de escaneo por cliente. Se coteja el nombre exacto y la aparición del activo; el nombre visible no es un identificador único ni prueba de titularidad. Las coincidencias múltiples se bloquean. Para una garantía de titularidad por usuario sería necesario añadir autorización de cuenta orgánica con correlación verificable por TikTok. El flujo actual requiere confirmación del usuario sobre la coincidencia detectada y no permite explorar perfiles de la agencia.
- La autorización de QR restringe la publicación nueva a anuncios; no permite publicar contenido orgánico desde este flujo.

Fuentes oficiales:
- https://business-api.tiktok.com/portal/docs/obtain-a-tiktok-account-ad-delivery-authorization-url/v1.3
- https://business-api.tiktok.com/portal/docs/link-a-tiktok-account-to-an-ad-account-in-business-center/v1.3
- https://business-api.tiktok.com/portal/docs/get-ad-accounts-linked-to-a-tiktok-account-in-business-center/v1.3
- https://business-api.tiktok.com/portal/docs/get-info-about-an-identity/v1.3
- https://business-api.tiktok.com/portal/docs/unlink-a-tiktok-account-from-an-ad-account-in-business-center/v1.3
- https://business-api.tiktok.com/portal/docs/delete-assets-from-a-bc/v1.3
- https://ads.tiktok.com/resources/help/article/how-to-remove-a-tiktok-account-from-business-center?lang=en
- https://ads.tiktok.com/resources/help/article/how-to-unlink-a-tiktok-account-for-ad-delivery-from-ad-accounts-in-tiktok?lang=en

Validación local: `node scripts/test-tiktok-qr.mjs` prueba aislamiento, vencimiento, coincidencia de nombre, QR y guardado sin cuentas, asignaciones posteriores sin QR, revocación, reclamaciones concurrentes, recuperación de fallos parciales, retirada y reactivación, confirmaciones vencidas y clasificación de permisos; TypeScript y ESLint de los archivos del flujo. Recorrido visual con datos ficticios: cero cuentas → QR → confirmar → cerrar y reabrir → crear cuenta después → actualizar → añadir → cuenta marcada como vinculada; revisión de escritorio y móvil. La retirada real completa y nueva autorización con cero asignaciones siguen pendientes de evidencia del proveedor y del registro persistente.
