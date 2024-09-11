// uploadService.ts
import { createFileChunks } from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import BackgroundActions from 'react-native-background-actions';
import { completeUpload, getPresignedUrls, initiateUpload } from './axiosConfig';
import axios from 'axios';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
const MAX_RETRIES = 3;
const LOW_BANDWIDTH_THRESHOLD = 1;
let uploadParts: { ETag: string; PartNumber: number; }[] = [];
const uploadFileInChunks = async (params: any) => {
  try {
  uploadParts = [];
const {fileUri, fileType, bucketName, key} = params.taskData;
console.log('uploadFileInChunks',fileUri);
    //const networkInfo = { type: 'wifi', effectiveType: '4g', downlinkMax: 100 };
  //
  // Check initial network connectivity and bandwidth
    const networkInfo = await NetworkHelper.getNetworkInfo();
    if (!networkInfo.isConnected) {
      throw new Error('No network connection');
    }

    console.log(`Network type: ${networkInfo.type}`);
    const chunks  = await createFileChunks(fileUri, CHUNK_SIZE);
    const uploadId = await initiateUpload(bucketName, key);
    const signedUrls = await getPresignedUrls(uploadId, key, chunks.map((chunk: Blob) => chunk.size));
    console.log('signedUrls:', signedUrls);
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
      const bandwidth = await NetworkHelper.getBandwidthEstimate();
      console.log(`Current bandwidth: ${bandwidth} Mbps`);
      if (bandwidth !== 'unknown' && bandwidth < LOW_BANDWIDTH_THRESHOLD) {
        Toast.show({
          type: 'error',
          text1: 'Warning',
          text2: 'Your internet speed is low. Upload may take longer than expected.',
        });
      }
      console.log('Uploading chunk:', chunks[i]);
      await uploadChunkWithRetry(signedUrls, chunks[i], 'application/octet-stream', i, chunks.length);
      console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);

    }
    console.log('Upload completed successfully');
    await completeUpload(uploadId, key, uploadParts);

  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });
  }
};

// Function to upload a chunk with retry logic
export const uploadChunkWithRetry = async (
  signedUrl: string,
  chunk: any,
  fileType: string,
  partNumber: number,
  totalParts: number,
  retries = 0,
) => {
  try {
    const response =  await axios.put(signedUrl, chunk, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      onUploadProgress: progressEvent => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 0),
        );
        console.log(`Chunk ${partNumber} upload progress: ${progress}%`);
        BackgroundActions.updateNotification({
          progressBar: {
            max: 100,
            value: Math.round(
              ((partNumber - 1 + progress / 100) / totalParts) * 100,
            ),
          },
        });
      },
    });

    console.log('response.headers.etag', response.headers.etag);
    uploadParts.push({ ETag: response.headers.etag, PartNumber: partNumber });
    console.log(`Chunk ${partNumber} uploaded successfully`);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(
        `Retrying chunk ${partNumber} (attempt ${
          retries + 1
        } of ${MAX_RETRIES})`,
      );
      await uploadChunkWithRetry(
        signedUrl,
        chunk,
        fileType,
        partNumber,
        totalParts,
        retries + 1,
      );
    } else {
      console.error(
        `Failed to upload chunk ${partNumber} after ${MAX_RETRIES} attempts.`,
      );
      throw error;
    }
  }
};


// Function to start the upload
const startUpload = async (options: any) => {

  await BackgroundActions.start(uploadFileInChunks, options);
};

// Function to stop the task
const stopUpload = async () => {
  await BackgroundActions.stop();
  console.log('Background upload stopped');
};

export const BackgroundChunkedUpload = async (fileUri: string | null) => {
  console.log('Background upload started',fileUri);
// Background task options
const options = {
  taskName: 'File Upload',
  taskTitle: 'Uploading File in Background',
  taskDesc: 'File is being uploaded in the background.',
  taskIcon: {
    name: 'ic_upload',
    type: 'drawable',
  },
  color: '#ff0000',
  linkingURI: 'yourapp://upload',
  progressBar: { max: 100, value: 0 },
  parameters: {
    delay: 1000,
    taskData: {
      fileUri: fileUri, // Example file URI
      bucketName: 'api-bucketfileupload.growexx.com', // Signed URL for S3
      fileType: 'video/mp4',
    },
  },
};

  //await BackgroundActions.start(uploadFileInChunks, options);
 startUpload(options);
};
