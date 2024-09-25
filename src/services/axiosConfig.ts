// axiosConfig.ts
import axios from 'axios';

const axiosInstance = axios.create({
  // baseURL: 'http://10.10.3.31:3001/api/file-upload',
  baseURL: 'https://fileupload.growexx.com/api/file-upload',
  timeout: 5000,
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
  console.log('initiateUpload completed');
  return response.data.UploadId;
};

export const getPresignedUrls = async (bucketName: string, uploadId: string, key: string, parts: number[]) => {
  console.log('getPresignedUrls', parts);
  const response = await axiosInstance.post('/generate-presigned-urls', {
    'bucketName': bucketName,
    'uploadId': uploadId,
    'key': key,
    'partNumbers': parts,
  });
  console.log('response', response.data.presignedUrls);
  return response.data.presignedUrls;
};

export const uploadPart = async (fileChunk: Blob, signedUrl: string) => {
  await axios.put(signedUrl, fileChunk, {
    headers: {
      'Content-Type': 'application/octet-stream',
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
  console.log('completeUpload');
  return response.data;
};
