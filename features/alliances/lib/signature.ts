import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RemoteSignatureStatus = "pending" | "signed" | "rejected" | "unknown";

export interface RemoteSigner {
  token: string;
  name: string;
  email: string;
  status: string;
  link: string;
  signedOn: string;
  rejectionReason: string;
}

export interface RemoteEnvelope {
  token: string;
  status: RemoteSignatureStatus;
  rejectionReason: string;
  signedDownloadUrl: string;
  signers: RemoteSigner[];
}

export function splitSignerPhone(raw: string): { countryCode: string; phone: string } | null {
  const compact = raw.trim().replace(/[\s()-]/g, "");
  if (!compact) return null;
  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    if (digits.startsWith("51") && digits.length === 11) {
      return { countryCode: "+51", phone: digits.slice(2) };
    }
    if (digits.startsWith("1") && digits.length === 11) {
      return { countryCode: "+1", phone: digits.slice(1) };
    }
    for (const size of [2, 1, 3]) {
      const phone = digits.slice(size);
      if (digits.length > size && phone.length >= 6 && phone.length <= 12) {
        return { countryCode: `+${digits.slice(0, size)}`, phone };
      }
    }
    return null;
  }
  let digits = compact.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length >= 11) digits = digits.slice(2);
  if (digits.length < 6 || digits.length > 12) return null;
  return { countryCode: "+51", phone: digits };
}

export function verifySignatureHmac(rawBody: string, header: string | null, secret: string): boolean {
  const provided = (header ?? "").trim().replace(/^sha256=/i, "");
  if (!provided || !secret) return false;
  const hex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const base64 = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return safeEqual(provided, hex) || safeEqual(provided, base64);
}

export function documentTokenFromWebhook(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const direct = uuidOf(root.token) ?? uuidOf(root.document_token) ?? uuidOf(root.archivo_id);
  if (direct) return direct;
  for (const key of ["document", "data", "envelope", "archivo"]) {
    const nested = root[key];
    if (!nested || typeof nested !== "object") continue;
    const record = nested as Record<string, unknown>;
    const found = uuidOf(record.token) ?? uuidOf(record.document_token) ?? uuidOf(record.archivo_id);
    if (found) return found;
  }
  return null;
}

export function parseRemoteEnvelope(payload: unknown): RemoteEnvelope | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const body = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const token = uuidOf(body.token);
  if (!token) return null;
  const signers = Array.isArray(body.signers) ? body.signers.map(parseRemoteSigner).filter((signer) => signer.name.length >= 2) : [];
  const rejectionReason = clean(
    text(body.rejection_reason) || signers.find((signer) => signer.rejectionReason)?.rejectionReason || "",
    500,
  );
  return {
    token,
    status: remoteStatus(text(body.status), rejectionReason),
    rejectionReason,
    signedDownloadUrl: text(body.signed_download_file),
    signers,
  };
}

export function buildContractPdf(html: string): { bytes: Uint8Array; pages: number } {
  const blocks = blocksFromHtml(html);
  const contents = layoutPages(blocks.length > 0 ? blocks : [{ kind: "p", text: "Documento" }]);
  return { bytes: assemblePdf(contents), pages: contents.length };
}

function parseRemoteSigner(value: unknown): RemoteSigner {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const signedAt = text(row.signed_at);
  return {
    token: uuidOf(row.token) ?? "",
    name: clean(text(row.name), 120),
    email: clean(text(row.email).toLowerCase(), 180),
    status: clean(text(row.status).toLowerCase(), 40),
    link: clean(text(row.link), 2000),
    signedOn: /^\d{4}-\d{2}-\d{2}/.test(signedAt) ? signedAt.slice(0, 10) : "",
    rejectionReason: clean(text(row.rejection_reason), 500),
  };
}

function remoteStatus(raw: string, rejectionReason: string): RemoteSignatureStatus {
  const value = raw.toLowerCase();
  if (value === "signed" || value === "completed" || value === "document_signed") return "signed";
  if (value === "rejected" || value === "signer_rejected" || rejectionReason) return "rejected";
  if (value === "pending" || value === "sent" || value === "in_progress") return "pending";
  return "unknown";
}

function uuidOf(value: unknown): string | null {
  const textValue = text(value);
  return UUID.test(textValue) ? textValue : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface PdfBlock {
  kind: "h1" | "h2" | "p";
  text: string;
}

function blocksFromHtml(html: string): PdfBlock[] {
  const source = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<h1[^>]*>/gi, "\n\n# ")
    .replace(/<h2[^>]*>/gi, "\n\n## ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h1|h2|p|header|footer|div|li|main)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  return decodeHtml(source)
    .split(/\n{2,}/)
    .map((block) => block.replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((block) => {
      if (block.startsWith("# ")) return { kind: "h1" as const, text: block.slice(2).trim() };
      if (block.startsWith("## ")) return { kind: "h2" as const, text: block.slice(3).trim() };
      return { kind: "p" as const, text: block.replace(/\s*\n\s*/g, " ") };
    })
    .filter((block) => block.text.length > 0);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function layoutPages(blocks: PdfBlock[]): string[] {
  const pages: string[][] = [[]];
  let y = 786;
  const push = (line: string) => pages[pages.length - 1].push(line);
  const nextPage = () => {
    if (pages.length >= 30) return false;
    pages.push([]);
    y = 786;
    return true;
  };
  const room = (height: number) => {
    if (y - height >= 64) return true;
    return nextPage();
  };

  for (const block of blocks) {
    const size = block.kind === "h1" ? 16 : block.kind === "h2" ? 12 : 11;
    const font = block.kind === "p" ? "F1" : "F2";
    const leading = size + 5;
    const width = block.kind === "h1" ? 48 : block.kind === "h2" ? 72 : 86;
    const lines = wrap(block.text, width);
    for (const line of lines) {
      if (!room(leading)) break;
      y -= leading;
      push(`BT /${font} ${size} Tf 1 0 0 1 56 ${y} Tm (${pdfEscape(line)}) Tj ET`);
    }
    y -= block.kind === "p" ? 6 : 8;
  }

  return pages.map((commands) => ["0.910 0.271 0.102 RG", "1.2 w", "56 812 m 539 812 l S", "0 0 0 RG", ...commands].join("\n"));
}

function wrap(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const pieces = word.length > width ? word.match(new RegExp(`.{1,${width}}`, "g")) ?? [word] : [word];
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (next.length > width && current) {
        lines.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function pdfEscape(value: string): string {
  let out = "";
  for (const byte of winAnsi(value)) {
    if (byte === 0x5c || byte === 0x28 || byte === 0x29) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function winAnsi(value: string): Buffer {
  const bytes: number[] = [];
  for (const char of value.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 63;
    if (code === 0x2014 || code === 0x2013) bytes.push(0x2d);
    else if (code <= 0xff) bytes.push(code);
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

function assemblePdf(contents: string[]): Uint8Array {
  const pageCount = contents.length;
  let nextId = 5;
  const pageIds: number[] = [];
  const streamIds: number[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    pageIds.push(nextId);
    streamIds.push(nextId + 1);
    nextId += 2;
  }
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  contents.forEach((body, index) => {
    objects.set(
      pageIds[index],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${streamIds[index]} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
    objects.set(streamIds[index], `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`);
  });

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  let cursor = chunks[0].byteLength;
  for (let id = 1; id < nextId; id += 1) {
    offsets[id] = cursor;
    const piece = Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, "latin1");
    chunks.push(piece);
    cursor += piece.byteLength;
  }
  const xref = [
    `xref\n0 ${nextId}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${nextId} /Root 1 0 R >>`,
    `startxref\n${cursor}`,
    "%%EOF",
  ].join("\n");
  chunks.push(Buffer.from(`${xref}\n`, "latin1"));
  return Buffer.concat(chunks);
}
