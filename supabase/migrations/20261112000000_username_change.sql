-- Cuándo cambió el nombre por última vez (se puede una vez cada 14 días; ver AUTH.usernameCooldown).
alter table public.profiles add column if not exists username_changed_at timestamptz;
