import { createHash } from "node:crypto";

const EDITOR_MARKS = ["photoshop", "gimp", "photopea", "paint.net", "canva", "figma", "picsart"];

export type CaptureDecision = "approve" | "review" | "reject";

export type MembershipCaptureStep = "pay" | "capture" | "review" | "rejected";

export function hashCapture(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function captureLooksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return jpeg || png || webp;
}

/** Marcas de editor en los metadatos. No autorizan solas el rechazo: mandan a revisión. */
export function captureHasEditorMark(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 256 * 1024));
  const text = Buffer.from(head).toString("latin1").toLowerCase();
  return EDITOR_MARKS.some((mark) => text.includes(mark));
}

export function decideMembershipCapture(input: {
  image: boolean;
  bytes: number;
  duplicate: boolean;
  editor: boolean;
  paid: boolean | null;
  looksLikeNas: boolean | null;
  edited: boolean | null;
  confidence: number | null;
  duplicateReference: boolean;
}): { decision: CaptureDecision; reason: string } {
  if (!input.image || input.bytes < 12_000 || input.bytes > 8_000_000) {
    return { decision: "reject", reason: "La captura tiene que ser una imagen del pago, en JPG, PNG o WebP." };
  }
  if (input.duplicate || input.duplicateReference) {
    return { decision: "reject", reason: "Esta captura ya se usó en otro pago." };
  }
  if (input.editor || input.edited === true) {
    return { decision: "review", reason: "La captura necesita revisión de gerencia antes de abrir el panel." };
  }
  const confidence = input.confidence ?? 0;
  if (input.paid === true && input.looksLikeNas === true && confidence >= 0.86) {
    return { decision: "approve", reason: "La captura muestra un pago de membresía terminado." };
  }
  if (input.paid === false && input.looksLikeNas === false && confidence >= 0.7) {
    return { decision: "reject", reason: "La captura no muestra un pago terminado en NAS." };
  }
  return { decision: "review", reason: "No alcanza para abrir el panel. Gerencia revisa la captura." };
}
