/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react-native/no-inline-styles */
import React, {useState, useEffect, useCallback} from 'react';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import {Bar} from 'react-native-progress';
import {
  monitorNetworkChanges,
  pauseUpload,
  resumeUpload,
  resumeUploadAfterAppRestard,
  startUploadFile,
  stopBackgroundUpload,
} from '../services/uploadService';
import StorageHelper, {STORAGE_KEY_STATUS} from '../helper/LocalStorage';
import Toast from 'react-native-toast-message';
import {
  requestNotificationPermission,
  requestStoragePermission,
} from '../helper/util';
import {
  deleteCachedFiles,
  requestManageExternalStoragePermission,
} from '../helper/FileUtils';
import {styles} from './upload_style';
import { deleteFile } from '../fileUtils';

const UploadScreen: React.FC = () => {
  const [progress, setProgress] = useState<number>(1);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [appRestarted, setAppRestarted] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [lastFileName, setlastFileName] = useState<string>('');
  const [uploadCompleted, setUploadCompleted] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const [isConnected, setIsConnected] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const APP_RESTARTED_MESSAGE = `Your previous upload of "${lastFileName}" was interrupted. Please select the same file to continue.`;

  const handleNetworkStatusChange = useCallback(
    async (internetStatus: number, uploadInProgress: boolean) => {
      // Update connection status
      setIsConnected(internetStatus);
      // Check if the internet is disconnected and upload is in progress
      if (internetStatus === 0 && uploadInProgress) {
        if (!paused) {
          await pauseUpload();
          setPaused(true);
        }
      }
    },
    [paused],
  );
  useEffect(() => {
    monitorNetworkChanges(handleNetworkStatusChange);
    return () => {};
  }, [handleNetworkStatusChange]);
  useEffect(() => {
    const initializeUpload = async () => {
      const lastUploadingStatus = await StorageHelper.getItem(
        STORAGE_KEY_STATUS,
      );
      if (lastUploadingStatus === 'uploading') {
        setAppRestarted(true);
        const uploadDetails = await StorageHelper.getItem('uploadDetails');
        if (uploadDetails) {
          const {fileName} = JSON.parse(uploadDetails);
          setlastFileName(fileName);
        }
      }
    };
    initializeUpload();
    return () => {};
  }, []);

  const initializeCheckLastUpload = async (
    newFileName: string,
    newFileUri: string,
    newFileType: string,
  ) => {
    const uploadDetails = await StorageHelper.getItem('uploadDetails');
    const status = await StorageHelper.getItem(STORAGE_KEY_STATUS);
    if (uploadDetails) {
      const {fileName, uploadId, fileUri, fileType} = JSON.parse(uploadDetails);
      console.log('uploadDetails:', fileName, uploadId, fileUri, fileType);
      if (
        newFileName === fileName &&
        newFileUri === fileUri &&
        newFileType === fileType
      ) {
        console.log('save file path', fileUri);
        if (status === 'uploading') {
          await RNFS.unlink(fileUri);
          setUploadId(uploadId);
          setAppRestarted(false);
          setlastFileName('');
          setSelectedFileName(newFileName);
          resumeUploadAfterAppRestard(
            newFileName,
            newFileType,
            newFileUri,
            (progress: number) => {
              setProgress(progress);
              if (progress === 100) {
                setUploadCompleted(true);
                setStatus('completed');
                return true;
              }
            },
          );
        }
      }
    }
    return false;
  };

  const selectLargeFile = async () => {
    await requestManageExternalStoragePermission();
    const hasPermission = await requestNotificationPermission();
    await requestStoragePermission();
    try {
      if (hasPermission) {
        const result = await DocumentPicker.pick({
          type: [DocumentPicker.types.video],
        });
        console.log('File is to handle', result);
        if (result[0]?.size && result[0].size > 25 * 1024 * 1024 * 1024) {
          console.log('File is too large to handle');
          setIsSelecting(false);
          return;
        }
        // const filePath = await getRealFilePath(result[0]?.uri);
        const isFileResumed = await initializeCheckLastUpload(
          result[0]?.name as string,
          result[0]?.uri as string,
          result[0]?.type as string,
        );
        if (!isFileResumed) {
          setSelectedFileName(result[0]?.name as string);
          startUpload(
            result[0]?.uri as string,
            result[0]?.name as string,
            result[0]?.type as string,
          );
        }
      } else {
        console.log('Notification permission denied');
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User canceled file picker');
      } else {
        console.error('Error picking document:', err);
      }
    }
    setIsSelecting(false);
  };

  const startUpload = async (
    fileUri: string,
    fileName: string,
    fileType: string,
  ) => {
    setlastFileName('');
    setStartTime(new Date(Date.now()));
    setUploadId('some-unique-id');
    setUploadCompleted(false);
    setStatus('processing');
    setTimeout(async () => {
      setStatus('uploading');
      await StorageHelper.setItem(
        'uploadDetails',
        JSON.stringify({
          status: 'uploading',
          fileUri,
          fileName,
        }),
      );
      startUploadFile(fileUri, fileName, fileType, (progress: number) => {
        if (progress === -1) {
          resetUpload();
        } else {
          setProgress(progress);
          if (progress === 100) {
            setEndTime(new Date(Date.now()));
            setUploadCompleted(true);
            setStatus('completed');
          }
        }
      });
    }, 2000);
  };

  const resetUpload = async () => {
    setAppRestarted(false);
    setProgress(1);
    setUploadId(null);
    setSelectedFileName('');
    setUploadCompleted(false);
    setStatus(null);
    stopBackgroundUpload();
    console.log('Resetting upload', RNFS.DocumentDirectoryPath);
    const ONE_WEEK_IN_MS = 1 * 60 * 1000; // 2 min
    await deleteCachedFiles(RNFS.CachesDirectoryPath, ONE_WEEK_IN_MS);
    await deleteCachedFiles(RNFS.TemporaryDirectoryPath, ONE_WEEK_IN_MS);
    await deleteCachedFiles(RNFS.DocumentDirectoryPath, ONE_WEEK_IN_MS);
    StorageHelper.clearAll();
  };

  const togglePauseResume = async () => {
    if (paused) {
      await resumeUpload((progress: number) => {
        if (progress === -1) {
          resetUpload();
        } else {
          setProgress(progress);
          if (progress === 100) {
            setUploadCompleted(true);
            setStatus('completed');
          }
        }
      });
      setPaused(false);
    } else {
      await pauseUpload();
      setPaused(true);
    }
  };

  const handleClearAll = async () => {
    try {
      await StorageHelper.clearAll();
      Toast.show({
        type: 'success',
        text1: 'All storage data cleared.',
      });
      console.log('All storage data cleared.');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colorScheme === 'dark' ? '#333' : '#fff'},
      ]}>
      <Text style={[styles.buttonText]}>
        {endTime ? `Upload Start Time: ${startTime}` : null}
      </Text>
      <Text style={[styles.buttonText]}>
        {endTime ? `Upload End Time: ${endTime}` : null}
      </Text>

      <TouchableOpacity
        style={[
          styles.clearAllButton,
          isConnected === 0 ? styles.disabledButton : {},
        ]}
        onPress={async () => {
          if (isConnected === 0) {
            return;
          } // Disable if offline
          await handleClearAll();
          resetUpload();
        }}
        disabled={isConnected === 0}>
        <Text
          style={[
            styles.buttonText,
            isConnected === 0 ? styles.disabledText : {},
          ]}>
          CLEAR DATA
        </Text>
      </TouchableOpacity>
      <Text
        style={[
          styles.networkStatus,
          {backgroundColor: isConnected === 0 ? 'gray' : '#007bff'},
        ]}>
        {isConnected === null
          ? 'Checking network...'
          : isConnected
          ? 'Connected'
          : 'Offline'}
      </Text>

      <Text style={styles.title}>
        {appRestarted ? APP_RESTARTED_MESSAGE : 'Upload Video File'}
      </Text>

      {selectedFileName && (
        <Text style={styles.fileName}>Selected Video File {selectedFileName}</Text>
      )}

      {(isSelecting || status === 'processing') && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loaderText}>
            {isSelecting ? 'Selecting file...' : 'Processing...'}
          </Text>
        </View>
      )}

      {(status === 'uploading' || status === 'completed') && (
        <>
          {progress < 100 && (
            <View style={styles.uploadStatusContainer}>
              {!paused && (
                <ActivityIndicator
                  size="small"
                  color="#007bff"
                  style={styles.uploadLoader}
                />
              )}
              <Text
                style={[
                  styles.processingText,
                  isConnected === 0 ? styles.disabledText : {},
                ]}>
                {paused ? 'Uploading paused' : 'Uploading....'}
              </Text>
            </View>
          )}
          <View style={styles.progressContainer}>
            <Bar
              progress={progress / 100}
              width={null}
              height={10}
              style={styles.progressBar}
              color="#007bff"
              unfilledColor="#e0e0e0"
            />
            <Text style={styles.progressText}>{Math.floor(progress)}%</Text>
          </View>

          {progress < 100 && !uploadCompleted && (
            <TouchableOpacity
              style={[
                styles.pauseButton,
                isConnected === 0 ? styles.disabledButton : {},
              ]}
              onPress={togglePauseResume}
              disabled={isConnected === 0}>
              <Text
                style={[
                  styles.buttonText,
                  isConnected === 0 ? styles.disabledText : {},
                ]}>
                {paused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
          )}

          {progress === 100 && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                isConnected === 0 ? styles.disabledButton : {},
              ]}
              onPress={() => resetUpload()}
              disabled={isConnected === 0}>
              <Text
                style={[
                  styles.buttonText,
                  isConnected === 0 ? styles.disabledText : {},
                ]}>
                Start New Upload
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {!uploadId && !isSelecting && (
        <>
          <TouchableOpacity
            style={[
              styles.selectButton,
              {marginTop: 25},
              isConnected === 0 ? styles.disabledButton : {}, // Conditional style for disabled state
            ]}
            onPress={selectLargeFile}
            disabled={isConnected === 0}>
            <Text
              style={[
                styles.buttonText,
                isConnected === 0 ? styles.disabledText : {},
              ]}>
              Select File from Documents
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default UploadScreen;
