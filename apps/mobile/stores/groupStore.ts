import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, Expense, Settlement, Balance, TxHistoryEntry, TxStatus, Member } from '../lib/types';
import { STORAGE_KEYS } from '../lib/constants';
import { v4 as uuidv4 } from 'uuid';

// Stable empty arrays (frozen, same reference always)
const EMPTY_EXPENSES: readonly Expense[] = Object.freeze([]);
const EMPTY_SETTLEMENTS: readonly Settlement[] = Object.freeze([]);
const EMPTY_BALANCES: readonly Balance[] = Object.freeze([]);

// Balance cache to avoid getSnapshot loops
type BalancesCacheEntry = {
  membersRef: Member[];
  expensesRef: readonly Expense[];
  settlementsRef: readonly Settlement[];
  value: Balance[];
};
const balancesCache = new Map<string, BalancesCacheEntry>();

interface GroupStore {
  // State
  groups: Group[];
  expenses: Record<string, Expense[]>;
  settlements: Record<string, Settlement[]>;
  txHistory: TxHistoryEntry[];
  isLoading: boolean;
  isHydrated: boolean;
  
  // Actions
  hydrate: () => Promise<void>;
  createGroup: (name: string, creatorWallet: string) => Promise<Group>;
  addMember: (groupId: string, wallet: string, nickname?: string) => Promise<void>;
  addExpense: (groupId: string, expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>;
  addSettlement: (settlement: Omit<Settlement, 'id' | 'settledAt'>) => Promise<Settlement>;
  
  // Tx History
  addTxHistory: (entry: Omit<TxHistoryEntry, 'id' | 'createdAt'>) => Promise<TxHistoryEntry>;
  updateTxStatus: (signature: string, status: TxStatus, error?: string) => Promise<void>;
  getTxBySignature: (signature: string) => TxHistoryEntry | undefined;
  
  // Selectors (stable references)
  getGroupById: (id: string) => Group | undefined;
  getExpensesByGroup: (groupId: string) => readonly Expense[];
  getSettlementsByGroup: (groupId: string) => readonly Settlement[];
  getBalances: (groupId: string) => readonly Balance[];
}

// Balance calculation (extracted for caching)
function computeBalances(group: Group, expenses: readonly Expense[], settlements: readonly Settlement[]): Balance[] {
  const balanceMap: Record<string, Record<string, number>> = {};
  
  group.members.forEach(m1 => {
    balanceMap[m1.wallet] = {};
    group.members.forEach(m2 => {
      if (m1.wallet !== m2.wallet) {
        balanceMap[m1.wallet][m2.wallet] = 0;
      }
    });
  });
  
  expenses.forEach(expense => {
    const splitCount = expense.splitBetween.length;
    if (splitCount === 0) return;
    const perPerson = expense.amount / splitCount;
    
    expense.splitBetween.forEach(wallet => {
      if (wallet !== expense.paidBy && balanceMap[wallet]?.[expense.paidBy] !== undefined) {
        balanceMap[wallet][expense.paidBy] += perPerson;
      }
    });
  });
  
  settlements.forEach(settlement => {
    if ((settlement.status === 'confirmed' || !settlement.status) && 
        balanceMap[settlement.from]?.[settlement.to] !== undefined) {
      balanceMap[settlement.from][settlement.to] -= settlement.amount;
    }
  });
  
  const balances: Balance[] = [];
  const seen = new Set<string>();
  
  Object.entries(balanceMap).forEach(([from, toMap]) => {
    Object.entries(toMap).forEach(([to, amount]) => {
      const reverseAmount = balanceMap[to]?.[from] || 0;
      const netAmount = amount - reverseAmount;
      
      if (netAmount > 0.01) {
        const key1 = `${from}-${to}`;
        const key2 = `${to}-${from}`;
        if (!seen.has(key1) && !seen.has(key2)) {
          seen.add(key1);
          balances.push({ from, to, amount: Math.round(netAmount * 100) / 100 });
        }
      }
    });
  });
  
  return balances;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  expenses: {},
  settlements: {},
  txHistory: [],
  isLoading: true,
  isHydrated: false,
  
  hydrate: async () => {
    try {
      const [groupsJson, expensesJson, settlementsJson, txHistoryJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
        AsyncStorage.getItem(STORAGE_KEYS.EXPENSES),
        AsyncStorage.getItem(STORAGE_KEYS.SETTLEMENTS),
        AsyncStorage.getItem(STORAGE_KEYS.TX_HISTORY),
      ]);
      
      set({
        groups: groupsJson ? JSON.parse(groupsJson) : [],
        expenses: expensesJson ? JSON.parse(expensesJson) : {},
        settlements: settlementsJson ? JSON.parse(settlementsJson) : {},
        txHistory: txHistoryJson ? JSON.parse(txHistoryJson) : [],
        isLoading: false,
        isHydrated: true,
      });
    } catch (error) {
      console.error('Failed to hydrate group store:', error);
      set({ isLoading: false, isHydrated: true });
    }
  },
  
  createGroup: async (name, creatorWallet) => {
    const group: Group = {
      id: uuidv4(),
      name,
      createdBy: creatorWallet,
      createdAt: Date.now(),
      members: [{ wallet: creatorWallet, addedAt: Date.now() }],
    };
    
    const groups = [...get().groups, group];
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    set({ groups });
    return group;
  },
  
  addMember: async (groupId, wallet, nickname) => {
    const groups = get().groups.map(g => {
      if (g.id === groupId) {
        if (g.members.some(m => m.wallet === wallet)) return g;
        return { ...g, members: [...g.members, { wallet, nickname, addedAt: Date.now() }] };
      }
      return g;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    set({ groups });
  },
  
  addExpense: async (groupId, expenseData) => {
    const expense: Expense = { ...expenseData, id: uuidv4(), createdAt: Date.now() };
    const currentExpenses = get().expenses[groupId] || [];
    const expenses = { ...get().expenses, [groupId]: [...currentExpenses, expense] };
    await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    set({ expenses });
    return expense;
  },
  
  addSettlement: async (settlementData) => {
    const settlement: Settlement = { ...settlementData, id: uuidv4(), settledAt: Date.now() };
    const { groupId } = settlementData;
    const currentSettlements = get().settlements[groupId] || [];
    const settlements = { ...get().settlements, [groupId]: [...currentSettlements, settlement] };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    set({ settlements });
    return settlement;
  },
  
  addTxHistory: async (entryData) => {
    const entry: TxHistoryEntry = { ...entryData, id: uuidv4(), createdAt: Date.now() };
    const txHistory = [entry, ...get().txHistory].slice(0, 100);
    await AsyncStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(txHistory));
    set({ txHistory });
    return entry;
  },
  
  updateTxStatus: async (signature, status, error) => {
    const txHistory = get().txHistory.map(tx => 
      tx.signature === signature 
        ? { ...tx, status, error, confirmedAt: status === 'confirmed' ? Date.now() : tx.confirmedAt }
        : tx
    );
    await AsyncStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(txHistory));
    set({ txHistory });
  },
  
  getTxBySignature: (signature) => get().txHistory.find(tx => tx.signature === signature),
  
  // Stable selectors
  getGroupById: (id) => {
    if (!id) return undefined;
    return get().groups.find(g => g.id === id);
  },
  
  getExpensesByGroup: (groupId) => {
    if (!groupId) return EMPTY_EXPENSES;
    return get().expenses[groupId] ?? EMPTY_EXPENSES;
  },
  
  getSettlementsByGroup: (groupId) => {
    if (!groupId) return EMPTY_SETTLEMENTS;
    return get().settlements[groupId] ?? EMPTY_SETTLEMENTS;
  },
  
  getBalances: (groupId) => {
    if (!groupId) return EMPTY_BALANCES;
    
    const group = get().groups.find(g => g.id === groupId);
    if (!group) return EMPTY_BALANCES;
    
    const expenses = get().expenses[groupId] ?? EMPTY_EXPENSES;
    const settlements = get().settlements[groupId] ?? EMPTY_SETTLEMENTS;
    
    // Check cache
    const cached = balancesCache.get(groupId);
    if (cached && 
        cached.membersRef === group.members &&
        cached.expensesRef === expenses &&
        cached.settlementsRef === settlements) {
      return cached.value;
    }
    
    // Compute and cache
    const value = computeBalances(group, expenses, settlements);
    balancesCache.set(groupId, {
      membersRef: group.members,
      expensesRef: expenses,
      settlementsRef: settlements,
      value,
    });
    
    return value;
  },
}));

// Stable selector hooks
export const useGroups = () => useGroupStore((state) => state.groups);
export const useIsGroupsHydrated = () => useGroupStore((state) => state.isHydrated);
export const useIsGroupsLoading = () => useGroupStore((state) => state.isLoading);
