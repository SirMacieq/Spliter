# Spliter 💸

Split expenses with friends. Settle instantly on Solana.

## Overview

Spliter is a mobile-first expense splitting app built natively for Solana. Think Venmo meets Splitwise, optimized for Solana Seeker users.

## Features

- 👥 Create groups with friends
- 📝 Track shared expenses in USDC
- ⚡ Settle up instantly on-chain
- 🔐 Non-custodial (your keys, your crypto)

## Tech Stack

- **Mobile:** React Native + Expo
- **Wallet:** Solana Mobile Wallet Adapter (MWA)
- **State:** Zustand + AsyncStorage
- **Blockchain:** Solana (USDC transfers)

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Expo CLI (`npm install -g expo-cli`)
- Android Studio or Xcode (for emulators)
- Solana wallet app (Phantom, Solflare, or Seeker)

### Installation

```bash
cd apps/mobile
npm install
```

### Development

```bash
# Start Expo dev server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS (Mac only)
npx expo run:ios
```

### Testing on Seeker

1. Enable Developer Mode on your Seeker device
2. Connect via USB or same WiFi network
3. Scan the QR code from Expo dev server
4. App will load with full MWA support

## Project Structure

```
spliter/
├── docs/           # Product specs and architecture
├── apps/
│   └── mobile/     # React Native Expo app
│       ├── app/    # Expo Router screens
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       └── lib/
└── packages/       # Shared packages (future)
```

## Documentation

- [Product Spec](docs/A-PRODUCT-SPEC.md)
- [Architecture](docs/B-ARCHITECTURE.md)
- [Repo Setup](docs/C-REPO-SETUP.md)
- [Sprint Plan](docs/D-SPRINT-PLAN.md)

## License

MIT
