import { put } from "@vercel/blob";
import { env } from "../env";

export async function uploadAudio(
  filename: string,
  data: Buffer,
  contentType = "audio/wav",
): Promise<string> {
  const result = await put(`tts_audio/${filename}`, data, {
    access: "public",
    contentType,
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });
  return result.url;
}

export async function uploadTextArtifact(
  filename: string,
  content: string,
  folder = "text",
): Promise<string> {
  const result = await put(`${folder}/${filename}`, content, {
    access: "public",
    contentType: "text/plain; charset=utf-8",
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });
  return result.url;
}
