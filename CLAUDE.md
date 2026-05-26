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
  - **Tyler James** · UUID `5a3f3615-2430-43cd-b460-dc4604239ccb` · $15/hr · marketing
  - **Jalen McGarrah** · UUID `f451ef9f-169d-4212-bcc9-fe8cd962b237` · $22/hr · development
- Inactive (dismissed): Andrew Kruszka (dismissed 2025-01-16) — expected, not in OS
- Gusto has no native time tracking integration (`source: 'none'`); hours are entered manually per payment

## Team roster notes
- **Isaac Harmon** — owner/PM, in OS at $0/hr, not in Gusto (expected)
- **Harmon Bot** — automation account in OS, not in Gusto (expected)
- **Isaac TEST** (`isaacdouglasharmon@gmail.com`) — test account in OS at $20/hr contractor, no Gusto counterpart. Flag each run until deactivated.

## Payroll routine — known patterns
- Tyler and Jalen log hours in the OS under `time_entries` with `contractor_paid` flag. Query `contractor_paid = false` for unpaid hours in the period.
- Also query for contractors with **zero entries at all** in the period (not just zero unpaid) — that's the real gap signal (e.g. Jalen paid 13.4h in Gusto on 2026-05-18 but had no OS entries from May 9 onward; he needed to log them after the fact).
- Cross-check: OS unpaid hours × hourly_rate should roughly match the Gusto contractor payment for the same period.
- All hours must be logged in the OS before being paid in Gusto. If OS shows 0h for a contractor but Gusto shows a payment, that is a real data gap — the contractor likely hasn't logged their hours yet (or entries weren't saved). Flag it and ask them to log before approving future payments.
- Referral payouts flow through `referral_payouts` table; check `status IN ('pending','due','approved')` for anything due this cycle.

## Slack
- Isaac Harmon Slack ID: `U052XA0EMQE`
