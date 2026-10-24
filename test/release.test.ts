import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { versionCode } from "../src/core/release.ts";

const { applyReleaseSigning } = createRequire(import.meta.url)("../plugins/release-signing.cjs") as {
  applyReleaseSigning: (gradle: string) => string;
};

// The part of the generated app/build.gradle (Expo SDK 58) that the plugin edits.
const generated = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled true
        }
    }
}`;

test("a version becomes a version code that only grows", () => {
  assert.equal(versionCode("1.0.0"), 1_000_000);
  assert.equal(versionCode("1.2.3"), 1_002_003);
  assert.ok(versionCode("1.10.0") > versionCode("1.9.9"));
  assert.ok(versionCode("2.0.0") > versionCode("1.999.999"));
  assert.equal(versionCode("1.2.3-rc.1"), 1_002_003);
});

test("a version that is not x.y.z, or too large, is refused", () => {
  assert.throws(() => versionCode("1.2"), /not a semantic version/);
  assert.throws(() => versionCode("v1.2.3"), /not a semantic version/);
  assert.throws(() => versionCode("1.1000.0"), /under 1000/);
});

test("the release build type signs with the release key once there is one, and with debug otherwise", () => {
  const out = applyReleaseSigning(generated);
  assert.match(out, /MOTORIDE_KEYSTORE_FILE/);
  assert.match(out, /MOTORIDE_REQUIRE_RELEASE_SIGNING/);
  // debug build type untouched, release picks the release config when it has a store file
  assert.match(out, /debug \{\n\s+signingConfig signingConfigs\.debug\n/);
  assert.match(
    out,
    /release \{\n\s+\/\/ Caution[^\n]*\n\s+signingConfig signingConfigs\.release\.storeFile \? signingConfigs\.release : signingConfigs\.debug/,
  );
  // the generated debug signing config is still there after the new one
  assert.match(
    out,
    /signingConfigs \{\n\s+release \{[\s\S]*?\n {8}\}\n {8}debug \{\n\s+storeFile file\('debug\.keystore'\)/,
  );
});

test("applying the plugin twice changes nothing more", () => {
  const once = applyReleaseSigning(generated);
  assert.equal(applyReleaseSigning(once), once);
});

test("a build.gradle the plugin does not recognise stops the build instead of shipping a debug-signed release", () => {
  assert.throws(() => applyReleaseSigning("android {}"), /signingConfigs block not found/);
  assert.throws(
    () =>
      applyReleaseSigning(
        "android {\n    signingConfigs {\n    }\n    buildTypes {\n        release {\n        }\n    }\n}",
      ),
    /release build type not found/,
  );
});
