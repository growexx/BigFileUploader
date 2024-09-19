import React, { useState, useEffect } from 'react';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Bar } from 'react-native-progress';
import {
  monitorNetworkChanges,
  pauseUpload,
  resumeUpload,
  startUploadFile,
  stopBackgroundUpload,
} from '../services/uploadService';
import StorageHelper, { STORAGE_KEY_STATUS } from '../helper/LocalStorage';
import Toast from 'react-native-toast-message';
import { requestNotificationPermission } from '../helper/util';
import { deleteCachedFiles } from '../helper/FileUtils';
import { requestPermissions } from '../helper/permission';

const MAX_FILE_SIZE_MB = 500;

const UploadScreen: React.FC = () => {
  const [progress, setProgress] = useState<number>(1);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [uploadCompleted, setUploadCompleted] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const [isConnected, setIsConnected] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);

  useEffect(() => {
    const handleNetworkStatusChange = (internetStatus: number) => {
      setIsConnected(internetStatus);
    };
    monitorNetworkChanges(handleNetworkStatusChange);

    return () => {
      // Logic to stop monitoring network changes if applicable
    };
  }, []);

  useEffect(() => {
    const initializeUpload = async () => {
      const uploadDetails = await StorageHelper.getItem('uploadDetails');
      console.log('uploadDetails : ' + uploadDetails);
      const status = await StorageHelper.getItem(STORAGE_KEY_STATUS);
      if (uploadDetails) {
        const { fileName, uploadId } = JSON.parse(uploadDetails);
        setStatus(status);
        if (status === 'uploading') {
          setFileName(fileName);
          setFileType('mixed');
          setUploadId(uploadId);
          resumeUpload(false, (progress: number) => {
            setProgress(progress);
            if (progress === 100) {
              setUploadCompleted(true);
              setStatus('completed');
            }
          });
        }
      }
    };
    initializeUpload();
    return () => { };
  }, []);

  const selectLargeFile = async () => {
    if (isConnected === 0) return; // Disable if offline
    setIsSelecting(true);
    requestPermissions();
    const hasPermission = await requestNotificationPermission();
    try {
      if (hasPermission) {
        const result = await DocumentPicker.pick({
          type: [DocumentPicker.types.video],
        });

        if (result[0]?.size && result[0].size > 20 * 1024 * 1024 * 1024) {
          console.log('File is too large to handle');
          setIsSelecting(false);
          return;
        }
        console.log(
          'Selected file: ',
          result[0]?.uri,
          result[0]?.size,
          result[0]?.name,
        );
        setFileName(result[0]?.name as string);
        setFileType(result[0]?.type as string);
        startUpload(result[0]?.uri as string, result[0]?.name as string);
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

  const selectMedia = async () => {
    if (isConnected === 0) return; // Disable if offline
    setIsSelecting(true);
    const hasPermission = await requestNotificationPermission();
    try {
      if (hasPermission) {
        const result = await launchImageLibrary({
          mediaType: 'mixed',
          includeBase64: false,
        });
        if (result.didCancel) {
          console.log('User cancelled media picker');
        } else if (result.assets && result.assets.length > 0) {
          if (result.assets && result.assets.length > 0) {
            const media = result.assets[0];
            const file = media;
            const fileSizeMB = file.fileSize ?? 0 / (1024 * 1024);
            if (fileSizeMB > MAX_FILE_SIZE_MB) {
              Alert.alert(
                'File Size Limit Exceeded',
                `The selected file exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB} MB.`,
                [{ text: 'OK' }]
              );
            } else {
              console.log('Selected file URI: ', file.uri);
              setFileName(media.fileName as string);
              setFileType(media.type as string);
              startUpload(media.uri as string, media.fileName as string);
            }
          }
        }
      } else {
        console.log('Notification permission denied');
      }
    } catch (err) {
      console.error('Error picking media:', err);
    }
    setIsSelecting(false);
  };

  const startUpload = async (fileUri: string, fileName: string) => {
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
      startUploadFile(fileUri, fileName, (progress: number) => {
        setProgress(progress);
        if (progress === 100) {
          setUploadCompleted(true);
          setStatus('completed');
        }
      });
    }, 2000);
  };

  const resetUpload = async () => {
    setProgress(0);
    setUploadId(null);
    setFileName('');
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
      await resumeUpload(paused, (progress: number) => {
        setProgress(progress);
        if (progress === 100) {
          setUploadCompleted(true);
          setStatus('completed');
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
        { backgroundColor: colorScheme === 'dark' ? '#333' : '#fff' },
      ]}>
      <TouchableOpacity
        style={[
          styles.clearAllButton,
          isConnected === 0 ? styles.disabledButton : {},
        ]} onPress={async () => {
          if (isConnected === 0) return; // Disable if offline
          await handleClearAll();
          resetUpload();
        }}
        disabled={isConnected === 0}>
        <Text style={[
          styles.buttonText,
          isConnected === 0 ? styles.disabledText : {}
        ]}>CLEAR DATA</Text>
      </TouchableOpacity>
      <Text style={styles.networkStatus}>
        {isConnected === null
          ? 'Checking network...'
          : isConnected
            ? 'Connected to the internet'
            : 'No internet connection'}
      </Text>

      <Text style={styles.title}>
        Upload {fileType.includes('video') ? 'Video' : 'Image'}
      </Text>

      {fileName && (
        <Text style={styles.fileName}>
          Selected {fileType.includes('video') ? 'Video' : 'Image'}: {fileName}
        </Text>
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
            <Text style={[styles.processingText && { paddingBottom: 18 }, isConnected === 0 ? styles.disabledText : {}]}>
              Uploading{paused ? ' paused' : '....'}
            </Text>
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
              ]} onPress={togglePauseResume}
              disabled={isConnected === 0}>
              <Text style={[
                styles.buttonText,
                isConnected === 0 ? styles.disabledText : {}
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
              ]} onPress={() => resetUpload()}
              disabled={isConnected === 0}>
              <Text style={[
                styles.buttonText,
                isConnected === 0 ? styles.disabledText : {}
              ]}>Start New Upload</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {!uploadId && !isSelecting && (
        <>
          <TouchableOpacity
            style={[
              styles.selectButton,
              isConnected === 0 ? styles.disabledButton : {},
            ]} onPress={selectMedia}
            disabled={isConnected === 0}>
            <Text style={[
              styles.buttonText,
              isConnected === 0 ? styles.disabledText : {}
            ]}>Select File (Up to 500MB)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectButton, { marginTop: 25 }, isConnected === 0 ? styles.disabledButton : {} // Conditional style for disabled state
            ]}
            onPress={selectLargeFile}
            disabled={isConnected === 0}>
            <Text style={[
              styles.buttonText,
              isConnected === 0 ? styles.disabledText : {}
            ]}>Select File from Document Picker</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#d3d3d3',
  },
  disabledText: {
    color: '#a9a9a9',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  fileName: {
    fontSize: 16,
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    borderRadius: 5,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 5,
    fontSize: 16,
  },
  pauseButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  selectButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    letterSpacing: 1,
  },
  clearAllButton: {
    backgroundColor: '#6c757d',
    padding: 10,
    borderRadius: 5,
    position: 'absolute',
    top: 50,
    right: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  processingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  processingText: {
    marginTop: 10,
    fontSize: 16,
  },
  networkStatus: {
    position: 'absolute',
    top: 200,
    fontSize: 14,
    color: '#fff',
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
  },
  networkWarning: {
    color: 'red',
    marginTop: 20,
  },
  loaderContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default UploadScreen;