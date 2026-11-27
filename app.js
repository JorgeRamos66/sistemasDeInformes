const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const FORM = FORMS.informe_docente;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// num() y pct() vienen de docx.js (misma cuenta en pantalla y en el documento).

let cur = { codigo: null, datos: {} }; // informe abierto
let admin = false;                      // true si se abrió desde el panel de administración
let dirty = false;                      // hay cambios sin guardar
let spy, listaAdmin = [];

const show = v => ['home', 'editor', 'admin'].forEach(x => $('#' + x).hidden = x !== v);
const msg = t => { const m = $('#msg'); m.textContent = t; m.classList.add('show'); clearTimeout(msg.t); msg.t = setTimeout(() => m.classList.remove('show'), 5000); };

/* ---------- Inicio: pestañas "Nuevo informe" / "Código" ---------- */
$$('[data-tab]').forEach(b => b.onclick = () => {
  $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b));
  ['nuevo', 'codigo'].forEach(t => $('#tab-' + t).hidden = t !== b.dataset.tab);
  if (b.dataset.tab === 'codigo') $('#code').focus();
});

function nuevo() { admin = false; cur = { codigo: null, datos: {} }; draw(cur.datos); scrollTo(0, 0); }

async function abrir(code, desdeAdmin) {
  code = String(code).replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(code)) return msg('El código tiene 10 letras y números.');
  const { data, error } = await sb.rpc('obtener_informe', { p_codigo: code });
  if (error) return msg('No se pudo abrir el informe: ' + error.message);
  if (!data) return msg('No existe ningún informe con ese código.');
  admin = desdeAdmin; cur = { codigo: code, datos: data }; draw(data); scrollTo(0, 0);
}

/* ---------- Dibujo del formulario a partir de schema.js ---------- */
const radios = (name, ops, v) => ops.map(o => `<label class="chk"><input type="radio" name="${name}" value="${esc(o)}" ${v === o ? 'checked' : ''}> ${o}</label>`).join('');

function field(f, d) {
  const v = d[f.k], L = f.label ? `<legend>${f.label}</legend>` : '';
  if (f.type === 'textarea') return `<label>${f.label}<textarea name="${f.k}" rows="3">${esc(v)}</textarea></label>`;
  if (f.type === 'checks') return `<fieldset>${L}${f.opciones.map(o => `<label class="chk"><input type="checkbox" name="${f.k}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}> ${o}</label>`).join('')}</fieldset>`;
  if (f.type === 'radios') return `<fieldset>${L}${radios(f.k, f.opciones, v)}</fieldset>`;
  if (f.type === 'matrix') return `<div class="scroll"><table><tr><th></th>${f.opciones.map(o => `<th>${o}</th>`).join('')}</tr>${f.filas.map((fl, i) =>
    `<tr><td>${fl}</td>${f.opciones.map(o => `<td><input type="radio" name="${f.k}|${i}" value="${esc(o)}" aria-label="${esc(fl)}: ${esc(o)}" ${v?.[i] === o ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</table></div>`;
  if (f.type === 'tabla') {
    const cell = (c, r) => c.opciones
      ? `<select name="${f.k}|${c.k}" aria-label="${esc(c.label)}"><option value=""></option>${c.opciones.map(o => `<option ${r[c.k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input name="${f.k}|${c.k}" value="${esc(r[c.k])}" aria-label="${esc(c.label)}">`;
    return `<div class="scroll"><table data-t="${f.k}"><thead><tr>${f.cols.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead><tbody>${(v?.length ? v : [{}]).map(r =>
      `<tr>${f.cols.map(c => `<td>${cell(c, r)}</td>`).join('')}<td><button type="button" class="sec" data-delrow aria-label="Quitar fila">✕</button></td></tr>`).join('')}</tbody></table></div>
      <button type="button" class="sec" data-addrow="${f.k}">Agregar docente</button>`;
  }
  if (f.type === 'stats') { // misma tabla que el documento: columnas "cursantes" y "recursantes"
    const r = v || {}, inp = (n, l) => `<input type="number" min="0" name="${f.k}|${n}" value="${esc(r[n])}" aria-label="${esc(l)}">`;
    const col = c => (c === 'c' ? 'cursantes' : 'recursantes');
    return `<div class="scroll"><table><tr><th>Cantidad de alumnos</th><th colspan="2">Total de cursantes (inscriptos 1.ª vez + recursantes)</th><th colspan="2">Total de recursantes</th></tr>
      <tr><td>Inscriptos totales / planilla de alumnado</td><td colspan="2">${inp('insc_c', 'Inscriptos totales, cursantes')}</td><td colspan="2">${inp('insc_r', 'Inscriptos totales, recursantes')}</td></tr>
      <tr><td>No cursaron (*)</td><td colspan="2">${inp('no_c', 'No cursaron, cursantes')}</td><td colspan="2">${inp('no_r', 'No cursaron, recursantes')}</td></tr>
      <tr><td><b>Total de cursantes</b></td><td data-tot="c"></td><td data-pct="tot_c"></td><td data-tot="r"></td><td data-pct="tot_r"></td></tr>
      ${f.filas.map(([n, l]) => `<tr><td>${l}</td>${['c', 'r'].map(c => `<td>${inp(n + '_' + c, l + ' (' + col(c) + ')')}</td><td data-pct="${n}_${c}"></td>`).join('')}</tr>`).join('')}</table></div>
      <p class="hint">(*) Deben contarse los alumnos que figuran en la planilla de alumnado y nunca asistieron a clase o que registraron su asistencia en las dos primeras semanas de clase solamente. El total de cursantes y los porcentajes se calculan solos.</p>`;
  }
  return `<label>${f.label}<input type="${f.type}" name="${f.k}" value="${esc(v)}"></label>`;
}

function draw(d, sigueSucio) {
  $('#form').innerHTML = FORM.secciones.map((s, i) => `<section id="s${i}"><h2>${s.titulo}</h2>${s.campos.map(f => field(f, d)).join('')}</section>`).join('');
  $('#nav').innerHTML = FORM.secciones.map((s, i) => `<a href="#s${i}" data-s="s${i}"><span>${s.titulo}</span></a>`).join('');
  dirty = !!sigueSucio;
  showCode();
  show('editor');
  spy?.disconnect();
  spy = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.s === e.target.id))), { rootMargin: '-25% 0px -65% 0px' });
  $$('#form section').forEach(s => spy.observe(s));
  refresh();
}

function showCode() {
  $('#codetxt').textContent = cur.codigo || 'Se genera al guardar';
  $('#codebox').classList.toggle('pending', !cur.codigo);
  $('#copy').hidden = !cur.codigo;
}

function refresh() { // secciones completadas, total de cursantes y porcentajes en vivo
  let hechas = 0;
  $$('#form section').forEach((s, i) => {
    const ok = [...s.querySelectorAll('input,textarea,select')].some(e => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value.trim()));
    s.classList.toggle('done', ok); $(`#nav a[data-s="s${i}"]`)?.classList.toggle('done', ok); hechas += ok;
  });
  $('#bar').style.width = (100 * hechas / FORM.secciones.length) + '%';
  const f = $('#form');
  if (!f.elements['res|insc_c']) return;
  const v = n => f.elements['res|' + n].value, tot = c => num(v('insc_' + c)) - num(v('no_' + c));
  $$('[data-tot]').forEach(e => { const c = e.dataset.tot; e.textContent = v('insc_' + c) === '' ? '–' : tot(c); });
  $$('[data-pct]').forEach(e => {
    const k = e.dataset.pct, c = k.slice(-1);
    e.textContent = k.startsWith('tot_') ? pct(v('insc_' + c) === '' ? '' : tot(c), v('insc_' + c)) : pct(v(k), tot(c));
  });
}

function collect() {
  const f = $('#form'), q = s => [...f.querySelectorAll(s)], d = {};
  for (const s of FORM.secciones) for (const x of s.campos) {
    const k = x.k;
    if (x.type === 'checks') d[k] = q(`[name="${k}"]:checked`).map(e => e.value);
    else if (x.type === 'radios') d[k] = f.querySelector(`[name="${k}"]:checked`)?.value ?? '';
    else if (x.type === 'matrix') d[k] = x.filas.map((_, i) => f.querySelector(`[name="${k}|${i}"]:checked`)?.value ?? '');
    else if (x.type === 'tabla') d[k] = q(`[data-t="${k}"] tbody tr`).map(tr => Object.fromEntries(x.cols.map(c => [c.k, tr.querySelector(`[name="${k}|${c.k}"]`).value])));
    else if (x.type === 'stats') d[k] = Object.fromEntries(q(`[name^="${k}|"]`).map(e => [e.name.split('|')[1], e.value]));
    else d[k] = f.elements[k].value;
  }
  return d;
}

/* ---------- Guardar ---------- */
async function save() {
  const datos = collect(), nueva = !cur.codigo;
  if (nueva) {
    const { data, error } = await sb.rpc('crear_informe', { p_datos: datos });
    if (error) { msg('No se pudo guardar: ' + error.message); return false; }
    cur.codigo = data;
  } else {
    const { data, error } = await sb.rpc('actualizar_informe', { p_codigo: cur.codigo, p_datos: datos });
    if (error || !data) { msg('No se pudo guardar' + (error ? ': ' + error.message : '. El informe ya no existe.')); return false; }
  }
  cur.datos = datos; dirty = false; showCode();
  msg(nueva ? `Guardado. El código de este informe es ${cur.codigo}` : 'Guardado');
  return true;
}

/* ---------- Descargas: el .docx sale de plantilla.docx; el PDF se imprime desde ese mismo .docx ---------- */
const fileName = ext => 'Informe_' + (cur.datos.asignatura || 'docente').trim().replace(/[^\wáéíóúñÁÉÍÓÚÑ-]+/g, '_') + '_' + cur.codigo + '.' + ext;

function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportDocx() {
  if (!await save()) return; // siempre se guarda primero: así el archivo lleva el código
  try { download(await buildDocx(cur.datos), fileName('docx')); } catch (e) { msg('No se pudo generar el documento: ' + e.message); }
}

async function exportPdf() {
  if (!await save()) return;
  try {
    const box = $('#print'); box.innerHTML = '';
    await docx.renderAsync(await buildDocx(cur.datos), box, null, { inWrapper: false, useBase64URL: true, ignoreLastRenderedPageBreak: true });
    await Promise.all([...box.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
    const t = document.title; document.title = fileName('pdf').replace(/\.pdf$/, ''); // nombre sugerido al guardar el PDF
    window.onafterprint = () => { document.title = t; box.innerHTML = ''; };
    window.print();
  } catch (e) { msg('No se pudo generar el PDF: ' + e.message); }
}

/* ---------- Administración (#k=CLAVE): lista de todos los informes, sin login ---------- */
// Sin contraseña: el enlace lleva una clave larga (#k=CLAVE). Sin ella la base no entrega la lista.
const ADMIN_KEY = decodeURIComponent((location.hash.match(/^#k=(.+)$/) || [])[1] || '');

function adminInit() { show('admin'); ADMIN_KEY ? adminList() : ($('#anokey').hidden = false); }

async function adminList() {
  show('admin'); admin = true;
  const { data, error } = await sb.rpc('admin_listar', { p_clave: ADMIN_KEY });
  if (error) { $('#alist').hidden = true; $('#anokey').hidden = false; return msg('La clave del enlace no es correcta.'); }
  $('#anokey').hidden = true; $('#alist').hidden = false;
  listaAdmin = data; renderAdmin();
}

function renderAdmin() {
  const q = $('#search').value.toLowerCase().trim();
  const filas = listaAdmin.filter(r => !q || [r.codigo, r.asignatura, r.ciclo, r.departamento].join(' ').toLowerCase().includes(q));
  $('#arows').innerHTML = filas.map(r => `<tr>
    <td><code>${esc(r.codigo)}</code></td><td>${esc(r.asignatura) || '(sin asignatura)'}</td><td>${esc(r.departamento)}</td><td>${esc(r.ciclo)}</td>
    <td>${new Date(r.updated_at).toLocaleDateString('es-AR')}</td>
    <td><button data-open="${esc(r.codigo)}">Abrir</button> <button data-del="${esc(r.codigo)}" class="sec danger">Eliminar</button></td></tr>`).join('')
    || `<tr><td colspan="6" class="empty">${listaAdmin.length ? 'Ningún informe coincide con la búsqueda.' : 'Todavía no hay informes cargados.'}</td></tr>`;
  $('#acount').textContent = `${filas.length} de ${listaAdmin.length} informes`;
}

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const a = e.target.closest('#nav a');
  if (a) { e.preventDefault(); return $(a.hash).scrollIntoView({ behavior: 'smooth' }); } // sin tocar el # de la URL (ahí vive #k=CLAVE)
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.open) abrir(b.dataset.open, true);
  else if (b.dataset.del) {
    if (!confirm(`¿Eliminar el informe ${b.dataset.del}? No se puede deshacer.`)) return;
    const { error } = await sb.rpc('admin_eliminar', { p_clave: ADMIN_KEY, p_codigo: b.dataset.del });
    error ? msg(error.message) : adminList();
  } else if (b.dataset.addrow) { const d = collect(); (d[b.dataset.addrow] ||= []).push({}); draw(d, true); }
  else if (b.hasAttribute('data-delrow')) { const t = b.closest('tbody'); if (t.rows.length > 1) { b.closest('tr').remove(); dirty = true; refresh(); } }
});
$('#form').addEventListener('input', () => { dirty = true; refresh(); });
$('#form').addEventListener('submit', e => e.preventDefault());
$('#new').onclick = nuevo;
$('#codeForm').addEventListener('submit', e => { e.preventDefault(); abrir($('#code').value, false); });
$('#back').onclick = () => { if (dirty && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return; admin ? adminList() : show('home'); };
$('#save').onclick = save;
$('#docx').onclick = exportDocx;
$('#pdf').onclick = exportPdf;
$('#copy').onclick = () => navigator.clipboard.writeText(cur.codigo).then(() => msg('Código copiado'), () => msg('Copialo a mano: ' + cur.codigo));
$('#search').addEventListener('input', renderAdmin);
$('#theme').onclick = () => { // claro por defecto; la elección se recuerda en este navegador
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.theme = t; } catch (e) {}
};
window.addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#k=')) location.reload(); });

location.hash.startsWith('#k=') ? adminInit() : show('home');
