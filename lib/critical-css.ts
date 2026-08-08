/**
 * CSS crítico inline — fallback si el chunk de Tailwind no llega (China / red lenta).
 * Reglas agresivas SOLO bajo `.auth-canvas` para no romper el dashboard.
 */
export const criticalCss = `
:root{
  --background:#f4f6f8;
  --foreground:#0f172a;
  --auth-text:#0f172a;
  --auth-text-muted:#475569;
  --auth-text-soft:#64748b;
  --auth-accent:#ff781f;
  --auth-accent-soft:rgb(255 120 31 / 0.14);
  --auth-divider:rgb(15 23 42 / 0.08);
  --auth-control-border:rgb(15 23 42 / 0.12);
  --auth-control-hover:#f1f5f9;
}
*,*::before,*::after{box-sizing:border-box}
html{height:100%;-webkit-text-size-adjust:100%}
body{
  margin:0;
  min-height:100%;
  background:var(--background);
  color:var(--foreground);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.sr-only{
  position:absolute!important;
  width:1px!important;
  height:1px!important;
  padding:0!important;
  margin:-1px!important;
  overflow:hidden!important;
  clip:rect(0,0,0,0)!important;
  white-space:nowrap!important;
  border:0!important;
}

/* ===== Solo landing / auth (no dashboard) ===== */
.auth-canvas{
  position:relative;
  min-height:100vh;
  overflow-x:hidden;
  background:
    radial-gradient(900px 480px at 8% 0%,rgb(255 120 31 / 0.12),transparent 55%),
    radial-gradient(720px 420px at 92% 8%,rgb(255 161 44 / 0.08),transparent 50%),
    linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);
  color:var(--auth-text);
}
.auth-canvas img{max-width:100%;height:auto;display:block}
.auth-canvas a{color:inherit;text-decoration:none}
.auth-canvas button{font:inherit}
.auth-canvas .auth-panel{
  border:1px solid var(--auth-divider);
  background:#fff;
  border-radius:16px;
  box-shadow:0 18px 40px rgb(15 23 42 / 0.08);
}
.auth-canvas header.sticky{
  position:sticky;
  top:0;
  z-index:40;
  border-bottom:1px solid var(--auth-divider);
  background:rgb(248 250 252 / 0.94);
  backdrop-filter:blur(12px);
}
.auth-canvas header .mx-auto,
.auth-canvas main .mx-auto,
.auth-canvas footer .mx-auto,
.auth-canvas section .mx-auto{
  width:100%;
  max-width:1180px;
  margin-left:auto;
  margin-right:auto;
  padding-left:1rem;
  padding-right:1rem;
}
.auth-canvas header .flex{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.75rem;
  min-height:3.5rem;
}
.auth-canvas nav[aria-label="Principal"]{display:none;gap:1.5rem}
@media(min-width:1024px){
  .auth-canvas nav[aria-label="Principal"]{display:flex;align-items:center}
  .auth-canvas nav[aria-label="Principal"] a{
    font-size:14px;font-weight:600;color:var(--auth-text-muted)
  }
}
.auth-canvas a[href*="login"],
.auth-canvas a[href*="register"]{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:12px;
  font-weight:600;
  font-size:14px;
  min-height:2.5rem;
  padding:0 1rem;
}
.auth-canvas a[href*="register"]{
  background:var(--auth-accent);
  color:#fff;
  font-weight:700;
  box-shadow:0 8px 18px rgb(255 120 31 / 0.25);
}
.auth-canvas h1{
  font-size:clamp(1.85rem,4vw,3rem);
  line-height:1.15;
  letter-spacing:-0.03em;
  margin:0.5rem 0 0;
  font-weight:700;
  max-width:18ch;
}
.auth-canvas #contenido>section:first-of-type{
  padding:2rem 1rem 3rem;
}
.auth-canvas #contenido>section:first-of-type .grid{
  display:grid;
  gap:2rem;
  align-items:center;
}
@media(min-width:1024px){
  .auth-canvas #contenido>section:first-of-type .grid{
    grid-template-columns:1.05fr .95fr;
    gap:3rem;
  }
}
.auth-canvas #contenido>section:first-of-type a[href*="register"],
.auth-canvas #contenido>section:first-of-type a[href*="login"]{
  min-height:3rem;
  border-radius:12px;
  padding:0 1.25rem;
  font-size:15px;
}
.auth-canvas #contenido>section:first-of-type a[href*="login"]{
  border:1px solid var(--auth-control-border);
  background:#fff;
  color:var(--auth-text);
}
.auth-canvas section p{color:var(--auth-text-muted)}
.auth-canvas div[title="Equipos en Latam"]{
  display:flex;
  flex-shrink:0;
  align-items:center;
}
.auth-canvas div[title="Equipos en Latam"]>span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:1.75rem;
  height:1.75rem;
  margin-left:-0.35rem;
  border-radius:9999px;
  border:2px solid #fff;
  background:var(--auth-accent-soft);
  color:var(--auth-accent);
  font-size:9px;
  font-weight:700;
}
.auth-canvas div[title="Equipos en Latam"]>span:first-child{margin-left:0}

/* ===== Landing Nsx (anti-FOUC primer paint) ===== */
.nsx-landing{
  min-height:100vh;
  overflow-x:hidden;
  background:#f5f5f7;
  color:rgb(26 26 28 / 0.6);
  font-family:var(--font-jakarta),ui-sans-serif,system-ui,sans-serif;
}
.nsx-landing .nsx-reveal{opacity:1;transform:none}
.nsx-landing .nsx-container{
  width:100%;
  max-width:1290px;
  margin-inline:auto;
  padding-inline:1.25rem;
}
.nsx-landing .nsx-h1{
  font-size:clamp(1.85rem,1.2rem + 4.2vw,4.25rem);
  font-weight:500;
  line-height:1.08;
  letter-spacing:-0.03em;
  color:#1a1a1c;
  margin:0;
}
.nsx-landing .nsx-hero{position:relative;padding-top:6.75rem}
`.trim();

/**
 * Reintenta CSS de Next si no aplicó (China / red lenta).
 * Marca html[data-css="ok"|"retry"|"fallback"] para diagnóstico.
 */
export const cssLoadGuardScript = `(function(){try{var d=document.documentElement;function ok(){var e=document.createElement("div");e.className="sr-only";e.setAttribute("aria-hidden","true");d.appendChild(e);var s=getComputedStyle(e);var w=parseFloat(s.width||"0");var good=s.position==="absolute"&&w<=1;e.remove();return good}function reload(){document.querySelectorAll('link[rel="stylesheet"][href*="_next/static"]').forEach(function(l){var h=l.getAttribute("href");if(!h||h.indexOf("_retry=")!==-1)return;var n=l.cloneNode(true);n.setAttribute("href",h+(h.indexOf("?")>=0?"&":"?")+"_retry="+Date.now());l.parentNode.insertBefore(n,l.nextSibling)})}function run(){if(ok()){d.setAttribute("data-css","ok");return}d.setAttribute("data-css","retry");reload();setTimeout(function(){if(ok())d.setAttribute("data-css","ok");else{reload();d.setAttribute("data-css","fallback")}},2200)}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();window.addEventListener("load",function(){if(!ok())run()})}catch(e){}})();`;
