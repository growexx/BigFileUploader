import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Bar } from 'react-native-progress';
import {
  BackgroundChunkedUpload,
  handleUploadWhenAppIsOpened,
  pauseUpload,
  resumeUpload,
} from '../services/uploadService';
import StorageHelper from '../helper/LocalStorage';
import { EventRegister } from 'react-native-event-listeners';

const UploadScreen: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [uploadCompleted, setUploadCompleted] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const initializeUpload = async () => {
      const uploadDetails = await StorageHelper.getItem('uploadDetails');

      if (uploadDetails) {
        const { status, fileName, uploadId } = JSON.parse(uploadDetails);
        setStatus(status); // Set the status from the storage

        if (status === 'uploading') {
          setFileName(fileName);
          setFileType('mixed');
          setUploadId(uploadId);
          handleUploadWhenAppIsOpened();
        }
      }
    };

    initializeUpload();

    // Set up event listener for progress updates
    const progressListener = EventRegister.addEventListener('uploadProgress', (data: number) => {
      setProgress(data);
    });

    // Clean up the event listener when the component unmounts
    return () => {
      EventRegister.removeEventListener(progressListener as never);
    };
  }, []);

  const selectMedia = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        includeBase64: false,
      });
      if (result.didCancel) {
        console.log('User cancelled media picker');
      } else if (result.assets && result.assets.length > 0) {
        const media = result.assets[0];
        setFileName(media.fileName as string);
        setFileType(media.type as string);
        startUpload(media.uri as string, media.fileName as string);
      }
    } catch (err) {
      console.error('Error picking media:', err);
    }
  };

  const startUpload = async (fileUri: string, fileName: string) => {
    setUploadId('some-unique-id');
    setUploadCompleted(false);
    setStatus('processing');
    setTimeout(async () => {
      setStatus('uploading');
      await StorageHelper.setItem('uploadDetails', JSON.stringify({
        status: 'uploading',
        fileUri,
        fileName,
      }));
      BackgroundChunkedUpload(fileUri, fileName, (progress: number) => {
        setProgress(progress);
        if (progress === 100) {
          setUploadCompleted(true);
          setStatus('completed');
        }
      });
    }, 2000);
  };

  const resetUpload = () => {
    setProgress(0);
    setUploadId(null);
    setFileName('');
    setUploadCompleted(false);
    setStatus(null);
    StorageHelper.clearAll();
  };

  const togglePauseResume = async () => {
    if (paused) {
      await resumeUpload();
      setPaused(false);
    } else {
      await pauseUpload();
      setPaused(true);
    }
  };

  const handleClearAll = async () => {
    try {
      await StorageHelper.clearAll();
      console.log('All storage data cleared.');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#333' : '#fff' }]}>
      <TouchableOpacity style={styles.clearAllButton} onPress={async () => {
        await handleClearAll();
        // Refresh the UI by resetting relevant states
        resetUpload(); // Call resetUpload to refresh the UI
      }}>
        <Text style={styles.buttonText}>CLEAR DATA</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Upload {fileType.includes('video') ? 'Video' : 'Image'}</Text>

      {fileName && <Text style={styles.fileName}>Selected {fileType.includes('video') ? 'Video' : 'Image'}: {fileName}</Text>}

      {status === 'processing' && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}

      {(status === 'uploading' || status === 'completed' ) && (
        <>
          {progress < 100 && (
            <Text style={styles.processingText && { paddingBottom: 18 }}>
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
              style={styles.pauseButton}
              onPress={togglePauseResume}
            >
              <Text style={styles.buttonText}>{paused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
          )}

          {progress === 100 && (
            <TouchableOpacity style={styles.cancelButton} onPress={resetUpload}>
              <Text style={styles.buttonText}>Start New Upload</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {!uploadId && (
        <TouchableOpacity style={styles.selectButton} onPress={selectMedia}>
          <Text style={styles.buttonText}>Select File</Text>
        </TouchableOpacity>
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
});

export default UploadScreen;
