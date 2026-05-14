// ---- State ----
let state = { config: { precios_simulacion: [] }, lotes_millas: [], tickets: [] };
let filtroActivo = "todos";

// ---- Init ----
document.addEventListener("DOMContentLoaded", async () => {
  await cargarDatos();
  iniciarNav();
  renderAll();
});

async function cargarDatos() {
  const res = await fetch("/api/data");
  state = await res.json();
}

function renderAll() {
  renderHeader();
  renderDashboard();
  renderMillas();
  renderTickets();
  renderConfig();
}

function renderHeader() {
  const { disponibles, precioPromedio } = calcularTotalesMillas();
  const el = document.getElementById("header-stats");
  if (!el) return;
  el.innerHTML = precioPromedio > 0
    ? `<strong>${fmtNum(disponibles)}</strong> millas · precio promedio <strong>$ ${precioPromedio.toFixed(2)}</strong>`
    : "";
}

// ---- Navegación ----
function iniciarNav() {
  document.querySelectorAll("[data-section]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const sec = link.dataset.section;
      document.querySelectorAll("[data-section]").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
      document.getElementById(`section-${sec}`).classList.add("active");
    });
  });

  document.querySelectorAll('input[name="tipo_canje"]').forEach(radio => {
    radio.addEventListener("change", () => {
      document.getElementById("campo-pesos-canje").style.display =
        radio.value === "millas_pesos" ? "" : "none";
    });
  });

  document.querySelectorAll(".filtro").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtroActivo = btn.dataset.filtro;
      renderTickets();
    });
  });
}

// ---- Helpers de cálculo ----
function calcularTotalesMillas() {
  const totalCompradas = state.lotes_millas.reduce((s, l) => s + l.cantidad, 0);
  const totalCanceladas = state.tickets
    .filter(t => t.estado === "emitido")
    .reduce((s, t) => s + (t.millas_canceladas || 0), 0);
  const precioPromedio = calcularPrecioPromedio();
  return { totalCompradas, totalCanceladas, disponibles: totalCompradas - totalCanceladas, precioPromedio };
}

function calcularPrecioPromedio() {
  const total = state.lotes_millas.reduce((s, l) => s + l.cantidad, 0);
  if (total === 0) return 0;
  const ponderado = state.lotes_millas.reduce((s, l) => s + l.cantidad * l.precio_por_milla, 0);
  return ponderado / total;
}

function normalizarTicket(t) {
  // backward compat: old model usaba viaje_facil:bool sin tipo_canje
  // estado intermedio usaba tipo_canje:"viaje_facil" (incorrecto)
  let tipo = t.tipo_canje || "normal";
  let vf = !!t.viaje_facil;
  if (tipo === "viaje_facil") { tipo = "normal"; vf = true; }
  return { ...t, tipo_canje: tipo, viaje_facil: vf };
}

function millasTicket(ticket) {
  const millasTasas = ticket.tasas.filter(t => t.moneda === "millas").reduce((s, t) => s + t.monto, 0);
  return ticket.millas_vuelo + millasTasas;
}

function tasasARS(ticket) {
  return ticket.tasas.filter(t => t.moneda === "ARS").reduce((s, t) => s + t.monto, 0);
}

function fechaLimiteVF(ticket) {
  const d = new Date(ticket.fecha_vuelo + "T00:00:00");
  d.setDate(d.getDate() - 60);
  return d;
}

function diasHastaFecha(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fecha - hoy) / 86400000);
}

function ars(n) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

function fmtNum(n) {
  return n.toLocaleString("es-AR");
}

function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ---- Dashboard ----
function renderDashboard() {
  const { totalCompradas, totalCanceladas, disponibles, precioPromedio } = calcularTotalesMillas();

  const ticketsEmitidos = state.tickets.filter(t => t.estado === "emitido" && normalizarTicket(t).viaje_facil);
  const millasPendientes = ticketsEmitidos.reduce((s, t) => {
    const total = millasTicket(t);
    return s + (total - (t.millas_canceladas || 0));
  }, 0);

  document.getElementById("dashboard-stats").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Millas disponibles</div>
      <div class="stat-value">${fmtNum(disponibles)}</div>
      <div class="stat-sub">de ${fmtNum(totalCompradas)} compradas</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Precio promedio</div>
      <div class="stat-value">$ ${precioPromedio.toFixed(2)}</div>
      <div class="stat-sub">ARS por milla</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Millas canceladas</div>
      <div class="stat-value">${fmtNum(totalCanceladas)}</div>
      <div class="stat-sub">en tickets emitidos</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pendiente VF</div>
      <div class="stat-value">${fmtNum(millasPendientes)}</div>
      <div class="stat-sub">millas por cancelar</div>
    </div>
  `;

  // Alertas Viaje Fácil
  const alertasEl = document.getElementById("dashboard-alertas");
  if (ticketsEmitidos.length === 0) {
    alertasEl.innerHTML = "";
  } else {
    const ordenados = [...ticketsEmitidos].sort((a, b) => {
      return fechaLimiteVF(a) - fechaLimiteVF(b);
    });
    alertasEl.innerHTML = `<div class="dash-section-label">Viaje Fácil — tickets emitidos</div>` +
      ordenados.map(t => {
        const limite = fechaLimiteVF(t);
        const dias = diasHastaFecha(limite);
        const totalMillas = millasTicket(t);
        const restantes = totalMillas - (t.millas_canceladas || 0);
        const clase = dias < 30 ? "" : dias < 60 ? "amarilla" : "ok";
        const urgencia = dias < 30
          ? `<span class="urgencia-roja">⚠ ${dias} días para el límite</span>`
          : dias < 60
            ? `<span class="urgencia-amarilla">⚡ ${dias} días para el límite</span>`
            : `<span class="urgencia-ok">${dias} días para el límite</span>`;
        return `
          <div class="alerta-card ${clase}">
            <strong>${t.origen} → ${t.destino}</strong> · ${t.aerolinea} · ${fmtFecha(t.fecha_vuelo)}<br>
            ${urgencia} · Fecha límite: ${fmtFecha(limite.toISOString().split("T")[0])}<br>
            Millas restantes: <strong>${fmtNum(restantes)}</strong> de ${fmtNum(totalMillas)}
          </div>`;
      }).join("");
  }

  // Tabla rápida de evaluando
  const evaluando = state.tickets.filter(t => t.estado === "evaluando");
  const evalEl = document.getElementById("dashboard-evaluando");
  if (evaluando.length === 0) {
    evalEl.innerHTML = "";
    return;
  }
  const pp = precioPromedio || state.config.precios_simulacion[0] || 0;
  evalEl.innerHTML = `
    <div class="dash-section-label">Tickets en evaluación</div>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Ruta</th><th>Aerolínea</th><th>Fecha</th>
          <th class="num">Millas</th>
          <th class="num">Costo millas<br><span style="font-weight:400;text-transform:none;letter-spacing:0">a $ ${pp.toFixed(2)}</span></th>
          <th class="num">Tasas</th>
          <th class="num">Pesos canje</th>
          <th class="num">Total ARS</th>
        </tr></thead>
        <tbody>
          ${evaluando.map(t => {
            const nt = normalizarTicket(t);
            const tm = millasTicket(t);
            const costoMillas = tm * pp;
            const tasa = tasasARS(t);
            const pesos = nt.tipo_canje === "millas_pesos" ? (t.pesos_canje || 0) : 0;
            const total = costoMillas + tasa + pesos;
            return `<tr>
              <td>${t.origen} → ${t.destino}</td>
              <td>${t.aerolinea}</td>
              <td>${fmtFecha(t.fecha_vuelo)}</td>
              <td class="num">${fmtNum(tm)}</td>
              <td class="num">${ars(costoMillas)}</td>
              <td class="num">${tasa > 0 ? ars(tasa) : "—"}</td>
              <td class="num">${pesos > 0 ? ars(pesos) : "—"}</td>
              <td class="num"><strong>${ars(total)}</strong></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// ---- Mis Millas ----
function renderMillas() {
  const tbody = document.getElementById("millas-body");
  const tfoot = document.getElementById("millas-foot");

  if (state.lotes_millas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:20px">Sin lotes registrados</td></tr>`;
    tfoot.innerHTML = "";
    return;
  }

  tbody.innerHTML = state.lotes_millas.map(l => `
    <tr>
      <td>${fmtFecha(l.fecha)}</td>
      <td class="num">${fmtNum(l.cantidad)}</td>
      <td class="num">$ ${Number(l.precio_por_milla).toFixed(2)}</td>
      <td class="num">${ars(l.cantidad * l.precio_por_milla)}</td>
      <td>${l.notas || ""}</td>
      <td>
        <button class="btn-sm" onclick='abrirModalLote(${JSON.stringify(l)})'>Editar</button>
        <button class="btn-sm danger" onclick="eliminarLote('${l.id}')">Eliminar</button>
      </td>
    </tr>`).join("");

  const totalCant = state.lotes_millas.reduce((s, l) => s + l.cantidad, 0);
  const totalCosto = state.lotes_millas.reduce((s, l) => s + l.cantidad * l.precio_por_milla, 0);
  const pp = calcularPrecioPromedio();
  tfoot.innerHTML = `
    <tr>
      <td>Totales</td>
      <td class="num">${fmtNum(totalCant)}</td>
      <td class="num">$ ${pp.toFixed(2)} <small>(promedio)</small></td>
      <td class="num">${ars(totalCosto)}</td>
      <td colspan="2"></td>
    </tr>`;
}

// ---- Tickets ----
function renderTickets() {
  const lista = document.getElementById("tickets-lista");
  let tickets = state.tickets;
  if (filtroActivo !== "todos") tickets = tickets.filter(t => t.estado === filtroActivo);

  if (tickets.length === 0) {
    lista.innerHTML = `<p style="color:#9ca3af">Sin tickets para mostrar.</p>`;
    return;
  }

  lista.innerHTML = tickets.map(t => renderTicketCard(t)).join("");
}

function renderTicketCard(ticket) {
  const tm = millasTicket(ticket);
  const arsTotal = tasasARS(ticket);
  const resumenTasas = ticket.tasas.length
    ? ticket.tasas.map(t => `${fmtNum(t.monto)} ${t.moneda}`).join(" + ")
    : "Sin tasas";
  const badgeClass = `badge-${ticket.estado}`;
  const labels = { evaluando: "Evaluando", emitido: "Emitido", descartado: "Descartado" };
  const nt = normalizarTicket(ticket);
  const tipoBadge = [
    nt.tipo_canje === "millas_pesos" ? `<span class="badge" style="background:#fef3c7;color:#b45309">Millas + Pesos</span>` : "",
    nt.viaje_facil ? `<span class="badge" style="background:#ede9fe;color:#7c3aed">Viaje Fácil</span>` : "",
  ].join("");

  return `
    <div class="ticket-card" id="card-${ticket.id}">
      <div class="ticket-header" onclick="toggleDetalle('${ticket.id}')">
        <div class="ticket-ruta">${ticket.origen} → ${ticket.destino}</div>
        <div class="ticket-meta">
          ${ticket.aerolinea} · ${fmtFecha(ticket.fecha_vuelo)} · ${fmtNum(tm)} millas · Tasas: ${resumenTasas}
        </div>
        ${tipoBadge}
        <span class="badge ${badgeClass}">${labels[ticket.estado]}</span>
        <div class="ticket-actions" onclick="event.stopPropagation()">
          <button class="btn-sm" onclick='abrirModalTicket(${JSON.stringify(ticket)})'>Editar</button>
          <button class="btn-sm danger" onclick="eliminarTicket('${ticket.id}')">Eliminar</button>
        </div>
      </div>
      <div class="ticket-detalle" id="detalle-${ticket.id}">
        ${renderSimulacion(ticket)}
        ${normalizarTicket(ticket).viaje_facil && ticket.estado === "emitido" ? renderVFPanel(ticket) : ""}
        ${ticket.notas ? `<p style="margin-top:10px;color:#9ca3af;font-size:12px"><em>${ticket.notas}</em></p>` : ""}
      </div>
    </div>`;
}

function renderSimulacion(ticket) {
  const precios = state.config.precios_simulacion;
  const tm = millasTicket(ticket);
  const ars_ = tasasARS(ticket);
  const pp = calcularPrecioPromedio();
  const nt = normalizarTicket(ticket);
  const pesosCanje = nt.tipo_canje === "millas_pesos" ? (ticket.pesos_canje || 0) : 0;
  const mostrarPesos = nt.tipo_canje === "millas_pesos";

  const filas = precios.map(p => {
    const costoMillas = tm * p;
    const total = costoMillas + pesosCanje + ars_;
    const esPromedio = Math.abs(p - pp) < 0.01;
    const cls = esPromedio ? "sim-row-highlight" : "";
    const estrella = esPromedio ? " ★" : "";
    return `<tr class="${cls}">
      <td>$ ${p.toFixed(2)}${estrella}</td>
      <td class="num">${ars(costoMillas)}</td>
      ${mostrarPesos ? `<td class="num">${ars(pesosCanje)}</td>` : ""}
      <td class="num">${ars_ > 0 ? ars(ars_) : "—"}</td>
      <td class="num"><strong>${ars(total)}</strong></td>
    </tr>`;
  }).join("");

  return `
    <table class="sim-table">
      <thead><tr>
        <th>Precio milla</th>
        <th class="num">Costo millas</th>
        ${mostrarPesos ? `<th class="num">Pesos canje</th>` : ""}
        <th class="num">Tasas ARS</th>
        <th class="num">Total ARS</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <small style="color:#9ca3af;font-size:11px">★ = tu precio de compra promedio · Millas totales: ${fmtNum(tm)}</small>`;
}

function renderVFPanel(ticket) {
  const totalMillas = millasTicket(ticket);
  const canceladas = ticket.millas_canceladas || 0;
  const restantes = totalMillas - canceladas;
  const limite = fechaLimiteVF(ticket);
  const dias = diasHastaFecha(limite);
  const urgenciaClase = dias < 30 ? "urgencia-roja" : dias < 60 ? "urgencia-amarilla" : "urgencia-ok";
  const urgenciaTexto = dias < 30
    ? `⚠ ${dias} días (urgente)`
    : dias < 60 ? `⚡ ${dias} días` : `${dias} días`;

  const precios = state.config.precios_simulacion;
  const filasRest = precios.map(p => {
    const costo = restantes * p;
    return `<tr><td>$ ${p.toFixed(2)}</td><td class="num">${ars(costo)}</td></tr>`;
  }).join("");

  return `
    <div class="vf-panel">
      <div class="vf-title">✈ Viaje Fácil</div>
      <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:2px">Fecha límite</div>
          <div class="${urgenciaClase}">${fmtFecha(limite.toISOString().split("T")[0])} · ${urgenciaTexto}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:2px">Millas canceladas</div>
          <div>${fmtNum(canceladas)} de ${fmtNum(totalMillas)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:2px">Millas restantes</div>
          <div><strong>${fmtNum(restantes)}</strong></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:#374151">Actualizar canceladas:</span>
        <input type="number" id="vf-canceladas-${ticket.id}" value="${canceladas}" min="0" max="${totalMillas}" style="width:120px">
        <button class="btn-primary" onclick="guardarCanceladas('${ticket.id}')">Guardar</button>
      </div>
      <details>
        <summary>Costo de cancelar las ${fmtNum(restantes)} millas restantes</summary>
        <table class="sim-table" style="margin-top:0.5rem">
          <thead><tr><th>Precio milla</th><th class="num">Costo ARS</th></tr></thead>
          <tbody>${filasRest}</tbody>
        </table>
      </details>
    </div>`;
}

function toggleDetalle(id) {
  const el = document.getElementById(`detalle-${id}`);
  el.classList.toggle("open");
}

// ---- Config ----
function renderConfig() {
  const lista = document.getElementById("precios-lista");
  lista.innerHTML = state.config.precios_simulacion.map((p, i) => `
    <div class="precio-row">
      <input type="number" step="0.01" min="0.01" value="${p}" id="precio-${i}">
      <button class="btn-sm danger" onclick="eliminarPrecio(${i})">Eliminar</button>
    </div>`).join("");
}

function agregarPrecio() {
  state.config.precios_simulacion.push(0);
  renderConfig();
}

function eliminarPrecio(i) {
  state.config.precios_simulacion.splice(i, 1);
  renderConfig();
}

async function guardarConfig() {
  const inputs = document.querySelectorAll("[id^='precio-']");
  state.config.precios_simulacion = Array.from(inputs).map(el => parseFloat(el.value)).filter(n => n > 0);
  state.config.precios_simulacion.sort((a, b) => a - b);
  await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.config),
  });
  renderConfig();
  renderDashboard();
  renderTickets();
  mostrarToast("Configuración guardada");
}

// ---- Modal Lote ----
function abrirModalLote(lote = null) {
  document.getElementById("modal-lote-titulo").textContent = lote ? "Editar lote" : "Agregar lote de millas";
  document.getElementById("lote-id").value = lote?.id || "";
  document.getElementById("lote-fecha").value = lote?.fecha || new Date().toISOString().split("T")[0];
  document.getElementById("lote-cantidad").value = lote?.cantidad || "";
  document.getElementById("lote-precio").value = lote?.precio_por_milla || "";
  document.getElementById("lote-notas").value = lote?.notas || "";
  document.getElementById("modal-lote").showModal();
}

function cerrarModal(id) {
  document.getElementById(id).close();
}

async function guardarLote(e) {
  e.preventDefault();
  const id = document.getElementById("lote-id").value;
  const lote = {
    fecha: document.getElementById("lote-fecha").value,
    cantidad: parseInt(document.getElementById("lote-cantidad").value),
    precio_por_milla: parseFloat(document.getElementById("lote-precio").value),
    notas: document.getElementById("lote-notas").value,
  };

  if (id) {
    const res = await fetch(`/api/millas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lote),
    });
    const updated = await res.json();
    state.lotes_millas = state.lotes_millas.map(l => l.id === id ? updated : l);
  } else {
    const res = await fetch("/api/millas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lote),
    });
    const created = await res.json();
    state.lotes_millas.push(created);
  }

  cerrarModal("modal-lote");
  renderMillas();
  renderDashboard();
  mostrarToast("Lote guardado");
}

async function eliminarLote(id) {
  if (!confirm("¿Eliminar este lote?")) return;
  await fetch(`/api/millas/${id}`, { method: "DELETE" });
  state.lotes_millas = state.lotes_millas.filter(l => l.id !== id);
  renderMillas();
  renderDashboard();
}

// ---- Modal Ticket ----
function abrirModalTicket(ticket = null) {
  document.getElementById("modal-ticket-titulo").textContent = ticket ? "Editar ticket" : "Agregar ticket";
  document.getElementById("ticket-id").value = ticket?.id || "";
  document.getElementById("ticket-aerolinea").value = ticket?.aerolinea || "";
  document.getElementById("ticket-origen").value = ticket?.origen || "";
  document.getElementById("ticket-destino").value = ticket?.destino || "";
  document.getElementById("ticket-fecha").value = ticket?.fecha_vuelo || "";
  document.getElementById("ticket-millas").value = ticket?.millas_vuelo || "";
  document.getElementById("ticket-estado").value = ticket?.estado || "evaluando";
  document.getElementById("ticket-notas").value = ticket?.notas || "";

  const nt = ticket ? normalizarTicket(ticket) : { tipo_canje: "normal", viaje_facil: false };
  document.querySelector(`input[name="tipo_canje"][value="${nt.tipo_canje}"]`).checked = true;
  document.getElementById("ticket-vf").checked = nt.viaje_facil;
  document.getElementById("ticket-pesos-canje").value = ticket?.pesos_canje || "";
  document.getElementById("campo-pesos-canje").style.display = nt.tipo_canje === "millas_pesos" ? "" : "none";

  const tasasEl = document.getElementById("tasas-lista");
  tasasEl.innerHTML = "";
  const tasas = ticket?.tasas || [{ monto: "", moneda: "ARS" }];
  tasas.forEach(t => agregarTasa(t));

  document.getElementById("modal-ticket").showModal();
}

function agregarTasa(tasa = { monto: "", moneda: "ARS" }) {
  const div = document.createElement("div");
  div.className = "tasa-row";
  div.innerHTML = `
    <input type="number" min="0" placeholder="Monto" value="${tasa.monto}" class="tasa-monto">
    <select class="tasa-moneda">
      <option value="ARS" ${tasa.moneda === "ARS" ? "selected" : ""}>ARS</option>
      <option value="millas" ${tasa.moneda === "millas" ? "selected" : ""}>Millas</option>
    </select>
    <button type="button" class="btn-sm danger" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById("tasas-lista").appendChild(div);
}

async function guardarTicket(e) {
  e.preventDefault();
  const id = document.getElementById("ticket-id").value;

  const tasaRows = document.querySelectorAll(".tasa-row");
  const tasas = Array.from(tasaRows)
    .map(row => ({
      monto: parseFloat(row.querySelector(".tasa-monto").value) || 0,
      moneda: row.querySelector(".tasa-moneda").value,
    }))
    .filter(t => t.monto > 0);

  const tipoCanje = document.querySelector('input[name="tipo_canje"]:checked')?.value || "normal";
  const ticket = {
    aerolinea: document.getElementById("ticket-aerolinea").value,
    origen: document.getElementById("ticket-origen").value.toUpperCase(),
    destino: document.getElementById("ticket-destino").value.toUpperCase(),
    fecha_vuelo: document.getElementById("ticket-fecha").value,
    millas_vuelo: parseInt(document.getElementById("ticket-millas").value),
    tipo_canje: tipoCanje,
    pesos_canje: tipoCanje === "millas_pesos" ? (parseFloat(document.getElementById("ticket-pesos-canje").value) || 0) : 0,
    viaje_facil: document.getElementById("ticket-vf").checked,
    estado: document.getElementById("ticket-estado").value,
    tasas,
    notas: document.getElementById("ticket-notas").value,
    millas_canceladas: id
      ? (state.tickets.find(t => t.id === id)?.millas_canceladas || 0)
      : 0,
  };

  if (id) {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticket),
    });
    const updated = await res.json();
    state.tickets = state.tickets.map(t => t.id === id ? updated : t);
  } else {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticket),
    });
    const created = await res.json();
    state.tickets.push(created);
  }

  cerrarModal("modal-ticket");
  renderTickets();
  renderDashboard();
  mostrarToast("Ticket guardado");
}

async function eliminarTicket(id) {
  if (!confirm("¿Eliminar este ticket?")) return;
  await fetch(`/api/tickets/${id}`, { method: "DELETE" });
  state.tickets = state.tickets.filter(t => t.id !== id);
  renderTickets();
  renderDashboard();
}

async function guardarCanceladas(ticketId) {
  const val = parseInt(document.getElementById(`vf-canceladas-${ticketId}`).value) || 0;
  const ticket = state.tickets.find(t => t.id === ticketId);
  const updated = { ...ticket, millas_canceladas: val };
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  });
  const saved = await res.json();
  state.tickets = state.tickets.map(t => t.id === ticketId ? saved : t);
  renderTickets();
  renderDashboard();
  mostrarToast("Millas canceladas actualizadas");
}

// ---- Toast ----
function mostrarToast(msg) {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "toast";
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "1.5rem", right: "1.5rem",
    background: "#1e293b", color: "white",
    padding: "0.6rem 1.2rem", borderRadius: "8px",
    fontSize: "0.9rem", zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
