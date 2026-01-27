# Spliter — Sprint Plan (14 Days)

## Overview

**Goal:** Ship MVP in 14 days
**Working hours:** ~6-8h/day
**Approach:** Vertical slices — each day delivers working increment

---

## Day-by-Day Plan

### Day 1: Project Setup + Wallet Connect ✅
**Goal:** App skeleton with wallet connection working

- [ ] Create Expo project with TypeScript
- [ ] Install dependencies (Solana, MWA, Zustand)
- [ ] Setup folder structure
- [ ] Create Welcome screen with branding
- [ ] Implement wallet connection (MWA)
- [ ] Create basic wallet store (Zustand)
- [ ] Test on emulator + Seeker

**Deliverable:** App that connects to wallet and shows connected address

---

### Day 2: Navigation + Home Screen
**Goal:** Tab navigation with groups list

- [ ] Setup Expo Router with tabs
- [ ] Create Home screen (groups list — empty state)
- [ ] Create Settings screen (connected wallet, disconnect)
- [ ] Design basic UI components (Button, Card)
- [ ] Add app icon and splash screen

**Deliverable:** Navigable app with wallet in settings

---

### Day 3: Group Creation
**Goal:** Users can create groups

- [ ] Create Group store (Zustand + AsyncStorage)
- [ ] Create "Create Group" screen
- [ ] Implement group creation flow
- [ ] Show groups on Home screen
- [ ] Handle empty state gracefully

**Deliverable:** Create group → see it on home

---

### Day 4: Group Detail + Members
**Goal:** View group, add members

- [ ] Create Group Detail screen (tabs: Expenses/Balances/Members)
- [ ] Implement Members tab
- [ ] Create "Add Member" modal/screen
- [ ] Wallet address input with paste
- [ ] Optional nickname
- [ ] Store members in group data

**Deliverable:** Add members to group

---

### Day 5: Add Expense - UI
**Goal:** Expense creation form

- [ ] Create "Add Expense" screen
- [ ] Amount input (USDC, number pad)
- [ ] Description input
- [ ] Payer selection (dropdown of members)
- [ ] Split preview (equal split, show per-person)
- [ ] Create Expense store

**Deliverable:** Expense form complete (UI only)

---

### Day 6: Add Expense - Logic
**Goal:** Expenses stored and displayed

- [ ] Save expenses to storage
- [ ] Show expenses list in group (Expenses tab)
- [ ] Expense card component
- [ ] Calculate running totals
- [ ] Handle edge cases (1 member, 0 amount)

**Deliverable:** Add expense → see it in list

---

### Day 7: Balance Calculation
**Goal:** Calculate who owes whom

- [ ] Implement balance calculation algorithm
- [ ] Simplify debts (A→B, B→C becomes A→C optimization)
- [ ] Create Balances tab UI
- [ ] Show "You owe X" / "X owes you" cards
- [ ] Net balance per member pair

**Deliverable:** See calculated balances

---

### Day 8: Settlement Flow - UI
**Goal:** Settlement screen and confirmation

- [ ] Create Settle screen
- [ ] Amount input (pre-filled from balance)
- [ ] Currency toggle (USDC/SOL)
- [ ] Recipient display (address + nickname)
- [ ] Confirmation step
- [ ] Transaction status UI (pending, success, error)

**Deliverable:** Complete settlement UI flow

---

### Day 9: Settlement - Solana Integration
**Goal:** Actual on-chain transfers

- [ ] Build USDC transfer transaction
- [ ] Build SOL transfer transaction
- [ ] Integrate with MWA signing
- [ ] Handle insufficient balance errors
- [ ] Handle insufficient SOL for fees
- [ ] Store settlement record locally

**Deliverable:** Real transfers working!

---

### Day 10: Settlement Polish + Testing
**Goal:** Bulletproof settlement flow

- [ ] Test USDC transfers (devnet)
- [ ] Test SOL transfers (devnet)
- [ ] Add transaction explorer link
- [ ] Improve error messages
- [ ] Add retry mechanism
- [ ] Test on Seeker device

**Deliverable:** Reliable settlement flow

---

### Day 11: UX Polish
**Goal:** Make it feel good

- [ ] Loading states everywhere
- [ ] Pull-to-refresh on lists
- [ ] Empty states with illustrations
- [ ] Form validation with clear errors
- [ ] Haptic feedback on actions
- [ ] Smooth animations (entry/exit)

**Deliverable:** Polished user experience

---

### Day 12: Edge Cases + Validation
**Goal:** Handle everything gracefully

- [ ] Self-payment prevention
- [ ] Zero amount prevention
- [ ] Duplicate member prevention
- [ ] Network error handling
- [ ] Wallet disconnection handling
- [ ] App backgrounding/foregrounding

**Deliverable:** Robust error handling

---

### Day 13: Final Testing + Mainnet
**Goal:** Production-ready

- [ ] Switch to mainnet RPC
- [ ] Test full flow with real USDC (small amounts)
- [ ] Test on multiple devices
- [ ] Fix any bugs found
- [ ] Performance check (list scrolling, etc.)
- [ ] Memory leak check

**Deliverable:** Mainnet-ready app

---

### Day 14: Release Prep
**Goal:** Ready for Solana dApp Store

- [ ] Final UI review
- [ ] App store screenshots
- [ ] Write app description
- [ ] Build release APK
- [ ] Test release build on device
- [ ] Prepare dApp Store submission
- [ ] Create demo video (optional)

**Deliverable:** Submittable release build

---

## Milestones Summary

| Day | Milestone | Status |
|-----|-----------|--------|
| 1 | Wallet connect working | ⬜ |
| 3 | Groups can be created | ⬜ |
| 6 | Expenses can be added | ⬜ |
| 7 | Balances calculated | ⬜ |
| 9 | On-chain settlement works | ⬜ |
| 14 | Release-ready APK | ⬜ |

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| MWA issues | Test early (Day 1), have fallback to web wallet |
| Solana RPC rate limits | Use Helius/QuickNode free tier |
| Balance calculation bugs | Write unit tests for algorithm |
| Seeker-specific bugs | Test on real Seeker from Day 9 |
| Scope creep | Strict MVP scope, post-MVP list |

---

## Daily Standup Template

```markdown
## Day X Standup

### Done yesterday:
- ...

### Plan for today:
- ...

### Blockers:
- ...
```

---

## Post-MVP Backlog

Items explicitly deferred:
1. Unequal splits (percentages, exact amounts)
2. Expense editing/deletion
3. Expense categories
4. Receipt photos
5. Push notifications
6. Group sharing via link
7. Multi-currency support
8. Seeker Genesis Token verification (bonus features)
9. Fee-helper (auto-convert for fees)
10. Backend sync for multi-device
