/* ---------- Cuestionario de alta (liga personal ?t=TOKEN) ---------- */
(async () => {
  const app = $('#app'); const token = new URLSearchParams(location.search).get('t') || '';
  $('#emp').textContent = (window.FACOL_FORMS || {}).empresa || '';
  const fin = (titulo, txt, ok) => { app.innerHTML = `<div class="card done"><h2 style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${esc(titulo)}</h2><p>${esc(txt)}</p></div>`; };
  let inv = null;
  try { inv = token ? await Envio.invitacion(token) : null; } catch (e) { return fin('No se pudo cargar', 'Revisa tu conexión a internet e intenta de nuevo.'); }
  if (!inv) return fin('Liga no válida', 'Esta liga no existe, ya fue utilizada o fue cancelada. Pide una nueva a tu asesor.');

  const secs = []; let cur = null;
  for (const c of Logica.CAMPOS_ALTA) { if (c.sec) { cur = {t: c.sec, cs: []}; secs.push(cur); } else cur.cs.push(c); }
  app.innerHTML = `<div class="card"><p style="margin:0">Hola${inv.nombre ? ' <b>' + esc(inv.nombre) + '</b>' : ''}. Llena tus datos tal como aparecen en tu INE. Los campos con <span style="color:var(--bad)">*</span> son obligatorios.</p></div>
    <form id="fm" novalidate>${secs.map(s => `<div class="card"><h2>${esc(s.t)}</h2>${s.cs.map(c => campoHtml(c)).join('')}</div>`).join('')}
    <div class="card"><label class="legal"><input type="checkbox" id="acepto" style="width:auto"> Bajo protesta de decir verdad, manifiesto que los datos que anteceden son ciertos y autorizo su uso para mi alta, contrato y pagos.</label>
      <div class="err" id="gErr"></div><button class="primary" id="env" type="submit">Enviar</button></div></form>`;
  const pads = firmas();
  const fm = $('#fm');
  // vista previa y validación en vivo
  $$('input[type=file]', fm).forEach(i => i.onchange = () => { const p = $(`[data-prev="${i.name}"]`); const f = i.files[0];
    if (f && /^image\//.test(f.type)) { p.src = URL.createObjectURL(f); p.hidden = false; } else p.hidden = true; });
  const clabe = $('[name=clabe]', fm); clabe.oninput = () => { const v = clabe.value.replace(/\D/g, ''); const f = clabe.closest('.f');
    if (v.length === 18) { const r = Logica.validarClabe(v, $('[name=banco]', fm).value); $('.msg', f).textContent = r.ok ? '' : r.motivo; $('.msg', f).className = r.ok ? 'ok msg' : 'msg';
      if (r.ok) $('.msg', f).textContent = '✓ CLABE válida' + (r.banco ? ' · ' + r.banco : '') + (r.aviso ? ' — ' + r.aviso : ''); } else { $('.msg', f).className = 'msg'; $('.msg', f).textContent = ''; } };
  const metodo = $('[name=metodo_dispersion]', fm);
  const banc = () => ['banco', 'numero_cuenta', 'clabe'].forEach(k => $(`[data-f="${k}"]`).style.display = metodo.value && metodo.value !== 'DEPOSITO BANCARIO' ? 'none' : '');
  metodo.onchange = banc;

  fm.onsubmit = async e => {
    e.preventDefault(); $('#gErr').textContent = '';
    const datos = {};
    for (const c of Logica.CAMPOS_ALTA) { if (!c.k || ['file', 'firma'].includes(c.t)) continue; let v = (fm.elements[c.k].value || '').trim(); if (c.up) v = v.toUpperCase(); if (['clabe', 'tel'].includes(c.t) || ['numero_cuenta', 'cp'].includes(c.k)) v = v.replace(/\s/g, ''); datos[c.k] = v; }
    const errores = Logica.validarAlta(datos);
    for (const c of Logica.CAMPOS_ALTA.filter(c => c.req && c.t === 'file')) if (!fm.elements[c.k].files.length) errores[c.k] = 'Sube la imagen';
    for (const [k, p] of Object.entries(pads)) if (p.vacio()) errores[k] = 'Dibuja tu firma';
    marcarErrores(errores);
    if (Object.keys(errores).length) { $('#gErr').textContent = 'Revisa los campos marcados en rojo.'; return; }
    if (!$('#acepto').checked) { $('#gErr').textContent = 'Debes aceptar la declaración para enviar.'; return; }
    const b = $('#env'); b.disabled = true; b.textContent = 'Enviando…';
    try {
      const arch = {};
      for (const c of Logica.CAMPOS_ALTA.filter(c => c.t === 'file')) { const f = fm.elements[c.k].files[0]; if (!f) continue; const blob = await comprimir(f);
        arch[c.k] = await Envio.subir(token, c.k, blob, /pdf/.test(f.type) ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'); }
      for (const [k, p] of Object.entries(pads)) arch[k] = await Envio.subir(token, k, await p.blob(), 'png');
      await Envio.alta(token, {...datos, _archivos: arch, _enviado: new Date().toISOString()});
      fin('¡Listo, recibimos tus datos!', 'Tu asesor revisará la información y te contactará para firmar tu contrato.', true);
      window.scrollTo(0, 0);
    } catch (err) { b.disabled = false; b.textContent = 'Enviar'; $('#gErr').textContent = 'No se pudo enviar: ' + err.message; }
  };
})();
