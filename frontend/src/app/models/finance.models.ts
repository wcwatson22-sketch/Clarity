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

export type ContributionMode = 'pct' | 'amount';
export interface ContributionInput {
  mode: ContributionMode;   // 'pct' = % of gross income, 'amount' = $/month
  value: number;
}
export interface RetirementContributions {
  trad401k: ContributionInput;
  roth401k: ContributionInput;
  tradIra: ContributionInput;
  rothIra: ContributionInput;
  employerMatchMonthly: number;   // $/month; counts toward savings, not take-home
}

export interface IncomeData {
  type: 'stable' | 'variable';
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  variableMonths: VariableMonth[];

  // Secondary / spousal income (server-persisted source of truth)
  secondaryEnabled: boolean;
  secondaryGrossMonthly: number;
  secondaryNetMonthly: number;

  // Retirement contributions (server-persisted)
  retirement: RetirementContributions;
}

/** A fresh, fully-populated IncomeData (avoids undefined fields when no record exists yet). */
export function emptyIncome(): IncomeData {
  const c = (): ContributionInput => ({ mode: 'amount', value: 0 });
  return {
    type: 'stable', grossMonthlyIncome: 0, netMonthlyIncome: 0, variableMonths: [],
    secondaryEnabled: false, secondaryGrossMonthly: 0, secondaryNetMonthly: 0,
    retirement: { trad401k: c(), roth401k: c(), tradIra: c(), rothIra: c(), employerMatchMonthly: 0 },
  };
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
