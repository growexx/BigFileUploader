import { DeviceEventEmitter, NativeEventEmitter, NativeModules } from 'react-native';

const { LargeFilePicker } = NativeModules;
const largeFilePickerEvents = new NativeEventEmitter(LargeFilePicker);

const openFilePicker = () => {
    console.log('openFilePicker',LargeFilePicker);
    return new Promise((resolve, reject) => {
        LargeFilePicker.openFilePicker();
        const subscription = DeviceEventEmitter.addListener('FilePicked', (uri: string) => {
          LargeFilePicker.getFileDetails(uri, (error: string | null, details: { fileName: string; filePath: string }) => {
            subscription.remove();
            if (error) {
              reject(error);
            } else {
              resolve(details);
            }
          });
        });
      });
};
const getFileDetails = (uri: string): Promise<{ fileName: string; filePath: string }> => {
    return new Promise((resolve, reject) => {
      LargeFilePicker.getFileDetails(uri, (error: string | null, result: { fileName: string; filePath: string }) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(result);
        }
      });
    });
  };


export default {
  openFilePicker,
  getFileDetails,
};
