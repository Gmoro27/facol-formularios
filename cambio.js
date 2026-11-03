/* ---------- Formulario de cambio de cuenta ---------- */
(() => {
  const app = $('#app');
  const C = [
    {k: 'correo', l: 'Correo electrónico', t: 'email', req: 1},
    {k: 'apellido_paterno', l: 'Apellido paterno', req: 1, up: 1},
    {k: 'apellido_materno', l: 'Apellido materno', req: 1, up: 1},
    {k: 'nombres', l: 'Nombre(s)', req: 1, up: 1},
    {k: 'banco', l: 'Institución bancaria', t: 'select', req: 1, o: Logica.BANCOS_FORM},
    {k: 'cuenta', l: 'Número de cuenta', req: 1},
    {k: 'clabe', l: 'CLABE interbancaria (18 dígitos, sin espacios)', t: 'clabe', req: 1},
    {k: 'clabe2', l: 'Vuelve a escribir tu CLABE', t: 'clabe', req: 1},
  ];
  app.innerHTML = `<form id="fm" novalidate><div class="card">${C.map(c => campoHtml(c)).join('')}</div>
    <div class="card"><label class="legal"><input type="checkbox" id="acepto" style="width:auto"> Declaro que la información es verdadera, que la cuenta está a mi nombre y autorizo el uso de estos datos para realizar mis pagos.</label>
    <div class="err" id="gErr"></div><button class="primary" id="env" type="submit">Enviar solicitud</button></div></form>`;
  const fm = $('#fm');
  fm.onsubmit = async e => {
    e.preventDefault();
    const d = {}; C.forEach(c => { let v = fm.elements[c.k].value.trim(); if (c.up) v = v.toUpperCase(); if (c.t === 'clabe' || c.k === 'cuenta') v = v.replace(/\s/g, ''); d[c.k] = v; });
    const err = {};
    C.forEach(c => { if (c.req && !d[c.k]) err[c.k] = 'Obligatorio'; });
    if (d.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) err.correo = 'Correo no válido';
    if (d.cuenta && !/^\d{8,12}$/.test(d.cuenta)) err.cuenta = 'Solo números (8 a 12 dígitos)';
    if (d.clabe) { const r = Logica.validarClabe(d.clabe, d.banco); if (!r.ok) err.clabe = r.motivo; else if (r.aviso) err.banco = r.aviso; }
    if (d.clabe2 && d.clabe2 !== d.clabe) err.clabe2 = 'Las dos CLABE no coinciden';
    marcarErrores(err);
    if (Object.keys(err).length) return ($('#gErr').textContent = 'Revisa los campos marcados en rojo.');
    if (!$('#acepto').checked) return ($('#gErr').textContent = 'Debes aceptar la declaración.');
    const b = $('#env'); b.disabled = true; b.textContent = 'Enviando…';
    try { delete d.clabe2; await Envio.cambio(d);
      app.innerHTML = '<div class="card done"><h2>Solicitud recibida</h2><p>Revisaremos tu solicitud. El cambio se aplica hasta que lo confirmemos; mientras tanto tus pagos siguen a la cuenta anterior.</p></div>';
    } catch (er) { b.disabled = false; b.textContent = 'Enviar solicitud'; $('#gErr').textContent = 'No se pudo enviar: ' + er.message; }
  };
})();
