# Spliter — Device Test Checklist

## Prerequisites
- Android device (Seeker preferred, or any Android with Phantom/Solflare)
- Wallet app installed with devnet SOL + devnet USDC
- USB debugging enabled or same WiFi network
- Expo Go installed OR dev client built

## Quick Start
```bash
cd /Users/maciej/clawd/spliter/apps/mobile
npm start
# Or for tunnel mode:
npm run start:tunnel
```

---

## Test Flow

### 1. Cold Start / Splash Screen ✨ NEW
- [ ] Kill app completely
- [ ] Open app → see splash screen (💸 + "Loading...")
- [ ] Splash shows until hydration complete
- [ ] No flicker to home before redirect
- [ ] If not connected → lands on Welcome screen
- [ ] If was connected → still lands on Welcome (MWA needs reconnect each session)

### 2. Route Guards ✨ NEW
- [ ] Without wallet connected:
  - [ ] Cannot manually navigate to /home
  - [ ] Cannot access /group/* routes
  - [ ] Always redirected to Welcome
- [ ] After connect → can access all routes

### 3. Wallet Connection
- [ ] App launches to Welcome screen
- [ ] Network badge visible (Devnet/Mainnet)
- [ ] "Connect Wallet" button visible
- [ ] Tap → MWA prompt appears
- [ ] Approve in wallet app
- [ ] Redirects to Home screen
- [ ] Wallet address shows correctly

**Edge cases:**
- [ ] Cancel connection → shows "Connection cancelled"
- [ ] No wallet app → shows error message
- [ ] Button disabled during connecting

### 4. Create Group
- [ ] Tap FAB (+) on home
- [ ] Enter group name "Test Trip"
- [ ] Tap Create → redirects to group detail
- [ ] You appear as first member
- [ ] Group shows on Home screen

### 5. Add Members
- [ ] Go to Members tab
- [ ] Tap "Add Member"
- [ ] Paste valid Solana address
- [ ] Add optional nickname
- [ ] Tap Add → member appears

**Edge cases:**
- [ ] Invalid address → error
- [ ] Duplicate address → error

### 6. Add Expense
- [ ] Go to Expenses tab
- [ ] Tap "Add Expense"
- [ ] Enter amount: 10.00
- [ ] Enter description: "Dinner"
- [ ] Select payer
- [ ] Verify split calculation
- [ ] Tap "Add Expense" → appears in list

### 7. Balances
- [ ] Go to Balances tab
- [ ] Verify calculation correct
- [ ] "Settle" button appears on balances

---

## Settlement Hardening ✨ NEW (Critical Tests)

### 8. Settlement - Happy Path
- [ ] Tap "Settle" on a balance
- [ ] Network badge visible on settle screen
- [ ] Recipient shown correctly
- [ ] Amount pre-filled
- [ ] Balance shown (refresh works)
- [ ] Tap "Continue" → confirmation screen
- [ ] Review: amount, recipient, network, fee
- [ ] Tap "Send Payment" → MWA prompt
- [ ] Approve → pending spinner
- [ ] Success screen shows:
  - [ ] ✅ checkmark
  - [ ] Amount and currency
  - [ ] Recipient name
  - [ ] Transaction signature (truncated)
  - [ ] "View on Solscan" button → opens correct URL with cluster param
  - [ ] "Copy Signature" button → copies full signature
  - [ ] Network badge
- [ ] Tap "Done" → back to group

### 9. Settlement - Double-Send Prevention ✨ NEW
- [ ] Start settlement flow
- [ ] On confirm screen, tap "Send Payment"
- [ ] Rapidly tap again multiple times
- [ ] Only ONE transaction should be sent
- [ ] Button should be disabled during signing

### 10. Settlement - User Rejected ✨ NEW
- [ ] Start settlement flow
- [ ] On MWA prompt, tap "Reject" / cancel
- [ ] App shows "Transaction cancelled"
- [ ] Returns to idle state (not error screen)
- [ ] Can tap "Continue" again to retry

### 11. Settlement - Timeout / Pending ✨ NEW
- [ ] Start settlement with poor network (or simulate)
- [ ] If confirmation times out:
  - [ ] Shows "Pending" screen (not error)
  - [ ] Transaction signature displayed
  - [ ] "View on Solscan" available
  - [ ] "Copy Signature" available
  - [ ] "Check Status" button (does NOT re-send tx)
  - [ ] "Close" button available
- [ ] Tap "Check Status" → re-checks confirmation only

### 12. Settlement - Network Error ✨ NEW
- [ ] Turn off network during balance load
- [ ] Shows "Failed to load balances" error
- [ ] "Refresh" button works when network restored

### 13. Settlement - Insufficient Fees ✨ NEW
- [ ] Use wallet with 0 SOL (or < 0.005 SOL)
- [ ] Warning banner shows: "Low SOL! Need ~0.005 SOL for fees"
- [ ] Faucet link shown on devnet
- [ ] "Continue" button disabled
- [ ] Cannot proceed without sufficient fees

### 14. Settlement - Insufficient Balance
- [ ] Try to send more USDC than balance
- [ ] Error: "Insufficient USDC"
- [ ] Try to send more SOL than available (minus fees)
- [ ] Error: shows max sendable

### 15. Settlement - SOL Transfer
- [ ] Switch to SOL tab
- [ ] "Use Max" button shows correct amount (balance - fees)
- [ ] Enter amount
- [ ] Complete flow same as USDC
- [ ] Verify tx on Solscan

---

## Persistence ✨ NEW

### 16. Data Persistence
- [ ] Create group, add members, add expense, settle
- [ ] Kill app completely
- [ ] Reopen app
- [ ] Groups still present
- [ ] Members still present
- [ ] Expenses still present
- [ ] Settlements still present
- [ ] (Note: wallet needs reconnect each session)

### 17. Network Persistence
- [ ] Go to Settings → Advanced → toggle network
- [ ] Switch to Mainnet (or Devnet)
- [ ] Kill app
- [ ] Reopen app
- [ ] Network setting preserved

---

## Settings

### 18. Settings Screen
- [ ] Tap ⚙️ on Home
- [ ] Wallet address shown
- [ ] Network badge in header
- [ ] SOL balance shown
- [ ] USDC balance shown
- [ ] "Refresh" updates balances
- [ ] "View on Solscan" opens correct URL
- [ ] Copy address works (shows ✓)

### 19. Network Toggle
- [ ] Settings → Advanced → expand
- [ ] Toggle "Use Devnet"
- [ ] Confirmation dialog appears
- [ ] After switch:
  - [ ] Network badge updates
  - [ ] Balances refresh
  - [ ] Faucet link appears (devnet only)

### 20. Disconnect
- [ ] Settings → Disconnect
- [ ] Confirmation dialog
- [ ] Returns to Welcome screen

---

## Console Checks

- [ ] No "getSnapshot should be cached" errors
- [ ] No infinite loop warnings
- [ ] No "Cannot update a component" warnings
- [ ] No uncaught promise rejections

---

## Bug Report Template

```markdown
### Bug: [Short title]
**Severity:** Critical / High / Medium / Low
**Screen:** [Which screen]
**Steps:**
1. ...
2. ...
**Expected:** ...
**Actual:** ...
**Console errors:** (if any)
```

---

## How to Test on Seeker

1. **Start dev server:**
   ```bash
   cd /Users/maciej/clawd/spliter/apps/mobile
   npm run start:tunnel
   ```

2. **On Seeker device:**
   - Open Expo Go app
   - Scan QR code from terminal
   - Wait for bundle to load

3. **Get devnet funds:**
   - Visit https://faucet.solana.com
   - Enter your wallet address
   - Request devnet SOL
   - For devnet USDC, use Jupiter on devnet or request from team

4. **Test MWA:**
   - Make sure Phantom/Solflare/Seeker Vault is installed
   - When app prompts, approve in wallet app
   - Check signature links open Solscan with `?cluster=devnet`

5. **Kill and restart:**
   - Swipe app away completely
   - Reopen via Expo Go
   - Verify splash → welcome flow
   - Verify data persisted
