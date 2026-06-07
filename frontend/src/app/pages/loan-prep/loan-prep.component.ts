import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanAccessService } from '../../services/plan-access.service';
import { AuthService } from '../../services/auth.service';
import { TabTutorialComponent, TutorialStep, shouldShowTutorial, tutorialKey } from '../../components/tab-tutorial/tab-tutorial.component';

interface DocItem { text: string; sub?: string[]; }
interface ChecklistItem { text: string; detail?: string; }
interface ChecklistSection { title: string; icon: string; items: ChecklistItem[]; }
interface KeyStat { label: string; value: string; note: string; }

interface LoanGuide {
  id: string; label: string; emoji: string; tagline: string; timeframe: string;
  keyStats: KeyStat[];
  docs: DocItem[];
  checklist: ChecklistSection[];
  doList: string[];
  avoidList: string[];
}

export const LOAN_GUIDES: LoanGuide[] = [
  {
    id: 'mortgage', label: 'Mortgage', emoji: '🏠',
    tagline: 'Buying a home is the largest financial transaction most people make. Preparation pays off.',
    timeframe: 'Start preparing 60–90 days before applying',
    keyStats: [
      { label: 'Min. Credit Score', value: '620+', note: '740+ for best rates' },
      { label: 'Max DTI', value: '43%', note: '36% or lower preferred' },
      { label: 'Down Payment', value: '3.5–20%', note: '20% avoids PMI' },
      { label: 'Cash Reserves', value: '2–6 mo', note: 'Months of PITI payment' },
    ],
    docs: [
      { text: '2 years of federal tax returns (all pages and schedules)', sub: ['All associated K-1s (if applicable)', 'Tax extension if filed'] },
      { text: '2 years of W-2s (all employers)' },
      { text: '2 most recent pay stubs' },
      { text: '3 months of bank statements — all accounts, all pages', sub: ['Investment and brokerage account statements', 'Retirement account statements (401k, IRA)'] },
      { text: 'Photo ID' },
      { text: 'Signed purchase agreement' },
      { text: 'Gift letter (if receiving gift funds for down payment)' },
      { text: 'Divorce decree or separation agreement (if applicable)' },
    ],
    checklist: [
      { title: '90+ Days Before Applying', icon: '📅', items: [
        { text: 'Pull your credit report from all 3 bureaus', detail: 'Free at AnnualCreditReport.com — check Equifax, Experian, and TransUnion' },
        { text: 'Dispute any errors on your credit report', detail: 'Errors take 30–45 days to resolve — start early' },
        { text: 'Pay credit cards below 30% utilization', detail: 'Below 10% is ideal — biggest short-term credit score impact' },
        { text: 'Avoid opening any new credit accounts', detail: 'Each new inquiry can drop your score 5–10 points' },
        { text: 'Calculate your DTI using the Clarity Cash Flow tab', detail: 'Monthly debt payments ÷ gross monthly income. Aim for 36% or less' },
        { text: 'Start saving for closing costs separately', detail: 'Budget 2–5% of the loan amount on top of your down payment' },
      ]},
      { title: '60 Days Before Applying', icon: '📋', items: [
        { text: 'Create your "Financial Information" folder and start filling it', detail: 'Organized documentation helps lenders move faster — they will notice' },
        { text: 'Collect tax returns for the last 2 years', detail: 'Include all pages and schedules — lenders reject incomplete returns' },
        { text: 'Download 2–3 months of bank statements', detail: 'Must include ALL pages, even blank ones. Missing pages raise red flags' },
        { text: 'Gather all W-2s and recent pay stubs', detail: 'You\'ll need documentation from every employer in the last 2 years' },
        { text: 'Get a formal pre-approval letter', detail: 'A real pre-approval reviews your full file and is taken seriously by sellers' },
      ]},
      { title: '30 Days Before & During Application', icon: '✅', items: [
        { text: 'Keep your employment stable — avoid changing jobs', detail: 'Even a promotion to a different company can delay or complicate your file' },
        { text: 'Avoid large or unusual deposits', detail: 'Every deposit over ~$1,000 may need to be sourced and explained' },
        { text: 'Respond to lender requests within 24 hours', detail: 'Slow responses are the #1 reason closings get delayed' },
        { text: 'Hold off on large credit purchases', detail: 'A new car or furniture purchase before closing has derailed many loans' },
        { text: 'Confirm your rate lock expiration date', detail: 'If closing is delayed, extending the lock costs money — know your timeline' },
      ]},
    ],
    doList: [
      'Keep all existing accounts open and active',
      'Pay every bill on time for the 90 days before applying',
      'Document every source of income thoroughly',
      'Season gift funds in your account at least 60 days before applying',
      'Get quotes from multiple lenders — even 0.25% difference saves thousands over 30 years',
    ],
    avoidList: [
      'Opening new credit cards or loans — even store cards at checkout',
      'Co-signing for anyone else\'s loan',
      'Making large purchases (car, furniture, appliances) before closing',
      'Depositing cash without documentation of its source',
      'Quitting or changing jobs during the loan process',
      'Paying off old collections without checking with your lender first',
    ],
  },

  {
    id: 'refinance', label: 'Refinance', emoji: '🔄',
    tagline: 'Refinancing can lower your rate, shorten your term, or tap equity. Prep is nearly identical to a purchase.',
    timeframe: 'Start preparing 30–60 days before applying',
    keyStats: [
      { label: 'Min. Credit Score', value: '620+', note: '740+ for best rates' },
      { label: 'Max LTV', value: '80%', note: 'Need 20%+ equity for best terms' },
      { label: 'Break-Even', value: '< 3 yrs', note: 'Closing cost ÷ monthly savings' },
      { label: 'Max DTI', value: '43%', note: '36% preferred' },
    ],
    docs: [
      { text: '2 years of federal tax returns (all pages)', sub: ['All associated K-1s (if applicable)', 'Tax extension if filed'] },
      { text: '2 years of W-2s' },
      { text: '2 most recent pay stubs' },
      { text: '2 months of bank statements — all accounts, all pages' },
      { text: 'Most recent mortgage statement' },
      { text: 'Homeowners insurance declarations page' },
      { text: 'Most recent property tax bill' },
      { text: 'Photo ID' },
    ],
    checklist: [
      { title: 'Before Applying', icon: '📅', items: [
        { text: 'Calculate your break-even point first', detail: 'Closing costs ÷ monthly savings = months to break even. Only worthwhile if you plan to stay longer' },
        { text: 'Check your current LTV', detail: 'You typically need at least 20% equity to avoid PMI. Check your Dashboard net worth data' },
        { text: 'Pull your credit score', detail: 'A 20-point improvement can change your rate tier significantly' },
        { text: 'Decide on your goal', detail: 'Lower rate? Shorter term? Cash-out? Each has different requirements and trade-offs' },
        { text: 'Get a home value estimate', detail: 'Zillow or Redfin for a rough estimate — the lender will order a formal appraisal (~$400–600)' },
      ]},
      { title: 'During the Process', icon: '✅', items: [
        { text: 'Shop at least 3 lenders on the same day', detail: 'Multiple mortgage inquiries within 14–45 days typically count as ONE inquiry for credit score purposes' },
        { text: 'Compare Loan Estimates line by line', detail: 'Lenders must provide this within 3 business days — watch origination fees closely' },
        { text: 'Keep paying your current mortgage on time', detail: 'A late payment during the refi process will complicate your application significantly' },
        { text: 'Schedule the appraisal promptly', detail: 'The appraisal is often the longest lead-time item — get it ordered early' },
      ]},
    ],
    doList: [
      'Compare multiple lenders — rates vary more than most people expect',
      'Ask about no-closing-cost options (rate is higher but no upfront cost)',
      'Consider a 15-year term if you can afford the payment — saves significantly on total interest',
      'Time your rate lock carefully — rates can move week to week',
    ],
    avoidList: [
      'Opening new credit during the process',
      'Making large unusual deposits without documentation',
      'Changing jobs during the refinance process',
      'Missing payments on your existing mortgage',
    ],
  },

  {
    id: 'heloc', label: 'HELOC', emoji: '🏦',
    tagline: 'A home equity line of credit lets you borrow against your equity on a revolving basis — flexible but variable rate.',
    timeframe: 'Start preparing 30–45 days before applying',
    keyStats: [
      { label: 'Min. Credit Score', value: '620+', note: '700+ for best terms' },
      { label: 'Max Combined LTV', value: '85–89%', note: 'First mortgage + HELOC combined' },
      { label: 'Min. Equity', value: '15–20%', note: 'Must have this in your home' },
      { label: 'Max DTI', value: '43%', note: 'Including new HELOC payment' },
    ],
    docs: [
      { text: '2 years of tax returns (if self-employed)', sub: ['All associated K-1s (if applicable)'] },
      { text: '2 years of W-2s' },
      { text: '2 most recent pay stubs' },
      { text: '2 months of bank statements — all pages' },
      { text: 'Most recent mortgage statement' },
      { text: 'Homeowners insurance declarations page' },
      { text: 'Most recent property tax bill' },
      { text: 'Photo ID' },
    ],
    checklist: [
      { title: 'Before Applying', icon: '📅', items: [
        { text: 'Estimate your available equity', detail: 'Home value × 0.85 minus your current mortgage balance = rough maximum HELOC' },
        { text: 'Check your credit score', detail: 'Lenders often require 700+ for their best HELOC terms' },
        { text: 'Calculate your DTI including a hypothetical HELOC payment', detail: 'Lenders qualify you at a stressed rate, not just the current draw rate' },
        { text: 'Decide between HELOC vs. home equity loan', detail: 'HELOC = flexible revolving line. HE Loan = fixed lump sum. Different tools for different needs' },
        { text: 'Understand the draw period vs. repayment period', detail: 'Draw period typically 10 years (interest-only), then 20-year repayment of principal + interest' },
      ]},
    ],
    doList: [
      'Use for investments or home improvements that add value',
      'Ask about rate caps — HELOCs are variable and can rise significantly',
      'Set up automatic minimum payments to protect your credit',
      'Keep a buffer — don\'t draw the full line immediately',
    ],
    avoidList: [
      'Using HELOC funds for vacations, cars, or depreciating assets',
      'Forgetting that your home is collateral — missed payments risk foreclosure',
      'Opening a HELOC if you might sell the home within 1–2 years',
      'Treating it as a long-term fixed-rate loan — the rate will move',
    ],
  },

  {
    id: 'auto', label: 'Auto Loan', emoji: '🚗',
    tagline: 'Cars depreciate fast. The right rate and term protect you from being upside-down on value.',
    timeframe: 'Start preparing 2–4 weeks before purchasing',
    keyStats: [
      { label: 'Min. Credit Score', value: '600+', note: '700+ for best rates' },
      { label: 'Recommended Term', value: '36–60 mo', note: 'Avoid 72–84 month loans' },
      { label: 'Down Payment', value: '10–20%', note: 'Keeps you above car\'s value' },
      { label: 'Max DTI', value: '50%', note: 'Including new car payment' },
    ],
    docs: [
      { text: '2 most recent pay stubs' },
      { text: 'Most recent tax return (if self-employed)' },
      { text: '1–2 months of bank statements' },
      { text: 'Vehicle purchase agreement' },
      { text: 'Vehicle history report (Carfax or equivalent) — for used vehicles' },
      { text: 'Driver\'s license' },
      { text: 'Proof of insurance' },
      { text: 'Proof of residence (utility bill or lease)' },
    ],
    checklist: [
      { title: 'Before Visiting the Dealership', icon: '📅', items: [
        { text: 'Get pre-approved from your bank or credit union first', detail: 'Credit unions often beat dealership financing by 1–3%. Use it as a negotiating tool' },
        { text: 'Research the vehicle\'s fair market value', detail: 'Use KBB, Edmunds, or CarGurus. Know the target price before you walk in' },
        { text: 'Calculate total cost of ownership', detail: 'Insurance, fuel, maintenance, and registration — not just the monthly payment' },
        { text: 'Know your credit score before they run it', detail: 'So you can recognize if the dealer is quoting you the wrong rate tier' },
      ]},
      { title: 'At the Dealership', icon: '✅', items: [
        { text: 'Don\'t reveal your pre-approval rate immediately', detail: 'Let them try to beat it — sometimes manufacturer programs offer lower rates' },
        { text: 'Read the financing agreement line by line before signing', detail: 'Check for add-ons (GAP, extended warranty, paint protection) that may have been included' },
        { text: 'Confirm the term length matches what you discussed verbally', detail: 'Sometimes terms get extended to lower the monthly payment without explicit agreement' },
      ]},
    ],
    doList: [
      'Get pre-approved from your own bank before going to the dealer',
      'Put 10–20% down to stay above the car\'s depreciating value',
      'Choose the shortest loan term you can comfortably afford',
      'Consider GAP insurance if putting less than 20% down',
    ],
    avoidList: [
      '72 or 84 month loans — depreciation will outpace your paydown quickly',
      'Rolling negative equity from an old car into a new loan',
      'Negotiating only on monthly payment instead of total price',
      'Letting dealers run your credit at multiple banks without explicit permission',
    ],
  },

  {
    id: 'student', label: 'Student Loan', emoji: '🎓',
    tagline: 'Federal loans first — always. Private loans fill the gap when federal limits are reached.',
    timeframe: 'File FAFSA October 1 for the following school year',
    keyStats: [
      { label: 'Federal First', value: 'FAFSA', note: 'File as early as October 1' },
      { label: 'Private Credit', value: '670+', note: 'Cosigner helps significantly' },
      { label: 'Total Borrow', value: '≤ Yr 1 Salary', note: 'Common rule of thumb' },
      { label: 'Rate Type', value: 'Fixed', note: 'Prefer fixed over variable' },
    ],
    docs: [
      { text: 'Prior year tax return — parent (if filing as a dependent)', sub: ['All associated K-1s (if applicable)'] },
      { text: 'Prior year tax return — student (if filed)' },
      { text: 'Bank account balance statement (for FAFSA asset reporting)' },
      { text: 'School acceptance letter' },
      { text: 'Cost of Attendance letter from the financial aid office' },
      { text: 'Proof of enrollment' },
      { text: 'Photo ID' },
      { text: 'Cosigner documents (private loans only)', sub: ['Cosigner tax returns', 'Cosigner pay stubs', 'Cosigner photo ID'] },
    ],
    checklist: [
      { title: 'Federal Loans — Do This First', icon: '🏛️', items: [
        { text: 'Create your FSA ID at StudentAid.gov', detail: 'Both student and parent need separate FSA IDs — do this before October 1' },
        { text: 'File FAFSA as early as possible on October 1', detail: 'Some aid is first-come-first-served. Filing early works in your favor' },
        { text: 'Accept subsidized loans before unsubsidized', detail: 'Subsidized loans don\'t accrue interest while you\'re in school' },
        { text: 'Explore grants and work-study before taking on any debt', detail: 'Grants never need to be repaid — maximize these first' },
      ]},
      { title: 'Private Loans — Only If Needed', icon: '🏦', items: [
        { text: 'Exhaust all federal, grant, and scholarship options first', detail: 'Private loans typically have fewer protections than federal loans' },
        { text: 'Compare at least 3–5 private lenders', detail: 'Check Credible, LendKey, College Ave, Sallie Mae, SoFi — rates vary widely' },
        { text: 'Apply with a creditworthy cosigner if possible', detail: 'A cosigner with strong credit can significantly reduce your rate' },
        { text: 'Choose a fixed rate for predictability', detail: 'Variable rates can rise significantly over a 10-year repayment term' },
      ]},
    ],
    doList: [
      'File FAFSA every single year — it does not auto-renew',
      'Accept grants and scholarships → federal subsidized → federal unsubsidized → private',
      'Track your total borrowed amount across all loans and all years',
      'Look into income-driven repayment plans for federal loans',
    ],
    avoidList: [
      'Taking private loans before maxing out federal options',
      'Borrowing more than your expected first-year salary in total',
      'Variable rate private loans for long repayment terms',
      'Ignoring interest accrual on unsubsidized loans during school',
    ],
  },

  {
    id: 'personal', label: 'Personal Loan', emoji: '💼',
    tagline: 'Unsecured and fast. Best for debt consolidation or a one-time purchase when you\'re paying off quickly.',
    timeframe: 'Can often fund within 1–5 business days',
    keyStats: [
      { label: 'Min. Credit Score', value: '670+', note: '720+ for best rates' },
      { label: 'Typical APR', value: '7–36%', note: 'Wide range based on credit' },
      { label: 'Loan Amounts', value: '$1K–$100K', note: 'Varies by lender' },
      { label: 'No Collateral', value: 'Unsecured', note: 'Credit is all that matters' },
    ],
    docs: [
      { text: '2 most recent pay stubs' },
      { text: 'Most recent tax return (if self-employed)' },
      { text: '1–2 months of bank statements' },
      { text: 'Photo ID' },
    ],
    checklist: [
      { title: 'Before Applying', icon: '📅', items: [
        { text: 'Check your credit score at all 3 bureaus', detail: 'Your interest rate is almost entirely driven by your credit score with unsecured loans' },
        { text: 'Calculate exactly how much you need — no more', detail: 'More principal means more interest paid — borrow only what\'s necessary' },
        { text: 'Get prequalification offers from multiple lenders', detail: 'Prequalification is a soft pull — check SoFi, LightStream, Marcus, Discover, and your local credit union' },
        { text: 'Calculate the total cost of the loan', detail: 'Monthly payment × number of months = total repayment. Compare this across lenders, not just the rate' },
        { text: 'Verify this is the most cost-effective option', detail: 'If APR is above 15%, a HELOC or 0% intro credit card offer may be significantly cheaper' },
      ]},
    ],
    doList: [
      'Use for debt consolidation when rate is lower than existing balances',
      'Choose the shortest term you can afford (less total interest paid)',
      'Check for prepayment penalties before signing',
      'Set up autopay — most lenders give 0.25–0.5% rate discount',
    ],
    avoidList: [
      'Using a personal loan for business purposes (consider SBA instead)',
      'Borrowing from lenders with rates above 36% — predatory territory',
      'Taking out a loan to cover recurring monthly budget shortfalls',
      'Ignoring origination fees — they add to your effective APR',
    ],
  },

  {
    id: 'commercial', label: 'Business Loan', emoji: '🏢',
    tagline: 'Lenders evaluate your business AND you personally. Both need to be in strong shape.',
    timeframe: 'Start preparing 3–6 months before applying',
    keyStats: [
      { label: 'Min. Credit Score', value: '650+', note: 'Personal and business both reviewed' },
      { label: 'Time in Business', value: '2+ years', note: 'Startups need different programs' },
      { label: 'DSCR', value: '1.25×+', note: 'Revenue must cover debt payments' },
      { label: 'Down Payment', value: '10–30%', note: 'Varies by loan type' },
    ],
    docs: [
      { text: '3 years of business tax returns (all pages)', sub: ['All associated K-1s', 'Tax extensions if filed'] },
      { text: '3 years of personal tax returns — all 20%+ owners', sub: ['All associated K-1s'] },
      { text: '6–12 months of business bank statements — all pages' },
      { text: '2–3 months of personal bank statements' },
      { text: 'Year-to-date Profit & Loss statement' },
      { text: 'Current balance sheet' },
      { text: 'Business debt schedule' },
      { text: 'Personal financial statement (assets and liabilities)' },
      { text: 'Articles of incorporation or operating agreement' },
      { text: 'Business licenses and permits' },
      { text: 'Photo ID — all 20%+ owners' },
    ],
    checklist: [
      { title: '90+ Days Before Applying', icon: '📅', items: [
        { text: 'Check your business credit profile', detail: 'Review Dun & Bradstreet, Experian Business, and Equifax Business scores separately from personal' },
        { text: 'Ensure 2+ years of clean business bank history', detail: 'No overdrafts, consistent revenue deposits, and no unusual activity or gaps' },
        { text: 'Get your books current with a CPA or accountant', detail: 'CPA-prepared statements carry significantly more weight with lenders' },
        { text: 'Calculate your DSCR (Debt Service Coverage Ratio)', detail: 'Net operating income ÷ annual debt payments. Lenders typically want to see 1.25× or higher' },
      ]},
      { title: '30–60 Days Before', icon: '📋', items: [
        { text: 'Prepare business plan and financial projections if needed', detail: 'Required for expansion loans — shows how the loan generates or supports revenue' },
        { text: 'Write a specific use of proceeds statement', detail: 'Exact breakdown of how every dollar will be deployed — vague answers can slow approval' },
        { text: 'Identify collateral you can pledge', detail: 'Real estate, equipment, and accounts receivable can support better terms' },
        { text: 'Have a preliminary conversation with your bank before formal application', detail: 'A pre-application meeting saves weeks of effort and helps ensure you\'re going to the right lender' },
      ]},
    ],
    doList: [
      'Work with a bank where you already have an established relationship',
      'Have a CPA prepare and sign your financial statements',
      'Keep personal and business bank accounts completely separate',
      'Apply before you need the money — never apply from a position of desperation',
    ],
    avoidList: [
      'Mixing personal and business bank accounts — it complicates many applications',
      'Applying when financial statements are not current',
      'Underestimating how much you need — undercapitalization causes problems',
      'Waiting until you\'re in financial trouble to apply',
    ],
  },

  {
    id: 'sba', label: 'SBA Loan', emoji: '🏛️',
    tagline: 'Government-backed with the best rates and terms for small businesses — and the most paperwork.',
    timeframe: 'Start preparing 3–6 months out; approval takes 30–90 days',
    keyStats: [
      { label: 'Min. Credit Score', value: '680+', note: '700+ preferred by most lenders' },
      { label: 'Down Payment', value: '10%', note: 'Typical for SBA 7(a) and 504' },
      { label: 'Time in Business', value: '2+ years', note: 'Startup programs also exist' },
      { label: 'DSCR', value: '1.25×+', note: 'Business income must cover payments' },
    ],
    docs: [
      { text: 'SBA Form 1919 — Borrower Information (all 20%+ owners)' },
      { text: 'SBA Form 912 — Statement of Personal History' },
      { text: 'SBA Form 413 — Personal Financial Statement' },
      { text: '3 years of business tax returns (all pages)', sub: ['All associated K-1s', 'Tax extensions if filed'] },
      { text: '3 years of personal tax returns — all 20%+ owners', sub: ['All associated K-1s'] },
      { text: '6 months of business bank statements — all pages' },
      { text: '3 months of personal bank statements' },
      { text: 'Year-to-date Profit & Loss statement' },
      { text: 'Current balance sheet' },
      { text: 'Business plan with 3–5 year financial projections' },
      { text: 'Detailed use of proceeds statement' },
      { text: 'Business licenses and registration' },
      { text: 'Articles of incorporation or operating agreement' },
      { text: 'Photo ID — all 20%+ owners' },
    ],
    checklist: [
      { title: 'Understand Your SBA Loan Options First', icon: '📚', items: [
        { text: 'SBA 7(a) — Most common. Up to $5M. Working capital, equipment, real estate', detail: 'Most flexible use of funds. Rates: Prime + 2.25–4.75%' },
        { text: 'SBA 504 — Real estate and heavy equipment up to $5.5M', detail: 'Lower rates for fixed assets. Requires a Certified Development Company (CDC)' },
        { text: 'SBA Microloan — Up to $50K for startups and small businesses', detail: 'Easier to qualify. Provided through nonprofit intermediary lenders' },
        { text: 'SBA Express — Faster approval (36 hours) up to $500K', detail: 'Higher rates than 7(a) but much faster process' },
      ]},
      { title: 'Preparation Steps', icon: '📋', items: [
        { text: 'Find an SBA Preferred Lender', detail: 'Preferred Lenders can approve in-house without SBA review — significantly faster. Find one at SBA.gov/tools/linc' },
        { text: 'Complete all SBA forms with extreme accuracy', detail: 'Errors on SBA forms are a common cause of delays. Have a professional review every page' },
        { text: 'Prepare a detailed business plan with projections', detail: 'Required for most SBA loans — must include market analysis, management team, and financial projections' },
        { text: 'Contact your local SBDC for free guidance', detail: 'Small Business Development Centers offer free consulting and will review your application before submission' },
      ]},
    ],
    doList: [
      'Work with an SBA Preferred Lender for the fastest approval',
      'Contact your local SBDC (Small Business Development Center) for free prep help',
      'Have a CPA prepare and certify your financial statements',
      'Ask about the SBA guarantee fee — it can sometimes be financed into the loan',
    ],
    avoidList: [
      'Submitting an incomplete package — incomplete applications are deprioritized',
      'Underestimating the timeline — budget 60–90 days minimum from application to funding',
      'Being inaccurate on any SBA form — these are federal documents',
      'Omitting even one required form — a single missing document can cause significant delay',
    ],
  },
];

@Component({
  selector: 'app-loan-prep',
  standalone: true,
  imports: [RouterLink, TabTutorialComponent],
  templateUrl: './loan-prep.component.html',
  styleUrl: './loan-prep.component.scss'
})
export class LoanPrepComponent {
  private plans = inject(PlanAccessService);
  private auth  = inject(AuthService);

  // ── Tab tutorial ─────────────────────────────────────────────────────────
  readonly TUTORIAL_KEY = 'clarity_tutorial_loanprep';
  readonly scopedTutorialKey = tutorialKey(this.TUTORIAL_KEY, this.auth.currentUser()?.id);
  showTutorial = signal(shouldShowTutorial(this.TUTORIAL_KEY, this.auth.currentUser()?.id));
  readonly tutorialSteps: TutorialStep[] = [
    { icon: '🏦', title: 'Loan Preparation Guide', body: 'Select a loan type to see a complete checklist of documents to gather, what lenders look for, and do\'s & don\'ts.' },
    { icon: '📋', title: 'Check Off Documents', body: 'Use the interactive checklist to track which documents you\'ve gathered. Your progress is saved automatically.' },
    { icon: '🔓', title: 'Premium Content', body: 'The full guides — including key stats, checklists, and do\'s & don\'ts — are available with Premium ($4.99/mo). The overview is free for everyone.' },
  ];

  // Loan Prep detail requires the Premium plan ($4.99/mo). Trial and Base plan users
  // can see the loan type grid but cannot open individual guides.
  readonly hasAccess = this.plans.canLoanPrep;

  readonly guides = LOAN_GUIDES;
  readonly selected = signal<LoanGuide | null>(null);

  // Checked state: Set of item IDs, persisted per loan type
  private _checkedKey = () => `clarity-loan-checks-${this.selected()?.id ?? ''}`;
  readonly checked = signal<Set<string>>(new Set());

  select(guide: LoanGuide) {
    this.selected.set(guide);
    const saved = localStorage.getItem(`clarity-loan-checks-${guide.id}`);
    this.checked.set(saved ? new Set(JSON.parse(saved)) : new Set());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back() { this.selected.set(null); }

  toggleCheck(id: string) {
    const s = new Set(this.checked());
    s.has(id) ? s.delete(id) : s.add(id);
    this.checked.set(s);
    localStorage.setItem(this._checkedKey(), JSON.stringify([...s]));
  }

  isChecked(id: string) { return this.checked().has(id); }

  // Count checked doc items only
  docItemIds(guide: LoanGuide): string[] {
    const ids: string[] = [];
    guide.docs.forEach((doc, i) => {
      ids.push(`doc-${i}`);
      doc.sub?.forEach((_, j) => ids.push(`doc-${i}-${j}`));
    });
    return ids;
  }
  docCheckedCount() {
    return this.docItemIds(this.selected()!).filter(id => this.isChecked(id)).length;
  }
  docTotalCount() { return this.docItemIds(this.selected()!).length; }

  clearChecks() {
    this.checked.set(new Set());
    localStorage.removeItem(this._checkedKey());
  }

  printChecklist() { window.print(); }
}
