const API_BASE = "/api";

/* ==================== AUTH HELPERS ==================== */

function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  location.href = "/login.html";
}

function getUserFromToken() {
  const t = getToken();
  if (!t) return null;
  try {
    const payload = t.split(".")[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function esAdmin() {
  const u = getUserFromToken();
  const rol = (u?.rol || u?.role || "").toLowerCase();
  return rol === "admin";
}

async function apiFetch(url, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) logout();
  return res;
}

/* ==================== UI POR ROL ==================== */

function aplicarUIporRol() {
  const admin = esAdmin();

  const badge = document.getElementById("user-badge");
  const u = getUserFromToken();
  if (badge) {
    const email = u?.email ? ` · ${u.email}` : "";
    badge.textContent = u ? `Rol: ${admin ? "admin" : "user"}${email}` : "";
  }

  const btnUsuarios = document.getElementById("btn-nav-usuarios");
  if (btnUsuarios) btnUsuarios.style.display = admin ? "flex" : "none";

  const btnAdminAlmacen = document.getElementById("btn-nav-admin-almacen");
  if (btnAdminAlmacen) btnAdminAlmacen.style.display = admin ? "flex" : "none";

  const btnGuardarMaterial = document.getElementById("btn-guardar-material");
  const hintMat = document.getElementById("hint-material-admin");
  if (btnGuardarMaterial) btnGuardarMaterial.disabled = !admin;
  if (hintMat) hintMat.style.display = admin ? "none" : "block";

  const btnCrearProyecto = document.getElementById("btn-crear-proyecto");
  const hintProj = document.getElementById("hint-proyecto-admin");
  if (btnCrearProyecto) btnCrearProyecto.disabled = !admin;
  if (hintProj) hintProj.style.display = admin ? "none" : "block";

  const btnSalidaProyecto = document.getElementById("btn-salida-proyecto");
  const hintSalida = document.getElementById("hint-salida-admin");
  if (btnSalidaProyecto) btnSalidaProyecto.disabled = !admin;
  if (hintSalida) hintSalida.style.display = admin ? "none" : "block";

  const btnCrearEtapa = document.getElementById("btn-crear-etapa");
  const btnCerrarEtapa = document.getElementById("btn-cerrar-etapa");
  const btnEtapaX = document.getElementById("btn-export-etapa-excel");
  const btnEtapaP = document.getElementById("btn-export-etapa-pdf");

  if (btnCrearEtapa) btnCrearEtapa.style.display = admin ? "inline-flex" : "none";
  if (btnCerrarEtapa) btnCerrarEtapa.style.display = admin ? "inline-flex" : "none";

  const expMatX = document.getElementById("btn-export-materiales-excel");
  const expMatP = document.getElementById("btn-export-materiales-pdf");
  if (expMatX) expMatX.style.display = admin ? "inline-flex" : "none";
  if (expMatP) expMatP.style.display = admin ? "inline-flex" : "none";

  if (btnEtapaX) btnEtapaX.style.display = admin ? "inline-flex" : "none";
  if (btnEtapaP) btnEtapaP.style.display = admin ? "inline-flex" : "none";
}

/* ==================== NAV / SECCIONES ==================== */

function mostrarSeccion(id) {
  document.querySelectorAll(".seccion").forEach(sec => sec.classList.remove("activa"));
  document.getElementById(id)?.classList.add("activa");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("activa", btn.dataset.section === id);
  });

  if (id === "admin-almacen") cargarAdminMaterialesV2();
  if (id === "movimientos") cargarMovimientosGlobal();
  if (id === "usuarios") cargarUsuarios();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => mostrarSeccion(btn.dataset.section));
});

/* ==================== EXPORT ==================== */

async function descargarArchivo(url, nombreArchivo) {
  const res = await apiFetch(url);

  if (res.status === 403) {
    alert("No tienes permisos para exportar.");
    return;
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Export error:", res.status, txt);
    alert(`No se pudo exportar. (${res.status})`);
    return;
  }

  const blob = await res.blob();
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

document.getElementById("btn-export-materiales-excel")?.addEventListener("click", () => {
  descargarArchivo(`${API_BASE}/materiales/export/excel`, "materiales.xlsx");
});

document.getElementById("btn-export-materiales-pdf")?.addEventListener("click", () => {
  descargarArchivo(`${API_BASE}/materiales/export/pdf`, "materiales.pdf");
});

/* ==================== PROVEEDORES ==================== */

let proveedoresCache = [];

async function cargarProveedores() {
  const select1 = document.getElementById("select-proveedor-material");
  const select2 = document.getElementById("select-proveedor-lote");
  if (!select1 && !select2) return;

  const res = await apiFetch(`${API_BASE}/proveedores`);
  const data = await res.json();

  proveedoresCache = data.proveedores || [];

  const llenar = (sel) => {
    if (!sel) return;
    sel.innerHTML = `<option value="">—</option>`;
    if (data.ok) {
      data.proveedores.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.nombre;
        sel.appendChild(opt);
      });
    }
  };

  llenar(select1);
  llenar(select2);
}

document.getElementById("btn-crear-proveedor")?.addEventListener("click", async () => {
  if (!esAdmin()) return alert("Solo admin puede registrar proveedores.");

  const input = document.getElementById("nuevo-proveedor-nombre");
  const nombre = (input?.value || "").trim();
  if (!nombre) return alert("Escribe el nombre del proveedor.");

  const res = await apiFetch(`${API_BASE}/proveedores`, {
    method: "POST",
    body: JSON.stringify({ nombre })
  });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "No se pudo crear proveedor.");

  if (input) input.value = "";
  await cargarProveedores();
  alert("Proveedor registrado");
});

/* ==================== MATERIALES (TABLA + BUSCADOR) ==================== */

let materialesCache = [];

function renderMaterialesTabla(lista) {
  const tbody = document.querySelector("#tabla-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.codigo}</td>
      <td>${m.nombre}</td>
      <td>${m.stock_actual}</td>
      <td>${m.ubicacion || ""}</td>
      <td>${m.proveedor_nombre || ""}</td>
      <td>${m.ticket_numero || ""}</td>
      <td>${m.requiere_protocolo ? (m.protocolo_texto || "Sí") : "No"}</td>
      <td>${m.precio_unitario ?? ""}</td>
      <td>${m.creado_por_nombre || m.creado_por_email || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarMateriales(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return materialesCache;

  return materialesCache.filter(m => {
    const texto = [
      m.codigo, m.nombre, m.ubicacion,
      m.proveedor_nombre, m.ticket_numero,
      m.protocolo_texto, m.creado_por_nombre, m.creado_por_email
    ].join(" ").toLowerCase();
    return texto.includes(q);
  });
}

document.getElementById("buscar-materiales")?.addEventListener("input", (e) => {
  renderMaterialesTabla(filtrarMateriales(e.target.value));
});

function toggleProtocoloForm() {
  const sel = document.getElementById("select-requiere-protocolo");
  const grupo = document.getElementById("grupo-protocolo-texto");
  if (!sel || !grupo) return;
  grupo.style.display = sel.value === "1" ? "block" : "none";
}
document.getElementById("select-requiere-protocolo")?.addEventListener("change", toggleProtocoloForm);

async function cargarMateriales() {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  if (!data.ok) {
    alert(data.message || "Error al cargar materiales");
    return;
  }

  materialesCache = data.materiales || [];
  const q = document.getElementById("buscar-materiales")?.value || "";
  renderMaterialesTabla(filtrarMateriales(q));
}

document.getElementById("form-material")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("No tienes permisos (solo admin).");

  const form = e.target;
  const requiere = form.requiere_protocolo?.value === "1";

  const payload = {
    codigo: form.codigo.value.trim(),
    nombre: form.nombre.value.trim(),
    stock_inicial: parseFloat(form.stock_inicial.value || 0),
    stock_minimo: parseFloat(form.stock_minimo.value || 0),
    ubicacion: form.ubicacion.value.trim() || null,
    proveedor_id: form.proveedor_id.value ? Number(form.proveedor_id.value) : null,
    ticket_numero: form.ticket_numero.value.trim() || null,
    requiere_protocolo: requiere ? 1 : 0,
    protocolo_texto: requiere ? (form.protocolo_texto.value.trim() || null) : null,
    precio_unitario: form.precio_unitario.value !== "" ? Number(form.precio_unitario.value) : null
  };

  const res = await apiFetch(`${API_BASE}/materiales`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al guardar material");

  alert("Material guardado");
  form.reset();
  toggleProtocoloForm();

  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
});

/* ==================== PROYECTOS ==================== */

let proyectoSeleccionadoId = null;
let etapaActivaId = null;
let etapaSeleccionadaId = "__ALL__";

async function cargarProyectos() {
  const res = await apiFetch(`${API_BASE}/proyectos`);
  const data = await res.json();

  const ul = document.getElementById("lista-proyectos");
  if (!ul) return;
  ul.innerHTML = "";

  if (!data.ok) {
    alert(data.message || "Error al cargar proyectos");
    return;
  }

  data.proyectos.forEach(p => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "10px";

    const info = document.createElement("span");
    info.textContent = `${p.clave} - ${p.nombre} (${p.estado || "ACTIVO"})`;
    info.style.cursor = "pointer";
    info.onclick = () => seleccionarProyecto(p);

    const acciones = document.createElement("div");
    acciones.style.display = "flex";
    acciones.style.gap = "8px";

    const btnXlsx = document.createElement("button");
    btnXlsx.className = "btn-secondary";
    btnXlsx.type = "button";
    btnXlsx.textContent = "Excel";
    btnXlsx.onclick = (e) => {
      e.stopPropagation();
      descargarArchivo(`${API_BASE}/proyectos/${p.id}/export/excel`, `proyecto_${p.clave}_movimientos.xlsx`);
    };

    const btnPdf = document.createElement("button");
    btnPdf.className = "btn-secondary";
    btnPdf.type = "button";
    btnPdf.textContent = "PDF";
    btnPdf.onclick = (e) => {
      e.stopPropagation();
      descargarArchivo(`${API_BASE}/proyectos/${p.id}/export/pdf`, `proyecto_${p.clave}_movimientos.pdf`);
    };

    acciones.appendChild(btnXlsx);
    acciones.appendChild(btnPdf);

    li.appendChild(info);
    li.appendChild(acciones);
    ul.appendChild(li);
  });
}

async function seleccionarProyecto(proyecto) {
  proyectoSeleccionadoId = proyecto.id;

  document.getElementById("info-proyecto-seleccionado").textContent =
    `${proyecto.clave} - ${proyecto.nombre}`;

  etapaSeleccionadaId = "__ALL__";
  const selectEtapa = document.getElementById("select-etapa");
  if (selectEtapa) selectEtapa.value = "__ALL__";

  await cargarEtapaActiva(proyectoSeleccionadoId);
  await cargarEtapasProyecto(proyectoSeleccionadoId);
  await refrescarMovimientosProyecto();
}

document.getElementById("form-proyecto")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("No tienes permisos para crear proyectos.");

  const form = e.target;
  const payload = {
    clave: form.clave.value.trim(),
    nombre: form.nombre.value.trim(),
    cliente: form.cliente.value.trim() || null,
    fecha_inicio: form.fecha_inicio.value || null,
    descripcion: form.descripcion.value.trim() || null
  };

  const res = await apiFetch(`${API_BASE}/proyectos`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "Error al crear proyecto");

  alert("Proyecto creado");
  form.reset();
  await cargarProyectos();
});

/* ==================== ETAPAS ==================== */

async function cargarEtapaActiva(proyectoId) {
  const res = await apiFetch(`${API_BASE}/proyectos/${proyectoId}/etapas/activa`);
  const data = await res.json();

  const txt = document.getElementById("etapa-activa-texto");
  if (!data.ok || !data.etapa) {
    etapaActivaId = null;
    if (txt) txt.textContent = "—";
    return;
  }

  etapaActivaId = data.etapa.id;
  if (txt) txt.textContent = data.etapa.nombre;
}

async function cargarEtapasProyecto(proyectoId) {
  const res = await apiFetch(`${API_BASE}/proyectos/${proyectoId}/etapas`);
  const data = await res.json();

  const select = document.getElementById("select-etapa");
  const resumen = document.getElementById("etapas-resumen");
  if (!select) return;

  select.innerHTML = `<option value="__ALL__">Todas</option>`;

  if (!data.ok) {
    if (resumen) resumen.textContent = "No se pudieron cargar etapas.";
    return;
  }

  data.etapas.forEach(et => {
    const opt = document.createElement("option");
    opt.value = String(et.id);
    opt.textContent = `${et.nombre} (${et.estado})`;
    select.appendChild(opt);
  });

  select.value = String(etapaSeleccionadaId);

  if (resumen) {
    const total = data.etapas.length;
    const activas = data.etapas.filter(e => e.estado === "ACTIVA").length;
    const cerradas = data.etapas.filter(e => e.estado === "CERRADA").length;
    resumen.textContent = `Etapas: ${total} · Activas: ${activas} · Cerradas: ${cerradas}`;
  }

  select.onchange = async () => {
    etapaSeleccionadaId = select.value;
    await refrescarMovimientosProyecto();
  };
}

document.getElementById("btn-crear-etapa")?.addEventListener("click", async () => {
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (!esAdmin()) return alert("No tienes permisos (solo admin).");

  const nombre = prompt("Nombre de la nueva etapa:");
  if (!nombre || !nombre.trim()) return;

  const res = await apiFetch(`${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas`, {
    method: "POST",
    body: JSON.stringify({ nombre: nombre.trim() })
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "No se pudo crear la etapa");

  alert("Etapa creada");
  await cargarEtapaActiva(proyectoSeleccionadoId);
  etapaSeleccionadaId = "__ALL__";
  document.getElementById("select-etapa").value = "__ALL__";
  await cargarEtapasProyecto(proyectoSeleccionadoId);
  await refrescarMovimientosProyecto();
});

document.getElementById("btn-cerrar-etapa")?.addEventListener("click", async () => {
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (!esAdmin()) return alert("No tienes permisos (solo admin).");
  if (!etapaActivaId) return alert("No hay etapa activa para cerrar.");
  if (!confirm("¿Cerrar la etapa activa?")) return;

  const res = await apiFetch(`${API_BASE}/etapas/${etapaActivaId}/cerrar`, { method: "POST" });
  const data = await res.json();
  if (!data.ok) return alert(data.message || "No se pudo cerrar la etapa");

  alert("Etapa cerrada");
  await cargarEtapaActiva(proyectoSeleccionadoId);
  etapaSeleccionadaId = "__ALL__";
  document.getElementById("select-etapa").value = "__ALL__";
  await cargarEtapasProyecto(proyectoSeleccionadoId);
  await refrescarMovimientosProyecto();
});

/* ==================== MATERIALES EN PROYECTO (SELECT + BUSCADOR) ==================== */

let materialesSelectCache = [];

function renderSelectMateriales(lista) {
  const select = document.getElementById("select-material-proyecto");
  if (!select) return;

  const actual = select.value;
  select.innerHTML = "";

  lista.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.codigo} - ${m.nombre} (stock: ${m.stock_actual})`;
    select.appendChild(opt);
  });

  if ([...select.options].some(o => o.value === actual)) {
    select.value = actual;
  }
}

function filtrarMaterialesSelect(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return materialesSelectCache;

  return materialesSelectCache.filter(m => {
    const texto = `${m.codigo} ${m.nombre}`.toLowerCase();
    return texto.includes(q);
  });
}

async function cargarMaterialesEnSelectProyecto() {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  if (!data.ok) {
    alert(data.message || "Error al cargar materiales para proyectos");
    return;
  }

  materialesSelectCache = data.materiales || [];
  const q = document.getElementById("buscar-material-proyecto")?.value || "";
  renderSelectMateriales(filtrarMaterialesSelect(q));
}

document.getElementById("buscar-material-proyecto")?.addEventListener("input", (e) => {
  renderSelectMateriales(filtrarMaterialesSelect(e.target.value));
});

/* ==================== MOVIMIENTOS PROYECTO (TABLA) ==================== */

async function cargarMovimientosDeProyecto(proyectoId) {
  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoId}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar movimientos del proyecto");

  data.movimientos.forEach(mv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(mv.creado_en).toLocaleString()}</td>
      <td>${mv.codigo} - ${mv.nombre}</td>
      <td>${mv.tipo}</td>
      <td>${mv.cantidad}</td>
      <td>${mv.comentario || ""}</td>
      <td>${mv.usuario_nombre || mv.usuario_email || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarMovimientosDeProyectoPorEtapa(proyectoId, etapaId) {
  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoId}/etapa/${etapaId}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar movimientos de la etapa");

  data.movimientos.forEach(mv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(mv.creado_en).toLocaleString()}</td>
      <td>${mv.codigo} - ${mv.nombre}</td>
      <td>${mv.tipo}</td>
      <td>${mv.cantidad}</td>
      <td>${mv.comentario || ""}</td>
      <td>${mv.usuario_nombre || mv.usuario_email || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function refrescarMovimientosProyecto() {
  if (!proyectoSeleccionadoId) return;

  if (etapaSeleccionadaId === "__ALL__") {
    await cargarMovimientosDeProyecto(proyectoSeleccionadoId);
  } else {
    await cargarMovimientosDeProyectoPorEtapa(proyectoSeleccionadoId, etapaSeleccionadaId);
  }

  await calcularTotalesProyectoYEtapa();
}

/* ==================== REGISTRAR SALIDA A PROYECTO ==================== */

document.getElementById("form-salida-proyecto")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!esAdmin()) return alert("Solo admin puede registrar salidas.");
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (!etapaActivaId) return alert("No hay etapa activa. Crea una etapa primero.");

  const form = e.target;
  if (!form.material_id.value) return alert("Selecciona un material (limpia búsqueda si no aparece).");

  const payload = {
    material_id: parseInt(form.material_id.value),
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value.trim() || null,
    etapa_id: etapaActivaId
  };

  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/salida`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "Error al registrar salida");

  alert("Salida registrada");
  form.reset();

  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
  await refrescarMovimientosProyecto();
});

/* ==================== TOTALES + EXPORT ETAPA ==================== */

function money(n) {
  const x = Number(n || 0);
  return "$" + x.toFixed(2);
}

async function calcularTotalesProyectoYEtapa() {
  if (!proyectoSeleccionadoId) return;

  const resAll = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/movimientos`);
  const dataAll = await resAll.json();
  if (!dataAll.ok) return;

  const totalProyecto = dataAll.movimientos.reduce((acc, mv) => {
    const total = mv.total ?? (Number(mv.precio_unitario || 0) * Number(mv.cantidad || 0));
    return acc + Number(total || 0);
  }, 0);

  const tp = document.getElementById("total-proyecto");
  if (tp) tp.textContent = money(totalProyecto);

  if (etapaSeleccionadaId === "__ALL__") {
    const te = document.getElementById("total-etapa");
    if (te) te.textContent = money(totalProyecto);
    return;
  }

  const resEt = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/etapa/${etapaSeleccionadaId}/movimientos`);
  const dataEt = await resEt.json();
  if (!dataEt.ok) return;

  const totalEtapa = dataEt.movimientos.reduce((acc, mv) => {
    const total = mv.total ?? (Number(mv.precio_unitario || 0) * Number(mv.cantidad || 0));
    return acc + Number(total || 0);
  }, 0);

  const te = document.getElementById("total-etapa");
  if (te) te.textContent = money(totalEtapa);
}

document.getElementById("btn-export-etapa-excel")?.addEventListener("click", () => {
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (etapaSeleccionadaId === "__ALL__") return alert("Selecciona una etapa específica.");

  descargarArchivo(
    `${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/excel`,
    `proyecto_${proyectoSeleccionadoId}_etapa_${etapaSeleccionadaId}.xlsx`
  );
});

document.getElementById("btn-export-etapa-pdf")?.addEventListener("click", () => {
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (etapaSeleccionadaId === "__ALL__") return alert("Selecciona una etapa específica.");

  descargarArchivo(
    `${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/pdf`,
    `proyecto_${proyectoSeleccionadoId}_etapa_${etapaSeleccionadaId}.pdf`
  );
});

/* ==================== ADMIN ALMACÉN V2 (LOTES) ==================== */

let adminMaterialSeleccionado = null;
let adminMaterialesCache = [];

function setAdminLotesVisible(visible) {
  const panel = document.getElementById("admin-lotes-panel");
  const vacio = document.getElementById("admin-lotes-vacio");
  if (panel) panel.style.display = visible ? "block" : "none";
  if (vacio) vacio.style.display = visible ? "none" : "block";
}

function toggleProtocoloLote() {
  const sel = document.getElementById("select-lote-requiere-protocolo");
  const grupo = document.getElementById("grupo-lote-protocolo");
  if (!sel || !grupo) return;
  grupo.style.display = sel.value === "1" ? "block" : "none";
}
document.getElementById("select-lote-requiere-protocolo")?.addEventListener("change", toggleProtocoloLote);

document.getElementById("buscar-admin-material")?.addEventListener("input", (e) => {
  const q = (e.target.value || "").toLowerCase().trim();
  const filtrados = !q
    ? adminMaterialesCache
    : adminMaterialesCache.filter(m => `${m.codigo} ${m.nombre}`.toLowerCase().includes(q));
  renderAdminMaterialesTabla(filtrados);
});

function renderAdminMaterialesTabla(lista) {
  const tbody = document.querySelector("#tabla-admin-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.codigo}</td>
      <td>${m.nombre}</td>
      <td>${m.stock_actual}</td>
      <td>${m.ubicacion || ""}</td>
      <td>
        <button class="btn-secondary" type="button" data-id="${m.id}">Ver lotes</button>
        <button class="btn-secondary" type="button" data-del="${m.id}">🗑 Desactivar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => seleccionarMaterialAdmin(btn.dataset.id);
  });

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.onclick = () => eliminarMaterial(btn.dataset.del);
  });
}

async function cargarAdminMaterialesV2() {
  if (!esAdmin()) return;

  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al cargar materiales (admin)");

  adminMaterialesCache = data.materiales || [];
  const q = document.getElementById("buscar-admin-material")?.value || "";
  const filtrados = q ? adminMaterialesCache.filter(m => `${m.codigo} ${m.nombre}`.toLowerCase().includes(q.toLowerCase())) : adminMaterialesCache;

  renderAdminMaterialesTabla(filtrados);

  // si ya había uno seleccionado, refresca
  if (adminMaterialSeleccionado) {
    await seleccionarMaterialAdmin(adminMaterialSeleccionado.id, true);
  }
}

async function seleccionarMaterialAdmin(materialId, silencioso = false) {
  const mat = adminMaterialesCache.find(x => String(x.id) === String(materialId));
  if (!mat) return;

  adminMaterialSeleccionado = mat;

  const lbl = document.getElementById("admin-material-seleccionado");
  if (lbl) lbl.textContent = `${mat.codigo} - ${mat.nombre}`;

  setAdminLotesVisible(true);

  // llenar proveedores en select de lotes
  await cargarProveedores();
  // cargar lotes
  await cargarLotesMaterial(mat.id, silencioso);
}

async function cargarLotesMaterial(materialId, silencioso = false) {
  const res = await apiFetch(`${API_BASE}/materiales/${materialId}/lotes`);
  const data = await res.json();

  if (!data.ok) {
    if (!silencioso) alert(data.message || "No se pudieron cargar lotes");
    return;
  }

  const tbody = document.querySelector("#tabla-admin-lotes tbody");
  if (tbody) tbody.innerHTML = "";

  const selectAjuste = document.getElementById("select-ajuste-lote");
  if (selectAjuste) selectAjuste.innerHTML = "";

  (data.lotes || []).forEach(l => {
    // tabla
    if (tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${l.id}</td>
        <td>${l.proveedor_nombre || ""}</td>
        <td>${l.precio_unitario ?? ""}</td>
        <td>${l.ticket_numero || ""}</td>
        <td>${l.requiere_protocolo ? (l.protocolo_texto || "Sí") : "No"}</td>
        <td>${l.cantidad_inicial ?? ""}</td>
        <td>${l.cantidad_disponible ?? ""}</td>
        <td>${l.creado_en ? new Date(l.creado_en).toLocaleString() : ""}</td>
        <td>
          <button class="btn-secondary" type="button" data-del-lote="${l.id}">🗑 Desactivar</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // select ajuste
    if (selectAjuste) {
      const opt = document.createElement("option");
      opt.value = l.id;
      const prov = l.proveedor_nombre ? ` · ${l.proveedor_nombre}` : "";
      const precio = l.precio_unitario != null ? ` · $${Number(l.precio_unitario).toFixed(2)}` : "";
      selectAjuste.appendChild(opt);
      opt.textContent = `Lote ${l.id}${prov}${precio} · disp:${l.cantidad_disponible}`;
    }
  });

  tbody?.querySelectorAll("button[data-del-lote]")?.forEach(btn => {
    btn.onclick = () => eliminarLote(btn.dataset.delLote);
  });
}

document.getElementById("form-crear-lote")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");
  if (!adminMaterialSeleccionado) return alert("Selecciona un material.");

  const form = e.target;

  const requiere = form.requiere_protocolo.value === "1";

  const payload = {
    proveedor_id: form.proveedor_id.value ? Number(form.proveedor_id.value) : null,
    precio_unitario: form.precio_unitario.value !== "" ? Number(form.precio_unitario.value) : null,
    ticket_numero: form.ticket_numero.value.trim() || null,
    requiere_protocolo: requiere ? 1 : 0,
    protocolo_texto: requiere ? (form.protocolo_texto.value.trim() || null) : null,
    cantidad: Number(form.cantidad.value)
  };

  const res = await apiFetch(`${API_BASE}/materiales/${adminMaterialSeleccionado.id}/lotes`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "No se pudo crear el lote");

  alert("Lote creado y stock actualizado");
  form.reset();
  toggleProtocoloLote();

  await cargarMateriales();             // refresca stock general
  await cargarAdminMaterialesV2();      // refresca lista admin
  await cargarLotesMaterial(adminMaterialSeleccionado.id, true);
});

document.getElementById("form-ajustar-lote")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");
  if (!adminMaterialSeleccionado) return alert("Selecciona un material.");

  const form = e.target;
  const loteId = form.lote_id.value;
  if (!loteId) return alert("Selecciona un lote.");

  const payload = {
    tipo: form.tipo.value, // entrada/salida
    cantidad: Number(form.cantidad.value),
    comentario: form.comentario.value.trim() || null
  };

  const res = await apiFetch(`${API_BASE}/lotes/${loteId}/ajuste`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "No se pudo ajustar el lote");

  alert("Ajuste aplicado");
  form.reset();

  await cargarMateriales();
  await cargarAdminMaterialesV2();
  await cargarLotesMaterial(adminMaterialSeleccionado.id, true);
});

async function eliminarLote(loteId) {
  if (!esAdmin()) return alert("Solo admin.");
  if (!confirm("¿Desactivar este lote? (No se borra historial)")) return;

  const res = await apiFetch(`${API_BASE}/lotes/${loteId}`, { method: "DELETE" });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "No se pudo desactivar el lote");

  alert("Lote desactivado");
  await cargarMateriales();
  await cargarAdminMaterialesV2();
  if (adminMaterialSeleccionado) await cargarLotesMaterial(adminMaterialSeleccionado.id, true);
}

async function eliminarMaterial(id) {
  if (!esAdmin()) return alert("Solo admin.");
  if (!confirm("¿Desactivar este material?")) return;

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al desactivar material");

  alert("Material desactivado");
  adminMaterialSeleccionado = null;
  setAdminLotesVisible(false);

  await cargarMateriales();
  await cargarAdminMaterialesV2();
}

/* ==================== MOVIMIENTOS GLOBALES ==================== */

async function cargarMovimientosGlobal() {
  const res = await apiFetch(`${API_BASE}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-global tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar movimientos globales");

  data.movimientos.forEach(mv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(mv.creado_en).toLocaleString()}</td>
      <td>${mv.material_nombre || mv.nombre || "-"}</td>
      <td>${mv.proyecto_id || "-"}</td>
      <td>${mv.etapa_id || "-"}</td>
      <td>${mv.tipo}</td>
      <td>${mv.cantidad}</td>
      <td>${mv.comentario || ""}</td>
      <td>${mv.usuario_nombre || mv.usuario_email || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==================== USUARIOS (ADMIN) ==================== */

async function cargarUsuarios() {
  if (!esAdmin()) return alert("No tienes permisos.");

  const res = await apiFetch(`${API_BASE}/users`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-usuarios tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "No se pudo cargar usuarios");

  data.usuarios.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.email}</td>
      <td>${u.rol}</td>
      <td>${u.activo ? "Sí" : "No"}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("btn-recargar-usuarios")?.addEventListener("click", () => {
  if (!esAdmin()) return alert("No tienes permisos.");
  cargarUsuarios();
});

document.getElementById("form-usuario")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("No tienes permisos.");

  const form = e.target;
  const payload = {
    nombre: form.nombre.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    rol: form.rol.value
  };

  const res = await apiFetch(`${API_BASE}/users`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "Error al crear usuario");

  alert("Usuario creado");
  form.reset();
  await cargarUsuarios();
});

/* ==================== INIT ==================== */

(function init() {
  if (!getToken()) return logout();

  aplicarUIporRol();
  document.getElementById("btn-logout")?.addEventListener("click", logout);

  cargarProveedores();
  cargarMateriales();
  cargarProyectos();
  cargarMaterialesEnSelectProyecto();

  // panel admin lotes invisible hasta seleccionar material
  setAdminLotesVisible(false);

  if (!esAdmin()) {
    const secAdmin = document.getElementById("admin-almacen");
    if (secAdmin) secAdmin.style.display = "none";
    const secUsuarios = document.getElementById("usuarios");
    if (secUsuarios) secUsuarios.style.display = "none";
  }
})();
