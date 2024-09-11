// uploadService.ts
import { createFileChunks } from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import BackgroundActions from 'react-native-background-actions';
import { completeUpload, getPresignedUrls, initiateUpload } from './axiosConfig';
import axios from 'axios';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk
const MAX_RETRIES = 3;
const LOW_BANDWIDTH_THRESHOLD = 1;
let uploadParts: { ETag: string; PartNumber: number; }[] = [];

const uploadFileInChunks = async (params: any, progressCallback?: (progress: number) => void) => {
  try {
    uploadParts = [];
    const { fileUri, fileType, bucketName, fileName } = params.taskData;
    console.log('uploadFileInChunks', fileUri);

    const networkInfo = await NetworkHelper.getNetworkInfo();
    if (!networkInfo.isConnected) {
      throw new Error('No network connection');
    }

    const { chunks, partNumbers } = await createFileChunks(fileUri, CHUNK_SIZE) as { chunks: Blob[]; partNumbers: number[]; };
    const uploadId = await initiateUpload(bucketName, fileName);
    const signedUrls = await getPresignedUrls(bucketName, uploadId, fileName, partNumbers);
    console.log('signedUrls:', signedUrls);
    console.log('partNumbers:', partNumbers);

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

    let totalProgress = 0;
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
      console.log('Uploading chunk:', chunks[i].size);
      await uploadChunkWithRetry(signedUrls[i], chunks[i], 'application/octet-stream', i + 1, chunks.length);
      totalProgress = Math.round(((i + 1) / chunks.length) * 100);
      if (progressCallback) {
        progressCallback(totalProgress);
      }
      console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);
    }
    console.log('Upload completed successfully');
    console.log('uploadParts', uploadParts);
    await completeUpload(uploadId, bucketName, fileName, uploadParts);

  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });
  }
};

const uploadChunkWithRetry = async (url: string, chunk: Blob, contentType: string, partNumber: number, totalParts: number) => {
  let retryCount = 0;
  while (retryCount < MAX_RETRIES) {
    try {
      const response = await axios.put(url, chunk, {
        headers: {
          'Content-Type': contentType,
        },
      });
      console.log(`Chunk ${partNumber} uploaded successfully`);
      uploadParts.push({
        ETag: response.headers.etag,
        PartNumber: partNumber,
      });
      return;
    } catch (error) {
      console.error(`Failed to upload chunk ${partNumber}. Retrying (${retryCount + 1}/${MAX_RETRIES})...`, error);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
    }
  }
  throw new Error(`Failed to upload chunk ${partNumber} after ${MAX_RETRIES} retries`);
};

export const BackgroundChunkedUpload = async (fileUri: string | null, fileName: string, progressCallback?: (progress: number) => void) => {
  console.log('Background upload started', fileUri);
  const options = {
    taskName: 'File Upload',
    taskTitle: 'Uploading File in Background',
    taskDesc: 'File is being uploaded in the background.',
    taskIcon: {
      name: 'ic_launcher',
      type: 'drawable',
    },
    color: '#ff0000',
    linkingURI: 'yourapp://upload',
    parameters: {
      delay: 1000,
      taskData: {
        fileUri: fileUri,
        bucketName: 'api-bucketfileupload.growexx.com',
        fileType: 'mixed',
        fileName: fileName
      },
    },
    progressCallback: (progress: number) => {
      // Implement the progress callback here
      if (progressCallback) {
        progressCallback(progress);
      }
    }
  };

  // Pass progress callback to uploadFileInChunks
  uploadFileInChunks({
    delay: 1000,
    taskData: {
      fileUri: fileUri,
      bucketName: 'api-bucketfileupload.growexx.com',
      fileType: 'mixed',
      fileName: fileName
    },
  }, options.progressCallback);
};
