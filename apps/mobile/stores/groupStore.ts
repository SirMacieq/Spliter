import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, Expense, Settlement, Member, Balance } from '../lib/types';
import { STORAGE_KEYS } from '../lib/constants';
import { v4 as uuidv4 } from 'uuid';

interface GroupStore {
  // State
  groups: Group[];
  expenses: Record<string, Expense[]>; // groupId -> expenses
  settlements: Record<string, Settlement[]>; // groupId -> settlements
  isLoading: boolean;
  
  // Actions
  loadData: () => Promise<void>;
  createGroup: (name: string, creatorWallet: string) => Promise<Group>;
  addMember: (groupId: string, wallet: string, nickname?: string) => Promise<void>;
  addExpense: (groupId: string, expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>;
  addSettlement: (settlement: Omit<Settlement, 'id' | 'settledAt'>) => Promise<Settlement>;
  getGroupById: (id: string) => Group | undefined;
  getExpensesByGroup: (groupId: string) => Expense[];
  getBalances: (groupId: string) => Balance[];
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  expenses: {},
  settlements: {},
  isLoading: true,
  
  loadData: async () => {
    try {
      const [groupsJson, expensesJson, settlementsJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
        AsyncStorage.getItem(STORAGE_KEYS.EXPENSES),
        AsyncStorage.getItem(STORAGE_KEYS.SETTLEMENTS),
      ]);
      
      set({
        groups: groupsJson ? JSON.parse(groupsJson) : [],
        expenses: expensesJson ? JSON.parse(expensesJson) : {},
        settlements: settlementsJson ? JSON.parse(settlementsJson) : {},
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      set({ isLoading: false });
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
        // Check if already a member
        if (g.members.some(m => m.wallet === wallet)) {
          return g;
        }
        return {
          ...g,
          members: [...g.members, { wallet, nickname, addedAt: Date.now() }],
        };
      }
      return g;
    });
    
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    set({ groups });
  },
  
  addExpense: async (groupId, expenseData) => {
    const expense: Expense = {
      ...expenseData,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    
    const expenses = {
      ...get().expenses,
      [groupId]: [...(get().expenses[groupId] || []), expense],
    };
    
    await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    set({ expenses });
    
    return expense;
  },
  
  addSettlement: async (settlementData) => {
    const settlement: Settlement = {
      ...settlementData,
      id: uuidv4(),
      settledAt: Date.now(),
    };
    
    const { groupId } = settlementData;
    const settlements = {
      ...get().settlements,
      [groupId]: [...(get().settlements[groupId] || []), settlement],
    };
    
    await AsyncStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));
    set({ settlements });
    
    return settlement;
  },
  
  getGroupById: (id) => get().groups.find(g => g.id === id),
  
  getExpensesByGroup: (groupId) => get().expenses[groupId] || [],
  
  getBalances: (groupId) => {
    const group = get().getGroupById(groupId);
    if (!group) return [];
    
    const expenses = get().getExpensesByGroup(groupId);
    const settlements = get().settlements[groupId] || [];
    
    // Calculate net balances
    const balanceMap: Record<string, Record<string, number>> = {};
    
    // Initialize balance map
    group.members.forEach(m1 => {
      balanceMap[m1.wallet] = {};
      group.members.forEach(m2 => {
        if (m1.wallet !== m2.wallet) {
          balanceMap[m1.wallet][m2.wallet] = 0;
        }
      });
    });
    
    // Process expenses
    expenses.forEach(expense => {
      const splitCount = expense.splitBetween.length;
      const perPerson = expense.amount / splitCount;
      
      expense.splitBetween.forEach(wallet => {
        if (wallet !== expense.paidBy) {
          // wallet owes paidBy
          balanceMap[wallet][expense.paidBy] = 
            (balanceMap[wallet][expense.paidBy] || 0) + perPerson;
        }
      });
    });
    
    // Process settlements (reduce debt)
    settlements.forEach(settlement => {
      if (settlement.currency === 'USDC') {
        balanceMap[settlement.from][settlement.to] = 
          (balanceMap[settlement.from][settlement.to] || 0) - settlement.amount;
      }
    });
    
    // Convert to Balance array (only positive amounts)
    const balances: Balance[] = [];
    Object.entries(balanceMap).forEach(([from, toMap]) => {
      Object.entries(toMap).forEach(([to, amount]) => {
        // Net out mutual debts
        const reverseAmount = balanceMap[to]?.[from] || 0;
        const netAmount = amount - reverseAmount;
        
        if (netAmount > 0.01) { // Ignore tiny amounts
          balances.push({ from, to, amount: Math.round(netAmount * 100) / 100 });
        }
      });
    });
    
    // Remove duplicates (A->B and B->A)
    const seen = new Set<string>();
    return balances.filter(b => {
      const key1 = `${b.from}-${b.to}`;
      const key2 = `${b.to}-${b.from}`;
      if (seen.has(key1) || seen.has(key2)) return false;
      seen.add(key1);
      return true;
    });
  },
}));
