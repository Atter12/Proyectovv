# Ads Holistic — shell iOS

App nativa (Capacitor 8) que abre **https://www.adsholistic.com** dentro de un WebView. La lógica sigue en Next.js. Este equipo (Windows) puede dejar el proyecto listo; el archive y TestFlight salen en un **Mac con Xcode**.

| | |
|---|---|
| Bundle ID | `com.adsholistic.app` |
| Nombre en el ícono | Ads Holistic |
| URL | `https://www.adsholistic.com` (`NEXT_PUBLIC_APP_URL` del env) |
| Proyecto Xcode | `ios/App/App.xcodeproj` (Swift Package Manager) |

## Qué hace esta fase

- WebView a producción, safe area (`contentInset: automatic`), status bar con texto oscuro sobre fondo `#fcfbf9`.
- Swipe desde el borde izquierdo para volver en el historial del WebView.
- User-Agent extra `HolisticApp/ios` (la web puede detectarlo después).
- Cookies de sesión en el almacén persistente del WKWebView: el origen de la página es `www.adsholistic.com`, así que el OTP de la primera vez debería quedar para las siguientes aperturas.
- Ícono provisional: “h” naranja (`#f5532c`, el del favicon) sobre negro, 1024. Splash crema. Reemplazar por el arte final antes del App Store público.

## Qué no hace todavía

- Push (el plugin está instalado; falta certificado APNs, tabla de tokens y los hooks de pago).
- Universal Link: el magic link abierto desde Mail sigue yendo a Safari, con cookies distintas a las de la app.
- Firma, TestFlight y listing.

## En el Mac

Requisitos: Xcode actual, cuenta Apple Developer del equipo Holistic, Node 22+.

```bash
cd mobile
npm install
npx cap sync ios
npx cap open ios
```

`cap sync` regenera `ios/App/App/capacitor.config.json` (está en gitignore) y copia `www/`. Hay que correrlo antes de abrir Xcode la primera vez, y cada vez que cambie `capacitor.config.ts`.

### Build interna a otro host

```bash
CAPACITOR_SERVER_URL=https://tu-staging.ejemplo npx cap sync ios
```

Tiene que ser HTTPS. El iPhone no llega a `localhost` de la Mac.

### Firma y TestFlight

1. En Xcode, target **App** → **Signing & Capabilities** → Team Holistic. El Bundle ID ya es `com.adsholistic.app` (hay que registrarlo en el portal de Apple si no existe).
2. Scheme **App**, destino **Any iOS Device (arm64)**.
3. **Product → Archive**.
4. Organizer → **Distribute App** → **App Store Connect** → upload.
5. En App Store Connect, TestFlight → grupo interno (staff) y después invitaciones a clientes piloto.
6. Export compliance: `ITSAppUsesNonExemptEncryption` está en `false` (solo HTTPS estándar).

Subir el build número (`CURRENT_PROJECT_VERSION` en el target) en cada archive nuevo. La versión visible arranca en `1.0`.

### Probar en un iPhone enchufado

Conectar el teléfono, elegirlo como destino, Run. La primera vez: OTP Hecom. Cerrar la app desde el switcher y volver a abrir: debe entrar al panel sin pedir código. Si pide OTP otra vez, la cookie no persistió y hay que mirarlo antes de seguir con push.

## Estructura

```
mobile/
  capacitor.config.ts    # URL, user-agent, splash, status bar
  www/index.html         # fallback local si no hay red (el arranque real es la URL)
  ios/                   # proyecto Xcode
```
