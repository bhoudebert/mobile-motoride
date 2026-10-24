// The Gradle edit behind with-release-signing.cjs, apart so a test can run it without Expo.
const SIGNING = `
    signingConfigs {
        release {
            def props = new Properties()
            def file = rootProject.file('keystore.properties')
            if (file.exists()) file.withInputStream { props.load(it) }
            def pick = { String env, String key -> System.getenv(env) ?: props.getProperty(key) }
            def store = pick('MOTORIDE_KEYSTORE_FILE', 'storeFile')
            if (store) {
                storeFile rootProject.file(store)
                storePassword pick('MOTORIDE_KEYSTORE_PASSWORD', 'storePassword')
                keyAlias pick('MOTORIDE_KEY_ALIAS', 'keyAlias')
                keyPassword pick('MOTORIDE_KEY_PASSWORD', 'keyPassword')
            } else if (System.getenv('MOTORIDE_REQUIRE_RELEASE_SIGNING')) {
                throw new GradleException('No release key: set MOTORIDE_KEYSTORE_FILE and the passwords')
            }
        }`;

/** The generated app/build.gradle with a release signing config, which the release build type uses once it has a key. */
function applyReleaseSigning(gradle) {
  if (gradle.includes("MOTORIDE_KEYSTORE_FILE")) return gradle;
  if (!gradle.includes("\n    signingConfigs {")) throw new Error("signingConfigs block not found in app/build.gradle");
  const release = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!release.test(gradle)) throw new Error("release build type not found in app/build.gradle");
  return gradle
    .replace("\n    signingConfigs {", () => SIGNING)
    .replace(
      release,
      "$1signingConfig signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug",
    );
}

module.exports = { applyReleaseSigning };
