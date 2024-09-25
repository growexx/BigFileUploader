const sonarqubeScanner = require('sonarqube-scanner');

sonarqubeScanner(
  {
    serverUrl: 'https://quality.growexx.com', // Replace with your SonarQube server URL
    options: {
      'sonar.projectKey': 'react_native_large_file_upload',
      'sonar.projectName': 'react_native_large_file_upload',
      'sonar.projectVersion': '1.0',
      'sonar.sources': 'src',
      'sonar.language': 'ts',
      'sonar.sourceEncoding': 'UTF-8',
      'sonar.exclusions': 'node_modules/**,build/**',
      // Optional: Path to the coverage report
      // 'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
      // Optional: Path to the test execution report
      // 'sonar.testExecutionReportPaths': 'reports/test-report.xml',
    },
  },
  () => process.exit()
);
