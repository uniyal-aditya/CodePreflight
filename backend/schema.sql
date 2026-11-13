-- CodePreflight · run in Supabase SQL editor
create table repositories(id uuid primary key default gen_random_uuid(), owner text, name text, url text unique, default_branch text);
create table audits(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users, repository_id uuid references repositories,
  commit_sha text not null, profile text default 'standard', status text default 'queued', coverage jsonb, score int, risk text,
  started_at timestamptz default now(), completed_at timestamptz);
create table findings(id uuid primary key default gen_random_uuid(), audit_id uuid references audits on delete cascade, code text, rule_id text,
  category text, severity text check (severity in ('critical','high','medium','low','info')), confidence text, file_path text, line_number int,
  evidence text, recommendation text, source text, fingerprint text, status text default 'open');
create table finding_status_history(id bigserial primary key, finding_id uuid references findings, status text, reason text not null, changed_by uuid, at timestamptz default now());
create table scan_tools(audit_id uuid references audits, tool text, version text);
alter table audits enable row level security; alter table findings enable row level security; alter table finding_status_history enable row level security;
create policy own_audits on audits for all using (user_id = auth.uid());
create policy own_findings on findings for all using (audit_id in (select id from audits where user_id = auth.uid()));
create policy own_hist on finding_status_history for all using (finding_id in (select f.id from findings f join audits a on a.id=f.audit_id where a.user_id=auth.uid()));

-- GitHub login / private repos
alter table audits add column if not exists is_private boolean default false;
alter table repositories enable row level security; alter table scan_tools enable row level security;
create policy own_repos on repositories for select using (id in (select repository_id from audits where user_id = auth.uid()));
alter table findings add column if not exists ai jsonb;  -- cached AI explanation
