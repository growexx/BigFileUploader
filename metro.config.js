const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { terserMinifier } = require('metro-minify-terser');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    minifierPath: 'metro-minify-terser',
    minifierConfig: {
      keep_classnames: true, // Keep class names
      keep_fnames: true,     // Keep function names
      mangle: true,          // Mangle variable names
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
