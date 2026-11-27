# Tutorial: poner en marcha el sistema de informes (de cero)

## Cómo está armado (arquitectura)

```
Docente (navegador)
   │  abre https://TU-USUARIO.github.io/TU-REPO/
   ▼
GitHub Pages ── sirve archivos estáticos: index.html + app.js + schema.js + config.js
   │
   │  (el JavaScript del navegador habla directo con Supabase por HTTPS)
   ▼
Supabase ── Auth (usuarios) + Postgres (tabla `informes`) + RLS (reglas de seguridad)
```

- **GitHub Pages** solo entrega archivos. No ejecuta código del servidor.
- **Supabase** es la base de datos y el login. La seguridad NO está en el JavaScript (cualquiera puede verlo) sino en las reglas **RLS** de la base: cada docente solo puede leer/escribir sus propios informes.
- **.docx** se genera en el navegador con la librería `docx`; **PDF** con el diálogo "Imprimir → Guardar como PDF". No hay servidor propio.
- **Escalabilidad**: el formulario entero está descrito en `schema.js`. La tabla `informes` guarda cada formulario como JSON (`datos`) más unas columnas (`ciclo`, `departamento`, `asignatura`) para filtrar. Un formulario nuevo = otra entrada en `schema.js`, sin cambiar la base de datos. Hay rol `admin` para que secretaría lea todos los informes.

| Archivo | Para qué |
|---|---|
| `index.html` | Pantallas (login, listado, formulario) y estilos |
| `schema.js` | **Definición del formulario** (preguntas, opciones) |
| `app.js` | Lógica: login, guardar, exportar .docx/PDF |
| `config.js` | URL y clave pública de Supabase (la completás en el paso 3) |
| `supabase.sql` | Crea las tablas y las reglas de seguridad |

---

## Paso 1 — Crear el proyecto en Supabase

1. Entrá a <https://supabase.com> → **Start your project** → registrate (podés usar tu cuenta de GitHub).
2. **New project**: ponele nombre (ej. `informes-docentes`), elegí una contraseña de base de datos (guardala), región **South America (São Paulo)**. Plan **Free**. Esperá 1–2 minutos.

## Paso 2 — Crear las tablas

1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abrí `supabase.sql`, copiá TODO, pegalo, y apretá **Run**. Debe decir "Success".
3. Verificá en **Table Editor**: aparecen `informes` y `profiles`.

## Paso 3 — Copiar las claves al proyecto

1. **Project Settings (engranaje) → API** (o "API Keys").
2. Copiá **Project URL** y la clave **anon / public** (en proyectos nuevos puede llamarse *Publishable key*).
3. Pegalas en `config.js`:
   ```js
   SUPABASE_URL: 'https://abcdefgh.supabase.co',
   SUPABASE_KEY: 'eyJhbGciOi...',
   ```
4. ⚠️ **Nunca** uses la clave `service_role` / *secret*: esa sí da acceso total. La `anon` es pública a propósito; la protege RLS (paso 2).

## Paso 4 — Configurar el login

**Authentication → Providers → Email** (ya viene activo).
- Para **probar rápido**: desactivá **Confirm email**. Así las cuentas entran sin verificar el correo.
- Para **producción**: dejalo activado (los docentes confirman por mail) y en **Authentication → URL Configuration** poné como *Site URL* la dirección de tu GitHub Pages (paso 6). Ojo: el plan gratuito limita los mails de confirmación por hora; si son muchos docentes, conviene configurar un SMTP propio (Authentication → SMTP Settings).

## Paso 5 — Probar en tu computadora

Desde la carpeta del proyecto, en PowerShell:

```powershell
python -m http.server 8000
```

Abrí <http://localhost:8000>, creá una cuenta, completá un informe, guardá, y descargá el .docx y el PDF. (No abras `index.html` con doble clic: algunas funciones del navegador requieren `http://`.)

## Paso 6 — Publicar en GitHub Pages

1. Creá una cuenta en <https://github.com> si no tenés.
2. **New repository** → nombre `informes-docentes`, **Public** (el plan gratuito de Pages lo exige público). Es seguro: no hay secretos en el código (la clave `anon` es pública).
3. Subí los archivos: en el repo → **Add file → Upload files** → arrastrá `index.html`, `app.js`, `schema.js`, `config.js` (el `supabase.sql` y este tutorial son opcionales) → **Commit changes**.
4. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** / carpeta **/(root)** → **Save**.
5. Al minuto, tu sistema está en `https://TU-USUARIO.github.io/informes-docentes/`.
6. Volvé a Supabase → **Authentication → URL Configuration** y pegá esa dirección en *Site URL*.

Para actualizar algo más adelante: editá el archivo en GitHub (lápiz) o subilo de nuevo → se republica solo.

## Paso 7 — Dar rol de administrador (secretaría)

Después de que esa persona se registre en el sistema, en **SQL Editor**:

```sql
update public.profiles set rol = 'admin'
where id = (select id from auth.users where email = 'secretaria@ejemplo.com');
```

Un admin puede **leer** todos los informes desde Supabase (Table Editor → `informes`, y desde ahí exportar a CSV). La pantalla del sistema todavía muestra solo los informes propios.

## Cómo modificar el formulario

Todo está en `schema.js`. Ejemplos:
- Agregar una opción a una lista: sumar un texto al arreglo `opciones`.
- Agregar una pregunta de texto: `{ k: 'mi_campo', type: 'textarea', label: 'Mi pregunta' }` dentro de una sección. `k` debe ser único y sin espacios.
- Tipos disponibles: `text`, `date`, `textarea`, `checks` (tildar varias), `radios` (una opción), `matrix` (filas × opciones), `tabla` (filas que se agregan), `stats` (cuadro de resultados con porcentajes automáticos).
- Los informes ya guardados siguen funcionando: los campos nuevos simplemente aparecen vacíos.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| "Invalid API key" / "Failed to fetch" | `config.js` mal copiado (URL o clave) |
| "new row violates row-level security" | No corriste `supabase.sql` completo, o no hay sesión iniciada |
| "Email not confirmed" | Confirm email activo: confirmar desde el correo o desactivarlo (paso 4) |
| Página en blanco en GitHub Pages | Pages no activado, o `index.html` no está en la raíz del repo |
| PDF sale cortado | En el diálogo de impresión: tamaño A4, márgenes "Predeterminado", destino "Guardar como PDF" |

## Límites del plan gratuito (a tener en cuenta)

- Supabase Free pausa el proyecto tras ~1 semana sin actividad (se reactiva con un clic en el panel) y no incluye backups automáticos. Si el sistema va a ser oficial, exportá los datos periódicamente o pasá a un plan pago.
- El `.docx` generado replica el contenido del formulario, no el diseño gráfico exacto del anexo original (membrete, logos, firma impresa).
