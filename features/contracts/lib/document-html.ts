function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function contractDocumentHtml(input: {
  title: string;
  parties: string;
  body: string;
  footer?: string;
}): string {
  const blocks = input.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("# ")) {
        return `<h1>${escapeHtml(block.slice(2).trim())}</h1>`;
      }
      if (block.startsWith("## ")) {
        return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { margin: 0; background: #f6f3ee; color: #1c1917; font: 16px/1.55 "Segoe UI", sans-serif; }
    main { max-width: 760px; margin: 32px auto; background: #fff; border: 1px solid #e7e0d6; padding: 48px 52px 64px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #ff781f; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #e8451a; }
    .meta { text-align: right; font-size: 13px; color: #57534e; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 18px; }
    h2 { font-size: 16px; margin: 26px 0 8px; }
    p { margin: 0 0 12px; }
    footer { margin-top: 36px; font-size: 12px; color: #78716c; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">Holistic Marketing</div>
      <div class="meta">${escapeHtml(input.parties)}</div>
    </header>
    ${blocks}
    <footer>${escapeHtml(input.footer ?? "Documento de Holistic Marketing.")}</footer>
  </main>
</body>
</html>`;
}
