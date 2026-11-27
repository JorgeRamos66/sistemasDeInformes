-- Pegar completo en Supabase > SQL Editor > Run. Se puede correr varias veces y sobre la base ya existente.
--
-- Modelo: los informes están OCULTOS. Nadie puede listar ni leer la tabla desde la web.
-- Solo se llega a un informe conociendo su código de 10 caracteres, mediante 3 funciones.
-- El administrador (con login) puede ver y editar todos.

-- ---------- Perfiles (para marcar quién es admin) ----------
create table if not exists public.profiles (
  id     uuid primary key references auth.users on delete cascade,
  nombre text,
  rol    text not null default 'docente' check (rol in ('docente','admin'))
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Tabla de informes ----------
create table if not exists public.informes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete set null,
  tipo         text not null default 'informe_docente',
  estado       text not null default 'borrador',
  ciclo        text,
  departamento text,
  asignatura   text,
  datos        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.informes alter column user_id drop not null;
alter table public.informes add column if not exists codigo text;
create index if not exists informes_tipo_idx on public.informes (tipo, ciclo, departamento);

-- Código de 10 caracteres alfanuméricos (sin 0/O/1/I para no confundirse al dictarlo).
-- 32 símbolos x 10 posiciones = más de un billón de combinaciones, generado con bytes aleatorios criptográficos.
create or replace function public.nuevo_codigo() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(10);
  r text := '';
begin
  for i in 0..9 loop r := r || substr(alfabeto, (get_byte(b, i) & 31) + 1, 1); end loop;
  return r;
end $$;

-- Informes que ya existían reciben su código.
update public.informes set codigo = public.nuevo_codigo() where codigo is null;
alter table public.informes alter column codigo set not null;
create unique index if not exists informes_codigo_key on public.informes (codigo);

-- ---------- Funciones públicas (la única puerta para docentes) ----------
create or replace function public.crear_informe(p_datos jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) > 200000 then
    raise exception 'Datos inválidos';
  end if;
  loop
    c := public.nuevo_codigo();
    begin
      insert into public.informes (codigo, datos, ciclo, departamento, asignatura)
      values (c, p_datos, p_datos->>'ciclo', p_datos->>'departamento', p_datos->>'asignatura');
      return c;
    exception when unique_violation then null; -- código repetido (casi imposible): reintenta
    end;
  end loop;
end $$;

create or replace function public.obtener_informe(p_codigo text) returns jsonb
language sql security definer set search_path = '' stable as $$
  select datos from public.informes where codigo = upper(trim(p_codigo))
$$;

create or replace function public.actualizar_informe(p_codigo text, p_datos jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) > 200000 then
    raise exception 'Datos inválidos';
  end if;
  update public.informes
     set datos = p_datos, ciclo = p_datos->>'ciclo', departamento = p_datos->>'departamento',
         asignatura = p_datos->>'asignatura', updated_at = now()
   where codigo = upper(trim(p_codigo));
  return found;
end $$;

revoke all on function public.nuevo_codigo() from public, anon, authenticated;
revoke all on function public.crear_informe(jsonb), public.obtener_informe(text), public.actualizar_informe(text, jsonb) from public;
grant execute on function public.crear_informe(jsonb), public.obtener_informe(text), public.actualizar_informe(text, jsonb) to anon, authenticated;

-- ---------- Seguridad de la tabla (RLS) ----------
alter table public.informes enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "abierto" on public.informes;
drop policy if exists "informes propios" on public.informes;
drop policy if exists "admin lee todo" on public.informes;
drop policy if exists "admin lee" on public.informes;
drop policy if exists "admin edita" on public.informes;
drop policy if exists "admin borra" on public.informes;
drop policy if exists "perfil propio" on public.profiles;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin')
$$;

create policy "admin lee"   on public.informes for select to authenticated using (public.is_admin());
create policy "admin edita" on public.informes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin borra" on public.informes for delete to authenticated using (public.is_admin());
create policy "perfil propio" on public.profiles for select to authenticated using (id = auth.uid());

-- Sin sesión (anon) NO hay acceso directo a la tabla. Con sesión, solo lo que permiten las políticas de arriba.
revoke all on public.informes from anon, authenticated;
grant select, update, delete on public.informes to authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;

-- ---------- Enlace de administración (sin contraseña) ----------
-- La clave se genera sola y vive en una tabla que la web NO puede leer. Para verla, ejecutar en el SQL Editor:
--     select clave from public.config_admin;
-- Enlace de administración:  https://TU-USUARIO.github.io/sistemasDeInformes/#k=LA-CLAVE
create table if not exists public.config_admin (clave text not null);
alter table public.config_admin enable row level security; -- sin políticas: nadie la lee desde la web
revoke all on public.config_admin from anon, authenticated;
insert into public.config_admin (clave)
  select encode(extensions.gen_random_bytes(18), 'hex') where not exists (select 1 from public.config_admin);

create or replace function public.admin_listar(p_clave text)
returns table (codigo text, asignatura text, ciclo text, departamento text, updated_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
begin
  if p_clave is null or p_clave <> (select c.clave from public.config_admin c limit 1) then
    raise exception 'No autorizado';
  end if;
  return query select i.codigo, i.asignatura, i.ciclo, i.departamento, i.updated_at
               from public.informes i order by i.updated_at desc;
end $$;

create or replace function public.admin_eliminar(p_clave text, p_codigo text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_clave is null or p_clave <> (select c.clave from public.config_admin c limit 1) then
    raise exception 'No autorizado';
  end if;
  delete from public.informes where codigo = upper(trim(p_codigo));
  return found;
end $$;

revoke all on function public.admin_listar(text), public.admin_eliminar(text, text) from public;
grant execute on function public.admin_listar(text), public.admin_eliminar(text, text) to anon, authenticated;
