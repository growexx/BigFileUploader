import { createFileChunks } from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import BackgroundActions from 'react-native-background-actions';
import { completeUpload, getPresignedUrls, initiateUpload } from './axiosConfig';
import axios, { CancelTokenSource } from 'axios';
import StorageHelper from '../helper/LocalStorage';
import { EventRegister } from 'react-native-event-listeners';

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_RETRIES = 3;
const LOW_BANDWIDTH_THRESHOLD = 1;
let uploadParts: { ETag: string; PartNumber: number; }[] = [];
let isPaused = false;
let currentUploadCancelSource: CancelTokenSource | null = null;

const uploadFileInChunks = async (params: any, progressCallback?: (progress: number) => void) => {
  try {
    uploadParts = [];
    const { fileUri, fileType, bucketName, fileName } = params.taskData;
    console.log('uploadFileInChunks', fileUri);

    const networkInfo = await NetworkHelper.getNetworkInfo();
    if (!networkInfo.isConnected) {
      throw new Error('No network connection');
    }
    await StorageHelper.setItem('uploadDetails', JSON.stringify({ status: 'processing' }));

    const { chunks, partNumbers } = await createFileChunks(fileUri, CHUNK_SIZE) as { chunks: Blob[]; partNumbers: number[]; };
    const uploadId = await initiateUpload(bucketName, fileName);
    const signedUrls = await getPresignedUrls(bucketName, uploadId, fileName, partNumbers);

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
      const bandwidth = await NetworkHelper.getNetworkInfo();
      console.log(`Current bandwidth: ${bandwidth.downlinkMax} Mbps`);
      if (bandwidth.downlinkMax !== 'unknown' && bandwidth.downlinkMax < LOW_BANDWIDTH_THRESHOLD && !bandwidth.isConnected) {
        console.error("Phone is not connected");

        Toast.show({
          type: 'error',
          text1: 'Warning',
          text2: 'Your internet speed is low. Upload may take longer than expected.',
        });
      }

      while (isPaused) {
        console.log('Upload paused, waiting to resume...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (currentUploadCancelSource === null) {
        currentUploadCancelSource = axios.CancelToken.source();
      }
      const chunk = chunks[i];
      const signedUrl = signedUrls[i];
      let uploadDetails = {
        status: 'uploading',
        signedUrl: signedUrls,
        uploadId: uploadId,
        fileUri: params.taskData.fileUri,
        fileType: params.taskData.fileType,
        bucketName: params.taskData.bucketName,
        fileName: params.taskData.fileName,
        partNumber: i + 1,
        totalParts: chunks.length,
        chunkProgress: 0,
      };

      await StorageHelper.setItem('uploadDetails', JSON.stringify(uploadDetails));

      try {
        await uploadChunkWithRetry(signedUrl, chunk, 'application/octet-stream', i + 1, chunks.length, (chunkProgress) => {
          uploadDetails.chunkProgress = chunkProgress;
          StorageHelper.setItem('uploadDetails', JSON.stringify(uploadDetails));
        });
        totalProgress = Math.round(((i + 1) / chunks.length) * 100);

        if (progressCallback) {
          progressCallback(totalProgress);
        }
        console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);
      } catch (error) {
        if (error.message === 'Upload cancelled') {
          console.log('Upload cancelled, will resume from this chunk');
          i--; // Retry this chunk when resumed
          continue;
        }
        throw error; // Re-throw if it's not a cancellation
      }
    }

    // Store uploadId and ETag only if upload is completed
    if (totalProgress === 100) {
      const upload = await completeUpload(uploadId, bucketName, fileName, uploadParts);
      console.log('upload', JSON.stringify(upload));
      // Store uploadId and ETag here
      await StorageHelper.setItem('uploadDetails', JSON.stringify({
        ...JSON.parse(await StorageHelper.getItem('uploadDetails')),
        uploadId: uploadId,
        eTag: uploadParts.map(part => part.ETag) // Store all ETags
      }));
    }

    console.log('Upload completed successfully');
    console.log('uploadParts', uploadParts);
    Toast.show({
      type: 'success',
      text1: 'Upload Complete',
      text2: 'File uploaded successfully.',
    });

    const storedUploadDetails = await StorageHelper.getItem('uploadDetails');
    if (storedUploadDetails) {
      const uploadDetails = JSON.parse(storedUploadDetails);
      await StorageHelper.setItem('uploadDetails', JSON.stringify({ ...uploadDetails, status: 'completed' }));
    }
  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });

    const storedUploadDetails = await StorageHelper.getItem('uploadDetails');
    if (storedUploadDetails) {
      const uploadDetails = JSON.parse(storedUploadDetails);
      await StorageHelper.setItem('uploadDetails', JSON.stringify({ ...uploadDetails, status: 'failed' }));
    }
  }
};

const uploadChunkWithRetry = async (
  signedUrl: string,
  chunk: any,
  fileType: string,
  partNumber: number,
  totalParts: number,
  progressCallback: (progress: number) => void,
  retries = 0,
) => {
  try {
    console.log("in uploadChunkWithRetry");
    console.log('signedUrl:' + signedUrl + ' ---partNumber:' + partNumber + ' ---totalParts:' + totalParts + ' ---chunk:' + chunk.size);

    const arrayBuffer = await blobToArrayBuffer(chunk);
    const uint8Array = new Uint8Array(arrayBuffer);

    currentUploadCancelSource = axios.CancelToken.source();

    const response = await axios.put(signedUrl, uint8Array, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      cancelToken: currentUploadCancelSource.token,
      onUploadProgress: progressEvent => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 0),
        );
        console.log(`Chunk ${partNumber} upload progress: ${progress}%`);
        progressCallback(progress);
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
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message);
      throw new Error('Upload cancelled');
    } else if (retries < MAX_RETRIES) {
      console.log(
        `Retrying chunk ${partNumber} (attempt ${retries + 1} of ${MAX_RETRIES})`,
      );
      await uploadChunkWithRetry(
        signedUrl,
        chunk,
        fileType,
        partNumber,
        totalParts,
        progressCallback,
        retries + 1,
      );
    } else {
      console.error(
        `Failed to upload chunk ${partNumber} after ${MAX_RETRIES} attempts.`,
      );
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: `Failed to upload chunk ${partNumber} after retries. Upload paused.`
      });
      isPaused = true; // Set pause action
      throw error;
    }
  } finally {
    currentUploadCancelSource = null;
  }
};

export const pauseUpload = async () => {
  isPaused = true;
  console.log('Pause requested');
  if (currentUploadCancelSource) {
    currentUploadCancelSource.cancel('Upload paused');
    currentUploadCancelSource = null; // Reset the cancel source

  }
  const storedUploadDetails = await StorageHelper.getItem('uploadDetails');

  if (storedUploadDetails) {
    const uploadDetails = JSON.parse(storedUploadDetails);
    await StorageHelper.setItem('uploadDetails', JSON.stringify({ ...uploadDetails, status: 'paused' }));
  }
};

export const resumeUpload = async () => {
  isPaused = false;
  console.log('Resume requested');

  const storedUploadDetails = await StorageHelper.getItem('uploadDetails');
  if (storedUploadDetails) {
    const uploadDetails = JSON.parse(storedUploadDetails);
    await StorageHelper.setItem('uploadDetails', JSON.stringify({ ...uploadDetails, status: 'uploading' }));
  }
  handleUploadWhenAppIsOpened();
};

export const handleUploadWhenAppIsOpened = async () => {
  const uploadDetails = await StorageHelper.getItem('uploadDetails');
  if (uploadDetails) {
    const { status, bucketName, uploadId, fileUri, fileName, partNumber, signedUrl, totalParts } = JSON.parse(uploadDetails);
    console.log("uploadDetails : " + bucketName);

    if (status === 'uploading' || status === 'paused') {
      const { chunks, partNumbers } = await createFileChunks(fileUri, CHUNK_SIZE) as { chunks: Blob[]; partNumbers: number[]; };
      for (let i = partNumber - 1; i < chunks.length; i++) {
        let totalProgress = (i / totalParts) * 100;
        updateProgress(totalProgress);
        isPaused = status === 'paused';
        console.log("Paused? :" + isPaused + " " + status);

        while (isPaused) {
          console.log('Upload paused, waiting to resume...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        try {
          await uploadChunkWithRetry(signedUrl[i], chunks[i], 'application/octet-stream', i + 1, totalParts, (chunkProgress) => {
            const chunkContribution = (1 / totalParts) * (chunkProgress / 100);
            totalProgress = ((i / totalParts) * 100) + (chunkContribution * 100);
            updateProgress(totalProgress);

            StorageHelper.setItem('uploadDetails', JSON.stringify({
              ...JSON.parse(uploadDetails),
              partNumber: i + 1,
              chunkProgress: chunkProgress,
              totalProgress: totalProgress
            }));
          });
        } catch (error) {
          console.error(`Error uploading chunk ${i + 1}:`, error);
          if (error.message === 'Upload cancelled') {
            break; // Stop if upload was cancelled (paused)
          }
        }
      }
      if (status !== 'paused') {
        const upload = await completeUpload(uploadId, bucketName, fileName, uploadParts);
        console.log('Upload completed after app refresh:', JSON.stringify(upload));
        updateProgress(100);
        await StorageHelper.clearAll();
      }
    }
  }
};

const updateProgress = (progress: number) => {
  const roundedProgress = Math.round(progress * 100) / 100;
  console.log(`Upload progress: ${roundedProgress}%`);

  EventRegister.emit('uploadProgress', roundedProgress);
};

// Helper function (unchanged)
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