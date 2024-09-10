import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
// import Upload, { UploadOptions } from 'react-native-background-upload';
import { Bar } from 'react-native-progress';
import { getSignedUrl } from '../services/s3Config';
import { uploadFileInChunks } from '../services/uploadService';

const UploadScreen: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [uploadCompleted, setUploadCompleted] = useState<boolean>(false);
  const colorScheme = useColorScheme();

  const selectFile = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });
      setFileName(result.name as never);
      startUpload(result.uri, result.name as never);
    } catch (err) {
      console.error('Error picking file:', err);
    }
  };

  const startUpload = async (fileUri: string, fileName: string) => {
    const signedUrl = await uploadFileInChunks(fileUri, 'api-bucketfileupload.growexx.com', fileName);
    console.log(signedUrl);


    try {

    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const pauseUpload = () => {
    if (uploadId) {
      // Upload.pauseUpload(uploadId);
      setPaused(true);
    }
  };

  const resumeUpload = () => {
    if (uploadId) {
      // Upload.resumeUpload(uploadId);
      setPaused(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#333' : '#fff' }]}>
      <Text style={styles.title}>Upload File</Text>
      {fileName ? <Text style={styles.fileName}>Selected File: {fileName}</Text> : null}
      <TouchableOpacity style={styles.selectButton} onPress={selectFile} disabled={uploadId !== null && !uploadCompleted}>
        <Text style={styles.buttonText}>Select File</Text>
      </TouchableOpacity>

      <Bar
        progress={progress / 100}
        width={null}
        height={10}
        style={styles.progressBar}
        color="#007bff"
        unfilledColor="#e0e0e0"
      />
      <Text style={styles.progressText}>{progress}%</Text>

      <View style={styles.buttonsContainer}>
        {!uploadCompleted && (
          <>
            <TouchableOpacity style={[styles.controlButton, styles.pauseButton]} onPress={pauseUpload} disabled={paused}>
              <Text style={styles.buttonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.resumeButton]} onPress={resumeUpload} disabled={!paused}>
              <Text style={styles.buttonText}>Resume</Text>
            </TouchableOpacity>
          </>
        )}

        {uploadCompleted && (
          <TouchableOpacity style={styles.uploadButton} onPress={() => console.log('Upload completed!')}>
            <Text style={styles.buttonText}>Upload Completed</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  fileName: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  selectButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBar: {
    marginVertical: 20,
  },
  progressText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    padding: 15,
    borderRadius: 10,
    width: 120,
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#ff6347',
  },
  resumeButton: {
    backgroundColor: '#32cd32',
  },
  uploadButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 10,
    width: 180,
    alignItems: 'center',
  },
});

export default UploadScreen;