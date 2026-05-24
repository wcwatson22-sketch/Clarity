using Clarity.Api.Models;

namespace Clarity.Api.Services;

public static class LessonStore
{
    public static readonly List<Lesson> All =
    [
        new() {
            Id = "net-worth", Title = "What is Net Worth?", Category = "Financial Basics", ReadTime = 3,
            Description = "Understand your complete financial picture in one number.",
            Content = "Net worth is the value of everything you own minus everything you owe. It's one of the most complete snapshots of financial health available. Assets typically include cash, investments, property, and retirement accounts. Liabilities include mortgages, loans, and credit card balances. A positive net worth means assets exceed debts — and it tends to grow over time as debts are paid down and savings accumulate.",
            Example = "Assets — checking $5,000 + brokerage $30,000 + home $350,000 = $385,000. Liabilities — mortgage $220,000 + car loan $12,000 = $232,000. Net worth = $385,000 − $232,000 = $153,000."
        },
        new() {
            Id = "cash-flow", Title = "What is Cash Flow?", Category = "Budgeting", ReadTime = 3,
            Description = "Learn how money moves in and out of your life each month.",
            Content = "Cash flow is the difference between income and expenses in a given period. Positive cash flow means more is coming in than going out. Negative cash flow means expenses are outpacing income. Understanding cash flow is valuable because it shows where money actually goes — not just where it's intended to go. Many people find that simply tracking this number changes how they make spending decisions.",
            Example = "Take-home pay $5,200/mo. Fixed expenses $1,800 + variable $900 + debt payments $600 + savings $500 = $3,800 total outflow. Monthly cash flow = $5,200 − $3,800 = $1,400 remaining."
        },
        new() {
            Id = "dti", Title = "What is Debt-to-Income Ratio?", Category = "Debt & Loans", ReadTime = 4,
            Description = "A key metric lenders use — and one worth understanding.",
            Content = "DTI is total monthly debt payments divided by gross monthly income. Lenders use it to gauge how much additional debt a borrower may be able to handle. A DTI under 36% is generally considered healthy by most lenders, and above 43% can make qualifying for new loans more difficult. Many people find that DTI naturally improves over time as income grows or as debts are paid down — both factors move the ratio in a favorable direction.",
            Example = "Monthly debts — mortgage $1,400 + car payment $350 + student loan $250 = $2,000. Gross monthly income = $7,000. DTI = $2,000 ÷ $7,000 = 28.6% (healthy range)."
        },
        new() {
            Id = "ltv", Title = "What is Loan-to-Value Ratio?", Category = "Mortgage", ReadTime = 3,
            Description = "How much of your home's value is financed versus owned.",
            Content = "LTV is the mortgage balance divided by the home's current market value. The lower the LTV, the more equity exists in the property. An LTV below 80% is often the threshold at which private mortgage insurance (PMI) is no longer required. Lenders tend to view lower LTVs more favorably when evaluating refinance applications. LTV typically improves over time as the mortgage is paid down and as home values appreciate.",
            Example = "Home value $500,000 · Mortgage balance $200,000 → LTV = 40%. With a HELOC balance of $100,000: combined debt = $300,000 → CLTV = $300,000 ÷ $500,000 = 60%."
        },
        new() {
            Id = "savings-rate", Title = "What is a Savings Rate?", Category = "Saving", ReadTime = 3,
            Description = "The percentage of your income you're putting to work for the future.",
            Content = "A savings rate is the portion of net income saved or invested each month. Research and financial planning studies suggest that even a 10% savings rate is a meaningful starting point. Those who save more aggressively — often in the 20–50% range — tend to reach financial independence significantly sooner. Getting a full picture of savings rate typically includes 401(k) contributions, IRA contributions, and brokerage investments together.",
            Example = "Take-home pay $5,000/mo. Savings — IRA $300 + brokerage $200 + 401(k) via payroll $400 = $900 total. Savings rate = $900 ÷ $5,000 = 18% (close to the 20% target)."
        },
        new() {
            Id = "emergency-fund", Title = "How to Build an Emergency Fund", Category = "Saving", ReadTime = 5,
            Description = "The financial cushion that protects everything else.",
            Content = "An emergency fund is generally described as 3–6 months of living expenses held in a liquid, accessible account. One common starting point many people use is a $1,000 initial cushion, building toward full coverage over time. Many find it helpful to keep this fund in a high-yield savings account separate from everyday checking — the physical separation tends to reduce the temptation to spend it. Most financial educators suggest keeping emergency funds out of volatile investments, since the primary value of this money is its guaranteed availability when needed.",
            Example = "Monthly essential expenses = $3,200 (rent $1,400 + food $500 + utilities $200 + minimum debt payments $700 + insurance $400). 3-month target = $9,600. 6-month target = $19,200. Starting goal: save $1,000 first, then build to the 3-month number."
        },
        new() {
            Id = "credit-score", Title = "Credit Score Basics", Category = "Credit", ReadTime = 4,
            Description = "What goes into your score and how to protect it.",
            Content = "Credit scores (300–850) are calculated from payment history (35%), amounts owed (30%), length of credit history (15%), new credit (10%), and credit mix (10%). The factors most within a person's control are payment history and credit utilization. Keeping utilization below 30% is a commonly cited benchmark. Opening several new accounts in a short period can temporarily affect scores. Reviewing your credit report at annualcreditreport.com at least once a year is widely recommended as a way to catch errors or unfamiliar activity.",
            Example = "Credit limit $10,000 across all cards. Balance currently owed = $2,800. Utilization = $2,800 ÷ $10,000 = 28% (just under the 30% benchmark)."
        },
        new() {
            Id = "credit-cards", Title = "How Credit Cards Affect Your Finances", Category = "Credit", ReadTime = 4,
            Description = "Used wisely, a tool. Used carelessly, a trap.",
            Content = "Credit cards charge 18–29% APR on carried balances. Paying the full balance monthly results in zero interest paid. Carrying a balance compounds quickly — $5,000 at 24% APR costs over $100 per month in interest alone. Those who find credit cards beneficial tend to use them for the rewards and built-in consumer protections, treating them as a payment method rather than a borrowing tool. The same features that make them convenient can make them costly when balances carry month to month.",
            Example = "$3,000 balance at 24% APR. Minimum payment ~$60/mo → payoff takes over 8 years and costs ~$2,600 in interest. Paying $200/mo instead: paid off in 18 months with ~$420 in interest — a $2,180 difference."
        },
        new() {
            Id = "mortgage-basics", Title = "Mortgage Basics", Category = "Mortgage", ReadTime = 5,
            Description = "Everything you need to know before borrowing for a home.",
            Content = "A mortgage is a loan secured by the home being purchased. Most are structured as 15 or 30-year terms. A 15-year loan typically carries higher monthly payments but substantially less total interest paid over the life of the loan. Monthly payments cover principal, interest, taxes, and insurance — often referred to as PITI. A down payment of 20% or more typically allows borrowers to avoid private mortgage insurance (PMI). Fixed-rate mortgages offer payment predictability; adjustable-rate mortgages (ARMs) often start lower but carry the possibility of future increases.",
            Example = "$400,000 home, 20% down ($80,000). Loan = $320,000 at 7% for 30 years → payment ≈ $2,129/mo (PITI). Same loan at 6.5% → ≈ $2,023/mo — $106 less per month, ~$38,000 less in total interest over the life of the loan."
        },
        new() {
            Id = "refinance", Title = "Should I Refinance My Mortgage?", Category = "Mortgage", ReadTime = 5,
            Description = "When refinancing makes sense — and when it doesn't.",
            Content = "Refinancing replaces an existing mortgage with a new one, ideally at a lower interest rate. A useful concept is the break-even point — how long it takes for monthly savings to exceed closing costs (which typically run 2–5% of the loan amount). If staying in the home past that point seems likely, refinancing may be worth exploring. Rate reductions of 0.5–1% or more are often cited as a threshold where the numbers tend to support a closer look.",
            Example = "Current mortgage $280,000 at 7.25%. Refi offer: 6.5% with $8,400 closing costs. Monthly savings ≈ $142. Break-even = $8,400 ÷ $142 ≈ 59 months (~5 years). Staying past year 5? Refinancing likely makes sense."
        },
        new() {
            Id = "auto-loan", Title = "Auto Loan Basics", Category = "Debt & Loans", ReadTime = 3,
            Description = "Understanding the numbers behind auto financing.",
            Content = "Auto loans are typically available in terms ranging from 24 to 84 months. Longer terms mean lower monthly payments but more total interest paid over time. A commonly cited guideline is keeping the loan term shorter than the car's expected useful life — so payments aren't continuing on a vehicle that may also need significant repairs. A down payment in the 10–20% range is often suggested to reduce the risk of owing more than the car is worth. Comparing rates from credit unions and banks before visiting a dealership gives many buyers useful context.",
            Example = "$35,000 car, 10% down ($3,500), $31,500 financed at 6.5%. 60-month loan → $615/mo, total interest $5,400. 72-month loan → $530/mo, total interest $6,660 — $1,260 more for a $85 lower payment."
        },
        new() {
            Id = "401k-vs-roth", Title = "401(k) vs Roth IRA", Category = "Retirement", ReadTime = 5,
            Description = "Two powerful retirement tools — here's how they differ.",
            Content = "A 401(k) uses pre-tax dollars — taxes are paid when withdrawals are made in retirement. A Roth IRA uses after-tax dollars — qualified withdrawals in retirement are tax-free. For those who expect to be in a higher tax bracket in retirement, a Roth is often considered advantageous. Many financial advisors suggest having both types of accounts for flexibility in retirement. Capturing any available employer match in a 401(k) is frequently described as one of the higher-value first steps in retirement planning, since it represents additional compensation.",
            Example = "Contributing $500/mo. 401(k): reduces taxable income now; taxed at withdrawal. Roth IRA: paid after-tax now; withdrawals in retirement are 100% tax-free. Both grow to ~$680,000 at 8% over 30 years — Roth withdrawals are never taxed again."
        },
        new() {
            Id = "compound", Title = "Compound Interest Explained Simply", Category = "Investing", ReadTime = 4,
            Description = "Why starting early tends to be the most impactful financial decision.",
            Content = "Compound interest means earning returns on previous returns. $10,000 invested at 8% annual return becomes $21,589 in 10 years, $46,610 in 20 years, and $100,627 in 30 years — without adding another dollar. Starting a decade earlier can roughly double the ending balance. This is why time in the market is so often emphasized over timing the market — the math of compounding rewards patience more than precision.",
            Example = "Investor A starts at 25, contributes $200/mo for 10 years (stops at 35), total in = $24,000. Investor B starts at 35, contributes $200/mo for 30 years, total in = $72,000. Both earn 8%/yr. At age 65: Investor A ≈ $375,000. Investor B ≈ $298,000. Starting earlier won — with one-third the contributions."
        },
        new() {
            Id = "debt-payoff", Title = "Debt Snowball vs Debt Avalanche", Category = "Debt & Loans", ReadTime = 4,
            Description = "Two proven strategies for paying off debt — each with a different logic.",
            Content = "The snowball method directs payments toward the smallest balance first, then rolls that freed-up payment to the next debt. It creates early wins and momentum, which research suggests can help people stay consistent. The avalanche method targets the highest-interest debt first, minimizing total interest paid mathematically. Both approaches work — and financial educators often point out that the most effective method is the one a person will actually follow through on consistently.",
            Example = "Three debts — medical bill $400 at 0%, credit card $2,200 at 22%, student loan $8,000 at 6%. Snowball: pay off medical bill first, then add that freed payment to the credit card. Avalanche: attack the credit card first (saves the most interest). Either way, an extra $200/mo eliminates all three debts years faster than minimums alone."
        },
        new() {
            Id = "variable-income", Title = "Budgeting with Variable Income", Category = "Budgeting", ReadTime = 5,
            Description = "How to budget when your income changes month to month.",
            Content = "Budgeting with variable income is a common challenge for freelancers, commission-based workers, and seasonal earners. A common approach is building the budget around the lowest expected monthly earnings — this way, any month above that threshold is a positive rather than a stressor. Directing surplus from higher-income months toward savings or a dedicated income buffer is a strategy many find effective for smoothing out volatility. Tracking a 6-month rolling average can offer a useful planning baseline that reflects real earning patterns.",
            Example = "6-month income: $4,200, $6,800, $3,900, $7,200, $5,100, $4,400. Average = $5,267/mo. Budget built around $3,900 (lowest month). Any income above $3,900 → replenish income buffer first, then extra debt payoff or savings."
        },
        new() {
            Id = "monthly-review", Title = "How to Review Your Finances Monthly", Category = "Financial Basics", ReadTime = 4,
            Description = "A simple monthly habit that changes everything.",
            Content = "A monthly financial review typically takes 20–30 minutes and involves checking net worth, cash flow, and key account balances — then updating any values that have changed and comparing to the prior month. Many people find that saving a snapshot at the same time helps build a meaningful historical record over time. Simply looking at your numbers on a consistent basis tends to build financial awareness and reduce anxiety around money — even when the numbers aren't where you'd like them to be.",
            Example = "20-minute check-in: ① Net worth up $1,400 vs. last month ② Cash flow +$720 ③ Emergency fund at 4.1 months ④ Credit card paid in full ✓ ⑤ Savings on pace ✓ ⑥ Screenshot saved. Same routine each month builds a financial history you can actually learn from."
        },
        new() {
            Id = "housing-ratio", Title = "What is a Housing Ratio?", Category = "Mortgage", ReadTime = 3,
            Description = "How to know if your housing cost is in a healthy range.",
            Content = "The housing ratio is monthly housing cost divided by gross monthly income. Lenders traditionally view a ratio below 28% favorably. When the ratio climbs above 35%, it tends to reduce financial flexibility in other areas. Housing cost in this context typically includes mortgage or rent, property taxes, insurance, and HOA fees. A high housing ratio often reflects a mismatch between housing cost and income level — something that tends to improve naturally as income grows or housing circumstances change over time.",
            Example = "Gross monthly income $8,000. Housing costs: mortgage $1,600 + property taxes $250 + insurance $120 + HOA $75 = $2,045/mo. Housing ratio = $2,045 ÷ $8,000 = 25.6% (within the healthy range)."
        },
        new() {
            Id = "free-cash-flow", Title = "What is Free Cash Flow?", Category = "Financial Basics", ReadTime = 3,
            Description = "The money left over after you've handled everything else.",
            Content = "Free cash flow is net income minus all expenses, debt payments, and savings contributions. A positive number represents money available for discretionary spending, additional debt payoff, or further investing. It's often described as the truest measure of financial breathing room — not just what someone earns, but what remains after all obligations are met. Many financial educators consider consistent positive free cash flow one of the clearest signs of financial stability.",
            Example = "Net income $5,200/mo. Fixed $1,800 + variable $900 + debt payments $600 + savings $500 = $3,800 outflow. Free cash flow = $5,200 − $3,800 = $1,400. That $1,400 is available for discretionary spending, extra debt payoff, or additional investing."
        },
        new() {
            Id = "loan-prep", Title = "How to Get Prepared for a Loan", Category = "Debt & Loans", ReadTime = 6,
            Description = "The documents, habits, and organization that make lenders say yes.",
            Content = "Loan approval often begins months before an application is submitted — not the day someone walks in. For consumer lending, lenders typically request: 3 years of personal tax returns, the 2 most recent W-2s, and the 2 most recent paystubs. Self-employed borrowers should generally expect to also provide 2 years of business tax returns and a current profit & loss statement. Beyond documents, lenders are typically evaluating credit score, debt-to-income ratio, employment stability (2+ years in the same field is often viewed favorably), and liquid reserves. File organization tends to matter more than most borrowers expect. A lender or processor handling dozens of clients a day is reviewing documents quickly — clear naming makes a real difference. Keeping everything in a personal cloud folder organized by document type means documents are ready whenever they're needed. In the months before applying, reviewing a credit report (available free at annualcreditreport.com) can help identify anything worth addressing. New credit inquiries in the period before application are worth considering, as they can temporarily affect scores. Large or unusual deposits may require documentation and explanation. The borrowers who tend to move through the process most smoothly are often not the ones with the most impressive finances — they're the ones who arrive organized.",
            Example = "Folder structure: Tax Returns/ → 'Tax Return_John Doe_2024.pdf', 'Tax Return_2025.pdf'. Income/ → 'W2_2025.pdf', 'W2_2024.pdf', 'Paystub_May2026.pdf', 'Paystub_Apr2026.pdf'. When the lender requests documents, you send the folder — organized in under 60 seconds."
        },
        new() {
            Id = "heloc-basics", Title = "What is a HELOC and How Does It Work?", Category = "Mortgage", ReadTime = 5,
            Description = "How to borrow against your home equity — and when it makes sense.",
            Content = "A HELOC (Home Equity Line of Credit) allows borrowing against the equity in a home, functioning similarly to a credit card with the home as collateral. Lenders typically allow borrowing up to 89.9% of the home's value minus the existing mortgage balance — known as the combined loan-to-value (CLTV) limit. HELOCs generally have two phases: a draw period (typically 10 years) where funds can be borrowed with interest-only payments, and a repayment period (typically 20 years) where the remaining balance is repaid. Interest rates are usually variable and tied to the prime rate. HELOCs are often used for home improvements, debt consolidation, or large planned expenses. Since the home serves as collateral, financial educators commonly note that a HELOC warrants the same level of consideration as any primary mortgage obligation.",
            Example = "Home value $450,000. Mortgage balance $320,000. Lender allows 89.9% CLTV. Max CLTV = $450,000 × 0.899 = $404,550. Available HELOC line = $404,550 − $320,000 = $84,550. Draw period: borrow up to $84,550, interest-only payments. Repayment period: 20 years to pay off the balance drawn."
        },
    ];
}
