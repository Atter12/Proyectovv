"use client";

import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env/env.client";
import {
  attachEducationVideoAction,
  prepareEducationVideoUploadAction,
  type EducationVideoAttach,
} from "../actions";

export async function uploadEducationMp4(
  slug: string,
  file: File,
): Promise<EducationVideoAttach> {
  const headBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let head = "";
  for (const byte of headBytes) head += String.fromCharCode(byte);
  const prepared = await prepareEducationVideoUploadAction({
    slug,
    size: file.size,
    head: btoa(head),
  });
  if (!prepared.ok) return prepared;
  if (!clientEnv.supabaseUrl || !clientEnv.supabaseAnonKey) {
    return { ok: false, error: "unknown" };
  }

  const supabase = createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, file, {
      contentType: "video/mp4",
    });
  if (error) return { ok: false, error: "unknown" };
  return attachEducationVideoAction(slug, prepared.path);
}
