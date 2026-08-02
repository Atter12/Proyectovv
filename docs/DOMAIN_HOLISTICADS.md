# Dominio Holistic Ads — `holisticads.com`

Panel en producción: **`https://holisticads.com`**  
Dominio anterior (mantener alias un tiempo): `https://ads.victorminas28.com`

Proyecto Vercel: `proyectovv` (team App Essential).

---

## Estado técnico (ya hecho en Vercel)

- Dominios agregados al proyecto: `holisticads.com` + `www.holisticads.com`
- Vercel espera DNS apuntando a: **`A → 76.76.21.21`**

---

## Paso crítico — DNS (Victor / Hostinger o registrar)

Hoy el dominio **sigue en parking de venta**:

| Actual (mal) | Debe quedar |
|---|---|
| `ns.buydomains.com` | `ns1.vercel-dns.com` |
| `this-domain-for-sale.com` | `ns2.vercel-dns.com` |

### Opción A (recomendada): nameservers de Vercel

En el panel donde compraron `holisticads.com` (GoDaddy / Namecheap / Sedo / etc.):

1. Completar transferencia / “claim” del dominio si aún dice *for sale*.
2. Cambiar **Nameservers** a:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. Esperar propagación (a veces 15 min, a veces hasta 24–48 h).
4. En Vercel → Domains → debería pasar a **Valid Configuration**.

### Opción B: DNS en el registrar (sin cambiar NS)

Si prefieren dejar NS del registrar, crear:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

**Sacar** cualquier registro a `nas.com`, parking, `buydomains`, “for sale”, o IPs raras.

---

## Env / integraciones (después de que el DNS esté Valid)

Vercel → Settings → Environment Variables (Production):

```
NEXT_PUBLIC_APP_URL=https://holisticads.com
```

Redeploy.

### Stripe

Webhook endpoint (Live o Test):

`https://holisticads.com/api/webhooks/payments/stripe`

Mismos eventos: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.expired`, `payment_intent.canceled`.

### Supabase Auth

- Site URL: `https://holisticads.com`
- Redirect URLs: `https://holisticads.com/**` (+ temporalmente `https://ads.victorminas28.com/**`)

### TikTok OAuth (si aplica)

Callback: `https://holisticads.com/api/integrations/tiktok/callback`

---

## Sobre China

Cambiar a `holisticads.com` mejora marca y limpia el DNS basura.  
Si desde mainland China el CSS sigue fallando, es limitación de red hacia Vercel — no se arregla solo con el dominio. Mitigación: VPN o CDN/proxy CN más adelante.

---

## `victorminas28.com` (no tocar la web principal)

La web de Victor en `@` / `www` se deja.  
Solo el panel `ads.` puede seguir como alias a Vercel mientras migran clientes a `holisticads.com`.
