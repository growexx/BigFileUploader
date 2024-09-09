// uploadService.ts
import axios from 'axios';
import { getSignedUrl } from './s3Config';
import { createFileChunks } from '../fileUtils';

export const uploadFileInChunks = async (fileUri: string, bucketName: string, key: string) => {
  try {
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const chunks = await createFileChunks(fileUri, chunkSize);
    const uploadId = await getSignedUrl(bucketName, key);
    console.log('Upload ID:', uploadId);
    for (let i = 0; i < chunks.length; i++) {
      const signedUrl = await getSignedUrl(bucketName, `${key}.part${i + 1}`);
      await axios.put(signedUrl, chunks[i], {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);
    }

    console.log('Upload completed successfully');
  } catch (err) {
    console.error('Upload failed:', err);
  }
};
