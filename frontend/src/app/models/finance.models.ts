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
  /** Optional annual rate (%) for liabilities. Unknown = null/undefined — never treated as 0%. */
  interestRate?: number | null;
  /** Present when this record is synced from a Real Estate property. The property
   *  is the source of truth for Value; edit it from the Real Estate tab instead. */
  linkedPropertyId?: string | null;
  linkedPropertyRole?: 'asset' | 'liability' | null;
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
export type RetirementType = 'trad401k' | 'roth401k' | 'tradIra' | 'rothIra';
export type IncomeSource = 'primary' | 'secondary';

/** One retirement contribution the user has chosen to track, tied to a
 *  specific income source (so a spouse's rate/amount is independent). */
export interface RetirementItem {
  id: string;
  incomeSource: IncomeSource;
  type: RetirementType;
  mode: ContributionMode;   // 'pct' = % of that income source's gross, 'amount' = $/month
  value: number;
}

/** One tier of an employer match formula: matches `matchPercent` of the
 *  employee's own contribution, for the slice of contribution rate up to
 *  `contributionPercent`. Tiers stack in order — "100% of first 3%, 50% of
 *  next 2%" is two tiers: {100, 3} then {50, 2}. */
export interface MatchTier {
  matchPercent: number;
  contributionPercent: number;
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

  // Retirement contributions — per income source, user-managed list (server-persisted)
  retirementItems: RetirementItem[];
  employerMatchTiersPrimary: MatchTier[];
  employerMatchTiersSecondary: MatchTier[];
}

/** A fresh, fully-populated IncomeData (avoids undefined fields when no record exists yet). */
export function emptyIncome(): IncomeData {
  return {
    type: 'stable', grossMonthlyIncome: 0, netMonthlyIncome: 0, variableMonths: [],
    secondaryEnabled: false, secondaryGrossMonthly: 0, secondaryNetMonthly: 0,
    retirementItems: [], employerMatchTiersPrimary: [], employerMatchTiersSecondary: [],
  };
}

export const RETIREMENT_TYPE_LABELS: Record<RetirementType, string> = {
  trad401k: 'Traditional 401(k)',
  roth401k: 'Roth 401(k)',
  tradIra:  'Traditional IRA',
  rothIra:  'Roth IRA',
};

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
