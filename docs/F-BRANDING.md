# Spliter — Branding Guide

## Colors

```typescript
primary: '#9945FF'    // Solana purple - buttons, highlights
secondary: '#14F195'  // Solana green - success states
background: '#0D0D0D' // Near black
surface: '#1A1A2E'    // Card backgrounds
text: '#FFFFFF'       // Primary text
textSecondary: '#A0A0A0' // Muted text
error: '#FF4444'
success: '#14F195'
warning: '#FFB800'
```

## Typography

- **Headers:** System default, bold weight (600-700)
- **Body:** System default, regular weight (400)
- **Monospace:** For wallet addresses

## App Identity

- **Name:** Spliter
- **Tagline:** Split expenses with friends. Settle instantly on Solana.
- **Emoji:** 💸

## Required Assets

### Icon (1024x1024)
- Background: #0D0D0D
- Foreground: 💸 emoji or stylized "S" in #9945FF
- Save as: `assets/icon.png`

### Adaptive Icon Android (1024x1024)
- Transparent background
- Centered foreground element
- Save as: `assets/adaptive-icon.png`

### Splash Icon (288x288 recommended)
- Same as icon, centered
- Background handled by splash backgroundColor
- Save as: `assets/splash-icon.png`

### Favicon (48x48)
- Simple version of icon
- Save as: `assets/favicon.png`

## Quick Asset Generation

Use a tool like:
- [Expo Icon Builder](https://buildicon.netlify.app/)
- [App Icon Generator](https://appicon.co/)
- Figma template

Or generate programmatically:
```bash
# Using ImageMagick (if installed)
convert -size 1024x1024 xc:'#0D0D0D' -gravity center \
  -pointsize 400 -fill '#9945FF' -annotate 0 '💸' \
  assets/icon.png
```

## Minimum Viable Assets

For MVP, the default Expo assets work. Replace when ready:

1. Create 1024x1024 icon with dark bg + purple 💸
2. Resize to needed sizes
3. Replace files in `assets/`
4. Rebuild with `npx expo prebuild --clean`
