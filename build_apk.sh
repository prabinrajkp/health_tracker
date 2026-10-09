#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  HEALTH QUEST — APK builder
#  Fully self-contained: data stored on the phone (IndexedDB).
#  No backend server required on the phone.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
ANDROID_DIR="$FRONTEND/android"
SDK_HOME="$HOME/android-sdk"
APK_OUT="$ROOT/health-quest-v4.29-debug.apk"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
error() { echo -e "${RED}✗ $*${NC}"; exit 1; }
step()  { echo -e "\n${GREEN}━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ── 1. Java JDK ────────────────────────────────────────────────────────────
step "Java JDK"
# Capacitor 8 requires Java 21
JAVA21="/usr/lib/jvm/java-21-openjdk-amd64"
if [ -d "$JAVA21" ]; then
  info "Java 21 found at $JAVA21"
elif java -version 2>&1 | grep -q "version \"21"; then
  info "Java 21 found: $(java -version 2>&1 | head -1)"
else
  warn "Java 21 not found — installing OpenJDK 21 (needs sudo)..."
  sudo apt-get update -qq
  sudo apt-get install -y openjdk-21-jdk
  info "Java 21 installed."
fi

# Resolve JAVA_HOME — must be Java 21 for Capacitor 8
if [ -d "/usr/lib/jvm/java-21-openjdk-amd64" ]; then
  JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
else
  JAVA_HOME="$(ls -d /usr/lib/jvm/java-21-* 2>/dev/null | head -1)"
  [ -z "$JAVA_HOME" ] && error "Could not find Java 21. Install openjdk-21-jdk and retry."
fi
export JAVA_HOME
info "JAVA_HOME: $JAVA_HOME"

# ── 2. Android SDK ─────────────────────────────────────────────────────────
step "Android SDK"

[ -z "${ANDROID_HOME:-}" ] && export ANDROID_HOME="$SDK_HOME"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"

SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

if [ ! -f "$SDKMANAGER" ]; then
  warn "Downloading Android command-line tools (~130 MB)..."
  mkdir -p "$ANDROID_HOME"
  TOOLS_ZIP="/tmp/cmdline-tools.zip"

  if command -v wget &>/dev/null; then
    wget -q --show-progress -O "$TOOLS_ZIP" \
      "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  elif command -v curl &>/dev/null; then
    curl -L --progress-bar -o "$TOOLS_ZIP" \
      "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  else
    error "Neither wget nor curl found. Install one and retry."
  fi

  UNZIP_TMP="/tmp/cmdline-tools-extract"
  rm -rf "$UNZIP_TMP" && mkdir -p "$UNZIP_TMP"
  unzip -q "$TOOLS_ZIP" -d "$UNZIP_TMP"
  rm -f "$TOOLS_ZIP"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  mv "$UNZIP_TMP/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$UNZIP_TMP"
  info "Command-line tools ready."
fi

# ── 3. SDK packages ────────────────────────────────────────────────────────
step "SDK packages"
info "Accepting licenses..."
yes | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses >/dev/null 2>&1 || true
info "Installing android-35, build-tools, platform-tools..."
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" "platforms;android-35" "build-tools;35.0.0" "platform-tools"
info "SDK ready."

# ── 4. npm install ─────────────────────────────────────────────────────────
step "npm install"
cd "$FRONTEND"
npm install --legacy-peer-deps

# ── 5. React build (no VITE_API_URL needed — app uses local storage) ───────
step "React build"
npm run build
info "React app built."

# ── 6. Capacitor sync ─────────────────────────────────────────────────────
step "Capacitor sync"
npx cap sync android
info "Capacitor synced."

# ── 7. Gradle APK ─────────────────────────────────────────────────────────
step "Gradle APK build"
cd "$ANDROID_DIR"
chmod +x gradlew

# Write sdk.dir so Gradle finds the SDK regardless of env var state
echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

# Pin JDK 21 in gradle.properties so it isn't overridden by system default
GRADLE_PROPS="$ANDROID_DIR/gradle.properties"
grep -v "^org.gradle.java.home" "$GRADLE_PROPS" > /tmp/gradle.properties.tmp 2>/dev/null || true
echo "org.gradle.java.home=$JAVA_HOME" >> /tmp/gradle.properties.tmp
mv /tmp/gradle.properties.tmp "$GRADLE_PROPS"

# Wipe the jars cache — avoids "Failed to create Jar file" on corrupt entries
rm -rf "$HOME/.gradle/caches/jars-9/" 2>/dev/null || true

GRADLE_LOG="/tmp/gradle-build.log"
./gradlew assembleDebug \
  --no-daemon \
  --console=plain \
  2>&1 | tee "$GRADLE_LOG" | grep -E "(BUILD|> Task|FAILURE|ERROR|Exception|Download)" || true

GRADLE_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$GRADLE_APK" ]; then
  warn "Build may have failed — last 50 lines:"
  tail -50 "$GRADLE_LOG"
  error "APK not produced."
fi

# ── 8. Copy to project root ────────────────────────────────────────────────
cp "$GRADLE_APK" "$APK_OUT"

PC_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓  APK READY  (fully self-contained)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  File : $APK_OUT"
echo "  Size : $(du -h "$APK_OUT" | cut -f1)"
echo ""
echo "  Data is stored locally on the phone — no backend needed."
echo ""
echo "  ─── Install on phone ────────────────────────────────"
echo "  Option A  USB + adb (fastest):"
echo "    adb install \"$APK_OUT\""
echo ""
echo "  Option B  WiFi (same network as this PC):"
echo "    1. Run:   python3 -m http.server 9999 --directory \"$ROOT\""
echo "    2. Phone: http://${PC_IP:-<your-pc-ip>}:9999/health-quest-debug.apk"
echo "    3. Tap the file to install"
echo "       (Android: Settings → Apps → Install unknown apps → enable for browser)"
echo ""
