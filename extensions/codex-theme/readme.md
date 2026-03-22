# CodeX Theme

A comprehensive Visual Studio Code theme extension featuring carefully crafted color schemes and custom file icons for an enhanced coding experience.

## Features

### Color Themes
- **CodeX Dark** - A sophisticated dark theme with balanced contrast and modern aesthetics
- **CodeX Light** - A clean, bright theme perfect for daytime coding
- **CodeX Obsidian** - A deep, rich dark theme inspired by obsidian stone
- **CodeX Midnight** - An ultra-dark theme for late-night coding sessions
- **CodeX Titan** - A powerful dark theme with strong visual hierarchy
- **CodeX High Contrast** - An accessibility-focused theme with maximum contrast

### Icon Theme
- **CodeX Icon Theme** - Custom file and folder icons with comprehensive language support
- Color-coded folders for better organization
- Specialized icons for popular frameworks and tools
- Consistent visual language across all file types

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "CodeX Theme"
4. Click **Install** on the CodeX Theme extension

## Theme Variants

### CodeX Dark
- **Editor Background**: `#121212`
- **Primary Accent**: `#0078D4`
- **Foreground**: `#D0D0D0`
- Perfect for general-purpose development with excellent readability

### CodeX Light
- **Editor Background**: `#F7F7F7`
- **Primary Accent**: `#0078D4`
- **Foreground**: `#1E1E1E`
- Clean and bright, ideal for well-lit environments

### CodeX Obsidian
- Deep, rich colors with enhanced contrast
- Specialized syntax highlighting for better code comprehension
- Optimized for long coding sessions

### CodeX Midnight
- Ultra-dark background (`#0D0D0D`)
- Reduced eye strain for night-time coding
- Subtle accent colors for minimal distraction

### CodeX Titan
- Strong visual hierarchy
- Enhanced syntax highlighting
- Professional appearance for enterprise development

### CodeX High Contrast
- Maximum contrast ratios for accessibility
- WCAG compliant color combinations
- Ideal for users with visual impairments

## Color Palette

### Primary Colors
- **Blue**: `#0078D4` - Primary accent, links, active elements
- **Cyan**: `#83d6c5` - Keywords, constants
- **Purple**: `#aa9bf5` - Variables, parameters
- **Pink**: `#e394dc` - Strings
- **Yellow**: `#ebc88d` - Functions
- **Orange**: `#fad075` - Booleans, tags

### UI Elements
- **Backgrounds**: Ranging from `#0D0D0D` (darkest) to `#F7F7F7` (lightest)
- **Borders**: Subtle `#1A1A1A` for dark themes, `#DCDCDC` for light
- **Text**: Carefully balanced for readability across all themes

## Supported File Types

The CodeX Icon Theme includes icons for:

### Languages
- JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust
- HTML, CSS, SCSS, SASS, LESS
- Markdown, JSON, YAML, XML
- Shell scripts, PowerShell, Batch
- And many more...

### Frameworks & Tools
- React, Vue, Angular, Svelte
- Node.js, Django, Flask, Rails
- Docker, Kubernetes
- Git, GitHub, GitLab
- Webpack, Vite, Babel
- ESLint, Prettier, Jest

### File Categories
- Configuration files (`.env`, `.config`, `settings.json`)
- Documentation (`.md`, `.txt`, `.pdf`)
- Media files (images, videos, audio)
- Database files (`.sql`, `.db`)
- Build artifacts and compiled files

## Customization

You can further customize the themes by overriding colors in your `settings.json`:

```json
{
  "workbench.colorCustomizations": {
    "[CodeX Dark]": {
      "editor.background": "#1a1a1a",
      "activityBar.background": "#0a0a0a"
    }
  },
  "editor.tokenColorCustomizations": {
    "[CodeX Dark]": {
      "textMateRules": [
        {
          "scope": "comment",
          "settings": {
            "fontStyle": "italic",
            "foreground": "#5a5a5a"
          }
        }
      ]
    }
  }
}
```

## Troubleshooting

### Icons Not Showing
1. Ensure the icon theme is activated: `Ctrl+Shift+P` → "Preferences: File Icon Theme"
2. Restart VS Code after activation
3. Check if other icon themes are conflicting

### Theme Not Applying
1. Verify the theme is installed and enabled
2. Try switching to another theme and back to CodeX
3. Restart VS Code
4. Check for conflicting extensions

### Performance Issues
- The themes are optimized for performance
- If you experience lag, try disabling other theme extensions
- Ensure you're using the latest version of VS Code

## Contributing

Contributions are welcome! Please feel free to submit issues and enhancement requests.

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Test with: `npm run compile`
5. Package with: `vsce package`

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the Visual Studio Code team for the excellent extension API
- Inspired by modern design principles and accessibility guidelines
- Built with passion for the developer community

---

**Enjoy coding with CodeX Theme!**
