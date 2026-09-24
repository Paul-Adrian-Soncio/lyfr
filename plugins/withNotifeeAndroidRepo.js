const { withProjectBuildGradle } = require("@expo/config-plugins");

// Notifee's Android native module (app.notifee:core) ships as a local Maven
// repo bundled inside node_modules rather than a published remote artifact.
// Notifee has no Expo config plugin of its own to register this, so without
// this patch every `expo prebuild` produces a build.gradle that can't resolve
// app.notifee:core and the Gradle build fails at dependency resolution.
function withNotifeeAndroidRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    const marker = "@notifee/react-native/android/libs";
    if (config.modResults.contents.includes(marker)) {
      return config;
    }
    config.modResults.contents = config.modResults.contents.replace(
      /allprojects\s*{\s*repositories\s*{/,
      `allprojects {\n  repositories {\n    maven { url "$rootDir/../node_modules/${marker}" }`,
    );
    return config;
  });
}

module.exports = withNotifeeAndroidRepo;
