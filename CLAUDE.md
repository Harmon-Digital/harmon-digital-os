# Harmon Digital OS — Claude Context

## Supabase
- Project: **Harmon Digital OS** · ID `ctfichbfoligaiabudjv`
- Key tables and actual column names (schema-verified 2026-05-26):
  - `team_members`: `id`, `user_id`, `full_name`, `email`, `role`, `employment_type`, `hourly_rate`, `status`
  - `time_entries`: `id`, `team_member_id`, `project_id`, `task_id`, `date`, `hours`, `description`, `billable`, `client_billed`, `contractor_paid`
  - `referral_payouts`: `id`, `referral_id`, `amount`, `payout_type`, `period_start`, `period_end`, `status`, `paid_date`, `payment_method`, `payment_reference`, `notes`
  - `referral_partners`: `id`, `user_id`, `company_name`, `contact_name`, `email`, `commission_rate`, `commission_months`, `payment_method`, `status`

## Gusto
- Company UUID: `90b7d65a-d95a-431c-ae17-75bc97de8f6a`
- **Contractor-only shop** — no W-2 employees, no open payroll runs. Compensation flows through contractor payments (`list_contractor_payments`, `list_contractors`). Skip `list_payrolls` / `list_pay_periods` / `list_time_records` — they return empty.
- Active contractors (as of 2026-05-26):
  - **Jalen McGarrah** · UUID `f451ef9f-169d-4212-bcc9-fe8cd962b237` · $22/hr · development
- Inactive/dismissed: Andrew Kruszka (dismissed 2025-01-16), Tyler James (departed 2026-05-26, needs Gusto dismissal) — both expected to be absent from active roster
- Gusto has no native time tracking integration (`source: 'none'`); hours are entered manually per payment

## Team roster notes
- **Isaac Harmon** — owner/PM, in OS at $0/hr, not in Gusto (expected)
- **Harmon Bot** — automation account in OS, not in Gusto (expected)
- **Isaac TEST** (`isaacdouglasharmon@gmail.com`) — deactivated in OS on 2026-05-26, no Gusto counterpart. No further action needed.

## Payroll routine — known patterns
- Tyler and Jalen log hours in the OS under `time_entries` with `contractor_paid` flag. Query `contractor_paid = false` for unpaid hours in the period.
- Cross-check: OS unpaid hours × hourly_rate should roughly match the Gusto contractor payment for the same period.
- **Date window caveat**: Gusto payment dates lag OS markings by ~6 days (e.g. OS marked paid May 12 → Gusto funded May 18). The OS entries that correspond to a Gusto payment may fall in the *prior* biweekly window, not the current one. Match by summing `contractor_paid = true` entries with `updated_at` near the Gusto payment date, not by pay period date range alone.
- A contractor having zero OS entries in the *current* period is expected mid-cycle — only flag it if Gusto shows a payment for that same window with no matching OS hours anywhere.
- All hours must be logged in the OS before being paid in Gusto. If OS shows 0h for a contractor but Gusto shows a payment, that is a real data gap — the contractor likely hasn't logged their hours yet (or entries weren't saved). Flag it and ask them to log before approving future payments.
- Referral payouts flow through `referral_payouts` table; check `status IN ('pending','due','approved')` for anything due this cycle.

## Slack
- Isaac Harmon Slack ID: `U052XA0EMQE`
