// Rellena plantilla.docx (el anexo original) con los datos del informe.
// No reconstruye el documento: edita su XML en el lugar, así se conservan logo, fuentes, tamaños,
// bordes, listas desplegables y viñetas exactamente como en el original.
const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const XMLNS = 'http://www.w3.org/XML/1998/namespace';
// Orden obligatorio de las propiedades dentro de <w:rPr> (Word puede rechazar el archivo si se altera).
const RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang'];

const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
// Porcentaje con 1 decimal y coma ("44,4%", "50%"); "–" si no se puede calcular.
const pct = (a, b) => (num(b) && String(a ?? '') !== '' ? (100 * num(a) / num(b)).toFixed(1).replace('.', ',').replace(',0', '') + '%' : '–');

async function buildDocx(d) {
  const zip = await JSZip.loadAsync(await (await fetch('plantilla.docx', { cache: 'no-cache' })).arrayBuffer());
  const parse = async f => {
    const x = new DOMParser().parseFromString(await zip.file(f).async('string'), 'application/xml');
    if (x.getElementsByTagName('parsererror').length) throw new Error('No se pudo leer ' + f);
    return x;
  };
  const doc = await parse('word/document.xml'), numb = await parse('word/numbering.xml');
  fill(doc, numb, d);
  const ser = x => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(x).replace(/^<\?xml[^>]*\?>\s*/, '');
  zip.file('word/document.xml', ser(doc), { createFolders: false });
  zip.file('word/numbering.xml', ser(numb), { createFolders: false });
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function fill(doc, numb, d) {
  const mk = (dc, n, attrs = {}) => { const e = dc.createElementNS(NS, 'w:' + n); for (const k in attrs) e.setAttributeNS(NS, 'w:' + k, attrs[k]); return e; };
  const el = (n, a) => mk(doc, n, a);
  const kids = (e, n) => [...e.children].filter(c => c.localName === n);
  const deep = (e, n) => [...e.getElementsByTagNameNS(NS, n)];
  const text = e => deep(e, 't').map(t => t.textContent).join('');
  const body = deep(doc, 'body')[0], paras = kids(body, 'p'), tbls = kids(body, 'tbl');
  const find = s => paras.find(p => text(p).replace(/\s+/g, ' ').trim().startsWith(s));
  const next = p => paras[paras.indexOf(p) + 1];
  const opts = k => FORMS.informe_docente.secciones.flatMap(s => s.campos).find(c => c.k === k).opciones;

  // --- propiedades de run ---
  const addProp = (rPr, n, attrs) => {
    const dc = rPr.ownerDocument, e = mk(dc, n, attrs), i = RPR_ORDER.indexOf(n);
    rPr.insertBefore(e, [...rPr.children].find(c => RPR_ORDER.indexOf(c.localName) > i) ?? null);
    return rPr;
  };
  const strip = r => { if (r) ['b', 'bCs', 'i', 'iCs'].forEach(n => kids(r, n).forEach(x => x.remove())); return r; }; // las respuestas no van en negrita/cursiva
  const rprOf = p => {
    const run = deep(p, 'r')[0], fromRun = run && kids(run, 'rPr')[0], ppr = kids(p, 'pPr')[0], fromMark = ppr && kids(ppr, 'rPr')[0];
    return (fromRun || fromMark)?.cloneNode(true);
  };
  const runs = (txt, rPr) => String(txt).split('\n').map((line, i) => {
    const r = el('r'); if (rPr) r.append(rPr.cloneNode(true)); if (i) r.append(el('br'));
    const t = el('t'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = line; r.append(t); return r;
  });

  // --- párrafos y celdas ---
  const jc = (p, v) => {
    const ppr = kids(p, 'pPr')[0] ?? p.insertBefore(el('pPr'), p.firstChild);
    let j = kids(ppr, 'jc')[0];
    if (!j) { j = el('jc'); const rp = kids(ppr, 'rPr')[0]; rp ? ppr.insertBefore(j, rp) : ppr.append(j); }
    j.setAttributeNS(NS, 'w:val', v);
  };
  const wipe = p => [...p.children].forEach(c => c.localName !== 'pPr' && c.remove());
  const fillPara = (p, txt) => { if (!p || !txt) return; const rp = strip(rprOf(p)); wipe(p); p.append(...runs(txt, rp)); };
  const setCell = (tc, v, center) => { // vacío = se deja el campo tal cual está en el formulario
    v = String(v ?? ''); if (v === '') return;
    const [p, ...rest] = kids(tc, 'p'); rest.forEach(x => x.remove());
    const rp = strip(rprOf(p)); wipe(p); if (center) jc(p, 'center'); p.append(...runs(v, rp));
  };
  const cells = tr => kids(tr, 'tc');
  const rowsOf = t => kids(t, 'tr');

  // --- Encabezado: fecha y datos generales (tabla 0) ---
  const pf = find('FECHA');
  if (d.fecha && pf) {
    const rs = kids(pf, 'r'), rp = kids(rs[1], 'rPr')[0];
    rs.slice(1).forEach(x => x.remove());
    pf.append(...runs(d.fecha.split('-').reverse().join('/'), rp));
  }
  const t0 = rowsOf(tbls[0]);
  [d.departamento, d.asignatura, d.plan].forEach((v, i) => setCell(cells(t0[i])[1], v));

  // --- 1) Plantel docente (tabla 1): se clona la fila modelo por cada persona ---
  const clean = e => [e, ...e.querySelectorAll('*')].forEach(x => { x.removeAttributeNS(W14, 'paraId'); x.removeAttributeNS(W14, 'textId'); });
  const fillRow = (tr, r) => {
    const tc = cells(tr); setCell(tc[0], r.nombre); setCell(tc[1], r.dni);
    ['categoria', 'dedicacion', 'revista'].forEach((k, i) => { const t = deep(tc[2 + i], 't')[0]; if (t) t.textContent = r[k] || ''; }); // listas desplegables del original
  };
  const tpl = rowsOf(tbls[1])[1], pers = (d.plantel || []).filter(r => Object.values(r).some(Boolean));
  if (pers.length) {
    pers.forEach(r => {
      const c = tpl.cloneNode(true); clean(c);
      deep(c, 'sdtPr').forEach(s => kids(s, 'id')[0]?.setAttributeNS(NS, 'w:val', String(Math.floor(Math.random() * 2e9)))); // ids únicos
      fillRow(c, r); tpl.before(c);
    });
    tpl.remove();
  } else fillRow(tpl, {});

  // --- 2) Resultados del cursado (tabla 2) ---
  const R = d.res || {}, rr = rowsOf(tbls[2]), tot = c => num(R['insc_' + c]) - num(R['no_' + c]);
  ['c', 'r'].forEach((c, k) => {
    setCell(cells(rr[1])[1 + k], R['insc_' + c], true);
    setCell(cells(rr[2])[1 + k], R['no_' + c], true);
    const t = tot(c);
    if (String(R['insc_' + c] ?? '') !== '') { setCell(cells(rr[3])[1 + 2 * k], t, true); setCell(cells(rr[3])[2 + 2 * k], pct(t, R['insc_' + c]), true); }
    ['regu', 'prom', 'libr', 'aban'].forEach((n, i) => {
      const v = R[n + '_' + c]; setCell(cells(rr[4 + i])[1 + 2 * k], v, true);
      if (String(v ?? '') !== '' && t) setCell(cells(rr[4 + i])[2 + 2 * k], pct(v, t), true);
    });
  });

  // --- Listas con viñeta "o": las opciones tildadas pasan a "X" (lista clonada con otro símbolo) ---
  const lists = { 5: [], 6: [], 7: [] };
  paras.forEach(p => { const n = deep(p, 'numId')[0]?.getAttributeNS(NS, 'val'); if (lists[n]) lists[n].push(p); });
  const marked = {};
  const tickedList = orig => {
    orig = String(orig); // los atributos XML son texto: '5', no 5
    if (marked[orig]) return marked[orig];
    const nid = String(900 + Object.keys(marked).length), root = numb.documentElement, ch = n => kids(root, n);
    const numEl = ch('num').find(x => x.getAttributeNS(NS, 'numId') === orig);
    const absId = kids(numEl, 'abstractNumId')[0].getAttributeNS(NS, 'val');
    const abs = ch('abstractNum').find(x => x.getAttributeNS(NS, 'abstractNumId') === absId).cloneNode(true);
    abs.setAttributeNS(NS, 'w:abstractNumId', nid);
    ['nsid', 'tmpl'].forEach(n => kids(abs, n).forEach(x => x.remove()));
    const lvl = kids(abs, 'lvl').find(l => l.getAttributeNS(NS, 'ilvl') === '0');
    kids(lvl, 'lvlText')[0].setAttributeNS(NS, 'w:val', 'X');
    addProp(kids(lvl, 'rPr')[0], 'b');
    root.insertBefore(abs, ch('num')[0]);
    const n = mk(numb, 'num', { numId: nid }); n.append(mk(numb, 'abstractNumId', { val: nid }));
    ch('num').at(-1).after(n);
    return (marked[orig] = nid);
  };
  const tick = (orig, i) => deep(lists[orig][i], 'numId')[0].setAttributeNS(NS, 'w:val', tickedList(orig));
  const tickAll = (orig, key) => (d[key] || []).forEach(o => { const i = opts(key).indexOf(o); if (i >= 0) tick(orig, i); });
  const tickOtras = (orig, i, label, txt) => { // última opción libre: "Otras: <texto>"
    if (!txt) return; tick(orig, i);
    const p = lists[orig][i], rp = kids(kids(p, 'r')[0], 'rPr')[0]; wipe(p); p.append(...runs(label + ': ' + txt, rp));
  };
  tickAll(5, 'rendimiento'); tickOtras(5, 9, 'Otras', d.rendimiento_otras);
  tickAll(6, 'fortalezas'); tickOtras(6, 7, 'Otras', d.fortalezas_otras);
  tickAll(7, 'herramientas'); tickOtras(7, 5, 'Otras', d.herramientas_otras);

  // --- 4) Carga horaria (tabla 3): X en Si / No; "-" en ambas si no corresponde ---
  const r3 = rowsOf(tbls[3]);
  (d.carga || []).forEach((a, i) => {
    const tc = cells(r3[i + 1]);
    if (a === 'Sí') setCell(tc[1], 'X', true);
    else if (a === 'No') setCell(tc[2], 'X', true);
    else if (a === 'No corresponde') { setCell(tc[1], '-', true); setCell(tc[2], '-', true); }
  });

  // --- 5) Dificultades (tabla 4) ---
  const r4 = rowsOf(tbls[4]);
  (d.dificultades || []).forEach((a, i) => { const k = ['Ninguno', 'Regular', 'Significativo'].indexOf(a); if (k >= 0) setCell(cells(r4[i + 2])[1 + k], 'X', true); });
  const pi = find('(*) Indique');
  if (d.dificultades_otras && pi) {
    const rp = strip(rprOf(pi)), t = deep(pi, 't').find(x => x.textContent.includes('(*) Indique'));
    t.textContent = '(*) Indique el tipo de dificultad: '; t.setAttributeNS(XMLNS, 'xml:space', 'preserve');
    t.parentNode.after(...runs(d.dificultades_otras, rp));
    deep(next(pi), 't').forEach(x => (x.textContent = '')); // se quita la segunda línea punteada
  }
  fillPara(next(find('Describa')), d.estrategias);

  // --- 8) Modificaciones: se resalta Si o No con negrita y subrayado ---
  const pc = find('¿Se realizaron cambios');
  if (d.hubo_cambios && pc) {
    const r = kids(pc, 'r')[0], rp = kids(r, 'rPr')[0], t = text(r), i = t.indexOf('Si - No');
    if (i >= 0) {
      const hi = on => (on ? addProp(addProp(rp.cloneNode(true), 'b'), 'u', { val: 'single' }) : rp);
      r.replaceWith(...[[t.slice(0, i), 0], ['Si', d.hubo_cambios === 'Sí'], [' - ', 0], ['No', d.hubo_cambios === 'No'], [t.slice(i + 7), 0]].flatMap(([s, on]) => runs(s, hi(on))));
    }
  }
  fillPara(next(find('Si la respuesta')), d.cambios);

  // --- 9) Otras actividades: la respuesta va en un párrafo nuevo debajo de cada ítem ---
  const after = (key, txt) => {
    const p = find(key); if (!p || !txt) return;
    const np = el('p'), ppr = kids(p, 'pPr')[0];
    if (ppr) np.append(ppr.cloneNode(true));
    np.append(...runs(txt, strip(rprOf(p)))); p.after(np);
  };
  after('- Colaboración', d.colaboracion);
  after('-Participación', d.extension);
  fillPara(next(find('7) Otros aspectos')), d.otros);

  const pfirma = find('Firma del Docente');
  if (d.firma && pfirma) { const rs = kids(pfirma, 'r'); pfirma.append(...runs(' ' + d.firma, strip(kids(rs.at(-1), 'rPr')[0]?.cloneNode(true)))); }
}
