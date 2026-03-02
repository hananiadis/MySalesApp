const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude warehouse-web folder from bundling (separate project)
config.watchFolders = config.watchFolders || [];
config.projectRoot = __dirname;
config.resolver.blacklistRE = new RegExp(
  `${__dirname.replace(/[/\\]/g, '[/\\\\]')}/warehouse-web/.*`
);

module.exports = config;
