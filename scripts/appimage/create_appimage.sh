#!/bin/bash

# ============================================================================
# CodeX AppImage Creation Script
# ============================================================================
# This script creates a production-ready Linux AppImage for CodeX
# Supports both macOS (for cross-compilation) and Linux native builds
# ============================================================================

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="CodeX"
APP_NAME_LOWER="codex"
APP_VERSION="1.0.0"
ARCH="x86_64"
BUILD_IMAGE_NAME="codex-appimage-builder"

# Print banner
echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║     ██████╗ ██████╗ ██████╗ ███████╗██╗  ██╗                     ║"
echo "║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝╚██╗██╔╝                     ║"
echo "║    ██║     ██║   ██║██║  ██║█████╗   ╚███╔╝                      ║"
echo "║    ██║     ██║   ██║██║  ██║██╔══╝   ██╔██╗                      ║"
echo "║    ╚██████╗╚██████╔╝██████╔╝███████╗██╔╝ ██╗                     ║"
echo "║     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝                     ║"
echo "║                                                                  ║"
echo "║              AppImage Builder v${APP_VERSION}                           ║"
echo "║              AI-Powered Code Editor                              ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check platform
platform=$(uname)

echo -e "${CYAN}[INFO]${NC} Detecting platform..."

if [[ "$platform" == "Darwin" ]]; then
    echo -e "${YELLOW}[NOTICE]${NC} Running on macOS. The AppImage created will only work on Linux systems."
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} Docker Desktop for Mac is not installed."
        echo -e "${BLUE}[INFO]${NC} Please install it from: https://www.docker.com/products/docker-desktop"
        exit 1
    fi
elif [[ "$platform" == "Linux" ]]; then
    echo -e "${GREEN}[OK]${NC} Running on Linux. Proceeding with AppImage creation..."
else
    echo -e "${RED}[ERROR]${NC} This script is intended to run on macOS or Linux."
    echo -e "${RED}[ERROR]${NC} Current platform: $platform"
    exit 1
fi

# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Check if Docker is running
echo -e "${CYAN}[INFO]${NC} Checking Docker status..."
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker is not running. Please start Docker first."
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Docker is running."

# Check and install Buildx if needed
echo -e "${CYAN}[INFO]${NC} Checking Docker Buildx..."
if ! docker buildx version >/dev/null 2>&1; then
    echo -e "${YELLOW}[NOTICE]${NC} Installing Docker Buildx..."
    mkdir -p ~/.docker/cli-plugins/
    curl -SL https://github.com/docker/buildx/releases/download/v0.13.1/buildx-v0.13.1.linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
fi
echo -e "${GREEN}[OK]${NC} Docker Buildx is available."

# Check for required icon file
if [ ! -f "CodeX.png" ]; then
    echo -e "${RED}[ERROR]${NC} CodeX.png icon not found in current directory!"
    echo -e "${BLUE}[INFO]${NC} Please ensure CodeX.png exists before running this script."
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Icon file found: CodeX.png"

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo -e "${CYAN}[INFO]${NC} Downloading appimagetool..."
    wget -O appimagetool "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool
    echo -e "${GREEN}[OK]${NC} appimagetool downloaded."
else
    echo -e "${GREEN}[OK]${NC} appimagetool already present."
fi

# Delete any existing AppImage to avoid bloating the build
rm -f ${APP_NAME}-${ARCH}.AppImage

# Create build Dockerfile
echo -e "${CYAN}[INFO]${NC} Creating build Dockerfile..."
cat > Dockerfile.build << 'EOF'
# syntax=docker/dockerfile:1
FROM ubuntu:20.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install required dependencies for the AppImage
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    binutils \
    file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
EOF

# Create .dockerignore file
echo -e "${CYAN}[INFO]${NC} Creating .dockerignore file..."
cat > .dockerignore << EOF
Dockerfile.build
.dockerignore
.git
.gitignore
.DS_Store
*~
*.swp
*.swo
*.tmp
*.bak
*.log
*.err
node_modules/
venv/
*.egg-info/
*.tox/
dist/
EOF

# Build Docker image without cache
echo -e "${CYAN}[INFO]${NC} Building Docker image (no cache)..."
docker build --no-cache -t "$BUILD_IMAGE_NAME" -f Dockerfile.build .

# Create AppImage using local appimagetool
echo -e "${CYAN}[INFO]${NC} Creating AppImage..."
docker run --rm --privileged -v "$(pwd):/app" "$BUILD_IMAGE_NAME" bash -c '
cd /app && \

# Clean up any existing AppDir
rm -rf CodeXApp.AppDir && \

# Create AppDir structure
mkdir -p CodeXApp.AppDir/usr/bin \
         CodeXApp.AppDir/usr/lib \
         CodeXApp.AppDir/usr/share/applications \
         CodeXApp.AppDir/usr/share/icons/hicolor/16x16/apps \
         CodeXApp.AppDir/usr/share/icons/hicolor/32x32/apps \
         CodeXApp.AppDir/usr/share/icons/hicolor/48x48/apps \
         CodeXApp.AppDir/usr/share/icons/hicolor/64x64/apps \
         CodeXApp.AppDir/usr/share/icons/hicolor/128x128/apps \
         CodeXApp.AppDir/usr/share/icons/hicolor/256x256/apps \
         CodeXApp.AppDir/usr/share/icons/hicolor/512x512/apps \
         CodeXApp.AppDir/usr/share/metainfo && \

# Copy application files (excluding build artifacts)
find . -maxdepth 1 ! -name CodeXApp.AppDir ! -name "." ! -name ".." ! -name "*.AppImage" ! -name "appimagetool" ! -name "Dockerfile.build" ! -name ".dockerignore" -exec cp -r {} CodeXApp.AppDir/usr/bin/ \; && \

# Copy icon to root and icon directories
cp CodeX.png CodeXApp.AppDir/codex.png && \
cp CodeX.png CodeXApp.AppDir/usr/share/icons/hicolor/256x256/apps/codex.png && \

# Create main desktop entry
cat > CodeXApp.AppDir/codex.desktop << DESKTOP_EOF
[Desktop Entry]
Name=CodeX
Comment=AI-Powered Code Editor - The Ultimate Development Environment
GenericName=Code Editor
Exec=codex %F
Icon=codex
Type=Application
StartupNotify=true
StartupWMClass=CodeX
Categories=TextEditor;Development;IDE;Utility;
MimeType=application/x-codex-workspace;text/plain;
Keywords=codex;code;editor;ide;development;programming;ai;
Actions=new-empty-window;

[Desktop Action new-empty-window]
Name=New Empty Window
Name[de]=Neues leeres Fenster
Name[es]=Nueva ventana vacía
Name[fr]=Nouvelle fenêtre vide
Name[it]=Nuova finestra vuota
Name[ja]=新しい空のウィンドウ
Name[ko]=새 빈 창
Name[ru]=Новое пустое окно
Name[zh_CN]=新建空窗口
Name[zh_TW]=開新空視窗
Exec=codex --new-window %F
Icon=codex
DESKTOP_EOF
chmod +x CodeXApp.AppDir/codex.desktop && \

# Copy desktop entry to applications directory
cp CodeXApp.AppDir/codex.desktop CodeXApp.AppDir/usr/share/applications/ && \

# Create URL handler desktop entry
cat > CodeXApp.AppDir/codex-url-handler.desktop << URL_EOF
[Desktop Entry]
Name=CodeX - URL Handler
Comment=AI-Powered Code Editor - URL Handler
GenericName=Code Editor
Exec=codex --open-url %U
Icon=codex
Type=Application
NoDisplay=true
StartupNotify=true
Categories=Utility;TextEditor;Development;IDE;
MimeType=x-scheme-handler/codex;
Keywords=codex;code;editor;
URL_EOF
chmod +x CodeXApp.AppDir/codex-url-handler.desktop && \
cp CodeXApp.AppDir/codex-url-handler.desktop CodeXApp.AppDir/usr/share/applications/ && \

# Create AppStream metadata for better desktop integration
cat > CodeXApp.AppDir/usr/share/metainfo/codex.appdata.xml << APPDATA_EOF
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>io.codex.CodeX</id>
  <name>CodeX</name>
  <summary>AI-Powered Code Editor</summary>
  <description>
    <p>CodeX is a modern, AI-powered code editor designed for developers who want to boost their productivity. With intelligent code suggestions, advanced syntax highlighting, and seamless integration with AI assistants, CodeX transforms the way you write code.</p>
    <p>Features:</p>
    <ul>
      <li>AI-powered code completion and suggestions</li>
      <li>Support for multiple programming languages</li>
      <li>Integrated terminal and debugger</li>
      <li>Git integration</li>
      <li>Customizable themes and extensions</li>
    </ul>
  </description>
  <launchable type="desktop-id">codex.desktop</launchable>
  <url type="homepage">https://codex.dev</url>
  <developer_name>Suryanshu Nabheet</developer_name>
  <provides>
    <binary>codex</binary>
  </provides>
  <categories>
    <category>Development</category>
    <category>IDE</category>
    <category>TextEditor</category>
  </categories>
  <content_rating type="oars-1.1" />
</component>
APPDATA_EOF

# Create AppRun launcher script
cat > CodeXApp.AppDir/AppRun << APPRUN_EOF
#!/bin/bash
# CodeX AppImage Launcher
# This script sets up the environment and launches CodeX

HERE=\$(dirname "\$(readlink -f "\${0}")")

# Set up library paths
export PATH=\${HERE}/usr/bin:\${PATH}
export LD_LIBRARY_PATH=\${HERE}/usr/lib:\${LD_LIBRARY_PATH}

# Set XDG paths for proper integration
export XDG_DATA_DIRS=\${HERE}/usr/share:\${XDG_DATA_DIRS}

# Launch CodeX with any passed arguments
# --no-sandbox is required for AppImage compatibility
exec \${HERE}/usr/bin/codex --no-sandbox "\$@"
APPRUN_EOF
chmod +x CodeXApp.AppDir/AppRun && \

# Set proper permissions for the entire AppDir
chmod -R 755 CodeXApp.AppDir && \

# Strip unneeded symbols from the binary to reduce size (if binary exists)
if [ -f "CodeXApp.AppDir/usr/bin/codex" ]; then
    strip --strip-unneeded CodeXApp.AppDir/usr/bin/codex 2>/dev/null || true
fi

echo "AppDir contents:" && \
ls -la CodeXApp.AppDir/ && \

# Create the AppImage
ARCH=x86_64 ./appimagetool -n CodeXApp.AppDir CodeX-x86_64.AppImage
'

# Clean up build artifacts
echo -e "${CYAN}[INFO]${NC} Cleaning up build artifacts..."
rm -rf CodeXApp.AppDir .dockerignore Dockerfile.build

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║   ✅ AppImage creation complete!                                 ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║   Output: CodeX-x86_64.AppImage                                  ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
