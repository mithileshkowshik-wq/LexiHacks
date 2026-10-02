export async function readBoundedResponse(response, maxBytes, { tooLarge, interrupted }) {
  if (!response.body) throw interrupted();

  const limitError = tooLarge();
  const chunks = [];
  let totalBytes = 0;

  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > maxBytes) throw limitError;
      chunks.push(bytes);
    }
  } catch (error) {
    if (error === limitError) throw error;
    throw interrupted();
  }

  return Buffer.concat(chunks, totalBytes);
}
