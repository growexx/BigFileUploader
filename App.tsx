// App.tsx
import React, { useState } from 'react';
import DocumentPicker from 'react-native-document-picker';
import {
  SafeAreaView,
  Button,
  StyleSheet,
  View,
} from 'react-native';
import {BackgroundChunkedUpload, uploadFileInChunks } from './src/services/uploadService';

const App = () => {
  const [fileUri, setFileUri] = useState<string | null>(null);


  const pickAndUploadFile = async () => {
    try {
      // Step 1: Pick document
      const file = await pickDocument();
      setFileUri(file?.uri ?? '');
      console.log('File picked:', file);
      BackgroundChunkedUpload(file?.uri ?? '');

    } catch (error) {
      console.error('Error during file upload:', error);
    }
  };

  // Document picker logic
  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });
      return res[0]; // Only picking one file for simplicity
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User canceled the document picker');
      } else {
        throw err;
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View>
      <Button title="Pick and Upload File" onPress={pickAndUploadFile} />
        {/* <Button title="Upload File" onPress={handleUpload} disabled={!fileUri} /> */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
