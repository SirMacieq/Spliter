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

## 7. Fee Enforcement
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
