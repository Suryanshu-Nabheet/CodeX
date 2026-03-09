#!/bin/bash

# ============================================================================
# CodeX AppImage Creation Script (Legacy/Simple Version)
# ============================================================================
# This is a simplified version for creating AppImages directly on Linux
# without Docker. Use create_appimage.sh for production builds.
# ============================================================================

set -e  # Exit on error
set -x  # Print commands as they are executed

# Configuration
APP_NAME="codex"
APP_DISPLAY_NAME="CodeX"
APP_VERSION="1.0.0"
ARCH="x86_64"

export ARCH

echo "============================================"
echo "  CodeX AppImage Builder (Legacy)"
echo "  Version: ${APP_VERSION}"
echo "============================================"

# Check if codex binary exists in current directory
if [ ! -f "./codex" ]; then
    echo "Error: codex binary not found in current directory"
    echo "Please ensure the 'codex' executable is in this directory."
    exit 1
fi

# Check if icon exists
if [ ! -f "./CodeX.png" ]; then
    echo "Error: CodeX.png icon not found in current directory"
    echo "Please ensure 'CodeX.png' is in this directory."
    exit 1
fi

# Create temporary directory
TEMP_DIR="$(mktemp -d)"
echo "Created temporary directory: $TEMP_DIR"
APP_DIR="$TEMP_DIR/${APP_DISPLAY_NAME}.AppDir"

# Create basic AppDir structure
mkdir -pv "$APP_DIR/usr/bin"
mkdir -pv "$APP_DIR/usr/lib"
mkdir -pv "$APP_DIR/usr/share/applications"
mkdir -pv "$APP_DIR/usr/share/icons/hicolor/256x256/apps"
mkdir -pv "$APP_DIR/usr/share/metainfo"

echo "Copying application binary..."
cp -v ./codex "$APP_DIR/usr/bin/"

# Copy the icon to required locations
echo "Copying icons..."
cp -v ./CodeX.png "$APP_DIR/codex.png"
cp -v ./CodeX.png "$APP_DIR/usr/share/icons/hicolor/256x256/apps/codex.png"

# Copy dependencies with error checking
echo "Copying dependencies..."
for lib in $(ldd ./codex | grep "=> /" | awk '{print $3}'); do
    if [ -f "$lib" ]; then
        cp -v "$lib" "$APP_DIR/usr/lib/" || echo "Failed to copy $lib"
    else
        echo "Warning: Library $lib not found"
    fi
done

# Create desktop file
echo "Creating desktop file..."
cat > "$APP_DIR/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Name=${APP_DISPLAY_NAME}
Comment=AI-Powered Code Editor - The Ultimate Development Environment
GenericName=Code Editor
Exec=codex %F
Icon=codex
Type=Application
StartupNotify=true
StartupWMClass=CodeX
Categories=TextEditor;Development;IDE;Utility;
MimeType=application/x-codex-workspace;
Keywords=codex;code;editor;ide;
Actions=new-empty-window;

[Desktop Action new-empty-window]
Name=New Empty Window
Exec=codex --new-window %F
Icon=codex
EOF

# Make desktop file executable
chmod +x "$APP_DIR/${APP_NAME}.desktop"

# Copy the desktop file to the applications directory
cp -v "$APP_DIR/${APP_NAME}.desktop" "$APP_DIR/usr/share/applications/"

# Create AppRun
echo "Creating AppRun..."
cat > "$APP_DIR/AppRun" <<EOF
#!/bin/bash
# CodeX AppImage Launcher

HERE="\$(dirname "\$(readlink -f "\${0}")")"
export PATH="\${HERE}/usr/bin:\${PATH}"
export LD_LIBRARY_PATH="\${HERE}/usr/lib:\${LD_LIBRARY_PATH}"
exec "\${HERE}/usr/bin/codex" --no-sandbox "\$@"
EOF

# Make AppRun executable
chmod +x "$APP_DIR/AppRun"

# Download appimagetool if not present in the current directory
if [ ! -f "./appimagetool-x86_64.AppImage" ]; then
    echo "Downloading appimagetool-x86_64.AppImage..."
    wget "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool-x86_64.AppImage
else
    echo "appimagetool-x86_64.AppImage is already present."
fi

# Create the AppImage
echo "Creating AppImage..."
ARCH=x86_64 ./appimagetool-x86_64.AppImage "$APP_DIR" "${APP_DISPLAY_NAME}-${APP_VERSION}-${ARCH}.AppImage"

# Cleanup
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "============================================"
echo "  ✅ AppImage creation complete!"
echo "  Output: ${APP_DISPLAY_NAME}-${APP_VERSION}-${ARCH}.AppImage"
echo "============================================"
