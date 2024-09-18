import React from 'react'; // Add this import
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import NetworkCheck from './src/helper/NetworkCheck';
import Toast from 'react-native-toast-message';
import {View, Text} from 'react-native'; // Import View and Text
import '@react-native-firebase/app';




// Wrap Toast with forwardRef
const ForwardedToast = React.forwardRef((props, ref) => (
  <Toast ref={ref} {...props} />
));

const App = () => {
    // firebase.initializeApp(); // This line should be auto-handled in most cases
  return (
  <View style={{flex: 1}}>
    {/* Remove the unnecessary whitespace */}
    <NetworkCheck />
    <ForwardedToast>
      <Text>Hello</Text>
    </ForwardedToast>
    {/* <Text>Welcome to the App!</Text> Text component with string content */}
  </View>
);
};
AppRegistry.registerComponent(appName, () => App);
