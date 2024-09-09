/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import FileUploadComponent from './src/screens/UploadScreen';

AppRegistry.registerComponent(appName, () => FileUploadComponent);
