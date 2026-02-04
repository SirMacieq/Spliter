# Spliter 💸

**Split and send SOL & USDC payments on Solana — instantly, on-chain.**

Spliter is a mobile-first Solana dApp that lets you send, split, and batch payments using SOL and USDC. Create payment links or QR codes, settle transactions directly on-chain, or send multiple payments in a single batch.

Built with Solana Seeker and Solana Mobile Wallet Adapter in mind.


## 🚀 Features

- 💸 **Send SOL & USDC** directly on Solana
- 🔗 **Create payment links & QR codes**
- 🔄 **Split payments** between multiple recipients
- 📦 **Batch transactions** in a single flow
- 🔐 **Non-custodial** — your wallet, your keys
- 📱 Optimized for **Solana Mobile / Seeker**


## 🧠 How It Works

Spliter connects to your mobile wallet via Solana Mobile Wallet Adapter (MWA).  
All transactions are executed **directly on-chain** — Spliter never takes custody of funds and does not act as an intermediary.


## 🛠 Tech Stack

- **Mobile:** React Native + Expo
- **Wallet:** Solana Mobile Wallet Adapter (MWA)
- **State:** Zustand + AsyncStorage
- **Blockchain:** Solana
- **Assets:** SOL, USDC
- **Network:** Mainnet-beta


## 🔐 Security & Custody

- Spliter is **non-custodial**
- Private keys never leave your wallet
- All transfers are signed by the user
- No backend custody or fund routing


## 📄 Privacy Policy

Spliter respects user privacy.

**Data Collection**
- Spliter does **not** collect personal data
- No email addresses, names, or identifiers are stored
- No analytics tied to wallet identity

**Wallet Usage**
- Wallet addresses are used **only** to facilitate on-chain transactions
- Wallet data is not stored on external servers

**On-Chain Data**
- All transactions occur on the Solana blockchain and are publicly verifiable
- Spliter does not control or modify on-chain data

**Third Parties**
- Spliter relies on the Solana blockchain and the user's chosen wallet provider
- No user data is sold or shared


## ⚖️ License

MIT License  
See [`LICENSE`](./LICENSE)


## © Copyright

© 2026 Spliter  
All rights reserved.


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
