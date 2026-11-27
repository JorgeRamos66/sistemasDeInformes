# Sistema de informes docentes: guía de uso y mantenimiento

## Cómo funciona

```
Docente ──► GitHub Pages (index.html + JS) ──► Supabase (base de datos)
```

- **Docentes (sin login):** entran a la página, completan el informe y lo guardan. Al guardar se genera un **código de 10 caracteres** (ej. `K7M2PX94QA`). Con ese código, desde la pestaña **Código**, pueden volver a abrir el informe, editarlo o descargarlo. Los informes **no se pueden listar ni buscar**: sin el código no hay forma de llegar a uno.
- **Descargas:** el **.docx** se arma sobre el documento original (`plantilla.docx`), así que conserva logo, tipografías, tamaños, bordes y listas desplegables. El nombre del archivo termina con el código: `Informe_Internetworking_K7M2PX94QA.docx`. Antes de descargar, el sistema guarda automáticamente, así el archivo siempre coincide con lo guardado.
- **Administración (sin contraseña):** `https://TU-USUARIO.github.io/sistemasDeInformes/#k=LA-CLAVE`. Es un enlace privado: la clave larga del final reemplaza a la contraseña. Muestra la lista de **todos** los informes (con su código), con búsqueda, y permite abrir, editar, descargar y eliminar. **No compartir ese enlace**: quien lo tenga ve todo.

| Archivo | Para qué |
|---|---|
| `index.html` | Pantallas y estilos (inicio, formulario, administración) |
| `schema.js` | **Definición del formulario** (preguntas y opciones) |
| `docx.js` | Rellena `plantilla.docx` con los datos del informe |
| `plantilla.docx` | El anexo original: **no editarlo** salvo que cambie el formato oficial |
| `app.js` | Lógica: guardar, códigos, descargas, administración |
| `config.js` | URL y clave pública de Supabase |
| `supabase.sql` | Tablas, funciones y reglas de seguridad |

---

## Actualizar la base de datos (Supabase)

Cada vez que cambie `supabase.sql`, se pega completo en **SQL Editor → New query → Run**. Se puede ejecutar varias veces sin problema y **no borra los informes existentes** (los que ya estaban reciben su código).

Debe terminar con **"Success"**. Esto: cierra el acceso abierto, agrega los códigos y crea las funciones que usa el sistema.

## Obtener el enlace de administración

Al ejecutar `supabase.sql` se genera solo una clave secreta. Para verla, en el **SQL Editor**:

```sql
select clave from public.config_admin;
```

Tu enlace es `https://TU-USUARIO.github.io/sistemasDeInformes/#k=` seguido de esa clave. Guardalo en favoritos.

- Para **cambiar la clave** (por ejemplo si el enlace se filtró): `update public.config_admin set clave = encode(extensions.gen_random_bytes(18), 'hex');` y volver a consultarla. El enlace viejo deja de funcionar.
- Recomendado: **Authentication → Sign In / Providers → Email** → desactivar **Allow new users to sign up**, porque el sistema ya no usa cuentas.

## Publicar los cambios en GitHub Pages

Subir al repositorio los archivos que cambiaron (todos los de la tabla, incluido `plantilla.docx`). Desde la carpeta del proyecto, en PowerShell:

```powershell
git add .
git commit -m "Códigos de informe, administración y plantilla docx"
git push
```

En 1 o 2 minutos se actualiza el sitio. Si el navegador sigue mostrando la versión vieja, recargar con **Ctrl + F5**.

## Cómo modificar el formulario

Todo está en `schema.js`.
- **Agregar una pregunta de texto:** `{ k: 'mi_campo', type: 'textarea', label: 'Mi pregunta' }` dentro de una sección (`k` único y sin espacios).
- **Importante:** el documento Word tiene un lugar fijo para cada dato. Una pregunta nueva se guarda en la base pero **no aparece en el .docx** salvo que se agregue también en `docx.js`. Las listas de opciones (viñetas tildables) deben mantener el **mismo orden** que en `plantilla.docx`.
- Tipos disponibles: `text`, `date`, `textarea`, `checks`, `radios`, `matrix`, `tabla`, `stats`.

## Sobre el PDF

El botón **Descargar PDF** muestra el documento en el diálogo de impresión: elegir **Guardar como PDF**, tamaño A4. El PDF se genera desde el mismo .docx, pero lo dibuja el navegador, no Word, así que **puede haber diferencias mínimas** (espaciados, tipografía si la computadora no tiene la fuente). Si hace falta un PDF idéntico al milímetro: descargar el .docx, abrirlo en Word y usar *Guardar como → PDF*.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| "No se pudo guardar: Could not find the function…" | No se ejecutó `supabase.sql` completo |
| "No existe ningún informe con ese código" | Código mal escrito (10 letras y números; no usa 0, O, 1, I) |
| "La clave del enlace no es correcta" | Enlace mal copiado, o se cambió la clave en `config_admin`. Volver a consultarla |
| Página vieja después de subir cambios | Recargar con Ctrl + F5 |
| Errores de conexión tras semanas sin uso | El plan gratuito de Supabase pausa el proyecto: reactivarlo desde su panel |

## Seguridad: lo que hay que saber

- La clave `sb_publishable_…` de `config.js` es pública por diseño. **Nunca** poner la clave *secret* / `service_role`.
- Cualquiera con la dirección del sitio puede **crear** informes (no hay login para docentes). No hay límite de cantidad, así que alguien podría llenar la base con basura. Si ocurre, se limpia desde el panel de administración.
- Los informes incluyen DNI de docentes: quien tenga un código ve y edita ese informe. Tratar los códigos como una contraseña.
- Supabase Free no hace copias de seguridad automáticas. Exportar `informes` a CSV periódicamente (Table Editor → Export).
