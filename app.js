const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const FORM = FORMS.informe_docente;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const num = v => parseFloat(v) || 0;
const pct = (a, b) => (num(b) && String(a ?? '') !== '' ?(100 * num(a) / num(b)).toFixed(1) + '%' : '–');
let cur = { id: null, estado: 'borrador', datos: {} }; // informe abierto

const show = v => ['list', 'editor'].forEach(x => $('#' + x).hidden = x !== v);
const $$ = s => [...document.querySelectorAll(s)];
let spy; // observador que marca en el menú lateral la sección visible
const msg = t => { const m = $('#msg'); m.textContent = t; m.classList.add('show'); clearTimeout(msg.t); msg.t = setTimeout(() => m.classList.remove('show'), 4000); };
const setEstado = () => { $('#estado').textContent = cur.estado; $('#estado').dataset.e = cur.estado; };

/* ---------- Sesión ---------- */
// Sin login: acceso abierto. Todos los informes son visibles y editables por cualquiera con el link (decisión del cliente).
loadList();

/* ---------- Listado ---------- */
async function loadList() {
  show('list');
  const { data, error } = await sb.from('informes').select('id,estado,ciclo,asignatura,updated_at')
    .eq('tipo', FORM.tipo).order('updated_at', { ascending: false });
  if (error) return msg(error.message);
  $('#rows').innerHTML = data.map(r => `<tr>
    <td>${esc(r.asignatura) || '(sin asignatura)'}</td><td>${esc(r.ciclo)}</td><td><span class="badge ${r.estado}">${r.estado}</span></td>
    <td>${new Date(r.updated_at).toLocaleDateString('es-AR')}</td>
    <td><button data-open="${r.id}">Abrir</button> <button data-del="${r.id}" class="sec danger">Eliminar</button></td></tr>`).join('')
    || '<tr><td colspan="5" class="empty">Todavía no hay informes. Tocá «Nuevo informe» para empezar.</td></tr>';
}
async function openInforme(id) {
  if (id) {
    const { data, error } = await sb.from('informes').select('*').eq('id', id).single();
    if (error) return msg(error.message);
    cur = data;
  } else cur = { id: null, estado: 'borrador', datos: {} };
  draw(cur.datos);
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
  if (f.type === 'tabla') return `<div class="scroll"><table data-t="${f.k}"><thead><tr>${f.cols.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead><tbody>${(v?.length ? v : [{}]).map(r =>
    `<tr>${f.cols.map(c => `<td><input name="${f.k}|${c.k}" value="${esc(r[c.k])}" aria-label="${esc(c.label)}"></td>`).join('')}<td><button type="button" class="sec" data-delrow>✕</button></td></tr>`).join('')}</tbody></table></div>
    <button type="button" class="sec" data-addrow="${f.k}">+ Agregar fila</button>`;
  if (f.type === 'stats') {
    const r = v || {}, i = (n, l) => `<label>${l}<input type="number" min="0" name="${f.k}|${n}" value="${esc(r[n])}"></label>`;
    return `<div class="grid">${i('insc', 'Inscriptos totales (planilla de alumnado)')}${i('no', 'No cursaron (*)')}${i('rec', 'Total de recursantes')}</div>
      <p class="hint">(*) Alumnos de la planilla que nunca asistieron o que solo registraron asistencia en las dos primeras semanas.</p>
      <p><b>Total de cursantes (inscriptos − no cursaron):</b> <output id="cur"></output></p>
      <div class="scroll"><table><tr><th></th><th colspan="2">Cursantes</th><th colspan="2">Recursantes</th></tr>${f.filas.map(([n, l]) =>
      `<tr><td>${l}</td>${['c', 'r'].map(c => `<td><input type="number" min="0" name="${f.k}|${n}_${c}" value="${esc(r[n + '_' + c])}" aria-label="${esc(l)} ${c === 'c' ? 'cursantes' : 'recursantes'}"></td><td data-pct="${n}_${c}"></td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  return `<label>${f.label}<input type="${f.type}" name="${f.k}" value="${esc(v)}"></label>`;
}

function draw(d) {
  $('#form').innerHTML = FORM.secciones.map((s, i) => `<section id="s${i}"><h2>${s.titulo}</h2>${s.campos.map(f => field(f, d)).join('')}</section>`).join('');
  $('#nav').innerHTML = FORM.secciones.map((s, i) => `<a href="#s${i}" data-s="s${i}"><span>${s.titulo}</span></a>`).join('');
  setEstado();
  show('editor');
  scrollTo(0, 0);
  spy?.disconnect();
  spy = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.s === e.target.id))), { rootMargin: '-25% 0px -65% 0px' });
  $$('#form section').forEach(s => spy.observe(s));
  refresh();
}

function refresh() { // secciones completadas, porcentajes y total de cursantes en vivo
  let hechas = 0;
  $$('#form section').forEach((s, i) => {
    const ok = [...s.querySelectorAll('input,textarea')].some(e => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value.trim()));
    s.classList.toggle('done', ok); $(`#nav a[data-s="s${i}"]`)?.classList.toggle('done', ok); hechas += ok;
  });
  $('#bar').style.width = (100 * hechas / FORM.secciones.length) + '%';
  const f = $('#form'), v = n => f.elements['res|' + n]?.value, cursantes = num(v('insc')) - num(v('no'));
  if (!$('#cur')) return;
  $('#cur').textContent = cursantes;
  f.querySelectorAll('[data-pct]').forEach(e => { const k = e.dataset.pct; e.textContent = pct(v(k), k.endsWith('_c') ? cursantes : v('rec')); });
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

async function save(estado) {
  const datos = collect();
  const row = { tipo: FORM.tipo, estado: estado || cur.estado, datos, updated_at: new Date().toISOString(),
    ...Object.fromEntries(FORM.indexar.map(k => [k, datos[k] || null])) };
  const { data, error } = await (cur.id ? sb.from('informes').update(row).eq('id', cur.id) : sb.from('informes').insert(row)).select().single();
  if (error) { msg(error.message); return false; }
  cur = data; setEstado(); msg('Guardado');
  return true;
}

/* ---------- Exportar: formulario → bloques neutros → .docx / HTML(PDF) ---------- */
function blocks(d) {
  const B = [{ t: 'title', text: FORM.titulo }], T = (head, rows) => B.push({ t: 'table', rows: [head, ...rows] });
  for (const s of FORM.secciones) {
    B.push({ t: 'h', text: s.titulo });
    for (const x of s.campos) {
      const v = d[x.k];
      if (x.type === 'checks') T(['Opción', 'Marcado'], x.opciones.map(o => [o, v?.includes(o) ? '☒' : '☐']));
      else if (x.type === 'matrix') T(['', ...x.opciones], x.filas.map((fl, i) => [fl, ...x.opciones.map(o => (v?.[i] === o ? 'X' : ''))]));
      else if (x.type === 'tabla') T(x.cols.map(c => c.label), (v || []).map(r => x.cols.map(c => r[c.k] || '')));
      else if (x.type === 'stats') {
        const r = v || {}, cur = num(r.insc) - num(r.no);
        T(['Concepto', 'Cantidad'], [['Inscriptos totales (planilla de alumnado)', r.insc || ''], ['No cursaron', r.no || ''], ['Total de cursantes', cur], ['Total de recursantes', r.rec || '']]);
        T(['', 'Cursantes', '%', 'Recursantes', '%'], x.filas.map(([n, l]) => [l, r[n + '_c'] || '', pct(r[n + '_c'], cur), r[n + '_r'] || '', pct(r[n + '_r'], r.rec)]));
      } else B.push({ t: 'p', label: x.label, text: v || '' });
    }
  }
  B.push({ t: 'p', text: '\n\n\n______________________________\nFirma del Docente Responsable' }, { t: 'p', text: FORM.pie });
  return B;
}

function toHtml(B) {
  return B.map(b => b.t === 'title' ? `<h1>${esc(b.text)}</h1>` : b.t === 'h' ? `<h2>${esc(b.text)}</h2>`
    : b.t === 'p' ? `<p>${b.label ? `<b>${esc(b.label)}:</b> ` : ''}${esc(b.text).replace(/\n/g, '<br>')}</p>`
    : `<table>${b.rows.map((r, i) => `<tr>${r.map(c => `<${i ? 'td' : 'th'}>${esc(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`).join('');
}

function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click(); URL.revokeObjectURL(a.href);
}

async function exportDocx() {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } = docx;
  const runs = (t, o = {}) => String(t).split('\n').map((l, i) => new TextRun({ text: l, break: i ? 1 : 0, ...o }));
  const kids = blocks(collect()).flatMap(b => b.t === 'title' ? [new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: runs(b.text) })]
    : b.t === 'h' ? [new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240 }, children: runs(b.text) })]
    : b.t === 'p' ? [new Paragraph({ children: [...(b.label ? runs(b.label + ': ', { bold: true }) : []), ...runs(b.text)] })]
    : [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: b.rows.map((r, i) => new TableRow({ tableHeader: !i,
        children: r.map(c => new TableCell({ children: [new Paragraph({ children: runs(c, { bold: !i, size: 18 }) })] })) })) }), new Paragraph('')]);
  download(await Packer.toBlob(new Document({ sections: [{ children: kids }] })), fileName() + '.docx');
}

// PDF: se abre el diálogo de impresión del navegador → "Guardar como PDF" (sin librerías extra).
function exportPdf() { $('#print').innerHTML = toHtml(blocks(collect())); window.print(); }
const fileName = () => 'informe_' + (collect().asignatura || 'docente').replace(/[^\w\-áéíóúñ]+/gi, '_');

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.open) openInforme(b.dataset.open);
  else if (b.dataset.del) { if (confirm('¿Eliminar este informe? No se puede deshacer.')) { const { error } = await sb.from('informes').delete().eq('id', b.dataset.del); error ? msg(error.message) : loadList(); } }
  else if (b.dataset.addrow) { const d = collect(); (d[b.dataset.addrow] ||= []).push({}); draw(d); }
  else if (b.hasAttribute('data-delrow')) { const t = b.closest('tbody'); if (t.rows.length > 1) b.closest('tr').remove(); refresh(); }
});
$('#form').addEventListener('input', refresh);
$('#form').addEventListener('submit', e => e.preventDefault()); // Enter dentro de un campo no debe recargar
$('#new').onclick = () => openInforme();
$('#back').onclick = loadList;
$('#save').onclick = () => save();
$('#send').onclick = async () => { if (confirm('¿Marcar como enviado? Podrás seguir editándolo y descargándolo.') && await save('enviado')) loadList(); };
$('#theme').onclick = () => { // claro por defecto; la elección se recuerda en este navegador
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.theme = t; } catch (e) {}
};
$('#docx').onclick = exportDocx;
$('#pdf').onclick = exportPdf;
