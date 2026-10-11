#!/bin/zsh
# Builds ExamForge.app (opens ExamForge in its own window; starts the local server if needed).
# Usage: scripts/make-mac-app.sh [install-dir]   (default: /Applications, else ~/Applications)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-/Applications}"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
APP="$DEST/ExamForge.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ROOT/scripts/icon/ExamForge.icns" "$APP/Contents/Resources/ExamForge.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>ExamForge</string>
  <key>CFBundleDisplayName</key><string>ExamForge</string>
  <key>CFBundleIdentifier</key><string>local.examforge.app</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>ExamForge</string>
  <key>CFBundleIconFile</key><string>ExamForge</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

cat > "$APP/Contents/MacOS/ExamForge" <<LAUNCH
#!/bin/zsh
ROOT="$ROOT"
URL="http://localhost:4317"
# Apps launched from Finder don't get your shell's PATH.
export PATH="\$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
LOG="\$ROOT/data/server.log"

if [ ! -d "\$ROOT" ]; then
  osascript -e 'display alert "ExamForge folder not found" message "Expected it at $ROOT. Re-run scripts/make-mac-app.sh from the ExamForge folder."'
  exit 1
fi
if ! command -v node >/dev/null; then
  osascript -e 'display alert "Node.js is required" message "Install Node.js from nodejs.org, then open ExamForge again."'
  open "https://nodejs.org"
  exit 1
fi
mkdir -p "\$ROOT/data"
if ! curl -s -o /dev/null --max-time 1 "\$URL/api/catalog"; then
  cd "\$ROOT"
  [ -d node_modules ] || npm install >> "\$LOG" 2>&1
  nohup node server.js >> "\$LOG" 2>&1 &
  for i in {1..60}; do curl -s -o /dev/null --max-time 1 "\$URL/api/catalog" && break; sleep 0.25; done
fi
# Prefer a chromeless app window; fall back to the default browser.
for b in "Google Chrome" "Microsoft Edge" "Brave Browser"; do
  if [ -d "/Applications/\$b.app" ]; then open -na "\$b" --args --app="\$URL"; exit 0; fi
done
open "\$URL"
LAUNCH
chmod +x "$APP/Contents/MacOS/ExamForge"
touch "$APP"
echo "Built $APP"
