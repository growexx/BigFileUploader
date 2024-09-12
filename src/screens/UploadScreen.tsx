import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Bar } from 'react-native-progress';
import { BackgroundChunkedUpload } from '../services/uploadService';

const UploadScreen: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [uploadCompleted, setUploadCompleted] = useState<boolean>(false);
  const colorScheme = useColorScheme();

  const selectMedia = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed', // Supports both image and video selection
        includeBase64: false,
      });
      if (result.didCancel) {
        console.log('User cancelled media picker');
      } else if (result.assets && result.assets.length > 0) {
        const media = result.assets[0];
        setFileName(media.fileName as string);
        setFileType(media.type as string); // Set the file type (e.g., image/jpeg, video/mp4)
        startUpload(media.uri as string, media.fileName as string);
      }
    } catch (err) {
      console.error('Error picking media:', err);
    }
  };

  const startUpload = async (fileUri: string, fileName: string) => {
    setUploadId('some-unique-id'); // Set a unique ID for the upload if needed
    setUploadCompleted(false); // Reset upload completed state
    BackgroundChunkedUpload(fileUri, fileName, (progress: number) => {
      setProgress(progress);
      if (progress === 100) {
        setUploadCompleted(true); // Mark upload as complete when progress reaches 100%
      }
    });
  };

  const resetUpload = () => {
    setProgress(0);
    setUploadId(null);
    setFileName('');
    setUploadCompleted(false);
  };

  const togglePauseResume = () => {
    setPaused(!paused);
    // Add pause/resume logic here if needed
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#333' : '#fff' }]}>
      <Text style={styles.title}>Upload {fileType.includes('video') ? 'Video' : 'Image'}</Text>

      {fileName ? <Text style={styles.fileName}>Selected {fileType.includes('video') ? 'Video' : 'Image'}: {fileName}</Text> : null}

      {/* Show the Progress Bar and Pause/Resume Button during the upload */}
      {uploadId && (
        <>
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

          {!uploadCompleted && (
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePauseResume}
            >
              <Text style={styles.buttonText}>{paused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
          )}

          {/* Show Cancel button when upload completes */}
          {uploadCompleted && (
            <TouchableOpacity style={styles.cancelButton} onPress={resetUpload}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Show the Select button only if there's no ongoing upload */}
      {!uploadId && (
        <TouchableOpacity style={styles.selectButton} onPress={selectMedia}>
          <Text style={styles.buttonText}>Select {fileType.includes('video') ? 'Video' : 'Image'}</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  fileName: {
    fontSize: 16,
    marginBottom: 10,
  },
  selectButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  progressBar: {
    width: '80%',
    marginRight: 10,
  },
  progressText: {
    fontSize: 16,
    color: '#333',
  },
  pauseButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#ff0000',
    padding: 10,
    borderRadius: 5,
  },
});

export default UploadScreen;
