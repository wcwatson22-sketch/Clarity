/**
 * Public Learn content — the single authoritative source for the marketing
 * website's Learn hub (/learn) and individual article pages (/learn/:slug).
 *
 * All content here is authored by Clarity and is safe to render as HTML
 * (no user input). Each article is plain data so it can also be reused by the
 * native app Learn experience in the future if the backend lesson system is
 * consolidated onto this source.
 *
 * IMPORTANT: when adding/removing a published article, also update the sitemap
 * (src/sitemap.xml) — see scripts/gen-sitemap note in the deliverable.
 */

export type DisclaimerType = 'none' | 'standard' | 'realestate';

export interface LearnCategory {
  id: string;
  name: string;
  blurb: string;
}

export interface FeatureLink {
  label: string;       // e.g. "Open Cash Flow"
  route: string;       // app route, e.g. "/cash-flow"
  premium?: boolean;   // true if the linked tool is Premium-only
  note?: string;       // short explanatory line
}

export interface LearnArticle {
  id: string;
  slug: string;
  title: string;            // visible H1
  seoTitle: string;         // <title> + og:title
  summary: string;          // meta description + hub card text
  category: string;         // LearnCategory.id
  /** Authored HTML body (h2/h3/p/ul/.example). Crawlable, no user input. */
  bodyHtml: string;
  featuredImage: string;    // absolute or root-relative OG image
  publishedAt: string;      // ISO date
  updatedAt: string;        // ISO date
  isPublished: boolean;
  isFeatured: boolean;
  relatedArticleIds: string[];
  disclaimerType: DisclaimerType;
  feature?: FeatureLink;
  readMinutes: number;
}

export const LEARN_DISCLAIMERS: Record<Exclude<DisclaimerType, 'none'>, string> = {
  standard:
    'Clarity provides educational information and estimates only. It does not provide financial advice, loan approval, prequalification, preapproval, or a lending commitment. Requirements and calculations vary by lender and loan program.',
  realestate:
    'Examples are for educational purposes only and do not represent guaranteed investment results.',
};

export const LEARN_CATEGORIES: LearnCategory[] = [
  { id: 'basics',      name: 'Personal Finance Basics', blurb: 'Net worth, cash flow, income, and the building blocks of your financial picture.' },
  { id: 'dti',         name: 'Debt & DTI',              blurb: 'How debt-to-income ratio works and how new loans change it.' },
  { id: 'loan-prep',   name: 'Loan Preparation',        blurb: 'What lenders look for and how to get your finances ready before you apply.' },
  { id: 'retirement',  name: 'Saving & Retirement',     blurb: 'Employer matches, account types, and budgeting guidelines that build long-term wealth.' },
  { id: 'real-estate', name: 'Real Estate',             blurb: 'Rental cash flow, operating costs, and the numbers behind investment property.' },
];

const OG = '/images/clarity-social-card.png';

/** Small reusable example callout markup. */
const ex = (html: string) => `<div class="example"><span class="example-label">Example</span>${html}</div>`;

export const LEARN_ARTICLES: LearnArticle[] = [
  // ─────────────────────────── Personal Finance Basics ───────────────────────
  {
    id: 'assets-vs-liabilities',
    slug: 'assets-vs-liabilities',
    category: 'basics',
    title: 'Understanding Assets and Liabilities',
    seoTitle: 'Assets vs. Liabilities: What They Are and Why They Matter | Clarity',
    summary: 'Assets are what you own, liabilities are what you owe, and the gap between them is your net worth. Here is how to tell them apart.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['how-to-calculate-net-worth', 'understanding-monthly-cash-flow'],
    disclaimerType: 'none',
    feature: { label: 'Track it on your Dashboard', route: '/dashboard', note: 'Clarity totals your assets and liabilities for you and tracks the change over time with snapshots.' },
    readMinutes: 4,
    bodyHtml: `
      <p>Almost every personal-finance number you will ever calculate starts with two simple ideas: <strong>assets</strong> and <strong>liabilities</strong>. Get these straight and net worth, debt ratios, and loan readiness all become easier to understand.</p>
      <h2>What is an asset?</h2>
      <p>An asset is anything you own that has value — money or something that could be converted to money. Common examples include:</p>
      <ul>
        <li>Cash in checking and savings accounts</li>
        <li>Retirement and investment accounts (401(k), IRA, brokerage)</li>
        <li>The market value of your home or other real estate</li>
        <li>Vehicles, and occasionally other high-value property</li>
      </ul>
      <h2>What is a liability?</h2>
      <p>A liability is anything you owe — a debt or obligation that you will have to pay back. Common examples include:</p>
      <ul>
        <li>Mortgage balance</li>
        <li>Auto loans</li>
        <li>Student loans</li>
        <li>Credit-card balances and personal loans</li>
      </ul>
      <h2>Why the difference matters</h2>
      <p>Your <strong>net worth</strong> is simply total assets minus total liabilities. Two people can earn the same salary but have very different financial pictures depending on what they own versus what they owe.</p>
      ${ex('<p>Maria owns a home worth $300,000 and has $40,000 in retirement savings (assets = $340,000). She owes $220,000 on her mortgage and $15,000 on a car loan (liabilities = $235,000). Her net worth is <strong>$105,000</strong>.</p>')}
      <h2>A quick caution</h2>
      <p>Not everything that feels like an asset behaves like one. A financed car loses value over time while the loan balance stays high, so early on it can contribute more to liabilities than to net worth. Focusing on the <em>gap</em> between assets and liabilities — rather than either number alone — keeps you honest.</p>
    `,
  },
  {
    id: 'how-to-calculate-net-worth',
    slug: 'how-to-calculate-net-worth',
    category: 'basics',
    title: 'How to Calculate Your Net Worth',
    seoTitle: 'How to Calculate Net Worth (With a Simple Example) | Clarity',
    summary: 'Net worth is total assets minus total liabilities. Learn how to calculate it, what counts, and how to track it over time.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['assets-vs-liabilities', 'understanding-monthly-cash-flow'],
    disclaimerType: 'none',
    feature: { label: 'See your net worth on the Dashboard', route: '/dashboard', note: 'Clarity calculates net worth automatically and saves snapshots so you can watch it grow.' },
    readMinutes: 4,
    bodyHtml: `
      <p>Net worth is the single best snapshot of your overall financial health. It answers one question: if you sold everything you own and paid off everything you owe, what would be left?</p>
      <h2>The formula</h2>
      <p><strong>Net worth = total assets − total liabilities.</strong></p>
      <h2>Step 1 — Add up your assets</h2>
      <p>List the current value of everything you own: cash, savings, retirement and investment accounts, your home's market value, and vehicles. Use realistic current values, not what you paid.</p>
      <h2>Step 2 — Add up your liabilities</h2>
      <p>List the current balance of everything you owe: mortgage, auto loans, student loans, credit cards, and any other debts.</p>
      <h2>Step 3 — Subtract</h2>
      ${ex('<p>Assets: $12,000 cash + $55,000 retirement + $310,000 home = <strong>$377,000</strong>.<br/>Liabilities: $240,000 mortgage + $9,000 car + $4,000 credit cards = <strong>$253,000</strong>.<br/>Net worth = $377,000 − $253,000 = <strong>$124,000</strong>.</p>')}
      <h2>A negative number is normal early on</h2>
      <p>Recent graduates or new homeowners often have negative net worth because of student loans or a fresh mortgage. What matters is the <strong>trend</strong>. Recalculating every month or quarter shows whether you are moving in the right direction.</p>
      <h2>Track it, don't just calculate it once</h2>
      <p>A single net-worth figure is a data point; a series of them is a story. Saving regular snapshots turns net worth into a motivating progress chart instead of a one-time chore.</p>
    `,
  },
  {
    id: 'gross-vs-take-home-pay',
    slug: 'gross-vs-take-home-pay',
    category: 'basics',
    title: 'Gross Income vs. Take-Home Pay',
    seoTitle: 'Gross Income vs. Take-Home Pay: What\'s the Difference? | Clarity',
    summary: 'Gross income is what you earn before deductions; take-home pay is what actually lands in your account. Here is why both matter.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: false,
    relatedArticleIds: ['understanding-monthly-cash-flow', 'what-is-dti'],
    disclaimerType: 'none',
    feature: { label: 'Enter both in Cash Flow', route: '/cash-flow', note: 'Clarity uses gross income for ratios like DTI and take-home pay for budgeting your real spending.' },
    readMinutes: 3,
    bodyHtml: `
      <p>Your paycheck has two important numbers, and confusing them is one of the most common budgeting mistakes.</p>
      <h2>Gross income</h2>
      <p><strong>Gross income</strong> is your total pay before anything is taken out — your salary or hourly earnings as stated in your offer letter.</p>
      <h2>Take-home (net) pay</h2>
      <p><strong>Take-home pay</strong> is what actually reaches your bank account after deductions such as:</p>
      <ul>
        <li>Federal, state, and local income taxes</li>
        <li>Social Security and Medicare (FICA)</li>
        <li>Health insurance premiums</li>
        <li>Retirement contributions like a 401(k)</li>
      </ul>
      ${ex('<p>A $72,000 salary is $6,000 gross per month. After taxes, insurance, and a 401(k) contribution, take-home pay might be about $4,500 per month. Budgeting against $6,000 would overstate what you can actually spend by $1,500.</p>')}
      <h2>When to use which</h2>
      <p>Lenders calculate ratios like debt-to-income against your <strong>gross</strong> income. But for day-to-day budgeting, plan against your <strong>take-home</strong> pay — that is the money you can really spend or save. Tracking both keeps your plan realistic and your loan math accurate.</p>
    `,
  },
  {
    id: 'understanding-monthly-cash-flow',
    slug: 'understanding-monthly-cash-flow',
    category: 'basics',
    title: 'How to Understand Your Monthly Cash Flow',
    seoTitle: 'Monthly Cash Flow Explained: Money In vs. Money Out | Clarity',
    summary: 'Cash flow is the difference between money coming in and money going out each month. Learn to read it and put it to work.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['fixed-vs-variable-expenses', 'fifty-thirty-twenty-rule'],
    disclaimerType: 'none',
    feature: { label: 'Map it in Cash Flow', route: '/cash-flow', note: 'Clarity adds up your income and expenses and shows your free cash flow each month.' },
    readMinutes: 4,
    bodyHtml: `
      <p>Cash flow is the heartbeat of a personal budget. It is simply the money coming in versus the money going out over a period — usually a month.</p>
      <h2>The basic equation</h2>
      <p><strong>Free cash flow = income − total expenses.</strong> A positive number means you have money left to save or invest; a negative number means you are dipping into savings or debt.</p>
      <h2>What counts as "money in"</h2>
      <p>Your take-home pay, plus any side income, rental income, or other regular deposits.</p>
      <h2>What counts as "money out"</h2>
      <p>Everything you spend: housing, utilities, food, transportation, debt payments, subscriptions, and savings contributions.</p>
      ${ex('<p>Take-home pay of $4,500, minus $3,900 in total monthly expenses, leaves <strong>$600</strong> of free cash flow — money you can direct toward savings, investing, or paying down debt faster.</p>')}
      <h2>Why it beats just watching your balance</h2>
      <p>A bank balance tells you what happened; cash flow tells you what is <em>going</em> to happen. When you can see your monthly surplus or shortfall in advance, you can make deliberate choices instead of reacting at the end of the month.</p>
      <h2>Turn surplus into progress</h2>
      <p>Even a small consistent surplus compounds. Directing it automatically toward savings or debt is the most reliable way to improve your net worth month after month.</p>
    `,
  },
  {
    id: 'fixed-vs-variable-expenses',
    slug: 'fixed-vs-variable-expenses',
    category: 'basics',
    title: 'Fixed vs. Variable Expenses',
    seoTitle: 'Fixed vs. Variable Expenses: How to Tell Them Apart | Clarity',
    summary: 'Fixed expenses stay the same each month; variable expenses change. Sorting them is the first step to a budget you can control.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: false,
    relatedArticleIds: ['understanding-monthly-cash-flow', 'fifty-thirty-twenty-rule'],
    disclaimerType: 'none',
    feature: { label: 'Sort them in Cash Flow', route: '/cash-flow', note: 'Clarity groups your spending into fixed, variable, debt, and savings so you can see where money goes.' },
    readMinutes: 3,
    bodyHtml: `
      <p>To control spending, it helps to know which costs you can change quickly and which you cannot. That is the difference between fixed and variable expenses.</p>
      <h2>Fixed expenses</h2>
      <p><strong>Fixed expenses</strong> are roughly the same amount every month and are hard to change in the short term:</p>
      <ul>
        <li>Rent or mortgage payment</li>
        <li>Car payment and insurance</li>
        <li>Loan payments</li>
        <li>Most subscriptions</li>
      </ul>
      <h2>Variable expenses</h2>
      <p><strong>Variable expenses</strong> change month to month based on your choices and circumstances:</p>
      <ul>
        <li>Groceries and dining out</li>
        <li>Fuel and transportation</li>
        <li>Entertainment and shopping</li>
        <li>Utilities that shift with the seasons</li>
      </ul>
      ${ex('<p>If money is tight, you usually cannot lower your $1,400 rent this month — but you can trim a $600 dining-and-shopping budget. Variable expenses are where short-term adjustments actually happen.</p>')}
      <h2>Why the split matters</h2>
      <p>Fixed expenses define the floor of your budget; variable expenses are the lever you can pull. Knowing the difference tells you where cuts are realistic — and where you may need bigger decisions (like refinancing or moving) to change the number.</p>
    `,
  },

  // ─────────────────────────────── Debt & DTI ────────────────────────────────
  {
    id: 'what-is-dti',
    slug: 'what-is-dti',
    category: 'dti',
    title: 'What Is Debt-to-Income Ratio (DTI)?',
    seoTitle: 'What Is Debt-to-Income Ratio (DTI) and How Is It Calculated? | Clarity',
    summary: 'DTI compares your monthly debt payments to your gross monthly income. Learn what it is, how to calculate it, and what lenders look for.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['how-a-new-loan-affects-dti', 'gross-vs-take-home-pay'],
    disclaimerType: 'standard',
    feature: { label: 'Calculate your DTI in Cash Flow', route: '/cash-flow', note: 'Clarity computes your DTI from the income and debts you enter — no spreadsheet required.' },
    readMinutes: 5,
    bodyHtml: `
      <p>Debt-to-income ratio, or <strong>DTI</strong>, is one of the most important numbers lenders use to decide whether to approve a loan — and it is easy to calculate yourself.</p>
      <h2>The definition</h2>
      <p>DTI is the percentage of your <strong>gross monthly income</strong> that goes toward <strong>monthly debt payments</strong>.</p>
      <p><strong>DTI = total monthly debt payments ÷ gross monthly income.</strong></p>
      <h2>What counts as debt</h2>
      <p>Typically your mortgage or rent, auto loans, student loans, minimum credit-card payments, and other loan obligations. Everyday bills like groceries and utilities are usually not included.</p>
      ${ex('<p>You earn $6,000 gross per month. Your debts are a $1,500 mortgage, $400 car payment, and $200 in card minimums = $2,100. DTI = $2,100 ÷ $6,000 = <strong>35%</strong>.</p>')}
      <h2>What lenders generally look for</h2>
      <p>Guidelines vary by lender and loan program, but many mortgage lenders prefer a DTI at or below roughly <strong>36%–43%</strong>. A lower DTI generally signals more room in your budget to take on a new payment.</p>
      <h2>Front-end vs. back-end DTI</h2>
      <p>Lenders sometimes look at two versions: <strong>front-end DTI</strong> (just housing costs ÷ income) and <strong>back-end DTI</strong> (all debts ÷ income). The back-end ratio is the one most people mean when they say "DTI."</p>
      <h2>Why it matters before you apply</h2>
      <p>Knowing your DTI ahead of time tells you whether a new loan is realistic and how much a payment would move the needle — so there are no surprises at the application stage.</p>
    `,
  },
  {
    id: 'how-a-new-loan-affects-dti',
    slug: 'how-a-new-loan-affects-dti',
    category: 'dti',
    title: 'How a New Loan Affects Your DTI',
    seoTitle: 'How a New Loan Changes Your Debt-to-Income Ratio | Clarity',
    summary: 'Adding a loan raises your monthly debt payments and your DTI. See how to estimate the impact before you apply.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['what-is-dti', 'what-lenders-review'],
    disclaimerType: 'standard',
    feature: { label: 'Try the Loan Impact Calculator', route: '/loan-impact', note: 'See how a new loan payment would change your DTI before you ever apply.' },
    readMinutes: 4,
    bodyHtml: `
      <p>Every new loan adds a monthly payment, and every monthly payment changes your debt-to-income ratio. Estimating that change in advance helps you avoid applying for something that pushes your DTI too high.</p>
      <h2>The mechanics</h2>
      <p>A new loan increases the <strong>numerator</strong> of the DTI formula (your total monthly debt payments) while your income usually stays the same. So your DTI goes up by the new payment divided by your gross monthly income.</p>
      ${ex('<p>Your current DTI is 30% on $6,000 gross income ($1,800 in payments). You are considering a car loan with a $450 monthly payment. New payments = $2,250, so your new DTI = $2,250 ÷ $6,000 = <strong>37.5%</strong>.</p>')}
      <h2>It is the payment, not the loan size</h2>
      <p>DTI cares about the <strong>monthly payment</strong>, not the total amount borrowed. A longer term lowers the monthly payment (and the DTI impact) but usually costs more in total interest — a trade-off worth weighing.</p>
      <h2>Check it before you apply</h2>
      <p>Running the numbers first tells you whether a loan keeps you in a comfortable range or tips you over a lender's threshold. It also shows whether paying off a smaller debt first would make room for the new one.</p>
    `,
  },

  // ───────────────────────────── Loan Preparation ────────────────────────────
  {
    id: 'personal-financial-statement',
    slug: 'personal-financial-statement',
    category: 'loan-prep',
    title: 'What Is a Personal Financial Statement?',
    seoTitle: 'What Is a Personal Financial Statement (PFS)? | Clarity',
    summary: 'A personal financial statement summarizes your assets, liabilities, and net worth — often required when you apply for a loan.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: false,
    relatedArticleIds: ['what-lenders-review', 'how-to-calculate-net-worth'],
    disclaimerType: 'standard',
    feature: { label: 'Build one with Loan Prep', route: '/loan-prep', premium: true, note: 'Premium includes tools to organize a personal financial statement for lender conversations.' },
    readMinutes: 4,
    bodyHtml: `
      <p>A <strong>personal financial statement</strong> (PFS) is a one-page summary of your financial position at a moment in time. Lenders, especially for business or larger loans, often ask for one.</p>
      <h2>What it contains</h2>
      <p>A PFS pulls together the same building blocks you use for net worth:</p>
      <ul>
        <li><strong>Assets</strong> — cash, investments, retirement accounts, real estate, and other property</li>
        <li><strong>Liabilities</strong> — mortgages, loans, and other debts</li>
        <li><strong>Net worth</strong> — assets minus liabilities</li>
        <li>Sometimes a summary of income and recurring expenses</li>
      </ul>
      ${ex('<p>When applying for a small-business loan, Devon submits a PFS showing $420,000 in assets, $260,000 in liabilities, and $160,000 in net worth — giving the lender a clear, organized picture in one document.</p>')}
      <h2>Why lenders want it</h2>
      <p>A PFS lets a lender quickly assess your overall financial strength and how much cushion you have. A clean, accurate statement signals that you are organized and serious.</p>
      <h2>How to prepare one</h2>
      <p>Gather current account balances and debt statements, value your property realistically, and keep the numbers consistent with documents you can back up. Updating it regularly means it is ready whenever an opportunity — or a lender — asks.</p>
    `,
  },
  {
    id: 'what-lenders-review',
    slug: 'what-lenders-review',
    category: 'loan-prep',
    title: 'What Lenders Review Before Approving a Loan',
    seoTitle: 'What Lenders Look At Before Approving a Loan | Clarity',
    summary: 'Credit, income, debt-to-income, assets, and documentation. Here is what lenders typically evaluate and how to prepare.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: false,
    relatedArticleIds: ['what-is-dti', 'personal-financial-statement'],
    disclaimerType: 'standard',
    feature: { label: 'Get organized with Loan Prep', route: '/loan-prep', premium: true, note: 'Premium helps you assemble the income, debt, and asset picture lenders ask for.' },
    readMinutes: 5,
    bodyHtml: `
      <p>Lending decisions can feel like a black box, but most lenders evaluate a similar short list. Knowing it lets you prepare instead of guess.</p>
      <h2>1. Credit history and score</h2>
      <p>Your track record of repaying debt. A higher score generally means more options and better rates.</p>
      <h2>2. Income and employment</h2>
      <p>Lenders want to see stable, verifiable income — usually through pay stubs, W-2s, or tax returns.</p>
      <h2>3. Debt-to-income ratio</h2>
      <p>As covered in <a href="/learn/what-is-dti">our DTI guide</a>, lenders compare your monthly debt payments to your gross income to gauge how much room you have for a new payment.</p>
      <h2>4. Assets and reserves</h2>
      <p>Savings and other assets show you can cover a down payment and weather a rough patch. Some loans require a few months of reserves.</p>
      <h2>5. Documentation</h2>
      <p>Be ready to provide identification, proof of income, bank statements, and details on existing debts.</p>
      ${ex('<p>Before applying for a mortgage, Priya checks her credit, confirms her DTI is around 32%, and gathers two months of pay stubs, two years of W-2s, and recent bank statements — so underwriting moves quickly.</p>')}
      <h2>Prepare before you apply</h2>
      <p>Lenders move faster, and you negotiate from a stronger position, when these pieces are organized in advance. The goal is no surprises — for you or the underwriter.</p>
    `,
  },

  // ──────────────────────────── Saving & Retirement ──────────────────────────
  {
    id: 'employer-401k-match',
    slug: 'employer-401k-match',
    category: 'retirement',
    title: 'How Employer 401(k) Match Works',
    seoTitle: 'How Employer 401(k) Match Works (And Why to Take It) | Clarity',
    summary: 'An employer match is free money toward retirement. Learn how matching formulas work and why you should capture the full match.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['fifty-thirty-twenty-rule', 'understanding-monthly-cash-flow'],
    disclaimerType: 'none',
    feature: { label: 'Add contributions in Cash Flow', route: '/cash-flow', note: 'Clarity lets you record your contributions and employer match so you can see the full picture.' },
    readMinutes: 4,
    bodyHtml: `
      <p>An employer 401(k) match is one of the rare guaranteed returns in personal finance: money your employer adds to your retirement account based on what you contribute.</p>
      <h2>How matching works</h2>
      <p>A match is usually expressed as a percentage of your contributions up to a limit. A common formula is <em>"100% of the first 3%, then 50% of the next 2%."</em></p>
      ${ex('<p>You earn $60,000 and your employer matches 100% of the first 3% and 50% of the next 2%. If you contribute 5% ($3,000), your employer adds $1,800 + $600 = <strong>$2,400</strong> — on top of your own contribution.</p>')}
      <h2>Why you should capture the full match</h2>
      <p>Not contributing enough to get the full match means leaving guaranteed money on the table. A 100% match is an instant 100% return — something no ordinary investment offers.</p>
      <h2>Watch the vesting schedule</h2>
      <p>Some employers require you to stay a certain number of years before the matched funds are fully <strong>vested</strong> (yours to keep if you leave). Your own contributions are always yours; the match may take time.</p>
      <h2>Fit it into your budget</h2>
      <p>Because contributions come out of your paycheck before you see them, they lower your take-home pay. Planning around that helps you capture the full match without straining your monthly cash flow.</p>
    `,
  },
  {
    id: 'fifty-thirty-twenty-rule',
    slug: 'fifty-thirty-twenty-rule',
    category: 'retirement',
    title: 'Understanding the 50/30/20 Guideline',
    seoTitle: 'The 50/30/20 Budget Rule Explained | Clarity',
    summary: 'A simple budgeting framework: 50% needs, 30% wants, 20% savings and debt payoff. Here is how to apply it to your take-home pay.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: false,
    relatedArticleIds: ['understanding-monthly-cash-flow', 'fixed-vs-variable-expenses'],
    disclaimerType: 'none',
    feature: { label: 'Apply it in Cash Flow', route: '/cash-flow', note: 'Clarity shows your spending by category so you can compare it against a 50/30/20 target.' },
    readMinutes: 3,
    bodyHtml: `
      <p>The 50/30/20 guideline is a popular starting framework for a budget because it is simple enough to remember and flexible enough to adapt.</p>
      <h2>The three buckets</h2>
      <ul>
        <li><strong>50% needs</strong> — housing, utilities, groceries, transportation, insurance, minimum debt payments</li>
        <li><strong>30% wants</strong> — dining out, entertainment, travel, shopping</li>
        <li><strong>20% savings &amp; debt payoff</strong> — emergency fund, retirement, and extra payments toward debt</li>
      </ul>
      <p>The percentages are based on your <strong>take-home pay</strong>, not gross income.</p>
      ${ex('<p>With $4,500 take-home pay: $2,250 for needs, $1,350 for wants, and $900 toward savings and debt. If your needs exceed 50%, the framework is a signal to look at bigger fixed costs.</p>')}
      <h2>Treat it as a starting point</h2>
      <p>High housing costs or aggressive savings goals may shift the ratios. The value of 50/30/20 is not the exact numbers — it is the habit of giving every dollar a job and protecting a meaningful share for your future.</p>
    `,
  },

  // ─────────────────────────────── Real Estate ───────────────────────────────
  {
    id: 'rental-property-cash-flow',
    slug: 'rental-property-cash-flow',
    category: 'real-estate',
    title: 'Rental Property Cash Flow Basics',
    seoTitle: 'Rental Property Cash Flow Basics for Beginners | Clarity',
    summary: 'Cash flow is rental income minus all expenses, including the mortgage. Learn the core numbers behind an investment property.',
    featuredImage: OG,
    publishedAt: '2026-06-20', updatedAt: '2026-06-20',
    isPublished: true, isFeatured: true,
    relatedArticleIds: ['understanding-monthly-cash-flow', 'how-a-new-loan-affects-dti'],
    disclaimerType: 'realestate',
    feature: { label: 'Analyze a property in Real Estate', route: '/real-estate', premium: true, note: 'Premium unlocks deeper rental analysis — cash flow, operating costs, and loan impact.' },
    readMinutes: 5,
    bodyHtml: `
      <p>For an investment property, "does it cash flow?" is the first question. Cash flow is what is left from the rent after every expense — including the mortgage — is paid.</p>
      <h2>The core formula</h2>
      <p><strong>Monthly cash flow = rental income − operating expenses − mortgage payment.</strong></p>
      <h2>Operating expenses to include</h2>
      <ul>
        <li>Property taxes and insurance</li>
        <li>Repairs and maintenance</li>
        <li>Property management (if used)</li>
        <li>A vacancy allowance — set aside for months with no tenant</li>
        <li>HOA fees, utilities you cover, and capital-expense reserves</li>
      </ul>
      ${ex('<p>Rent is $2,000/month. Operating expenses (taxes, insurance, maintenance, vacancy, management) total $650, and the mortgage is $1,150. Monthly cash flow = $2,000 − $650 − $1,150 = <strong>$200</strong>.</p>')}
      <h2>Don't forget vacancy and reserves</h2>
      <p>New investors often overstate cash flow by ignoring vacancy and surprise repairs. Budgeting for them upfront keeps a "great deal" from turning into a monthly drain.</p>
      <h2>How the loan changes the math</h2>
      <p>The mortgage payment is usually the largest single expense, so loan terms drive returns. A higher rate or shorter term raises the payment and can erase thin cash flow — which is why running the numbers before you buy matters so much.</p>
    `,
  },
];

// ────────────────────────────── Helper functions ─────────────────────────────

export function publishedArticles(): LearnArticle[] {
  return LEARN_ARTICLES.filter(a => a.isPublished);
}

export function getArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find(a => a.slug === slug && a.isPublished);
}

export function articlesByCategory(categoryId: string): LearnArticle[] {
  return publishedArticles().filter(a => a.category === categoryId);
}

export function featuredArticles(): LearnArticle[] {
  return publishedArticles().filter(a => a.isFeatured);
}

export function relatedArticles(article: LearnArticle): LearnArticle[] {
  return article.relatedArticleIds
    .map(id => LEARN_ARTICLES.find(a => a.id === id && a.isPublished))
    .filter((a): a is LearnArticle => !!a);
}

export function categoryName(categoryId: string): string {
  return LEARN_CATEGORIES.find(c => c.id === categoryId)?.name ?? '';
}
