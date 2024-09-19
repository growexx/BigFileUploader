import {
  createDynamicChukSize,
  getUploadedChunks,
} from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import BackgroundActions from 'react-native-background-actions';
import {completeUpload, getPresignedUrls, initiateUpload} from './axiosConfig';
import axios, {CancelTokenSource} from 'axios';
import StorageHelper, {
  STORAGE_KEY_CHUNKS,
  STORAGE_KEY_STATUS,
  STORAGE_KEY_UPLOAD_DETAILS,
} from '../helper/LocalStorage';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { int } from 'aws-sdk/clients/datapipeline';
import { deleteCachedFiles } from '../helper/FileUtils';
const MAX_RETRIES = 3;

let uploadParts: {ETag: string; PartNumber: number}[] = [];
let currentUploadCancelSource: CancelTokenSource | null = null;
let uploadedChunk: any = 0;
let isNetworkConnected:int = 1;
let isPaused = false;
let uploadIds = '';
let uploadInProgress = false;
// Initiate upload and get presigned URLs once
const initiateUploadProcess = async (fileName: string, bucketName: string) => {
  let previuseUploadId: string = '';
  const uploadDetails = await StorageHelper.getItem(STORAGE_KEY_UPLOAD_DETAILS);
  if (uploadDetails) {
    const {uploadId, etags} = JSON.parse(uploadDetails);
    uploadParts = etags;
    if (uploadId) {
      previuseUploadId = uploadId;
    } else {
      uploadParts = [];
      await StorageHelper.setItem(STORAGE_KEY_STATUS, 'processing');
      previuseUploadId = await initiateUpload(bucketName, fileName);
    }
  } else {
    // await StorageHelper.setItem(STORAGE_KEY_STATUS, 'processing');
    // previuseUploadId = await initiateUpload(bucketName, fileName);
  }
  uploadIds = previuseUploadId;
  return previuseUploadId;
};
// Function to delete a file
const deleteFile = async (filePath: string) => {
  RNFS.exists(filePath)
    .then(exists => {
      if (exists) {
        return RNFS.unlink(filePath);
      } else {
        console.log('File does not exist:', filePath);
      }
    })
    .then(() => {
      console.log('File deleted successfully');
    })
    .catch(error => {
      console.log('Failed to delete file:', error);
    });
};

// Example usage after uploading
const clearCacheAfterUpload = async (filePath: string) => {
  // After the upload is complete, clear the cache
  await deleteFile(filePath);
  await cleanUpOldCache();
};

//First time upload without intruptions
const uploadFileInChunks = async (
  params: any,
  progressCallback?: (progress: number) => void,
) => {
  try {
    const {fileUri, bucketName, fileName} = params.taskData;
    const networkInfo = await NetworkHelper.getNetworkInfo();
    if (!networkInfo.isConnected) {
      throw new Error('No network connection');
    }

    const fileStat = await RNFS.stat(fileUri);
    const fileSize = fileStat.size;
    uploadedChunk = (await getUploadedChunks()) || 0;
    let start: number = uploadedChunk;
    let chunkSize = await createDynamicChukSize();
    console.log('uploadedChunk size', uploadedChunk);
    let end = start + chunkSize;

    while (start < fileSize) {
      if (isPaused) {
      console.log('Upload paused, waiting to resume...');
       return;
      }
      if (end > fileSize) {
        end = fileSize;
      }
      const chunk = await RNFS.read(fileUri, end - start, start, 'base64');
      const uploadId = await initiateUploadProcess(fileName, bucketName);
      let totalProgress = 0;
      // for (let i = 0; i < chunks.length; i++) {
      const signedUrls = await getPresignedUrls(
        bucketName,
        uploadId,
        fileName,
        [uploadParts.length + 1],
      );

      if (currentUploadCancelSource === null) {
        currentUploadCancelSource = axios.CancelToken.source();
      }
      // const chunk = chunks[i];
      const signedUrl = signedUrls[0];
      const existingUploadDetailsString = await StorageHelper.getItem(
        STORAGE_KEY_UPLOAD_DETAILS,
      );
      const existingUploadDetails = existingUploadDetailsString
        ? JSON.parse(existingUploadDetailsString)
        : null;
      let uploadDetails = {
        signedUrl: signedUrl,
        uploadId: uploadId,
        fileUri: params.taskData.fileUri,
        fileType: params.taskData.fileType,
        bucketName: params.taskData.bucketName,
        fileName: params.taskData.fileName,
        partNumber: uploadParts.length + 1,
        etags: existingUploadDetails?.etags || [],
        chunkProgress: 0,
      };
      await StorageHelper.setItem(STORAGE_KEY_STATUS, 'uploading');
      await StorageHelper.setItem(
        STORAGE_KEY_UPLOAD_DETAILS,
        JSON.stringify(uploadDetails),
      );
      await uploadChunkWithRetry(
        signedUrl,
        chunk,
        uploadParts.length + 1,
        chunkProgress => {
          uploadDetails.chunkProgress = chunkProgress;
          StorageHelper.setItem(
            STORAGE_KEY_UPLOAD_DETAILS,
            JSON.stringify(uploadDetails),
          );
        },
      );
      start = end;
      end = start + chunkSize;
      if(!isPaused) {
        totalProgress = (start / fileSize) * 100; //Math.round(((i + 1) / chunks.length) * 100);
        console.log('uploadedChunk start', start);
        console.log('totalProgress', totalProgress);
        if (progressCallback) {
          progressCallback(totalProgress);
        }
      }

    }
    if (!isPaused) {
      const upload = await completeUpload(
        uploadIds,
        bucketName,
        fileName,
        uploadParts,
      );
      if (upload) {
        uploadInProgress = false;
        console.log('upload', JSON.stringify(upload));
        await StorageHelper.removeItem(STORAGE_KEY_UPLOAD_DETAILS);
        await StorageHelper.setItem(STORAGE_KEY_STATUS, 'completed');
        await StorageHelper.setItem(STORAGE_KEY_CHUNKS, '0');
      }
      if (progressCallback) {
        progressCallback(100);
      }
    }

    // Proceed with the download or upload
    console.log('Starting data transfer...');
    clearCacheAfterUpload(fileUri);
  } catch (err) {
    console.log('Upload failed:', err);
    if ((err as Error)?.message !== 'No network connection') {
    //await StorageHelper.setItem(STORAGE_KEY_STATUS, 'failed');
    await StorageHelper.removeItem(STORAGE_KEY_UPLOAD_DETAILS);
    await StorageHelper.setItem(STORAGE_KEY_STATUS, 'completed');
    await StorageHelper.setItem(STORAGE_KEY_CHUNKS, '0');
    }
  }
};
const cleanUpOldCache = async () => {
  await AsyncStorage.clear();
  const cacheDir = RNFS.CachesDirectoryPath;
  const files = await RNFS.readDir(cacheDir);
  for (const file of files) {
    const fileExists = await RNFS.exists(file.path);
    if (fileExists) {
      // Implement your logic to determine if the file is old or unused
      // Example: Delete files older than 24 hours
      const stats = await RNFS.stat(file.path);
      const fileAge = Date.now() - stats.mtime;
      const maxAge = 1 * 60 * 1000; // 1 Min

      if (fileAge > maxAge) {
        await RNFS.unlink(file.path);
      }
    }
  }
};
const uploadChunkWithRetry = async (
  signedUrl: string,
  chunk: any,
  partNumber: number,
  progressCallback: (progress: number) => void,
  retries = 0,
) => {
  try {
    console.log('chunk upload started');
    uploadInProgress = true;
    var fileProgress = 0;
    const byteCharacters = atob(chunk);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArrayChunk = new Uint8Array(byteNumbers);
    currentUploadCancelSource = axios.CancelToken.source();

    const response = await axios.put(signedUrl, byteArrayChunk, {
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
        fileProgress = progress;
      },
    });
    uploadedChunk = uploadedChunk + byteArrayChunk.length;
    await StorageHelper.setItem(STORAGE_KEY_CHUNKS, uploadedChunk.toString());
    //console.log(`Chunk ${partNumber} uploaded successfully`);
    // Save ETag only when the chunk's upload progress is 100%
    if (fileProgress === 100) {
      uploadParts.push({ETag: response.headers.etag, PartNumber: partNumber});
      const uploadDetails = await StorageHelper.getItem(
        STORAGE_KEY_UPLOAD_DETAILS,
      );
      if (uploadDetails) {
        const uploadDetailsObj = JSON.parse(uploadDetails);
        const etagsArray = uploadDetailsObj.etags;

        await etagsArray.push({
          ETag: response.headers.etag,
          PartNumber: partNumber,
        });
        await StorageHelper.setItem(
          STORAGE_KEY_UPLOAD_DETAILS,
          JSON.stringify({
            ...uploadDetailsObj,
            etags: etagsArray,
          }),
        );
      }
    }
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message);
    } else if (retries < MAX_RETRIES && isNetworkConnected >= 1) {
      console.log(
        `Retrying chunk ${partNumber} (attempt ${
          retries + 1
        } of ${MAX_RETRIES})`,
      );
      await uploadChunkWithRetry(
        signedUrl,
        chunk,
        partNumber,
        progressCallback,
        retries + 1,
      );
    } else {
      console.log(
        `Failed to upload chunk ${partNumber} after ${MAX_RETRIES} attempts.`,
      );
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: `Failed to upload chunk ${partNumber} after retries. Upload paused.`,
      });
      throw error;
    }
  } finally {
    currentUploadCancelSource = null;
  }
};

export const pauseUpload = async () => {
  isPaused = true;
  Toast.show({
    type: 'info',
    text1: 'Upload Paused',
  });
  console.log('Pause requested');
  if (currentUploadCancelSource) {
    currentUploadCancelSource.cancel('Upload paused');
    currentUploadCancelSource = null; // Reset the cancel source
  }
  BackgroundActions.stop();
  await StorageHelper.setItem(STORAGE_KEY_STATUS, 'paused');
};

// Function to stop the background upload
export const stopBackgroundUpload = async () => {
  isPaused = true;
  await BackgroundActions.stop();
  if (currentUploadCancelSource) {
    currentUploadCancelSource.cancel('Upload paused');
    currentUploadCancelSource = null; // Reset the cancel source
  }
  await StorageHelper.setItem(STORAGE_KEY_STATUS, 'cleared');
  console.log('Background upload stopped');
};

export const BackgroundChunkedUpload = async (
  fileUri: string | null,
  fileName: string,
  progressCallback?: (progress: number) => void,
) => {
  if (!fileUri) {
    return;
  }
  const options = {
    taskName: 'ExampleTask',
    taskTitle: 'Example Background Task',
    taskDesc: 'Running background task',
    taskIcon: {
      name: 'ic_launcher',
      type: 'mipmap',
    },
    color: '#ff0000',
    parameters: {
      delay: 1000,
      taskData: {
        fileUri: fileUri,
        bucketName: 'api-bucketfileupload.growexx.com',
        fileType: 'mixed',
        fileName: fileName,
      },
    },
  };

  try {
    // Start the background task
    await BackgroundActions.start(async (taskData) => {
      console.log('Background upload started', taskData);

      try {
        // Upload file in chunks
        await uploadFileInChunks(taskData, async (progress: number) => {
          // Update the progress bar as the upload progresses
          if (progressCallback) {
            progressCallback(progress);
          }

          // Check if the background task is running before updating the notification
          if (await BackgroundActions.isRunning() && progress === 100) {
            console.log(`Task is running. Updating notification with progress: ${progress}%`);
            // Update the notification progress
            await BackgroundActions.updateNotification({
              taskTitle: 'Upload Complete',
              taskDesc: 'Your file has been uploaded successfully.',
              progressBar: { max: 100, value: 100 },
            });
            await BackgroundActions.stop();
          } else {
            console.log('Background task is not running, skipping notification update.');
          }
        });
      } catch (error) {
        console.error('Background upload error:', error);
        // Handle upload failure
        if (await BackgroundActions.isRunning()) {
          await BackgroundActions.updateNotification({
            taskTitle: 'Upload Failed',
            taskDesc: 'There was an error uploading your file.',
          });
        }
      } finally {
        // Stop the background task after upload completes or fails
        await BackgroundActions.stop();
      }
    }, options);

  } catch (error) {
    console.error('Error starting background upload:', error);
  }
};

export const resumeUpload = async (
  isPausedByUser: boolean,
  progressCallback?: (progress: number) => void,
) => {
  Toast.show({
    type: 'info',
    text1: 'Uploading Resumed',
  });
  isPaused = false;
  // uploadParts = [];
  console.log('Resume requested', isPausedByUser);
  //if (!isPausedByUser) {
    console.log('Resume requested by user');
    const uploadDetails = await StorageHelper.getItem(
      STORAGE_KEY_UPLOAD_DETAILS,
    );
    const status = await StorageHelper.getItem(STORAGE_KEY_STATUS);
    if (uploadDetails) {
      await StorageHelper.setItem(STORAGE_KEY_STATUS, 'uploading');
      const {fileUri, fileName} = JSON.parse(uploadDetails);
      if (status === 'uploading' || status === 'paused') {
        BackgroundChunkedUpload(fileUri, fileName, (progress: number) => {
          if (progressCallback) {
            progressCallback(progress);
          }
        });
      }
    }
  // } else {
  //   console.log('Resume requested by auto matically');
  //   isPaused = false;
  // }
};
export const startUploadFile = async (
  fileUri: string | null,
  fileName: string,
  progressCallback?: (progress: number) => void,
) => {
  isPaused = false;
  uploadParts = [];
  BackgroundChunkedUpload(fileUri, fileName, (progress: number) => {
    if (progressCallback) {
      progressCallback(progress);
    }
  });
  // } else {
  //   isPaused = !isPausedByUser;
  // }
};
type NetworkStatusCallback = (isNetworkConnected: number, uploadProcessInprogress: boolean) => void;

export const monitorNetworkChanges = (onNetworkStatusChange: NetworkStatusCallback) => {
  console.log('Monitoring network changes',  uploadInProgress);
  // Default to true
  NetworkHelper.monitorBandwidthChanges(
    () => {
      isNetworkConnected = 2;
      console.log('Low bandwidth detected');
      Toast.show({
        type: 'error',
        text1: 'Warning',
        text2:
          'Your internet speed is low. Upload may take longer than expected.',
      });
      onNetworkStatusChange(isNetworkConnected, uploadInProgress);
    },
    () => {
     isNetworkConnected = 0; // Default to true
        console.log('Internet connection lost. Pausing upload...');
        Toast.show({
          type: 'error',
          text1: 'No Internet Connection',
          text2: 'Internet connection lost. please check your network connection.',
        });
        onNetworkStatusChange(isNetworkConnected, uploadInProgress);
    },
    () => {

        isNetworkConnected = 1;
        console.log('Internet connection regained. Resuming upload...');
        onNetworkStatusChange(isNetworkConnected, uploadInProgress);
        // isPaused = false;
        // Toast.show({
        //   type: 'success',
        //   text1: 'Upload Resumed',
        //   text2: 'Internet connection regained. Upload resumed.',
        // });
    },
  );
};
export const periodicDataCleanup = async () => {
  console.log('Performing scheduled data cleanup');
  const ONE_WEEK_IN_MS = 15 * 60 * 1000; // 2 min
  await deleteCachedFiles(RNFS.CachesDirectoryPath, ONE_WEEK_IN_MS);
  await deleteCachedFiles(RNFS.TemporaryDirectoryPath, ONE_WEEK_IN_MS);
  await deleteCachedFiles(RNFS.DocumentDirectoryPath, ONE_WEEK_IN_MS);
};
