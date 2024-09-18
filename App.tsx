import React from 'react';
import { Button, View } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { PermissionsAndroid, Platform } from 'react-native';

// Request notification permission for Android 13 and above
const requestNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

// Mock sleep function for async delay
const sleep = (time: number | undefined) => new Promise((resolve) => setTimeout(resolve, time));

// Background task function
const veryIntensiveTask = async (taskData?: { delay: number } | undefined) => {
  const { delay } = taskData || { delay: 1000 };
  for (let i = 0; BackgroundService.isRunning(); i++) {
    console.log(`Iteration ${i}`);
    await sleep(delay);
  }
};

// Task options
const options = {
  taskName: 'ExampleTask',
  taskTitle: 'Example Background Task',
  taskDesc: 'Running background task',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#ff0000',
  parameters: {
    delay: 1000,
  },
};

const App = () => {
  const startTask = async () => {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
      await BackgroundService.start(veryIntensiveTask, options);
    } else {
      console.log('Notification permission denied');
    }
  };

  const stopTask = async () => {
    await BackgroundService.stop();
  };

  return (
    <View>
      <Button title="Start Background Task" onPress={startTask} />
      <Button title="Stop Background Task" onPress={stopTask} />
    </View>
  );
};

export default App;
