/* ---------- FACOL: lógica común de los formularios públicos ---------- */
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/* Envío: a Supabase si config.js está lleno; si no, al "modo demostración" de la app abierta en esta misma PC. */
const Envio = (() => {
  const C = window.FACOL_FORMS || {};
  if (C.url && C.key) {
    const sb = supabase.createClient(C.url, C.key, {auth: {persistSession: false}});
    const chk = ({data, error}) => { if (error) throw new Error(error.message); return data; };
    return {
      modo: 'supabase',
      invitacion: async t => chk(await sb.rpc('alta_invitacion', {p_token: t})),
      subir: async (token, campo, blob, ext) => { const p = `formularios/${token}/${campo}_${Date.now()}.${ext}`; chk(await sb.storage.from('archivos').upload(p, blob, {contentType: blob.type})); return p; },
      alta: async (t, datos) => chk(await sb.rpc('enviar_alta', {p_token: t, p_datos: datos})),
      cambio: async datos => chk(await sb.rpc('enviar_cambio', {p_datos: datos})),
    };
  }
  const KEY = 'facol-demo-db'; const load = () => JSON.parse(localStorage.getItem(KEY) || '{}'); const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  const toDataUrl = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  return {
    modo: 'demo',
    invitacion: async t => { const i = (load().invitaciones || []).find(x => x.token === t && ['enviada', 'respondida'].includes(x.estado)); return i ? {nombre: i.nombre, estado: i.estado} : null; },
    subir: async (_t, _c, blob) => toDataUrl(blob),
    alta: async (t, datos) => { const d = load(); const i = (d.invitaciones || []).find(x => x.token === t); if (!i) throw new Error('La liga no es válida');
      Object.assign(i, {respuesta: datos, estado: 'respondida', respondida_at: new Date().toISOString()}); save(d); return true; },
    cambio: async datos => { const d = load(); d.cambios_cuenta = d.cambios_cuenta || [];
      d.cambios_cuenta.push({id: crypto.randomUUID(), estado: 'pendiente', created_at: new Date().toISOString(), ...datos,
        apellido_paterno: datos.apellido_paterno.toUpperCase(), apellido_materno: datos.apellido_materno.toUpperCase(), nombres: datos.nombres.toUpperCase(), banco: datos.banco.toUpperCase()}); save(d); return true; },
  };
})();

/** Dibuja un campo del cuestionario. */
function campoHtml(c, valor = '') {
  const req = c.req ? ' <span class="req">*</span>' : '';
  let input;
  if (c.t === 'select') input = `<select name="${c.k}"><option value="">— elige —</option>${c.o.map(o => `<option ${o === valor ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (c.t === 'textarea') input = `<textarea name="${c.k}" rows="3">${esc(valor)}</textarea>`;
  else if (c.t === 'firma') input = `<canvas class="sig" data-k="${c.k}"></canvas><div class="row"><button type="button" data-clear="${c.k}">Borrar firma</button><span class="legal">Firma como en tu INE.</span></div>`;
  else if (c.t === 'file') input = `<input type="file" name="${c.k}" accept="image/*,.pdf"><img class="prev" data-prev="${c.k}" hidden>`;
  else input = `<input name="${c.k}" type="${c.t === 'date' ? 'date' : c.t === 'email' ? 'email' : c.t === 'tel' ? 'tel' : 'text'}" ${['clabe', 'tel'].includes(c.t) || /cp|cuenta/.test(c.k) ? 'inputmode="numeric"' : ''} value="${esc(valor || c.def || '')}" ${c.up ? 'style="text-transform:uppercase"' : ''}>`;
  return `<div class="f" data-f="${c.k}"><label>${esc(c.l)}${req}</label>${input}<div class="msg"></div></div>`;
}

/** Pizarrón para la firma; devuelve {vacio(), blob()} por campo */
function firmas() {
  const out = {};
  $$('canvas.sig').forEach(cv => {
    const ctx = cv.getContext('2d'); let dib = false, usado = false;
    const fit = () => { const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0a1f44'; usado = false; };
    fit();
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => { dib = true; usado = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
    cv.onpointermove = e => { if (!dib) return; ctx.lineTo(...pos(e)); ctx.stroke(); };
    cv.onpointerup = cv.onpointercancel = () => { dib = false; };
    $(`[data-clear="${cv.dataset.k}"]`).onclick = fit;
    out[cv.dataset.k] = {vacio: () => !usado, blob: () => new Promise(r => cv.toBlob(r, 'image/png'))};
  });
  return out;
}

/** Reduce fotos grandes del celular antes de subirlas. */
async function comprimir(file, max = 1600) {
  if (!/^image\//.test(file.type) || file.size < 400000) return file;
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = img.width * k; cv.height = img.height * k;
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise(r => cv.toBlob(b => r(b || file), 'image/jpeg', 0.85));
}
function marcarErrores(errores) {
  $$('.f').forEach(f => { const e = errores[f.dataset.f]; f.classList.toggle('bad', !!e); $('.msg', f).textContent = e || ''; });
  const first = $('.f.bad'); if (first) first.scrollIntoView({behavior: 'smooth', block: 'center'});
}
