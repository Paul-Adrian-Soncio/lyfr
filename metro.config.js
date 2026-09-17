const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Drizzle's generated migrations.js imports .sql files directly — see
// https://orm.drizzle.team/quick-sqlite/expo. Treat them as source, not assets,
// so Metro bundles their contents as strings rather than copying them as files.
config.resolver.sourceExts.push("sql");

module.exports = config;
