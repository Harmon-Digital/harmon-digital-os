alter table time_entries
  add column if not exists client_billed boolean default false,
  add column if not exists contractor_paid boolean default false;
