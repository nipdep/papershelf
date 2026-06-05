import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const bytes = await readFile(path.join(process.cwd(), "lib/statics/favicon-32x32.png"));

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
