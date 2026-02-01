# End-to-End Device Test Checklist

Test on: **Solana Seeker (Android)**

## Prerequisites
- [ ] App built and installed on device
- [ ] Wallet app installed (Phantom, Solflare, etc.)
- [ ] Test wallet has:
  - [ ] SOL for fees (~0.01 SOL minimum)
  - [ ] Some USDC (for USDC tests)
- [ ] `EXPO_PUBLIC_FEE_WALLET` configured in env
- [ ] `EXPO_PUBLIC_FEE_BPS` set (default 250 = 2.5%)

---

## 1. Wallet Connection
- [ ] App loads splash screen
- [ ] Welcome screen shows "Connect Wallet" button
- [ ] Tapping "Connect" opens wallet adapter
- [ ] After authorization, redirects to Home
- [ ] Wallet address shows correctly in header

---

## 2. Group Flow
- [ ] Create new group
- [ ] Add another member (paste wallet address)
- [ ] Add expense (split between members)
- [ ] Balances tab shows correct amounts
- [ ] "You owe" / "owes you" displays correctly

---

## 3. Settle Payment (Direct)
- [ ] From Balances, tap "Pay" on a balance you owe
- [ ] Amount prefilled correctly
- [ ] Can toggle USDC/SOL
- [ ] Balance shown correctly
- [ ] "Continue" navigates to confirmation
- [ ] Confirmation shows amount, recipient, network fee
- [ ] "Send Payment" triggers wallet approval
- [ ] Pending screen shows while confirming
- [ ] Success screen shows with tx signature
- [ ] "View on Solscan" opens correct URL
- [ ] "Copy ID" copies signature

---

## 4. Pay Link - Request Payment

### 4.1 Generate Link
- [ ] From Balances, tap "Request" on balance owed to you
- [ ] Request Payment screen opens
- [ ] Amount prefilled correctly
- [ ] Can change amount
- [ ] Can toggle USDC/SOL
- [ ] Can add note (max 140 chars)
- [ ] Fee info displayed ({FEE_PERCENT}% message)
- [ ] "Generate Payment Link" creates link
- [ ] QR code displays correctly
- [ ] Link shown in card
- [ ] "Copy Link" copies to clipboard
- [ ] "Share" opens share sheet

### 4.2 Open Link
- [ ] Open generated link (spliter://pay?...)
- [ ] App opens to Pay screen
- [ ] Amount displayed correctly
- [ ] Recipient address correct
- [ ] Note displayed (if present)
- [ ] Fee breakdown shows:
  - [ ] Recipient gets: original amount
  - [ ] Service fee: {FEE_PERCENT}% of amount
  - [ ] You pay: amount + fee
- [ ] Network badge shows current network
- [ ] Balance shown correctly

### 4.3 Pay via Link
- [ ] "Continue to Pay" → Confirmation screen
- [ ] Confirmation shows all details + fee
- [ ] "Pay Now" triggers wallet approval
- [ ] Transaction includes BOTH transfers (recipient + fee wallet)
- [ ] Success screen shows correct amount sent
- [ ] Transaction verifiable on Solscan (2 transfers in 1 tx)

---

## 5. Pay Link - Invalid Params
- [ ] `spliter://pay` (no params) → "Missing recipient address"
- [ ] `spliter://pay?to=invalid` → "Invalid recipient address"
- [ ] `spliter://pay?to=<valid>&amount=-5` → "Invalid payment amount"
- [ ] `spliter://pay?to=<valid>&amount=5&currency=BTC` → "Invalid currency"
- [ ] All invalid states show friendly error + "Go Back" button
- [ ] App does NOT crash

---

## 6. Pay Link - Edge Cases
- [ ] Open link when not connected → "Wallet Not Connected" message
- [ ] Open link when fee wallet not configured → "Pay Unavailable" message
- [ ] Attempt to pay with insufficient balance → Error shown
- [ ] Attempt to pay with insufficient SOL for fees → Warning + faucet link (devnet)
- [ ] Cancel wallet approval → Returns to idle state (can retry)
- [ ] Tx timeout → Shows pending state + "Check Status" button

---

## 7. Batch Payouts

### 7.1 Navigation
- [ ] Home screen shows "Tools" section with "Batch Payout" card
- [ ] Tapping "Batch Payout" navigates to batch screen
- [ ] Header shows "Batch Payout" title

### 7.2 Mode Selection
- [ ] Can toggle between TOKEN and NFT modes
- [ ] Switching modes clears current rows
- [ ] Token mode shows asset selection (SOL/USDC/CUSTOM)
- [ ] NFT mode hides asset selection

### 7.3 Token Batch - Asset Selection
- [ ] Can toggle between SOL, USDC, CUSTOM
- [ ] Balance updates when switching assets
- [ ] Custom mint input appears for CUSTOM
- [ ] Invalid mint address shows error

### 7.4 Input Methods

#### 7.4.1 CSV Import
- [ ] "Import CSV File" button opens file picker
- [ ] Token CSV: `recipient,amount` format parsed correctly
- [ ] NFT CSV: `recipient,nft_mint` format parsed correctly
- [ ] Lines starting with # (comments) skipped
- [ ] Invalid rows show validation errors

#### 7.4.2 Paste Input
- [ ] Enter multi-line text in paste area
- [ ] "Parse & Add" button parses and adds rows
- [ ] Token format: `recipient,amount`
- [ ] NFT format: `recipient,nft_mint`
- [ ] Tab-separated also works

#### 7.4.3 Manual Add
- [ ] **Token**: Enter recipient + amount, tap + button
- [ ] **NFT**: Enter recipient + NFT mint, tap + button
- [ ] Rows appear in list below
- [ ] Can remove individual rows with ✕ button
- [ ] "Clear All" removes all rows

### 7.5 Preflight Validation
- [ ] Invalid rows highlighted with red border
- [ ] Validation errors shown per row:
  - [ ] Missing recipient
  - [ ] Invalid address
  - [ ] Invalid amount (tokens)
  - [ ] Missing/invalid NFT mint
- [ ] Summary shows totals and fees
- [ ] "Continue" button disabled if no valid rows

### 7.6 Preview/Confirmation
- [ ] Preview shows all valid rows with status "queued"
- [ ] **Token**: Shows amount + fee (2.5%) + total cost
- [ ] **NFT**: Shows count + fee ({NFT_FEE_SOL} SOL each) + total fee
- [ ] Fee wallet address shown (shortened)
- [ ] Network fee estimate shown
- [ ] Balance check displayed
- [ ] Low SOL warning if needed
- [ ] "Back" returns to input phase
- [ ] "Send All" starts execution

### 7.7 Execution
- [ ] Progress shows "X of Y"
- [ ] Stats update: Done, Queued, Failed
- [ ] "Stop" button stops after current tx
- [ ] Each row updates status: queued → sending → sent → confirmed/failed
- [ ] Wallet approval requested per row
- [ ] If cancelled, row stays queued (can retry)
- [ ] Confirmed rows show ✅
- [ ] Failed rows show ❌ with error

### 7.8 Fee Correctness

#### Token Batch
- [ ] Each transaction contains TWO instructions:
  - [ ] Transfer tokens to recipient
  - [ ] Transfer fee (2.5%) to fee wallet
- [ ] Fee paid in same asset (SOL fee in SOL, token fee in token)
- [ ] Verify on Solscan: single tx, 2 transfers

#### NFT Batch
- [ ] Each transaction contains TWO instructions:
  - [ ] Transfer NFT to recipient
  - [ ] Transfer SOL fee to fee wallet
- [ ] Fee = EXPO_PUBLIC_NFT_FEE_SOL (default 0.002 SOL)
- [ ] Verify on Solscan: NFT transfer + SOL transfer

### 7.9 Done Phase
- [ ] Stats show final counts (Confirmed/Pending/Failed)
- [ ] "Retry Failed" available if any failed
- [ ] "Check" button on pending rows to verify status
- [ ] **Export Report**: "Copy Summary" copies text report
- [ ] **Export Report**: "Share" opens share sheet
- [ ] "Done" clears draft and returns to home

### 7.10 Batch Resume/Recovery
- [ ] Start batch, stop mid-execution, close app
- [ ] Reopen app, navigate to Batch screen
- [ ] "Incomplete Batch Found" prompt appears
- [ ] "Continue" loads saved batch state
- [ ] "Start Fresh" discards saved batch
- [ ] Completed rows preserved (won't re-send)
- [ ] Only queued/failed rows can be retried
- [ ] Signatures preserved → status check only, no re-send

### 7.11 Edge Cases
- [ ] Double-send prevention: sending row can't be triggered again
- [ ] Signature exists → retry only checks status, never resends
- [ ] Stop mid-batch → remaining rows stay queued
- [ ] Empty paste → nothing added
- [ ] Duplicate recipients → allowed (user's choice)
- [ ] Draft persists across app restarts
- [ ] Different wallet → draft ignored (wallet mismatch)

## 8. Fee Enforcement
- [ ] Pay link ALWAYS includes fee in transaction
- [ ] Direct settle (group/settle) does NOT include fee (existing behavior)

> **TODO**: Audit all send paths. Direct settle may need fee in future.

---

## 8. Network Switching
- [ ] Change network in Settings (Devnet ↔ Mainnet)
- [ ] Pay link respects current network
- [ ] Explorer links use correct cluster param

---

## Sign-off

| Tester | Date | Device | Result |
|--------|------|--------|--------|
|        |      |        |        |

---

## Notes
- Pay links use `spliter://pay?to=...&amount=...&currency=...` format
- Fee wallet must be valid Solana address
- Fee is calculated as: `amount * FEE_BPS / 10000`
- All amounts in human-readable format (not lamports)
