-- Pegar completo en Supabase > SQL Editor > Run.

-- Perfil de cada usuario (rol docente | admin). Se crea solo al registrarse.
create table public.profiles (
  id     uuid primary key references auth.users on delete cascade,
  nombre text,
  rol    text not null default 'docente' check (rol in ('docente','admin'))
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un solo tipo de tabla para TODOS los formularios futuros: "tipo" distingue cuál es,
-- las columnas sueltas sirven para filtrar/reportar y "datos" guarda el formulario completo.
create table public.informes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  tipo         text not null default 'informe_docente',
  estado       text not null default 'borrador' check (estado in ('borrador','enviado')),
  ciclo        text,
  departamento text,
  asignatura   text,
  datos        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.informes (user_id);
create index on public.informes (tipo, ciclo, departamento);

create function public.is_admin() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin')
$$;

-- Seguridad (RLS): cada docente solo toca lo suyo; el admin puede leer todo.
alter table public.profiles enable row level security;
alter table public.informes enable row level security;

create policy "perfil propio" on public.profiles for select using (id = auth.uid() or public.is_admin());

-- ACCESO ABIERTO (sin login): cualquiera con el link lee, crea, edita y borra. Decisión del cliente.
alter table public.informes alter column user_id drop not null;
create policy "abierto" on public.informes for all to anon using (true) with check (true);

-- Permisos de acceso por API (necesarios porque al crear el proyecto se dejó desmarcado
-- "Grant API access to new tables automatically").
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.informes to anon, authenticated;
grant select on public.profiles to authenticated;

-- Para hacer admin a alguien (después de que se registre):
-- update public.profiles set rol = 'admin' where id = (select id from auth.users where email = 'secretaria@ejemplo.com');
