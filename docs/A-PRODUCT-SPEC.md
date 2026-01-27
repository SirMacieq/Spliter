# Spliter — Product Specification (MVP)

## Overview

**Spliter** is a Solana-native mobile expense splitting app. Think Venmo meets Splitwise, built for Solana Seeker users.

**Core value:** Split expenses with friends, settle instantly on-chain in USDC.

---

## MVP Scope

### Features (In Scope)

1. **Create Group** — Name + optional description
2. **Add Members** — Wallet address + optional nickname
3. **Add Expense** — Amount (USDC), description, payer, equal split
4. **View Balances** — Who owes whom (net balances)
5. **Settle Up** — Direct wallet-to-wallet USDC transfer (SOL optional)

### Out of Scope (Post-MVP)

- Unequal splits / percentages
- Expense categories / receipts
- Multi-currency
- Push notifications
- Expense editing/deletion
- Group chat
- Fee-helper swaps (auto-convert SOL→USDC for fees)

---

## User Flows

### Flow 1: Onboarding
```
1. Open app → Welcome screen
2. Tap "Connect Wallet" → MWA triggers wallet selection
3. Wallet connected → Home screen (empty groups)
```

### Flow 2: Create Group
```
1. Home → Tap "+" or "Create Group"
2. Enter group name (required)
3. Tap "Create"
4. Group created → Group detail screen (you are only member)
```

### Flow 3: Add Members
```
1. Group detail → Tap "Add Member"
2. Enter wallet address (paste or scan QR)
3. Optional: Enter nickname
4. Tap "Add"
5. Member added → Shows in member list
```

### Flow 4: Add Expense
```
1. Group detail → Tap "Add Expense"
2. Enter amount (USDC)
3. Enter description ("Dinner", "Uber", etc.)
4. Select payer (default: you)
5. Split: Equal (MVP only)
6. Tap "Add Expense"
7. Expense recorded → Balances updated
```

### Flow 5: View Balances
```
1. Group detail → "Balances" tab
2. Shows net balances:
   - "You owe Alice 25 USDC"
   - "Bob owes you 15 USDC"
3. Tap on a balance → Settlement options
```

### Flow 6: Settle Up
```
1. Tap balance → "Settle" button
2. Confirm amount (can adjust down)
3. Select currency (USDC default, SOL toggle)
4. Tap "Send"
5. MWA transaction signing (Seeker: double-tap)
6. If insufficient SOL for fees → Show "Top up SOL" prompt
7. Transaction confirmed → Balance updated
```

---

## Screens

| # | Screen | Description |
|---|--------|-------------|
| 1 | Welcome | Logo, "Connect Wallet" button |
| 2 | Home | List of groups, "Create Group" FAB |
| 3 | Create Group | Form: name input |
| 4 | Group Detail | Tabs: Expenses / Balances / Members |
| 5 | Add Member | Form: wallet address, nickname |
| 6 | Add Expense | Form: amount, description, payer |
| 7 | Settle | Amount, currency toggle, confirm |
| 8 | Transaction Status | Pending → Success/Error |

---

## Data Model (Logical)

### Group
```typescript
{
  id: string;           // UUID
  name: string;
  createdBy: PublicKey;
  createdAt: Date;
  members: Member[];
}
```

### Member
```typescript
{
  wallet: PublicKey;
  nickname?: string;
  addedAt: Date;
}
```

### Expense
```typescript
{
  id: string;           // UUID
  groupId: string;
  amount: number;       // USDC (6 decimals)
  description: string;
  paidBy: PublicKey;
  splitBetween: PublicKey[];  // Equal split for MVP
  createdAt: Date;
}
```

### Settlement
```typescript
{
  id: string;
  groupId: string;
  from: PublicKey;
  to: PublicKey;
  amount: number;
  currency: 'USDC' | 'SOL';
  txSignature: string;
  settledAt: Date;
}
```

---

## Key UX Principles

1. **USDC-first** — All amounts displayed in USDC by default
2. **No custody** — App never holds funds; all transfers user-initiated
3. **Seeker-optimized** — Double-tap signing, Genesis Token recognition
4. **Minimal friction** — Fewest taps to complete core actions
5. **Clear states** — Loading, success, error always visible

---

## Success Metrics (Post-Launch)

- Groups created
- Expenses logged
- Settlements completed (on-chain txs)
- Viral coefficient (members invited per user)
