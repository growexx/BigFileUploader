
import { Alert } from 'react-native';
import BackgroundActions from 'react-native-background-actions';
import axios from 'axios';
import { useEffect } from 'react';


// Background Task function
const uploadTask = async (taskData: any) => {
  const { fileUri, signedUrl, fileType } = taskData;
  const headers = { 'Content-Type': fileType };

  try {
    // Read the file as base64 for the upload
    console.log('Reading file:', fileUri);

    // Upload using Axios
    // await axios.put(signedUrl, file, { headers });

    console.log('File uploaded successfully in background');
  } catch (error) {
    console.error('Upload failed:', error);
  }
};

// Options for background upload
const options = {
  taskName: 'File Upload',
  taskTitle: 'Uploading File in Background',
  taskDesc: 'File is being uploaded in the background.',
  taskIcon: {
    name: 'ic_upload', // You can use a custom notification icon
    type: 'drawable',
  },
  color: '#ff0000', // Notification bar color
  linkingURI: 'yourapp://upload', // Deep link to your app
  parameters: { delay: 1000 }, // Additional parameters
  progressBar: {
    max: 100, // You can set this for progress tracking
    value: 0,
  },
};

// Function to start the upload task
const startUpload = async () => {
  try {
    const taskData = {
      fileUri: 'path/to/your/large-file.jpg', // Example file URI
      signedUrl: 'your-s3-signed-url', // Signed URL for S3
      fileType: 'image/jpeg',
    };

    await BackgroundActions.start(uploadTask, options);

    Alert.alert('Upload started in the background');
  } catch (error) {
    console.error('Error starting background task:', error);
  }
};

// Function to stop the task if needed
const stopUpload = async () => {
  await BackgroundActions.stop();
  Alert.alert('Background upload stopped');
};

export const BackgroundFileUpload = () => {
  useEffect(() => {
    // Start upload on component mount
    startUpload();

    // Cleanup on unmount
    return () => {
      stopUpload();
    };
  }, []);

  return null;
};
