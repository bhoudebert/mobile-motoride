// Signs the Android release build with our own key. `expo prebuild` regenerates android/ and its Gradle signs release
// with the debug key, so the change is made here and not by hand. The key comes from environment variables (CI) or
// android/keystore.properties (a laptop); without one a development build still works, and CI refuses to go on.
const { withAppBuildGradle } = require("expo/config-plugins");
const { applyReleaseSigning } = require("./release-signing.cjs");

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    c.modResults.contents = applyReleaseSigning(c.modResults.contents);
    return c;
  });
