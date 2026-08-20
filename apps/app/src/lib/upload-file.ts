const uploadFile = async (
  file: File,
  purpose: "image" | "chat_attachment" = "image",
) => {
  const response = await fetch(`/api/uploads?purpose=${purpose}`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const result = (await response.json().catch(() => null)) as {
    message?: string;
    url?: string;
  } | null;

  if (!response.ok || !result?.url) {
    throw new Error(result?.message ?? `Upload failed (${response.status}).`);
  }

  return result.url;
};

export { uploadFile };
