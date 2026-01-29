# Spliter — Sprint Plan (Completed)

## Overview

**Status:** ✅ MVP Complete
**Approach:** Continuous development until completion

---

## Completed Features

### Core Infrastructure ✅
- [x] Create Expo project with TypeScript
- [x] Install dependencies (Solana, MWA, Zustand)
- [x] Setup folder structure
- [x] Constants and types defined
- [x] Storage persistence with AsyncStorage

### Wallet Integration ✅
- [x] Welcome screen with branding
- [x] Implement wallet connection (MWA)
- [x] Create wallet store (Zustand)
- [x] Error handling for wallet connection

### Navigation ✅
- [x] Setup Expo Router with Stack navigation
- [x] All screens registered in _layout.tsx

### Screens ✅
- [x] **Welcome (index.tsx)** - Wallet connection, branding
- [x] **Home (home.tsx)** - Groups list with FAB
- [x] **Settings (settings.tsx)** - Wallet info, balances, disconnect
- [x] **Create Group (group/create.tsx)** - Group creation form
- [x] **Group Detail (group/[id].tsx)** - Tabs: Expenses/Balances/Members
- [x] **Add Member (group/add-member.tsx)** - Wallet address + nickname
- [x] **Add Expense (group/add-expense.tsx)** - Amount, description, payer, split
- [x] **Settle (group/settle.tsx)** - USDC/SOL transfers with confirmation

### Components ✅
- [x] Button (primary, secondary, outline, sizes)
- [x] Card
- [x] Input
- [x] EmptyState
- [x] Loading

### Stores ✅
- [x] walletStore - Connection state
- [x] groupStore - Groups, expenses, settlements, balances

### Hooks ✅
- [x] useWalletConnection - MWA integration
- [x] useErrorHandler - Error handling utility
- [x] useBalances - SOL/USDC balance fetching

### Solana Integration ✅
- [x] USDC transfers
- [x] SOL transfers
- [x] Balance checking
- [x] ATA creation if needed
- [x] Transaction confirmation
- [x] Solscan explorer links

### Balance Calculation ✅
- [x] Expense tracking
- [x] Equal split calculation
- [x] Net balance computation
- [x] Settlement recording

### UX ✅
- [x] Dark theme (Solana purple)
- [x] Loading states
- [x] Error states
- [x] Empty states
- [x] Form validation
- [x] Pull-to-refresh on lists

---

## File Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx          # Root layout + navigation
│   ├── index.tsx            # Welcome/connect screen
│   ├── home.tsx             # Groups list
│   ├── settings.tsx         # Wallet settings
│   └── group/
│       ├── [id].tsx         # Group detail with tabs
│       ├── create.tsx       # Create group
│       ├── add-member.tsx   # Add member to group
│       ├── add-expense.tsx  # Add expense
│       └── settle.tsx       # Settlement flow
├── components/
│   ├── index.ts
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── EmptyState.tsx
│   └── Loading.tsx
├── hooks/
│   ├── index.ts
│   ├── useWalletConnection.ts
│   ├── useErrorHandler.ts
│   └── useBalances.ts
├── stores/
│   ├── walletStore.ts
│   └── groupStore.ts
├── lib/
│   ├── constants.ts
│   ├── types.ts
│   ├── solana.ts
│   └── validation.ts
└── assets/
    └── (app icons, splash)
```

---

## Post-MVP Backlog

Items for future releases:
1. Unequal splits (percentages, exact amounts)
2. Expense editing/deletion
3. Expense categories
4. Receipt photos
5. Push notifications
6. Group sharing via link
7. Multi-currency support
8. Seeker Genesis Token verification
9. Fee-helper (auto-convert for fees)
10. Backend sync for multi-device
11. Haptic feedback
12. Custom app icon & splash screen
13. Unit tests

---

## Testing Checklist

Before release:
- [ ] Test wallet connection on Phantom
- [ ] Test wallet connection on Solflare
- [ ] Test on Seeker device
- [ ] Test USDC transfer (devnet first)
- [ ] Test SOL transfer (devnet first)
- [ ] Test mainnet with small amounts
- [ ] Test edge cases (1 member, 0 balance)
- [ ] Performance check on older devices

---

## Commands

```bash
# Development
cd apps/mobile
npm start          # Start Expo dev server

# Build
npx expo export --platform android
npx eas build --platform android --profile preview

# Run on device
npx expo start --android
npx expo start --ios
```
