# Plan — frenar el gasto de prepago en Ads Holistic

Fecha: 29 de setiembre de 2026.  
Estado: el código local ya trata a todos los de Ads Holistic como prepago. **Eso aún no está publicado.** En www.adsholistic.com y en hecom.club el hueco sigue abierto.

## Qué pasó

En Hecom, sección Crédito, al abrir la ficha de un cliente la pantalla guardaba sola un link (`credito_form_slug`) para el botón Pasar link.

Ads Holistic leía ese link y lo tomaba como crédito de agencia. Con eso no bajaba el presupuesto de TikTok cuando la cartera no alcanzaba. El cliente prepago seguía gastando y el mes cerraba debiendo.

Wilder Remolina es el caso claro: en setiembre debe USD 708.86. Del 14 al 19 gastó más de lo que recargó. El domingo 27 pagó y gastó lo mismo; esa deuda es de antes.

## ¿Ya paramos eso?

No en vivo.

| Parte | Qué hace el código local | En vivo hoy |
|---|---|---|
| Hecom, ficha Crédito | Abrir la ficha ya no guarda el link. Pasar link solo copia el enlace. | Sigue guardando el link al abrir la ficha. |
| Ads Holistic | Nadie es crédito. El link no salta el tope. El cupo de BM 10/30 vuelve a ser gastado + cartera. | Quien tiene link sigue sin tope. |

No se bajó ningún presupuesto de TikTok en esta pasada. Publicar el código no recorta cuentas solas: el tope corre cuando se abre la cuenta o cuando el cliente recarga. Un recorte masivo es otro paso, con dry-run y un «aplicá».

## A quién vigilar (setiembre, corte al 28)

Clientes con login en Ads Holistic que este mes gastaron más de lo pagado al periodo. Los cuatro primeros de la segunda tabla pagaron, pero el cobro está marcado en agosto, así que setiembre les sale descubierto.

| Cliente | Debe USD | Gasto + fee | Pagado al periodo |
|---|---:|---:|---:|
| Jesús Jiménez | 4,794.28 | 4,794.28 | 0.00 |
| Luis Oropeza | 3,642.61 | 4,242.61 | 600.00 |
| Wilder Remolina | 708.86 | 2,939.26 | 2,230.40 |
| Adriana Trujillo | 614.65 | 614.65 | 0.00 |
| Neojael Justo | 301.07 | 1,154.07 | 853.00 |
| Jesus Fuentes | 255.47 | 3,324.47 | 3,069.00 |
| Julio Lirio | 146.38 | 146.38 | 0.00 |
| Adrian Pacahuala | 62.71 | 304.22 | 241.51 |
| Dominic Velame | 54.64 | 54.64 | 0.00 |
| Joseph Carranza | 10.30 | 1,245.30 | 1,235.00 |
| Andy Peralta | 9.65 | 229.65 | 220.00 |

Deuda = cargo − cobrado aplicable. El cargo es el gasto por (1 + fee%). El surcharge de Stripe no baja la deuda. Los cobros cuentan por `periodo_resumen` del mes, no por el día en que cayó el pago si el periodo es otro mes.

## Cómo se lee el access token

No se imprime. No se pega en el chat, en el MD ni en un commit.

El valor vive en `Proyectovv/.env.local`, en la línea `TIKTOK_ACCESS_TOKEN`. El mismo nombre está en Vercel, proyecto proyectovv, Production, y en Hecom para el sync de gastos. En los dos lados tiene que ser el token de agencia con permiso finance del Business Center.

Un script lo toma así, sin mostrarlo:

```bash
node --env-file=.env.local tu-script.mjs
```

Dentro del script:

```js
const token = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();
if (!token) throw new Error("Falta TIKTOK_ACCESS_TOKEN");
```

Algunos scripts viejos leen el archivo a mano: abren `.env.local`, buscan la clave `TIKTOK_ACCESS_TOKEN` y cortan lo que va después del primer `=`. Es el mismo valor. No hace falta ese parseo si el comando lleva `--env-file=.env.local`.

En el servidor de Ads Holistic el camino es `serverEnv.tiktokAccessToken` (`lib/env/env.server.ts`), que es `process.env.TIKTOK_ACCESS_TOKEN`. Las llamadas de finance pasan por `resolveTikTokFinanceAccessToken`: primero ese token de agencia; si no hay, el OAuth de la organización, que muchas veces no tiene permiso finance.

Hecom lo lee en `api/credito-tiktok-core.js` con `process.env.TIKTOK_ACCESS_TOKEN`.

La API de TikTok no lleva el token en la URL. Va en el header:

```js
headers: { "Access-Token": token }
```

Base: `https://business-api.tiktok.com/open_api/v1.3`.

Hecom y Supabase usan otra llave, la service role, también solo desde `.env.local` (`HECOM_SUPABASE_URL`, `HECOM_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Misma regla: se lee del entorno y no se imprime.

Para comprobar que el token está, sin verlo:

```js
console.log(token ? `token cargado, largo ${token.length}` : "falta token");
```

## Plan de ataque

1. Publicar Hecom para que abrir la ficha deje de guardar el link. Archivos: `credito.html`, `public/credito.html`, `api/credito-form-resolve.js`.
2. Publicar Ads Holistic para que el link no sea crédito. Archivos: `lib/hecom/agency-credit.ts`, `lib/hecom/is-agency-credit-cliente.server.ts`, `lib/hecom/clientes.server.ts`, `lib/ops/assistant-brief.server.ts`, `app/api/ad-accounts/live-metrics/route.ts`.
3. Monitoreo diario, solo lectura, de esos 11 y de cualquier cliente con login en Ads Holistic:
   - cargo del mes (gasto hasta ayer, hora Lima) contra cobrado aplicable del periodo;
   - si la deuda sube de un día a otro más que el gasto de ese día, el tope no está frenando;
   - correr con `node --env-file=.env.local`. No usar `--commit` en el cap de presupuestos hasta que se diga «aplicá».
4. El recorte de presupuesto TikTok (bajar el cupo a gastado + cartera) es aparte. El script `scripts/cap-ads-holistic-shared-budgets.mjs` primero en dry-run. `--commit` solo con permiso explícito. No es un cron silencioso.
5. No borrar el link de las fichas. Sirve para el formulario. Lo que se corta es usarlo como crédito.

## Qué no hacer

- No imprimir `TIKTOK_ACCESS_TOKEN` ni las service role.
- No commitear `.env.local`.
- No recortar presupuestos de un listado entero sin mirar el dry-run.
- No tratar un cobro de agosto que cayó el 1 de setiembre como pago de setiembre: el periodo manda.
