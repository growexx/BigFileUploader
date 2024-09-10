// uploadService.ts
import axios from 'axios';
import { getSignedUrl } from './s3Config';
import { createFileChunks } from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
const LOW_BANDWIDTH_THRESHOLD = 1;

export const uploadFileInChunks = async (fileUri: string, bucketName: string, key: string) => {
  try {
    console.log(`Network type: ${networkInfo.type}`);
    console.log(`Effective network type: ${networkInfo.effectiveType}`);
    console.log(`Estimated bandwidth: ${networkInfo.downlinkMax} Mbps`);

    const chunkSize = 5 * 1024 * 1024; // 5MB
    const chunks = await createFileChunks(fileUri, chunkSize);
    const uploadId = await getSignedUrl(bucketName, key);
    console.log('Upload ID:', uploadId);

    NetworkHelper.monitorBandwidthChanges(
      () => {
        Toast.show({
          type: 'error',
          text1: 'Warning',
          text2: 'Your internet speed is low. Upload may take longer than expected.',
        });
      },
      () => {
        if (uploadId) {
          Toast.show({
            type: 'error',
            text1: 'Upload Paused',
            text2: 'Internet connection lost. Upload paused.',
          });
        }
      },
      () => {
        if (uploadId) {

          Toast.show({
            type: 'success',
            text1: 'Upload Resumed',
            text2: 'Internet connection regained. Upload resumed.',
          });
        }
      }
    );

    for (let i = 0; i < chunks.length; i++) {
      // Check bandwidth before uploading each chunk
      const bandwidth = await NetworkHelper.getBandwidthEstimate();
      console.log(`Current bandwidth: ${bandwidth} Mbps`);
      if (bandwidth < LOW_BANDWIDTH_THRESHOLD) {
        Toast.show({
          type: 'error',
          text1: 'Warning',
          text2: 'Your internet speed is low. Upload may take longer than expected.',
        });
      }

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
