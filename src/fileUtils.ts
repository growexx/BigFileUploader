// fileUtils.ts
export const createFileChunks = async (fileUri: string, chunkSize: number) => {
  const file = await fetch(fileUri);
  const blob = await file.blob();
  const chunks = [];
  const totalChunks = Math.ceil(blob.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, blob.size);
    const chunk = blob.slice(start, end);
    chunks.push(chunk);
  }

  return chunks;
};
