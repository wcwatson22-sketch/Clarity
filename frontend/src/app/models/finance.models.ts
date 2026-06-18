export type AccountType = 'Asset' | 'Liability';
export type BudgetGroup = 'Fixed' | 'Variable' | 'Debt' | 'Savings';

export interface Account {
  id: string;
  group: string;
  category: string;
  name: string;
  value: number;
  type: AccountType;
  isAnchor?: boolean;
  updatedAt: string;
}

export interface SnapshotLineItem {
  accountId: string;
  name: string;
  category: string;
  group: string;
  type: AccountType;
  value: number;
}

export interface Snapshot {
  id: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  cashPosition: number;
  createdAt: string;
  isInitialBaseline?: boolean;
  lineItems?: SnapshotLineItem[];
}

export interface BudgetItem {
  id: string;
  group: BudgetGroup;
  name: string;
  amount: number;
  /** Per-item monthly budget (Variable expenses only). null/undefined = no budget set. */
  budget?: number | null;
  category?: string | null;
}

export interface VariableMonth {
  month: string;
  amount: number;
}

export interface IncomeData {
  type: 'stable' | 'variable';
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  variableMonths: VariableMonth[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: number;
  content: string;
  example: string;
}

export interface EducationProgress {
  articleId: string;
  completed: boolean;
  bookmarked: boolean;
  helpful?: boolean | null;
}

export interface SurveyResponse {
  topics: string[];
  freeText: string;
}
