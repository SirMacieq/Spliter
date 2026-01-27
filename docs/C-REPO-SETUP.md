# Spliter — Repository Setup

## Folder Structure

```
spliter/
├── docs/                       # Documentation
│   ├── A-PRODUCT-SPEC.md
│   ├── B-ARCHITECTURE.md
│   ├── C-REPO-SETUP.md
│   └── D-SPRINT-PLAN.md
│
├── apps/
│   └── mobile/                 # React Native Expo app
│       ├── app/                # Expo Router screens
│       │   ├── (tabs)/         # Tab navigation
│       │   │   ├── index.tsx   # Home (groups list)
│       │   │   └── settings.tsx
│       │   ├── group/
│       │   │   ├── [id].tsx    # Group detail
│       │   │   ├── create.tsx  # Create group
│       │   │   └── add-expense.tsx
│       │   ├── settle/
│       │   │   └── [id].tsx    # Settlement flow
│       │   ├── _layout.tsx     # Root layout
│       │   └── index.tsx       # Entry / Welcome
│       │
│       ├── components/         # Shared UI components
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   ├── WalletButton.tsx
│       │   └── ...
│       │
│       ├── hooks/              # Custom hooks
│       │   ├── useWallet.ts
│       │   ├── useGroups.ts
│       │   └── useSettlement.ts
│       │
│       ├── stores/             # Zustand stores
│       │   ├── groupStore.ts
│       │   ├── walletStore.ts
│       │   └── settingsStore.ts
│       │
│       ├── lib/                # Utilities
│       │   ├── solana.ts       # Solana helpers
│       │   ├── storage.ts      # AsyncStorage wrapper
│       │   ├── types.ts        # TypeScript types
│       │   └── constants.ts    # App constants
│       │
│       ├── assets/             # Images, fonts
│       ├── app.json            # Expo config
│       ├── package.json
│       ├── tsconfig.json
│       ├── babel.config.js
│       └── .env.local          # Environment vars
│
├── packages/                   # Shared packages (future)
│   └── anchor/                 # Anchor program (post-MVP)
│       └── ...
│
├── .gitignore
├── package.json                # Root package.json (workspaces)
├── README.md
└── turbo.json                  # Turborepo config (optional)
```

---

## Setup Commands

### Prerequisites

```bash
# Required
node >= 18
npm >= 9

# Recommended
# - Solana CLI (for devnet testing)
# - Android Studio or Xcode (for emulators)
# - Solana Seeker or Phantom Mobile (for real device testing)
```

### Step 1: Initialize Project

```bash
cd /Users/maciej/clawd/spliter

# Create Expo app with TypeScript
npx create-expo-app@latest apps/mobile --template tabs
cd apps/mobile

# Install core dependencies
npm install @solana/web3.js @solana/spl-token
npm install @solana-mobile/mobile-wallet-adapter-protocol
npm install @solana-mobile/mobile-wallet-adapter-protocol-web3js
npm install zustand
npm install @react-native-async-storage/async-storage
npm install react-native-mmkv  # Fast storage

# UI components
npm install react-native-paper react-native-safe-area-context

# Utils
npm install uuid bs58
npm install -D @types/uuid
```

### Step 2: Configure Expo

Update `app.json`:
```json
{
  "expo": {
    "name": "Spliter",
    "slug": "spliter",
    "version": "1.0.0",
    "scheme": "spliter",
    "platforms": ["ios", "android"],
    "android": {
      "package": "com.spliter.app",
      "adaptiveIcon": {
        "backgroundColor": "#1a1a2e"
      }
    },
    "ios": {
      "bundleIdentifier": "com.spliter.app"
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

### Step 3: Environment Variables

Create `.env.local`:
```bash
# Solana
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
EXPO_PUBLIC_SOLANA_NETWORK=mainnet-beta

# USDC Mint (Mainnet)
EXPO_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# For devnet testing, use:
# EXPO_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
# EXPO_PUBLIC_SOLANA_NETWORK=devnet
# EXPO_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (devnet USDC)
```

### Step 4: TypeScript Config

`tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### Step 5: Run Development

```bash
# Start Expo dev server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS (Mac only)
npx expo run:ios
```

---

## Git Setup

```bash
cd /Users/maciej/clawd/spliter

# Initialize git
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp/
.pnp.js

# Expo
.expo/
dist/
web-build/

# Native builds
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
android/
ios/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Turborepo
.turbo/

# Build
*.tsbuildinfo
EOF

# Initial commit
git add -A
git commit -m "Initial Spliter project setup"
```

---

## Recommended VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

---

## Development Workflow

### Daily Development
```bash
cd apps/mobile
npx expo start
# Press 'a' for Android, 'i' for iOS
```

### Testing on Seeker
1. Enable Developer Mode on Seeker
2. Connect via USB or same WiFi
3. Scan QR code from Expo
4. App loads with MWA support

### Building APK (for Solana dApp Store)
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build Android APK
eas build --platform android --profile preview
```
