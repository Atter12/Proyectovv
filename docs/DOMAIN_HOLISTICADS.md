# Dominio Holistic Ads — `adsholistic.com`

Panel en producción: **`https://www.adsholistic.com`**  
(apex `adsholistic.com` redirige 308 → `www`)  
Alias legacy: `https://ads.victorminas28.com`

Proyecto Vercel: `proyectovv` (team App Essential).

---

## DNS Hostinger (hecho)

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | `300` |
| CNAME | `www` | `cname.vercel-dns.com` | `300` |

Vercel emite SSL solo (1–10 min). Cuando diga **Valid Configuration**, listo.

---

## Env / integraciones

```
NEXT_PUBLIC_APP_URL=https://www.adsholistic.com
```

Redeploy después de cambiar env.

### Stripe webhook

`https://www.adsholistic.com/api/webhooks/payments/stripe`

### Supabase Auth

- Site URL: `https://www.adsholistic.com`
- Redirect URLs: `https://www.adsholistic.com/**` (+ `https://ads.victorminas28.com/**` temporal)

### TikTok OAuth (si aplica)

`https://www.adsholistic.com/api/integrations/tiktok/callback`

---

## Nota China

Dominio limpio ≠ acceso garantizado desde mainland. Si el CSS falla allá, es red hacia Vercel.

---

## Legacy

`ads.victorminas28.com` puede quedar como alias.  
`holisticads.com` (otro nombre) quedó aparcado / no usar.
