const API_BASE = "/api";

/* ================= AUTH ================= */

function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  location.href = "/login.html";
}

function parseJwt() {
  const t = getToken();
  if (!t) return null;
  return JSON.parse(atob(t.split(".")[1]));
}

function esAdmin() {
  const u = parseJwt();
  return u && u.rol === "admin";
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) logout();
  return res;
}

/* ================= UI ================= */

function aplicarUIporRol() {
  document.getElementById("btn-nav-usuarios").style.display = esAdmin() ? "flex" : "none";
  document.querySelector('[data-section="admin-almacen"]').style.display = esAdmin() ? "flex" : "none";
}

aplicarUIporRol();

/* ================= NAV ================= */

function mostrarSeccion(id) {
  document.querySelectorAll(".seccion").forEach(s => s.classList.remove("activa"));
  document.getElementById(id).classList.add("activa");
  if (id === "usuarios") cargarUsuarios();
}

document.querySelectorAll(".nav-btn").forEach(b =>
  b.onclick = () => mostrarSeccion(b.dataset.section)
);

/* ================= USUARIOS ================= */

async function cargarUsuarios() {
  const res = await apiFetch(`${API_BASE}/users`);
  const data = await res.json();
  const tbody = document.querySelector("#tabla-usuarios tbody");
  tbody.innerHTML = "";
  data.usuarios.forEach(u => {
    tbody.innerHTML += `<tr><td>${u.nombre}</td><td>${u.email}</td><td>${u.rol}</td><td>${u.activo ? "Sí" : "No"}</td></tr>`;
  });
}

document.getElementById("form-usuario").onsubmit = async e => {
  e.preventDefault();
  const f = e.target;
  const res = await apiFetch(`${API_BASE}/users`, {
    method: "POST",
    body: JSON.stringify({
      nombre: f.nombre.value,
      email: f.email.value,
      password: f.password.value,
      rol: f.rol.value
    })
  });
  const d = await res.json();
  alert(d.message || "Usuario creado");
  f.reset();
  cargarUsuarios();
};

/* ================= PROYECTOS / ETAPAS ================= */

let proyectoSeleccionadoId = null;
let etapaSeleccionadaId = "__ALL__";
let etapaActivaId = null;

async function cargarProyectos() {
  const r = await apiFetch(`${API_BASE}/proyectos`);
  const d = await r.json();
  const ul = document.getElementById("lista-proyectos");
  ul.innerHTML = "";
  d.proyectos.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.clave} - ${p.nombre}`;
    li.onclick = () => seleccionarProyecto(p);
    ul.appendChild(li);
  });
}

async function seleccionarProyecto(p) {
  proyectoSeleccionadoId = p.id;
  document.getElementById("info-proyecto-seleccionado").textContent = `${p.clave} - ${p.nombre}`;
  await cargarEtapaActiva();
  await cargarEtapas();
  await refrescarMovimientos();
}

async function cargarEtapaActiva() {
  const r = await apiFetch(`${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/activa`);
  const d = await r.json();
  etapaActivaId = d.etapa?.id || null;
  document.getElementById("etapa-activa-texto").textContent = d.etapa?.nombre || "—";
}

async function cargarEtapas() {
  const r = await apiFetch(`${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas`);
  const d = await r.json();
  const s = document.getElementById("select-etapa");
  s.innerHTML = `<option value="__ALL__">Todas</option>`;
  d.etapas.forEach(e => {
    s.innerHTML += `<option value="${e.id}">${e.nombre} (${e.estado})</option>`;
  });
  s.onchange = () => {
    etapaSeleccionadaId = s.value;
    refrescarMovimientos();
  };
}

async function refrescarMovimientos() {
  let url = `${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/movimientos`;
  if (etapaSeleccionadaId !== "__ALL__") {
    url = `${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/etapa/${etapaSeleccionadaId}/movimientos`;
  }
  const r = await apiFetch(url);
  const d = await r.json();
  const tb = document.querySelector("#tabla-movimientos-proyecto tbody");
  tb.innerHTML = "";
  let total = 0;
  d.movimientos.forEach(m => {
    total += Number(m.total || 0);
    tb.innerHTML += `<tr>
      <td>${new Date(m.creado_en).toLocaleString()}</td>
      <td>${m.nombre}</td>
      <td>${m.cantidad}</td>
      <td>${m.usuario_nombre || "-"}</td>
    </tr>`;
  });
  document.getElementById("total-etapa").textContent = `$${total.toFixed(2)}`;
  document.getElementById("total-proyecto").textContent = `$${total.toFixed(2)}`;
}

/* ================= EXPORT ================= */

function descargarArchivo(url, nombre) {
  apiFetch(url).then(r => r.blob()).then(b => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = nombre;
    a.click();
  });
}

document.getElementById("btn-export-etapa-excel").onclick = () =>
  descargarArchivo(`${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/excel`, "etapa.xlsx");

document.getElementById("btn-export-etapa-pdf").onclick = () =>
  descargarArchivo(`${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/pdf`, "etapa.pdf");

/* ================= INIT ================= */

cargarProyectos();
