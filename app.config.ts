import type { ConfigContext, ExpoConfig } from "expo/config";
import { readFileSync } from "node:fs";
import { versionCode } from "./src/core/release.ts";

// app.json holds the static settings; the version comes from package.json, which release-please bumps (docs/SHIPPING.md).
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  version,
  android: { ...config.android, versionCode: versionCode(version) },
  plugins: [...(config.plugins ?? []), "./plugins/with-release-signing.cjs"],
});
