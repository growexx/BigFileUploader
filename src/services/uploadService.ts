import { createFileChunks } from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import BackgroundActions from 'react-native-background-actions';
import { completeUpload, getPresignedUrls, initiateUpload } from './axiosConfig';
import axios from 'axios';
import StorageHelper from '../helper/LocalStorage';

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_RETRIES = 3;
const LOW_BANDWIDTH_THRESHOLD = 1;
let uploadParts: { ETag: string; PartNumber: number; }[] = [];
let isPaused = false;

const uploadFileInChunks = async (params: any, progressCallback?: (progress: number) => void) => {
  try {
    uploadParts = [];
    const { fileUri, fileType, bucketName, fileName } = params.taskData;
    console.log('uploadFileInChunks', fileUri);

    const networkInfo = await NetworkHelper.getNetworkInfo();
    if (!networkInfo.isConnected) {
      throw new Error('No network connection');
    }

    const uploadDetails = {
      status: 'uploading',
      fileUri,
      fileType,
      bucketName,
      fileName,
    };

    await StorageHelper.setItem('uploadDetails', JSON.stringify(uploadDetails));
    console.log("LocalStorage uploadDetails:", await StorageHelper.getItem('uploadDetails'));

    const { chunks, partNumbers } = await createFileChunks(fileUri, CHUNK_SIZE) as { chunks: Blob[]; partNumbers: number[]; };
    const uploadId = await initiateUpload(bucketName, fileName);



    const signedUrls = await getPresignedUrls(bucketName, uploadId, fileName, partNumbers);
    await StorageHelper.setItem('uploadId', uploadId);
    console.log('Upload ID saved to local storage:', uploadId);
    await StorageHelper.setItem('signedUrls', JSON.stringify(signedUrls));
    console.log('Signed URLs saved to local storage:', signedUrls);

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

      while (isPaused) {
        console.log('Upload paused, waiting to resume...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait until resume
      }

      // Restart chunk upload if necessary
      const chunk = chunks[i];
      const signedUrl = signedUrls[i];
      console.log('Uploading chunk:', chunk.size);
      await uploadChunkWithRetry(signedUrl, chunk, 'application/octet-stream', i + 1, chunks.length);
      totalProgress = Math.round(((i + 1) / chunks.length) * 100);
      if (progressCallback) {
        progressCallback(totalProgress);
      }
      console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);
    }

    console.log('Upload completed successfully');
    console.log('uploadParts', uploadParts);
    const upload = await completeUpload(uploadId, bucketName, fileName, uploadParts);
    console.log('upload', JSON.stringify(upload));
    Toast.show({
      type: 'success',
      text1: 'Upload Complete',
      text2: 'File uploaded successfully.',
    });

    await StorageHelper.setItem('uploadDetails', JSON.stringify({ ...uploadDetails, status: 'completed' }));
    console.log("LocalStorage uploadDetails (completed):", await StorageHelper.getItem('uploadDetails'));
  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });

    await StorageHelper.setItem('uploadDetails', JSON.stringify({ ...uploadDetails, status: 'failed' }));
    console.log("LocalStorage uploadDetails (failed):", await StorageHelper.getItem('uploadDetails'));
  }
};

const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
};

export const uploadChunkWithRetry = async (
  signedUrl: string,
  chunk: any,
  fileType: string,
  partNumber: number,
  totalParts: number,
  retries = 0,
) => {
  try {
    console.log("i am here");
    console.log('signedUrl:' + signedUrl + ' ---partNumber:' + partNumber + ' ---totalParts:' + totalParts + ' ---chunk:' + chunk);
    console.log('chunk size', chunk.size);
    const arrayBuffer = await blobToArrayBuffer(chunk);
    const uint8Array = new Uint8Array(arrayBuffer);
    const response = await axios.put(signedUrl, uint8Array, {
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
        `Retrying chunk ${partNumber} (attempt ${retries + 1
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

const startUpload = async (options: any) => {
  console.log("background upload started");
  console.log(options);

  await StorageHelper.setItem('uploadStatus', 'started');
  console.log('Upload status set to "started"');

  await BackgroundActions.start(uploadFileInChunks, options);
  console.log("background upload ended");
};

const stopUpload = async () => {
  await BackgroundActions.stop();
  console.log('Background upload stopped');
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
      if (progressCallback) {
        progressCallback(progress);
      }
    }
  };

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

// Export pause and resume functions
export const pauseUpload = () => {
  isPaused = true;
  console.log('Pause requested');
  StorageHelper.setItem('uploadDetails', JSON.stringify({ status: 'paused' }));
  // StorageHelper.clearAll();

};

export const resumeUpload = () => {
  isPaused = false;
  console.log('Resume requested');
  // Optionally save to local storage
  StorageHelper.setItem('uploadDetails', JSON.stringify({ status: 'uploading' }));
};

export const handleUploadWhenAppIsOpened = async () => {

  const uploadDetails = await StorageHelper.getItem('uploadDetails');
  console.log('uploadDetails:', uploadDetails);
  if (uploadDetails) {
    const { status,bucketName, uploadId, fileUri, fileName, signedUrls, currentPartNumber } = JSON.parse(uploadDetails);
    console.log('status:', status);
    if (status === 'uploading') {
     //called createChunks
     const { chunks, partNumbers } = await createFileChunks(fileUri, CHUNK_SIZE) as { chunks: Blob[]; partNumbers: number[]; };
     for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const signedUrl = signedUrls[i];
      console.log('Uploading chunk:', chunk.size);
      if (currentPartNumber >= i + 1) {
      await uploadChunkWithRetry(signedUrl, chunk, 'application/octet-stream', i + 1, chunks.length);
      }
     }
     //call completeUpload
      const upload = await completeUpload(uploadId, bucketName, fileName, uploadParts);
      console.log('upload', JSON.stringify(upload));
    }
  }
}