// axiosConfig.ts
import axios from 'axios';
import { getSignedUrl } from './s3Config';

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com', // Replace with your API base URL
  timeout: 1000,
  headers: {},
});

export const uploadFileToS3 = async (fileUri: string, bucketName: string, key: string) => {
    try {
      const signedUrl = await getSignedUrl(bucketName, key);
      const file = await fetch(fileUri);
      const blob = await file.blob();

      const response = await axios.put(signedUrl, blob, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload successful:', response);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };
export default axiosInstance;
