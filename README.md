# Auto Finance Studio v2

Vercel-ready Next.js accounting web app for educational bookkeeping.

## Features
- Chart of Accounts
- Regular journal entries
- Adjusting entries
- General Journal
- General Ledger
- Trial Balance
- Adjusted Trial Balance
- 10-column worksheet with adjustment calculations
- Income Statement
- Statement of Owner's Equity
- Balance Sheet
- Closing-entry review
- Post-closing trial balance
- Double-entry validation
- Accounting equation check
- PHP formatting
- LocalStorage persistence
- Print-friendly reports
- Mobile responsive UI

## Run
Node.js 20.9+ recommended.

```bash
npm install
npm run dev
```

## Build verification

```bash
npm run build
```

## Deploy
Push the project to GitHub and import the repository into Vercel. No environment variables are required.

## Important
This is an educational bookkeeping application. It does not replace professional accounting software or an accountant.

The closing-entry screen intentionally uses a review workflow rather than automatically posting synthetic Income Summary transactions, because Income Summary is not currently included as a permanent chart-of-accounts record. This avoids contaminating the post-closing balance with an implementation-only account.

## v3 additions
- 20+ selectable currencies with locale-aware formatting
- XLSX export using the SheetJS `xlsx` package
- Workbook sheets: Journal, Accounts, Trial Balance, Adjusted TB, Worksheet, Income Statement, Balance Sheet
- Exported numeric cells remain numeric/editable in Excel/Google Sheets
- Currency and business settings persist locally


## v4 Formula-linked XLSX
The XLSX export contains editable Accounts and Journal source sheets plus formula-linked Trial Balance, Adjusted TB, Worksheet, Income Statement, Owner's Equity, Balance Sheet, and Post-Closing TB. Editing source cells in Excel and recalculating updates the reports.
