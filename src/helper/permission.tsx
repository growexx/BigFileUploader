import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export const requestPermissions = async () => {
  try {
    const result = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
    if (result === RESULTS.GRANTED) {
      console.log('Permission granted');
    } else {
      console.log('Permission denied');
    }
    // const granted = await PermissionsAndroid.request(
    //   PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    //   {
    //     title: 'Permission for File Access',
    //     message: 'This app needs access to your files to upload them.',
    //     buttonNeutral: 'Ask Me Later',
    //     buttonNegative: 'Cancel',
    //     buttonPositive: 'OK',
    //   }
    // );
    // if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    //   console.log('You can access the files');
    // } else {
    //   console.log('File access permission denied');
    // }
  } catch (err) {
    console.warn(err);
  }
};
