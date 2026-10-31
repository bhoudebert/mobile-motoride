{
  description = "MobileMotoRide: motorcycle GPS app (Expo, React Native, Android)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          android_sdk.accept_license = true;
        };
      };

      # Versions follow React Native's catalog: node_modules/react-native/gradle/libs.versions.toml
      android = pkgs.androidenv.composeAndroidPackages {
        platformVersions = [
          "36"
          "37"
        ];
        buildToolsVersions = [
          "36.0.0"
          "37.0.0"
        ];
        ndkVersions = [ "27.1.12297006" ];
        cmakeVersions = [ "3.22.1" ];
        includeNDK = true;
        includeEmulator = false;
      };
      sdk = "${android.androidsdk}/libexec/android-sdk";
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        name = "mobile-motoride-shell";
        packages = [
          pkgs.nodejs_24
          pkgs.jdk17
          pkgs.git
          pkgs.gh
          # `npm run specs`: the same validator as the CI check "Specs validate".
          pkgs.openspec
          android.androidsdk
        ];

        ANDROID_HOME = sdk;
        ANDROID_SDK_ROOT = sdk;
        JAVA_HOME = "${pkgs.jdk17}";

        # Gradle downloads an aapt2 that cannot run on NixOS (dynamic linker); use the SDK's.
        GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${sdk}/build-tools/37.0.0/aapt2";

        shellHook = ''
          if [ ! -d node_modules ]; then
            echo "node_modules missing: run 'npm ci' (also installs the git hooks)"
          fi
        '';
      };
    };
}
