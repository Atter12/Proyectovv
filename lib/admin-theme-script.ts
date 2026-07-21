/**
 * Inline script — runs before paint.
 * Dark mode is admin-only. Customer/auth routes always stay light at the
 * document level (auth pages use their own dark canvas styles).
 * Does not follow OS prefers-color-scheme for the whole site (that was
 * painting the dashboard black on PCs with Windows dark mode).
 */
export const adminThemeInitScript = `(function(){try{var r=document.documentElement;var p=location.pathname||"";var isAdmin=p==="/admin")||p.indexOf("/admin/")===0;r.classList.remove("light","dark");if(!isAdmin){r.classList.add("light");r.dataset.themeDirection="light";return}var t=localStorage.getItem("admin-theme");if(t!=="light"&&t!=="dark"){t="light"}r.classList.add(t);r.dataset.themeDirection=t}catch(e){document.documentElement.classList.add("light");document.documentElement.dataset.themeDirection="light"}})();`;
