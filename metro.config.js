const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

delete config.watcher?.unstable_workerThreads;

module.exports = config;
