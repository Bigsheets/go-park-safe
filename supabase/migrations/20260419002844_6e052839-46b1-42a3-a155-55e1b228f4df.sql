create table public.parking_reports (
  id uuid primary key default gen_random_uuid(),
  sign_type text not null check (sign_type in ('no_parking','max_3h','permit_only','unknown')),
  notes text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create index parking_reports_lat_lng_idx on public.parking_reports (lat, lng);

alter table public.parking_reports enable row level security;

create policy "Anyone can read parking reports"
  on public.parking_reports for select using (true);

create policy "Anyone can insert parking reports"
  on public.parking_reports for insert with check (true);