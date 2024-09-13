import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import NetworkCheck from './src/helper/NetworkCheck';
AppRegistry.registerComponent(appName, () => NetworkCheck);
