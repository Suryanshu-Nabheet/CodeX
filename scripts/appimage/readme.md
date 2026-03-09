# CodeX AppImage Builder

<p align="center">
  <img src="CodeX.png" alt="CodeX Logo" width="200">
</p>

<p align="center">
  <strong>AI-Powered Code Editor</strong><br>
  Build production-ready Linux AppImages for CodeX
</p>

---

## 📋 Overview

This directory contains scripts for creating Linux AppImage distributions of CodeX. The scripts support both Docker-based cross-compilation (from macOS) and native Linux builds.

## 📁 Files

| File                        | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `create_appimage.sh`        | **Main script** - Docker-based AppImage builder (recommended) |
| `create-appimage-old.sh`    | Legacy script for direct Linux builds                         |
| `CodeX.png`                 | Application icon (256x256 recommended)                        |
| `codex.desktop`             | Desktop entry file for app launchers                          |
| `codex-url-handler.desktop` | URL handler for `codex://` protocol                           |

## 🖥️ System Requirements

### For Docker Build (Recommended)

- **Docker Desktop** (macOS or Linux)
- **Internet Connection** for downloading dependencies

### For Native Linux Build (Legacy Script)

- **Ubuntu 20.04+** or equivalent
- Required dependencies:
  ```
  libfuse2 libglib2.0-0 libgtk-3-0 libx11-xcb1 libxss1
  libxtst6 libnss3 libasound2 libdrm2 libgbm1
  ```

## 🚀 Quick Start

### Option 1: Docker Build (Recommended)

```bash
# Navigate to the appimage directory
cd scripts/appimage

# Make the script executable
chmod +x create_appimage.sh

# Run the build script
./create_appimage.sh
```

### Option 2: Native Linux Build

```bash
# Navigate to the appimage directory
cd scripts/appimage

# Ensure codex binary is present
# Make the script executable
chmod +x create-appimage-old.sh

# Run the build script
./create-appimage-old.sh
```

## 📖 Detailed Instructions

### Prerequisites

1. **Install Docker**
   - **macOS**: Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - **Ubuntu**: `sudo apt install docker.io`
   - **Arch Linux**: `sudo pacman -S docker`
   - **Fedora**: `sudo dnf install docker`

2. **Configure Docker Permissions** (Linux only)

   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER

   # Log out and back in for changes to take effect
   ```

3. **Start Docker Service** (Linux only)

   ```bash
   sudo systemctl enable docker
   sudo systemctl start docker
   ```

### Required Files

Before running the build script, ensure these files are present:

```
scripts/appimage/
├── create_appimage.sh      # Build script
├── CodeX.png               # Application icon
└── codex                   # Application binary (if building locally)
```

### Running the Build

```bash
# Make script executable
chmod +x create_appimage.sh

# Run the build
./create_appimage.sh
```

### Build Output

After successful completion, you'll find:

```
CodeX-x86_64.AppImage    # The ready-to-distribute AppImage
```

## 🔧 Build Process Overview

The `create_appimage.sh` script performs the following steps:

1. **Platform Detection** - Checks for macOS or Linux
2. **Docker Verification** - Ensures Docker is installed and running
3. **Buildx Setup** - Installs Docker Buildx if needed
4. **Icon Validation** - Verifies `CodeX.png` exists
5. **Tool Download** - Downloads `appimagetool` if not present
6. **Docker Build** - Creates Ubuntu 20.04-based build environment
7. **AppDir Creation** - Builds the AppImage directory structure:
   ```
   CodeXApp.AppDir/
   ├── AppRun
   ├── codex.desktop
   ├── codex.png
   └── usr/
       ├── bin/
       ├── lib/
       └── share/
           ├── applications/
           ├── icons/
           └── metainfo/
   ```
8. **AppImage Generation** - Packages everything into a single executable
9. **Cleanup** - Removes temporary build files

## 🔒 Desktop Integration

The generated AppImage includes:

- **Desktop Entry** (`codex.desktop`) - For application launchers
- **URL Handler** (`codex-url-handler.desktop`) - For `codex://` URLs
- **AppStream Metadata** - For software centers and app stores
- **Icon Assets** - Multiple resolution icons for various contexts

## ⚠️ Troubleshooting

### Docker Not Running

```bash
# Check Docker status
docker info

# Start Docker service (Linux)
sudo systemctl start docker
```

### Permission Denied

```bash
# Run with sudo (not recommended) or fix Docker permissions
sudo usermod -aG docker $USER
# Then log out and back in
```

### Missing Icon

```bash
# Ensure CodeX.png exists in the same directory
ls -la CodeX.png
```

### Build Fails

```bash
# Clean up and retry
rm -f *.AppImage appimagetool Dockerfile.build .dockerignore
./create_appimage.sh
```

## 📦 Distribution

The generated `CodeX-x86_64.AppImage` can be:

- **Run directly** - `./CodeX-x86_64.AppImage`
- **Installed** - Move to `/opt/` or `~/Applications/`
- **Integrated** - Use AppImageLauncher for full desktop integration

## 📄 License

This script is provided "as is" under the same license as the main CodeX project. Free to use, modify, and distribute.

---

<p align="center">
  Made with ❤️ by the CodeX Team
</p>
