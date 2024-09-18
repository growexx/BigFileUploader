// axiosConfig.ts
import axios from 'axios';

const axiosInstance = axios.create({
  // baseURL: 'http://10.10.3.31:3001/api/file-upload',
  baseURL: 'https://fileupload.growexx.com/api/file-upload',
  timeout: 50000,
  headers: {},
});

export default axiosInstance;

export const initiateUpload = async (bucketName: string, fileName: string) => {
  console.log(bucketName + ' && ' + fileName);
  console.log('initiateUpload');

  const response = await axiosInstance.post('/initiate-upload', {
    'bucketName': bucketName,
    'key': fileName,
  });
  return response.data.UploadId;
};

export const getPresignedUrls = async (bucketName: string, uploadId: string, key: string, parts: number[]) => {
  const response = await axiosInstance.post('/generate-presigned-urls', {
    'bucketName': bucketName,
    'uploadId': uploadId,
    'key': key,
    'partNumbers': parts,
  });

  return response.data.presignedUrls; // Contains array of { partNumber, signedUrl }
};

export const uploadPart = async (fileChunk: Blob, signedUrl: string) => {
  await axios.put(signedUrl, fileChunk, {
    headers: {
      'Content-Type': 'application/octet-stream', // Use appropriate content type
    },
  });
};

export const completeUpload = async (uploadId: string, bucketName: string, key: string, parts: { ETag: string; PartNumber: number }[]) => {
  console.log('completeUpload', parts);
  const response = await axiosInstance.post('/complete-upload', {
    'bucketName': bucketName,
    'uploadId': uploadId,
    'key': key,
    'parts': parts,
  });
  console.log('completeUpload : ' + JSON.stringify(response));

  return response.data; // Contains completion message and location in S3
};
