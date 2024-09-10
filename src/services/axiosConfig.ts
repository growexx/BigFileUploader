// axiosConfig.ts
import axios from 'axios';

// Import the module or define the type for 'BackgroundActions'

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com', // Replace with your API base URL
  timeout: 1000,
  headers: {},
});

export default axiosInstance;

export const initiateUpload = async (fileName: string, fileType: string) => {
  const response = await axiosInstance.post('/initiate-upload', {
    fileName,
    fileType,
  });

  return response.data; // Contains `uploadId` and `key`
};

export const getPresignedUrls = async (uploadId: string, key: string, parts: number[]) => {
  const response = await axiosInstance.post('/presigned-urls', {
    uploadId,
    key,
    parts,
  });

  return response.data; // Contains array of { partNumber, signedUrl }
};

export const uploadPart = async (fileChunk: Blob, signedUrl: string) => {
  await axios.put(signedUrl, fileChunk, {
    headers: {
      'Content-Type': 'application/octet-stream', // Use appropriate content type
    },
  });
};

export const completeUpload = async (uploadId: string, key: string, parts: { ETag: string; PartNumber: number }[]) => {
  const response = await axiosInstance.post('/complete-upload', {
    uploadId,
    key,
    parts,
  });

  return response.data; // Contains completion message and location in S3
};
