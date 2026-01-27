# Spliter — System Architecture

## Design Philosophy

**Simplicity over purity.** For MVP:
- Off-chain storage for groups/expenses (faster iteration)
- On-chain only for settlements (trustless transfers)
- No smart contract for data storage (unnecessary complexity for MVP)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE APP (React Native)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Screens   │  │   Stores    │  │  Wallet Adapter     │  │
│  │  (UI/UX)    │  │  (Zustand)  │  │  (MWA)              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│   OFF-CHAIN STORE   │         │   SOLANA NETWORK    │
│   (AsyncStorage +   │         │                     │
│    Optional API)    │         │  - USDC Transfers   │
│                     │         │  - SOL Transfers    │
│  - Groups           │         │  - TX Signatures    │
│  - Members          │         │                     │
│  - Expenses         │         │                     │
│  - Settlements*     │         │                     │
└─────────────────────┘         └─────────────────────┘
       (* metadata)                (* actual txs)
```

---

## On-Chain vs Off-Chain Split

| Data | Storage | Rationale |
|------|---------|-----------|
| Groups | Off-chain | No value in on-chain; faster iteration |
| Members | Off-chain | Just wallet + nickname mapping |
| Expenses | Off-chain | Ledger is social, not financial |
| Settlements (metadata) | Off-chain | Track what was settled |
| Settlements (transfer) | **ON-CHAIN** | Actual USDC/SOL transfer |

### Why Off-Chain for MVP?

1. **Speed** — No program deployment, no account rent
2. **Flexibility** — Easy to change data model
3. **Cost** — Zero on-chain storage costs
4. **Privacy** — Expense data stays local/encrypted

### Why On-Chain for Settlements?

1. **Trustless** — User signs, funds move
2. **Verifiable** — TX signature is proof
3. **No custody** — App never touches funds

---

## Data Storage Strategy

### Phase 1: Local-First (MVP)

```
AsyncStorage (device-local)
├── groups/
│   └── {groupId}.json
├── expenses/
│   └── {groupId}/
│       └── {expenseId}.json
└── settlements/
    └── {groupId}/
        └── {settlementId}.json
```

**Pros:** Zero backend, instant, works offline
**Cons:** No sync across devices, no shared group state

### Phase 1.5: Shared via Group Invite Link (MVP Enhancement)

Groups can be "exported" as a signed payload:
1. Creator signs group data with wallet
2. Generates shareable link (base64 encoded)
3. Members import via link
4. Each member has local copy

### Phase 2: Backend Sync (Post-MVP)

Optional lightweight API for group sync:
- Supabase or similar
- Wallet-based auth (sign message)
- Real-time sync for shared groups

---

## Settlement Flow (On-Chain)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User taps   │────▶│  Build TX    │────▶│  MWA Sign    │
│  "Settle"    │     │  (SPL Token  │     │  (Seeker     │
│              │     │   Transfer)  │     │   double-tap)│
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Update UI   │◀────│  Confirm TX  │◀────│  Broadcast   │
│  + Local DB  │     │  on-chain    │     │  to Solana   │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Transaction Details

**USDC Transfer:**
```typescript
// SPL Token Transfer
{
  program: TOKEN_PROGRAM_ID,
  instruction: 'transfer',
  source: userUsdcAta,      // User's USDC ATA
  destination: recipientAta, // Recipient's USDC ATA
  amount: amountInLamports,  // USDC has 6 decimals
  authority: userWallet,
}
```

**SOL Transfer:**
```typescript
// System Program Transfer
{
  program: SystemProgram,
  instruction: 'transfer',
  from: userWallet,
  to: recipientWallet,
  lamports: amount,
}
```

---

## Security Model

### Assumptions

1. **Wallet is identity** — User authenticated by wallet signature
2. **No custody** — App never has access to private keys
3. **Local data = user's responsibility** — Clearing app clears data
4. **Settlements are final** — On-chain transfers are irreversible

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| Fake group members | Verify wallet can sign (future: require member confirmation) |
| Expense manipulation | Creator signs expenses; others can dispute (post-MVP) |
| Phishing (wrong recipient) | Show recipient address clearly; Seeker ID if available |
| Insufficient fees | Check SOL balance before TX; clear error message |

---

## Tech Stack

### Mobile App
- **Framework:** React Native + Expo (SDK 52+)
- **State:** Zustand
- **Storage:** AsyncStorage + MMKV (fast)
- **Wallet:** @solana-mobile/mobile-wallet-adapter
- **Solana:** @solana/web3.js, @solana/spl-token
- **UI:** React Native Paper or Tamagui

### Solana Integration
- **Network:** Mainnet (devnet for testing)
- **RPC:** Helius or QuickNode (free tier)
- **Tokens:** USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)

### Development
- **Monorepo:** Turborepo or simple npm workspaces
- **Types:** TypeScript everywhere
- **Linting:** ESLint + Prettier

---

## Environment Variables

```bash
# .env.local
EXPO_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
EXPO_PUBLIC_SOLANA_NETWORK=mainnet-beta
EXPO_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

---

## Future Architecture (Post-MVP)

### Smart Contract (Anchor)

If we need on-chain group state:
```rust
#[account]
pub struct Group {
    pub creator: Pubkey,
    pub name: String,
    pub members: Vec<Pubkey>,
    pub created_at: i64,
}

#[account]
pub struct Expense {
    pub group: Pubkey,
    pub paid_by: Pubkey,
    pub amount: u64,
    pub description: String,
    pub split_between: Vec<Pubkey>,
}
```

**When to add:** If we need trustless group state, multi-device sync without backend, or on-chain expense verification.
