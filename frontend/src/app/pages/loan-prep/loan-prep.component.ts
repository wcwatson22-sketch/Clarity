import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface FolderItem  { folder: string; files: string[]; }
interface ChecklistItem { text: string; detail?: string; }
interface ChecklistSection { title: string; icon: string; items: ChecklistItem[]; }
interface KeyStat { label: string; value: string; note: string; }

interface LoanGuide {
  id: string; label: string; emoji: string; tagline: string; timeframe: string;
  keyStats: KeyStat[];
  folders: FolderItem[];
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
    folders: [
      { folder: 'Financial Information', files: [
        'Tax Return_Your Name_2024',
        'Tax Return_Your Name_2023',
        'W-2_Your Name_2024  (one per employer, per year)',
        'W-2_Your Name_2023',
        'Pay Stub_Your Name_January 2025  (2 most recent)',
        'Pay Stub_Your Name_February 2025',
        'K-1_Your Name_2024  (if applicable — partnerships, S-corps, trusts)',
        'Bank Statement_Your Name_January 2025  (all pages, last 2–3 months)',
        'Bank Statement_Your Name_February 2025',
        'Bank Statement_Your Name_March 2025',
        'Investment Statement_Your Name_Q1 2025',
        'Retirement Account Statement_Your Name_Q1 2025',
        'Photo ID_Your Name',
        'Purchase Agreement_Property Address_2025',
        'Gift Letter_Your Name_2025  (if receiving gift funds for down payment)',
        'Divorce Decree_Your Name_Year  (if applicable)',
      ]},
    ],
    checklist: [
      { title: '90+ Days Before Applying', icon: '📅', items: [
        { text: 'Pull your credit report from all 3 bureaus', detail: 'Free at AnnualCreditReport.com — check Equifax, Experian, and TransUnion' },
        { text: 'Dispute any errors on your credit report', detail: 'Errors take 30–45 days to resolve — start early' },
        { text: 'Pay credit cards below 30% utilization', detail: 'Below 10% is ideal. This has the biggest short-term credit score impact' },
        { text: 'Avoid opening any new credit accounts', detail: 'Each new inquiry can drop your score 5–10 points' },
        { text: 'Calculate your DTI using the Clarity Cash Flow tab', detail: 'Monthly debt payments ÷ gross monthly income. Aim for 36% or less' },
        { text: 'Start saving for closing costs separately', detail: 'Budget 2–5% of the loan amount on top of your down payment' },
      ]},
      { title: '60 Days Before Applying', icon: '📋', items: [
        { text: 'Create your "Financial Information" folder and start filling it', detail: 'Name every document using the format shown above — it keeps things organized for the lender' },
        { text: 'Collect tax returns for the last 2 years', detail: 'Include all pages and schedules — lenders reject incomplete returns' },
        { text: 'Download 2–3 months of bank statements', detail: 'Must include ALL pages, even blank ones. Missing pages raise red flags' },
        { text: 'Gather all W-2s and recent pay stubs', detail: 'You\'ll need documentation from every employer in the last 2 years' },
        { text: 'Get a formal pre-approval letter', detail: 'Different from pre-qualification — a real pre-approval reviews your full file and is taken seriously by sellers' },
      ]},
      { title: '30 Days Before & During Application', icon: '✅', items: [
        { text: 'Lock your employment — do not change jobs', detail: 'Even a promotion to a different company can delay or kill your loan' },
        { text: 'Do not make any large or unusual deposits', detail: 'Every deposit over ~$1,000 must be sourced and explained. Cash deposits are a red flag' },
        { text: 'Respond to all lender requests within 24 hours', detail: 'Slow responses are the #1 reason closings get delayed' },
        { text: 'Make no large credit purchases', detail: 'A new car or furniture purchase before closing has derailed many loans' },
        { text: 'Confirm your rate lock expiration date', detail: 'If closing is delayed, extending the lock costs money — know your timeline' },
      ]},
    ],
    doList: [
      'Keep all existing accounts open and active',
      'Pay every bill on time for the 90 days before applying',
      'Keep 2+ years at the same employer if possible',
      'Document every source of income thoroughly',
      'Season gift funds in your account at least 60 days before applying',
      'Get quotes from multiple lenders — even 0.25% difference saves thousands over 30 years',
      'Understand FHA vs. Conventional vs. VA vs. USDA loan options',
    ],
    avoidList: [
      'Opening new credit cards or loans — even store cards at checkout',
      'Co-signing for anyone else\'s loan',
      'Making large purchases (car, furniture, appliances) before closing',
      'Depositing cash without documentation of its source',
      'Moving money between accounts excessively without explanation',
      'Quitting or changing jobs during the loan process',
      'Paying off old collections without checking with your lender first — it can backfire',
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
    folders: [
      { folder: 'Financial Information', files: [
        'Tax Return_Your Name_2024',
        'Tax Return_Your Name_2023',
        'W-2_Your Name_2024',
        'W-2_Your Name_2023',
        'Pay Stub_Your Name_January 2025  (2 most recent)',
        'Pay Stub_Your Name_February 2025',
        'Bank Statement_Your Name_January 2025  (all pages, last 2 months)',
        'Bank Statement_Your Name_February 2025',
        'Mortgage Statement_Property Address_March 2025',
        'Homeowners Insurance_Property Address_2025',
        'Property Tax Bill_Property Address_2025',
        'Photo ID_Your Name',
      ]},
    ],
    checklist: [
      { title: 'Before Applying', icon: '📅', items: [
        { text: 'Calculate your break-even point first', detail: 'Closing costs ÷ monthly savings = months to break even. Only worthwhile if you plan to stay longer than that' },
        { text: 'Check your current LTV', detail: 'You need at least 20% equity to avoid PMI on a conventional refi. Check your Dashboard net worth data' },
        { text: 'Pull your credit score', detail: 'A 20-point improvement can change your rate tier significantly' },
        { text: 'Decide on your goal', detail: 'Lower rate? Shorter term? Cash-out? Each has different requirements and trade-offs' },
        { text: 'Get a home value estimate', detail: 'Zillow or Redfin for a rough estimate — the lender will order a formal appraisal (~$400–600)' },
      ]},
      { title: 'During the Process', icon: '✅', items: [
        { text: 'Shop at least 3 lenders on the same day', detail: 'Multiple mortgage inquiries within 14–45 days count as ONE inquiry for credit score purposes' },
        { text: 'Compare Loan Estimates line by line', detail: 'Lenders must provide this within 3 business days of application — watch origination fees closely' },
        { text: 'Keep paying your current mortgage on time', detail: 'A late payment during the refi process will kill your application' },
        { text: 'Schedule the appraisal promptly', detail: 'The appraisal is often the longest lead-time item — get it ordered early' },
      ]},
    ],
    doList: [
      'Compare multiple lenders — rates vary more than most people expect',
      'Ask about no-closing-cost options (rate is higher but no upfront cost)',
      'Consider a 15-year term if you can afford the payment — saves massively on total interest',
      'Time your rate lock carefully — rates can move significantly week to week',
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
    folders: [
      { folder: 'Financial Information', files: [
        'Tax Return_Your Name_2024  (if self-employed)',
        'Tax Return_Your Name_2023  (if self-employed)',
        'W-2_Your Name_2024',
        'Pay Stub_Your Name_January 2025  (2 most recent)',
        'Pay Stub_Your Name_February 2025',
        'Bank Statement_Your Name_January 2025  (all pages, last 2 months)',
        'Bank Statement_Your Name_February 2025',
        'Mortgage Statement_Property Address_March 2025',
        'Homeowners Insurance_Property Address_2025',
        'Property Tax Bill_Property Address_2025',
        'Photo ID_Your Name',
      ]},
    ],
    checklist: [
      { title: 'Before Applying', icon: '📅', items: [
        { text: 'Estimate your available equity', detail: 'Home value × 0.85 minus your current mortgage balance = rough maximum HELOC. Cross-reference with your Dashboard' },
        { text: 'Check your credit score', detail: '700+ gets the best terms. Below 680 and some lenders won\'t approve at all' },
        { text: 'Calculate your DTI including a hypothetical HELOC payment', detail: 'Lenders qualify you at a stressed rate, not just the current draw rate' },
        { text: 'Decide between HELOC vs. home equity loan', detail: 'HELOC = flexible revolving line. HE Loan = fixed lump sum. Different tools for different needs' },
        { text: 'Understand the draw period vs. repayment period', detail: 'Draw period typically 10 years (interest-only), then 20-year repayment of principal + interest' },
      ]},
    ],
    doList: [
      'Use for investments or home improvements that add value',
      'Ask about rate caps — HELOCs are variable and can rise significantly',
      'Set up automatic minimum payments to protect your credit',
      'Keep a buffer — don\'t max out the line immediately',
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
    folders: [
      { folder: 'Financial Information', files: [
        'Pay Stub_Your Name_January 2025  (2 most recent)',
        'Pay Stub_Your Name_February 2025',
        'Tax Return_Your Name_2024  (if self-employed)',
        'Bank Statement_Your Name_January 2025',
        'Vehicle Purchase Agreement_Make Model Year_2025',
        'Vehicle History Report_VIN Number',
        'Proof of Insurance_Your Name_2025',
        'Drivers License_Your Name',
        'Proof of Residence_Your Name_March 2025  (utility bill or lease)',
      ]},
    ],
    checklist: [
      { title: 'Before Visiting the Dealership', icon: '📅', items: [
        { text: 'Get pre-approved from your bank or credit union first', detail: 'Credit unions often beat dealership financing by 1–3%. Use it as a negotiating tool at the dealer' },
        { text: 'Research the vehicle\'s fair market value', detail: 'Use KBB, Edmunds, or CarGurus. Know the target price before you walk in' },
        { text: 'Calculate total cost of ownership', detail: 'Insurance, fuel, maintenance, and registration — not just the monthly payment' },
        { text: 'Know your credit score before they run it', detail: 'So you can identify if the dealer is quoting you the wrong rate tier' },
        { text: 'Decide on your max total price and monthly payment ceiling', detail: 'Dealers negotiate on monthly payment — you need to negotiate on total price first' },
      ]},
      { title: 'At the Dealership', icon: '✅', items: [
        { text: 'Don\'t reveal your pre-approval rate immediately', detail: 'Let them try to beat it — sometimes manufacturer programs offer lower rates' },
        { text: 'Read the financing agreement line by line before signing', detail: 'Check for add-ons (GAP, extended warranty, paint protection) quietly included' },
        { text: 'Confirm the term length matches what you discussed verbally', detail: 'Dealers sometimes extend the term to lower payments without your explicit agreement' },
      ]},
    ],
    doList: [
      'Get pre-approved from your own bank before going to the dealer',
      'Put 10–20% down to stay above the car\'s depreciating value',
      'Choose the shortest loan term you can comfortably afford',
      'Consider GAP insurance if putting less than 20% down',
      'Check if manufacturer offers 0% financing — sometimes better than the rebate',
    ],
    avoidList: [
      '72 or 84 month loans — you\'ll be underwater on value almost immediately',
      'Rolling negative equity from an old car into a new loan',
      'Negotiating only on monthly payment instead of total price',
      'Letting dealers run your credit at multiple banks without explicit permission',
      'Buying add-ons you didn\'t plan for (clear coat, fabric protection, etc.)',
    ],
  },

  {
    id: 'student', label: 'Student Loan', emoji: '🎓',
    tagline: 'Federal loans first — always. Private loans fill the gap when federal limits are reached.',
    timeframe: 'File FAFSA October 1 for the following school year',
    keyStats: [
      { label: 'Federal First', value: 'FAFSA', note: 'File as early as October 1' },
      { label: 'Private Credit', value: '670+', note: 'Cosigner helps significantly' },
      { label: 'Total Borrow', value: '≤ Yr 1 Salary', note: 'Rule of thumb: don\'t exceed it' },
      { label: 'Rate Type', value: 'Fixed', note: 'Prefer fixed over variable' },
    ],
    folders: [
      { folder: 'Financial Information', files: [
        'Tax Return_Parent Name_2024  (if filing as a dependent)',
        'Tax Return_Student Name_2024  (if filed)',
        'Bank Statement_Your Name_Date  (asset balance for FAFSA filing)',
        'Enrollment Verification_Your Name_2025',
        'Cost of Attendance Letter_School Name_2025',
        'Acceptance Letter_School Name_2025',
        'Photo ID_Your Name',
        'Cosigner Tax Return_Cosigner Name_2024  (for private loans)',
        'Cosigner Pay Stub_Cosigner Name_January 2025  (for private loans)',
        'Cosigner Photo ID_Cosigner Name  (for private loans)',
      ]},
    ],
    checklist: [
      { title: 'Federal Loans — Do This First', icon: '🏛️', items: [
        { text: 'Create your FSA ID at StudentAid.gov', detail: 'Both student and parent need separate FSA IDs — do this before October 1' },
        { text: 'File FAFSA as early as possible on October 1', detail: 'Some aid is first-come-first-served. Every day earlier helps' },
        { text: 'Accept subsidized loans before unsubsidized', detail: 'Subsidized loans don\'t accrue interest while you\'re in school' },
        { text: 'Know your annual and lifetime borrowing limits', detail: 'Dependent undergrad limit: $27,000 over 4 years. Independent: $57,500' },
        { text: 'Explore grants and work-study before taking on any debt', detail: 'Grants never need to be repaid — maximize these first' },
      ]},
      { title: 'Private Loans — Only If Needed', icon: '🏦', items: [
        { text: 'Exhaust all federal, grant, and scholarship options first', detail: 'Private loans have fewer protections and often higher rates than federal loans' },
        { text: 'Compare at least 3–5 private lenders', detail: 'Check Credible, LendKey, College Ave, Sallie Mae, SoFi — rates vary widely' },
        { text: 'Apply with a creditworthy cosigner if possible', detail: 'A cosigner with good credit can cut your rate by 2–4%' },
        { text: 'Choose a fixed rate for predictability', detail: 'Variable rates can rise significantly over a 10-year repayment term' },
        { text: 'Calculate your estimated monthly payment before borrowing', detail: 'Rule of thumb: your total debt shouldn\'t exceed your expected first-year salary' },
      ]},
    ],
    doList: [
      'File FAFSA every single year — it does not auto-renew',
      'Accept grants and scholarships → federal subsidized → federal unsubsidized → private',
      'Track your total borrowed amount across all loans and all years',
      'Look into income-driven repayment plans for federal loans',
      'Consider Public Service Loan Forgiveness if entering government or nonprofit work',
    ],
    avoidList: [
      'Taking private loans before maxing out federal options',
      'Borrowing more than your expected first-year salary in total',
      'Variable rate private loans for long repayment terms',
      'Ignoring interest accrual on unsubsidized loans during school',
      'Missing the grace period end date — loans enter repayment 6 months after graduation',
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
      { label: 'No Collateral', value: 'Unsecured', note: 'Your credit is all that matters' },
    ],
    folders: [
      { folder: 'Financial Information', files: [
        'Pay Stub_Your Name_January 2025  (2 most recent)',
        'Pay Stub_Your Name_February 2025',
        'Tax Return_Your Name_2024  (if self-employed)',
        'Bank Statement_Your Name_January 2025',
        'Bank Statement_Your Name_February 2025',
        'Photo ID_Your Name',
      ]},
    ],
    checklist: [
      { title: 'Before Applying', icon: '📅', items: [
        { text: 'Check your credit score at all 3 bureaus', detail: 'Your interest rate is almost entirely driven by your credit score with unsecured loans' },
        { text: 'Calculate exactly how much you need — no more', detail: 'Don\'t borrow more than necessary. More principal means more interest paid' },
        { text: 'Get prequalification offers from multiple lenders', detail: 'Prequalification is a soft pull — check SoFi, LightStream, Marcus, Discover, and your local credit union' },
        { text: 'Calculate the total cost of the loan', detail: 'Monthly payment × number of months = total repayment. Compare this number across all lenders, not just the rate' },
        { text: 'Verify borrowing at this rate makes sense', detail: 'If APR is above 15%, a HELOC or a 0% intro credit card offer may be significantly cheaper' },
      ]},
    ],
    doList: [
      'Use for debt consolidation when rate is lower than existing balances',
      'Choose the shortest term you can afford (less total interest paid)',
      'Check for prepayment penalties before signing',
      'Set up autopay — most lenders give 0.25–0.5% rate discount',
    ],
    avoidList: [
      'Using a personal loan for business purposes (use SBA instead)',
      'Borrowing from lenders with rates above 36% — predatory territory',
      'Taking out a loan to cover recurring monthly budget shortfalls',
      'Ignoring origination fees — they add to your effective APR and reduce what you actually receive',
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
    folders: [
      { folder: 'Financial Information', files: [
        'Business Tax Return_Business Name_2024',
        'Business Tax Return_Business Name_2023',
        'Business Tax Return_Business Name_2022',
        'Personal Tax Return_Your Name_2024',
        'Personal Tax Return_Your Name_2023',
        'Personal Tax Return_Your Name_2022',
        'Business Bank Statement_Business Name_January 2025  (last 6–12 months)',
        'Business Bank Statement_Business Name_February 2025',
        'Personal Bank Statement_Your Name_January 2025  (last 2–3 months)',
        'Personal Bank Statement_Your Name_February 2025',
        'P&L Statement_Business Name_YTD 2025',
        'Balance Sheet_Business Name_March 2025',
        'Business Debt Schedule_Business Name_2025',
        'Personal Financial Statement_Your Name_2025',
        'Articles of Incorporation_Business Name',
        'Business License_Business Name_2025',
        'Photo ID_Your Name',
      ]},
    ],
    checklist: [
      { title: '90+ Days Before Applying', icon: '📅', items: [
        { text: 'Establish and check your business credit profile', detail: 'Check Dun & Bradstreet, Experian Business, and Equifax Business scores separately from personal' },
        { text: 'Ensure 2+ years of clean business bank history', detail: 'No overdrafts, consistent revenue deposits, and no unusual activity or gaps' },
        { text: 'Get your books current with a CPA or accountant', detail: 'Lenders won\'t work with disorganized financials. CPA-prepared statements carry significantly more weight' },
        { text: 'Calculate your DSCR (Debt Service Coverage Ratio)', detail: 'Net operating income ÷ annual debt payments. Lenders want to see 1.25× or higher' },
        { text: 'Pay down personal debt to improve your personal DTI', detail: 'Your personal credit is still on the hook for most business loans under $5M' },
      ]},
      { title: '30–60 Days Before', icon: '📋', items: [
        { text: 'Prepare your business plan and financial projections', detail: 'Required for expansion loans — must show how the loan generates or supports revenue' },
        { text: 'Gather 3 years of business and personal tax returns', detail: 'Must be signed and complete — all schedules, K-1s, and extensions included' },
        { text: 'Write a specific use of proceeds statement', detail: 'Exact breakdown of how every dollar will be deployed — vague answers get rejected' },
        { text: 'Identify collateral you can pledge', detail: 'Real estate, equipment, and accounts receivable can all support better terms' },
        { text: 'Have a preliminary conversation with your bank before formal application', detail: 'A pre-application meeting saves weeks of effort and helps you go to the right lender' },
      ]},
    ],
    doList: [
      'Work with a bank where you already have an established relationship',
      'Have a CPA prepare and sign your financial statements',
      'Be transparent about past challenges — lenders will find out regardless',
      'Keep personal and business bank accounts completely separate',
      'Consider SBA loan programs for better rates and terms (see SBA Loan guide)',
      'Apply before you need the money — never apply from a position of desperation',
    ],
    avoidList: [
      'Mixing personal and business bank accounts — it disqualifies many loans',
      'Applying when financial statements are not current',
      'Underestimating how much you need — undercapitalization causes more business failures than overleveraging',
      'Taking on more debt than your monthly cash flow can comfortably service',
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
    folders: [
      { folder: 'Financial Information', files: [
        'SBA Form 1919_Your Name_2025',
        'SBA Form 912_Your Name_2025',
        'SBA Form 413_Your Name_2025  (Personal Financial Statement)',
        'Business Tax Return_Business Name_2024',
        'Business Tax Return_Business Name_2023',
        'Business Tax Return_Business Name_2022',
        'Personal Tax Return_Your Name_2024',
        'Personal Tax Return_Your Name_2023',
        'Personal Tax Return_Your Name_2022',
        'Business Bank Statement_Business Name_January 2025  (last 6 months)',
        'Business Bank Statement_Business Name_February 2025',
        'Personal Bank Statement_Your Name_January 2025  (last 3 months)',
        'P&L Statement_Business Name_YTD 2025',
        'Balance Sheet_Business Name_March 2025',
        'Business Plan_Business Name_2025',
        'Use of Proceeds_Business Name_2025',
        'Business License_Business Name',
        'Articles of Incorporation_Business Name',
        'Photo ID_Your Name',
      ]},
    ],
    checklist: [
      { title: 'Understand Your SBA Loan Options First', icon: '📚', items: [
        { text: 'SBA 7(a) — Most common. Up to $5M. Working capital, equipment, real estate', detail: 'Best for most small businesses. Flexible use of funds. Rates: Prime + 2.25–4.75%' },
        { text: 'SBA 504 — Real estate and heavy equipment up to $5.5M', detail: 'Lower rates for fixed assets. Requires a Certified Development Company (CDC). 10% down typical' },
        { text: 'SBA Microloan — Up to $50K for startups and small businesses', detail: 'Easier to qualify. Provided through nonprofit intermediary lenders. Rates: 8–13%' },
        { text: 'SBA Express — Faster approval (36 hours) up to $500K', detail: 'Higher rates than 7(a) but much faster. Good for businesses that can\'t wait 60–90 days' },
      ]},
      { title: 'Preparation Steps', icon: '📋', items: [
        { text: 'Find an SBA Preferred Lender', detail: 'Preferred Lenders can approve in-house without SBA review — significantly faster. Find one at SBA.gov/tools/linc' },
        { text: 'Complete all SBA forms with extreme accuracy', detail: 'Errors on SBA forms are the #1 cause of delays. Have a professional review every page before submitting' },
        { text: 'Prepare a detailed business plan with projections', detail: 'Required for most SBA loans — must include market analysis, management team, and 3-year financial projections' },
        { text: 'Confirm you meet SBA eligibility requirements', detail: 'Must be a for-profit US business, meet SBA size standards, and demonstrate you\'ve sought other financing first' },
        { text: 'Contact your local SBDC for free guidance', detail: 'Small Business Development Centers offer free consulting and will review your application before submission' },
      ]},
    ],
    doList: [
      'Work with an SBA Preferred Lender for the fastest approval',
      'Contact your local SBDC (Small Business Development Center) for free prep help',
      'Be extremely thorough and accurate on every SBA form',
      'Have a CPA prepare and certify your financial statements',
      'Ask about the SBA guarantee fee — it can sometimes be financed into the loan',
    ],
    avoidList: [
      'Submitting an incomplete package — incomplete applications go to the bottom of the pile',
      'Working with non-preferred SBA lenders if speed is a factor',
      'Underestimating the timeline — budget 60–90 days minimum from application to funding',
      'Being dishonest on any SBA form — these are federal documents with serious consequences',
      'Omitting even one required form — a single missing document can cause weeks of delay',
    ],
  },
];

@Component({
  selector: 'app-loan-prep',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './loan-prep.component.html',
  styleUrl: './loan-prep.component.scss'
})
export class LoanPrepComponent {
  private auth = inject(AuthService);

  readonly isPremium  = computed(() => this.auth.currentUser()?.isPaid === true && this.auth.currentUser()?.tier === 'Premium');
  readonly trialActive = computed(() => {
    if (this.auth.currentUser()?.isPaid) return false;
    const t = this.auth.currentUser()?.trialEndsAt;
    if (!t) return false;
    return new Date(t) > new Date();
  });
  readonly hasAccess = computed(() => this.isPremium() || this.trialActive());

  readonly guides = LOAN_GUIDES;
  readonly selected = signal<LoanGuide | null>(null);

  select(guide: LoanGuide) {
    this.selected.set(guide);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  back() { this.selected.set(null); }
}
