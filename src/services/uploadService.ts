import axios from 'axios';
import { getSignedUrl } from './s3Config';
import { createFileChunks } from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

const LOW_BANDWIDTH_THRESHOLD = 1;

export const uploadFileInChunks = async (fileUri: string, bucketName: string, key: string) => {
  try {
    // Get network information
    const networkInfo = await NetworkHelper.getNetworkInfo();
    console.log(`Network type: ${networkInfo.type}`);
    console.log(`Effective network type: ${networkInfo.effectiveType}`);
    console.log(`Estimated bandwidth: ${networkInfo.downlinkMax} Mbps`);

    console.log("fileUri :" + fileUri);

    const chunkSize = 50 * 1024 * 1024; // 5MB
    const chunks = await createFileChunks(fileUri, chunkSize);
    const uploadId = await getSignedUrl(bucketName, key);
    console.log('Upload ID:', uploadId);

    // Monitor bandwidth changes
    const unsubscribe = NetworkHelper.monitorBandwidthChanges(
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
      const bandwidth = await NetworkHelper.getBandwidthEstimate();
      console.log(`Current bandwidth: ${bandwidth} Mbps`);
      if (bandwidth !== 'unknown' && bandwidth < LOW_BANDWIDTH_THRESHOLD) {
        Toast.show({
          type: 'error',
          text1: 'Warning',
          text2: 'Your internet speed is low. Upload may take longer than expected.',
        });
      }

      const signedUrl = await getSignedUrl(bucketName, `${key}.part${i + 1}`);
      try {
        await axios.put(signedUrl, chunks[i], {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);
      } catch (error) {
        console.error(`Failed to upload chunk ${i + 1}:`, error);
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: `Chunk ${i + 1} failed to upload.`,
        });
        // Optional: handle retry logic here
        break; // Stop further uploads on failure
      }
    }

    console.log('Upload completed successfully');
  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });
  }
};
