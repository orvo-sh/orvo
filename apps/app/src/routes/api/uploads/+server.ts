import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST = (async ({ locals, request, url }) => {
  if (!locals.auth) {
    return json({ message: "Unauthorized." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (!contentType) {
    return json({ message: "File content type is required." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return json(
      { message: "File exceeds maximum size of 10 MB." },
      { status: 413 },
    );
  }

  const data = new Uint8Array(await request.arrayBuffer());
  const result = await locals.container.uploadService.uploadFile({
    contentType,
    fileSizeBytes: data.byteLength,
    purpose:
      url.searchParams.get("purpose") === "chat_attachment"
        ? "chat_attachment"
        : "image",
    data,
  });

  if (!result.success) {
    return json({ message: result.error }, { status: 400 });
  }

  return json(result.data);
}) satisfies RequestHandler;
