import { PermissionsAndroid } from 'react-native';
import { openSettings, check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';

export const requestPermissions = async () => {
  try {
    let permission;

    // Android-specific permission logic
    if (Platform.OS === 'android') {
      if (Platform.Version >= 30) {
        // For Android 11 and above
        permission = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      } else {
        permission = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      }
    }

    // Ensure the permission is correctly assigned
    if (!permission) {
      throw new Error('Permission constant is not defined.');
    }

    const permissionStatus = await check(permission);

    if (permissionStatus === RESULTS.GRANTED) {
      console.log('Permission already granted');
    } else if (permissionStatus === RESULTS.DENIED) {
      console.log('Permission denied, requesting permission...');
      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        console.log('Permission granted');
      } else if (result === RESULTS.DENIED) {
        console.log('Permission denied by the user');
      } else if (result === RESULTS.BLOCKED) {
        console.log('Permission blocked, directing user to settings...');
       openSettings();
      }
    } else if (permissionStatus === RESULTS.BLOCKED) {
      console.log('Permission blocked, directing user to settings...');
     openSettings();
    }
  } catch (err) {
    console.error('Error while requesting permission:', err);
  }
};
export const requestFilePermission = async () => {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Permission for File Access',
        message: 'This app needs access to your files to upload them.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('You can access the files');
    } else {
      console.log('File access permission denied');
    }
  } catch (err) {
    console.warn(err);
  }
};

export const requestExternalStoragePermission = async () => {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'External Storage Permission',
        message: 'This app needs access to your external storage to read files.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};
