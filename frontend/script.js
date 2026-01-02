const API_BASE = "/api";

/* ==================== AUTH HELPERS ==================== */

function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  location.href = "/login.html";
}

// Decodifica JWT sin librerías (solo payload base64url)
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

// fetch con JWT + manejo de 401
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

  // badges
  const badge = document.getElementById("user-badge");
  const u = getUserFromToken();
  if (badge) {
    const email = u?.email ? ` · ${u.email}` : "";
    badge.textContent = u ? `Rol: ${admin ? "admin" : "user"}${email}` : "";
  }

  // nav
  const btnUsuarios = document.getElementById("btn-nav-usuarios");
  if (btnUsuarios) btnUsuarios.style.display = admin ? "flex" : "none";

  const btnAdminAlmacen = document.getElementById("btn-nav-admin-almacen");
  if (btnAdminAlmacen) btnAdminAlmacen.style.display = admin ? "flex" : "none";

  // permisos acciones
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

  // etapas (crear/cerrar + export etapa)
  const btnCrearEtapa = document.getElementById("btn-crear-etapa");
  const btnCerrarEtapa = document.getElementById("btn-cerrar-etapa");
  const btnEtapaX = document.getElementById("btn-export-etapa-excel");
  const btnEtapaP = document.getElementById("btn-export-etapa-pdf");

  if (btnCrearEtapa) btnCrearEtapa.style.display = admin ? "inline-flex" : "none";
  if (btnCerrarEtapa) btnCerrarEtapa.style.display = admin ? "inline-flex" : "none";

  // export materiales/proyecto/etapa (si quieres solo admin)
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

  if (id === "admin-almacen") cargarAdminMateriales();
  if (id === "movimientos") cargarMovimientosGlobal();
  if (id === "usuarios") cargarUsuarios();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => mostrarSeccion(btn.dataset.section));
});

/* ==================== EXPORT MATERIALES ==================== */

async function descargarArchivo(url, nombreArchivo) {
  const res = await apiFetch(url);

  // log útil para ver el error exacto en consola
  console.log("EXPORT", url, "STATUS", res.status);

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


/* ==================== PROVEEDORES (API) ==================== */

async function cargarProveedores() {
  const select1 = document.getElementById("select-proveedor-material");
  const select2 = document.getElementById("select-proveedor-editar");
  if (!select1 && !select2) return;

  const res = await apiFetch(`${API_BASE}/proveedores`);
  const data = await res.json();

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

/* ==================== MATERIALES ==================== */

function toggleProtocoloForm() {
  const sel = document.getElementById("select-requiere-protocolo");
  const grupo = document.getElementById("grupo-protocolo-texto");
  if (!sel || !grupo) return;
  grupo.style.display = sel.value === "1" ? "block" : "none";
}
document.getElementById("select-requiere-protocolo")?.addEventListener("change", toggleProtocoloForm);

function toggleProtocoloEditar() {
  const sel = document.getElementById("select-requiere-protocolo-editar");
  const grupo = document.getElementById("grupo-protocolo-texto-editar");
  if (!sel || !grupo) return;
  grupo.style.display = sel.value === "1" ? "block" : "none";
}
document.getElementById("select-requiere-protocolo-editar")?.addEventListener("change", toggleProtocoloEditar);

async function cargarMateriales() {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) {
    alert(data.message || "Error al cargar materiales");
    return;
  }
   // guardamos cache
  materialesCache = data.materiales || [];

  // si hay búsqueda escrita, respétala
  const q = document.getElementById("buscar-materiales")?.value || "";
  renderMaterialesTabla(filtrarMateriales(q));


  data.materiales.forEach(m => {
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

/* ==================== BUSCADOR: MATERIALES ==================== */

let materialesCache = []; // guardamos lista para filtrar sin recargar

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
      m.codigo,
      m.nombre,
      m.ubicacion,
      m.proveedor_nombre,
      m.ticket_numero,
      m.protocolo_texto,
      m.creado_por_nombre,
      m.creado_por_email
    ].join(" ").toLowerCase();

    return texto.includes(q);
  });
}

document.getElementById("buscar-materiales")?.addEventListener("input", (e) => {
  const q = e.target.value;
  const filtrados = filtrarMateriales(q);
  renderMaterialesTabla(filtrados);
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

    /* ==================== BUSCADOR: SELECT MATERIAL EN PROYECTOS ==================== */

let materialesSelectCache = []; // lista para filtrar options

function renderSelectMateriales(lista) {
  const select = document.getElementById("select-material-proyecto");
  if (!select) return;

  const actual = select.value; // mantener selección si existe
  select.innerHTML = "";

  lista.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.codigo} - ${m.nombre} (stock: ${m.stock_actual})`;
    select.appendChild(opt);
  });

  // si la selección anterior existe aún, re-asignar
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

document.getElementById("buscar-material-proyecto")?.addEventListener("input", (e) => {
  const q = e.target.value;
  renderSelectMateriales(filtrarMaterialesSelect(q));
});


    // export proyecto completo (admin si backend lo restringe)
    const btnXlsx = document.createElement("button");
    btnXlsx.className = "btn-secondary";
    btnXlsx.textContent = "Excel";
    btnXlsx.onclick = (e) => {
      e.stopPropagation();
      descargarArchivo(`${API_BASE}/proyectos/${p.id}/export/excel`, `proyecto_${p.clave}_movimientos.xlsx`);
    };

    const btnPdf = document.createElement("button");
    btnPdf.className = "btn-secondary";
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

  await cargarEtapaActiva(proyecto.id);
  await cargarEtapasProyecto(proyecto.id);
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

/* ==================== ETAPAS (PROYECTOS) ==================== */

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
  const select = document.getElementById("select-etapa");
  if (select) select.value = "__ALL__";
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
  const select = document.getElementById("select-etapa");
  if (select) select.value = "__ALL__";
  await cargarEtapasProyecto(proyectoSeleccionadoId);
  await refrescarMovimientosProyecto();
});

/* ==================== MATERIALES EN PROYECTO ==================== */

// cache para filtrar el select sin volver a pedir API cada tecla
let materialesSelectCache = [];

// renderiza options del select
function renderSelectMateriales(lista) {
  const select = document.getElementById("select-material-proyecto");
  if (!select) return;

  const actual = select.value; // intenta mantener selección
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

// filtra por código o nombre
function filtrarMaterialesSelect(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return materialesSelectCache;

  return materialesSelectCache.filter(m => {
    const texto = `${m.codigo} ${m.nombre}`.toLowerCase();
    return texto.includes(q);
  });
}

// carga materiales una vez y luego filtra en cliente
async function cargarMaterialesEnSelectProyecto() {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al cargar materiales para proyectos");

  materialesSelectCache = data.materiales || [];

  const q = document.getElementById("buscar-material-proyecto")?.value || "";
  renderSelectMateriales(filtrarMaterialesSelect(q));
}

// listener del buscador (ponlo UNA sola vez)
document.getElementById("buscar-material-proyecto")?.addEventListener("input", (e) => {
  const q = e.target.value;
  renderSelectMateriales(filtrarMaterialesSelect(q));
});

/* ==================== MATERIALES EN PROYECTO (BUSCADOR + SELECT) ==================== */


function renderSelectMateriales(lista) {
  const select = document.getElementById("select-material-proyecto");
  if (!select) return;

  const actual = select.value; // mantener selección si es posible
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

// ✅ engancha el listener cuando ya existe el input en el DOM
(function initBuscadorMaterialProyecto() {
  const input = document.getElementById("buscar-material-proyecto");
  if (!input) return;

  input.addEventListener("input", () => {
    renderSelectMateriales(filtrarMaterialesSelect(input.value));
  });
})();


/* ==================== TOTALES + EXPORT ETAPA ==================== */

function money(n) {
  const x = Number(n || 0);
  return "$" + x.toFixed(2);
}

async function calcularTotalesProyectoYEtapa() {
  if (!proyectoSeleccionadoId) return;

  // Total proyecto (sumando precio_unitario*cantidad si viene en la respuesta)
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

// export etapa (admin)
document.getElementById("btn-export-etapa-excel")?.addEventListener("click", () => {
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (etapaSeleccionadaId === "__ALL__") return alert("Selecciona una etapa específica (no 'Todas').");
  descargarArchivo(
    `${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/excel`,
    `proyecto_${proyectoSeleccionadoId}_etapa_${etapaSeleccionadaId}.xlsx`
  );
});

document.getElementById("btn-export-etapa-pdf")?.addEventListener("click", () => {
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (etapaSeleccionadaId === "__ALL__") return alert("Selecciona una etapa específica (no 'Todas').");
  descargarArchivo(
    `${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/pdf`,
    `proyecto_${proyectoSeleccionadoId}_etapa_${etapaSeleccionadaId}.pdf`
  );
});

/* ==================== ADMIN ALMACÉN (CRUD + AJUSTE) ==================== */

async function cargarAdminMateriales() {
  if (!esAdmin()) return;

  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-admin-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar admin materiales");

  data.materiales.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.codigo}</td>
      <td>${m.nombre}</td>
      <td>${m.stock_actual}</td>
      <td>${m.ubicacion || ""}</td>
      <td>
        <button class="btn-edit btn-secondary" data-id="${m.id}">✏️ Editar</button>
        <button class="btn-delete btn-secondary" data-id="${m.id}">🗑 Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-edit").forEach(btn => {
    btn.onclick = () => cargarEditorMaterial(btn.dataset.id);
  });

  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => eliminarMaterial(btn.dataset.id);
  });
}

async function cargarEditorMaterial(id) {
  if (!esAdmin()) return;

  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al cargar materiales");

  const mat = data.materiales.find(m => String(m.id) === String(id));
  if (!mat) return;

  await cargarProveedores();

  const form = document.getElementById("form-editar-material");
  form.dataset.id = id;

  form.codigo.value = mat.codigo;
  form.nombre.value = mat.nombre;
  form.stock_minimo.value = mat.stock_minimo || 0;
  form.ubicacion.value = mat.ubicacion || "";
  form.proveedor_id.value = mat.proveedor_id || "";
  form.ticket_numero.value = mat.ticket_numero || "";
  form.requiere_protocolo.value = mat.requiere_protocolo ? "1" : "0";
  form.protocolo_texto.value = mat.protocolo_texto || "";
  form.precio_unitario.value = mat.precio_unitario ?? "";

  toggleProtocoloEditar();

  document.getElementById("admin-form-panel").style.display = "block";
}

document.getElementById("form-editar-material")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");

  const form = e.target;
  const id = form.dataset.id;

  const requiere = form.requiere_protocolo.value === "1";

  const payload = {
    nombre: form.nombre.value.trim(),
    stock_minimo: parseFloat(form.stock_minimo.value || 0),
    ubicacion: form.ubicacion.value.trim() || null,
    proveedor_id: form.proveedor_id.value ? Number(form.proveedor_id.value) : null,
    ticket_numero: form.ticket_numero.value.trim() || null,
    requiere_protocolo: requiere ? 1 : 0,
    protocolo_texto: requiere ? (form.protocolo_texto.value.trim() || null) : null,
    precio_unitario: form.precio_unitario.value !== "" ? Number(form.precio_unitario.value) : null
  };

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al actualizar material");

  alert("Material actualizado");
  await cargarAdminMateriales();
  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
});

document.getElementById("form-ajuste-stock")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");

  const form = e.target;
  const idMaterial = document.getElementById("form-editar-material")?.dataset?.id;
  if (!idMaterial) return alert("Selecciona un material primero.");

  const payload = {
    material_id: Number(idMaterial),
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value.trim() || null
  };

  const endpoint =
    form.tipo.value === "entrada"
      ? `${API_BASE}/movimientos/entrada`
      : `${API_BASE}/movimientos/salida`;

  const res = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al registrar movimiento");

  alert("Movimiento registrado");
  form.reset();
  await cargarAdminMateriales();
  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
});

async function eliminarMaterial(id) {
  if (!esAdmin()) return alert("Solo admin.");
  if (!confirm("¿Eliminar este material? (se desactiva)")) return;

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (!data.ok) return alert(data.message || "Error al eliminar material");

  alert("Material eliminado (desactivado)");
  await cargarAdminMateriales();
  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
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
  // si no hay token, manda a login
  if (!getToken()) return logout();

  aplicarUIporRol();

  document.getElementById("btn-logout")?.addEventListener("click", logout);``

  cargarProveedores();
  cargarMateriales();
  cargarProyectos();
  cargarMaterialesEnSelectProyecto();

  // ocultar sección admin si no admin
  if (!esAdmin()) {
    const secAdmin = document.getElementById("admin-almacen");
    if (secAdmin) secAdmin.style.display = "none";
    const secUsuarios = document.getElementById("usuarios");
    if (secUsuarios) secUsuarios.style.display = "none";
  }
})();
