import {createFileChunks} from '../fileUtils';
import NetworkHelper from '../helper/NetworkHelper';
import Toast from 'react-native-toast-message';
import BackgroundActions from 'react-native-background-actions';
import BackgroundService from 'react-native-background-actions';
import {completeUpload, getPresignedUrls, initiateUpload} from './axiosConfig';
import axios, {CancelTokenSource} from 'axios';
import StorageHelper, {
  STORAGE_KEY_CHUNKS,
  STORAGE_KEY_STATUS,
  STORAGE_KEY_UPLOAD_DETAILS,
} from '../helper/LocalStorage';
import RNFS from 'react-native-fs';
const MAX_RETRIES = 3;

let uploadParts: {ETag: string; PartNumber: number}[] = [];
let currentUploadCancelSource: CancelTokenSource | null = null;
let uploadedChunk: any = 0;
let isPaused = false;
let uploadIds = '';
// Initiate upload and get presigned URLs once
const initiateUploadProcess = async (fileName: string, bucketName: string) => {
  let previuseUploadId: string = '';
  const uploadDetails = await StorageHelper.getItem(STORAGE_KEY_UPLOAD_DETAILS);
  if (uploadDetails) {
  const {uploadId, etags} = JSON.parse(uploadDetails);
   uploadParts = etags;
    console.log('previuseUploadId', uploadId);
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
  try {
    await RNFS.unlink(filePath);
    console.log('File deleted:', filePath);
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
};

// Example usage after uploading
const clearCacheAfterUpload = async (filePath: string) => {
  // Perform your upload logic here...
  await cleanUpOldCache();
  // After the upload is complete, clear the cache
  await deleteFile(filePath);
};

//First time upload without intruptions
const uploadFileInChunks = async (
  params: any,
  progressCallback?: (progress: number) => void,
) => {
  try {
    const {fileUri, bucketName, fileName} = params.taskData;
    console.log('uploadFileInChunks', fileUri);
    const networkInfo = await NetworkHelper.getNetworkInfo();
    if (!networkInfo.isConnected) {
      throw new Error('No network connection');
    }
    // const {
    //   chunks,
    //   uploadedChunkSize,
    //   blobSize,
    // }: {
    //   chunks: Blob[];
    //   partNumbers: number[];
    //   uploadedChunkSize: number[];
    //   blobSize: number;
    // } = (await createFileChunks(fileUri)) as unknown as {
    //   chunks: Blob[];
    //   partNumbers: number[];
    //   uploadedChunkSize: number[];
    //   blobSize: number;
    // };

    const chunkSize = 5 * 1024 * 1024; // 10MB chunks
    const fileStat = await RNFS.stat(fileUri);

    const fileSize = fileStat.size;
    let start = 0;
    let end = chunkSize;

    while (start < fileSize) {
      if (end > fileSize) {
        end = fileSize;
      }
    const chunk = await RNFS.read(fileUri, end - start, start, 'base64');
    // NetworkHelper.validateNetworkAndDataSize(chunk.length).then(
    //   async (isValid: any) => {
    //     if (isValid) {
          console.log('chunks size', chunk.length);
        //  uploadedChunk = uploadedChunkSize;
          const uploadId = await initiateUploadProcess(fileName, bucketName);
          monitorNetworkChanges(uploadId);
          let totalProgress = 0;
          // for (let i = 0; i < chunks.length; i++) {
            while (isPaused) {
              console.log('Upload paused, waiting to resume...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              return;
            }
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
            console.log('signedUrl', signedUrl);
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
            totalProgress = end / fileSize * 100; //Math.round(((i + 1) / chunks.length) * 100);
            console.log('totalProgress', totalProgress);
            if (progressCallback) {
              progressCallback(totalProgress);
            }
            // console.log(`Uploaded chunk ${i + 1} of ${chunks.length}`);
         // }
          // const upload = await completeUpload(
          //   uploadId,
          //   bucketName,
          //   fileName,
          //   uploadParts,
          // );

          // if (upload) {
          //   console.log('upload', JSON.stringify(upload));
          //   await StorageHelper.removeItem(STORAGE_KEY_UPLOAD_DETAILS);
          //   await StorageHelper.setItem(STORAGE_KEY_STATUS, 'completed');
          //   await StorageHelper.setItem(STORAGE_KEY_CHUNKS, '0');
          // }
          // // Proceed with the download or upload
          // console.log('Starting data transfer...');
      //   } else {
      //     console.log('Data transfer cancelled due to network limits.');
      //     throw new Error('Data transfer cancelled due to network limits.');
      //  // }
     // },
   // );
  }
  const upload = await completeUpload(
    uploadIds,
    bucketName,
    fileName,
    uploadParts,
  );

  if (upload) {
    console.log('upload', JSON.stringify(upload));
    await StorageHelper.removeItem(STORAGE_KEY_UPLOAD_DETAILS);
    await StorageHelper.setItem(STORAGE_KEY_STATUS, 'completed');
    await StorageHelper.setItem(STORAGE_KEY_CHUNKS, '0');
  }
  // Proceed with the download or upload
  console.log('Starting data transfer...');
  clearCacheAfterUpload(fileUri);
  } catch (err) {
    console.error('Upload failed:', err);
    //await StorageHelper.setItem(STORAGE_KEY_STATUS, 'failed');
    await StorageHelper.removeItem(STORAGE_KEY_UPLOAD_DETAILS);
    await StorageHelper.setItem(STORAGE_KEY_STATUS, 'completed');
    await StorageHelper.setItem(STORAGE_KEY_CHUNKS, '0');
  }
};
const cleanUpOldCache = async () => {
  const cacheDir = RNFS.CachesDirectoryPath;
  const files = await RNFS.readDir(cacheDir);

  for (const file of files) {
    // Implement your logic to determine if the file is old or unused
    // Example: Delete files older than 24 hours
    const stats = await RNFS.stat(file.path);
    const fileAge = Date.now() - stats.mtimeMs;
    const maxAge = 1 * 60 * 1000; // 1 Min

    if (fileAge > maxAge) {
      await RNFS.unlink(file.path);
      console.log(`Old file deleted: ${file.path}`);
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
    console.log('in uploadChunkWithRetry');
    var fileProgress = 0;
    // const arrayBuffer = await blobToArrayBuffer(chunk);
    // const uint8Array = new Uint8Array(arrayBuffer);

    currentUploadCancelSource = axios.CancelToken.source();

    const response = await axios.put(signedUrl, chunk, {
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
    uploadedChunk = uploadedChunk + chunk.size;
    console.log('response.headers.etag', response.headers.etag);
    await StorageHelper.setItem(STORAGE_KEY_CHUNKS, uploadedChunk.toString());
    // Save ETag only when the chunk's upload progress is 100%
    // if (progress === 100) {

    console.log(`Chunk ${partNumber} uploaded successfully`);
    // Save ETag only when the chunk's upload progress is 100%
    if (fileProgress === 100) {
      uploadParts.push({ETag: response.headers.etag, PartNumber: partNumber});
      console.log(
        `Chunk ${partNumber} uploaded successfully with ETag: ${response.headers.etag}`,
      );
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
    } else if (retries < MAX_RETRIES) {
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
      console.error(
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
// Mock sleep function for async delay
const sleep = (time: number | undefined) => new Promise((resolve) => setTimeout(resolve, time));

// Background task function
const veryIntensiveTask = async (taskData?: { delay: number } | undefined) => {
  const { delay } = taskData || { delay: 1000 };
  for (let i = 0; BackgroundService.isRunning(); i++) {
    console.log(`Iteration ${i}`);
    await sleep(delay);
  }
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
    progressCallback: (progress: number) => {
      if (progressCallback) {
        progressCallback(progress);
      }
    },
  };

  await BackgroundActions.start(async taskData => {
    try {
      await uploadFileInChunks(taskData, options.progressCallback);
      await BackgroundActions.updateNotification({
        taskTitle: 'Upload Complete',
        taskDesc: 'Your file has been uploaded successfully.',
        progressBar: {max: 100, value: 100},
      });
      // Stop the background task
      await BackgroundActions.stop();
    } catch (error) {
      console.error('Background upload error:', error);
      await BackgroundActions.updateNotification({
        taskTitle: 'Upload Failed',
        taskDesc: 'There was an error uploading your file.',
      });
      await BackgroundActions.stop();
    }
  }, options);

  // uploadFileInChunks({
  //   delay: 1000,
  //   taskData: {
  //     fileUri: fileUri,
  //     bucketName: 'api-bucketfileupload.growexx.com',
  //     fileType: 'mixed',
  //     fileName: fileName,
  //   },
  // }, options.progressCallback);
};

export const resumeUpload = async (
  isPausedByUser: boolean,
  progressCallback?: (progress: number) => void,
) => {
  Toast.show({
    type: 'info',
    text1: 'Uploading Resumed',
  });
  // uploadParts = [];
  console.log('Resume requested');
  //if (!isPausedByUser) {
  const uploadDetails = await StorageHelper.getItem(STORAGE_KEY_UPLOAD_DETAILS);
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
  //   isPaused = !isPausedByUser;
  // }
};
export const startUploadFile = async (
  fileUri: string | null,
  fileName: string,
  progressCallback?: (progress: number) => void,
) => {
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
const monitorNetworkChanges = (uploadId: string) => {
  console.log('Monitoring network changes');
  NetworkHelper.monitorBandwidthChanges(
    () => {
      console.log('Low bandwidth detected');
      Toast.show({
        type: 'error',
        text1: 'Warning',
        text2:
          'Your internet speed is low. Upload may take longer than expected.',
      });
    },
    () => {
      if (uploadId) {
        console.log('Internet connection lost. Pausing upload...');
        isPaused = true;
        Toast.show({
          type: 'error',
          text1: 'Upload Paused',
          text2: 'Internet connection lost. Upload paused.',
        });
      }
    },
    () => {
      if (uploadId) {
        console.log('Internet connection regained. Resuming upload...');
        isPaused = false;
        // Toast.show({
        //   type: 'success',
        //   text1: 'Upload Resumed',
        //   text2: 'Internet connection regained. Upload resumed.',
        // });
      }
    },
  );
};
