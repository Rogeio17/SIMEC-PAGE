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

  if (id === "admin-almacen") cargarAdminMateriales();
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



/* ==================== MATERIALES (TABLA + BUSCADOR + CREAR) ==================== */

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

    unidad: (form.unidad?.value || "pza").trim(),

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

  await cargarMaterialesEnSelectProyecto({ limpiarFiltro: true });

  await cargarAdminMateriales(true);
});


/* ==================== PROYECTOS ==================== */
let proyectoSeleccionadoId = null;
let etapaActivaId = null;
let etapaSeleccionadaId = "__ALL__";

async function cargarProyectos() {
  const res = await apiFetch(`${API_BASE}/proyectos`);
  const data = await res.json().catch(() => ({}));

  const ul = document.getElementById("lista-proyectos");
  if (!ul) return;
  ul.innerHTML = "";

  if (!data.ok) {
    alert(data.message || "Error al cargar proyectos");
    return;
  }

  const toggleArchivados = document.getElementById("toggle-ver-archivados");
  const verArchivados = !!(toggleArchivados && toggleArchivados.checked);

  
  const proyectos = (data.proyectos || []).filter(p => {
    const estado = String(p.estado || "abierto").toLowerCase();
    return verArchivados ? true : estado !== "archivado";
  });

  proyectos.forEach(p => {
    const estado = String(p.estado || "abierto").toLowerCase();

    const li = document.createElement("li");
    li.dataset.id = p.id;                
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "10px";
    li.style.cursor = "pointer";     

    li.onclick = () => seleccionarProyecto(p);

  
    if (Number(proyectoSeleccionadoId) === Number(p.id)) {
      li.classList.add("seleccionado");
    }

    const info = document.createElement("span");
    info.textContent = `${p.clave} - ${p.nombre} (${estado})`;
    info.style.pointerEvents = "none";  

    const acciones = document.createElement("div");
    acciones.style.display = "flex";
    acciones.style.gap = "8px";

    const btnXlsx = document.createElement("button");
    btnXlsx.className = "btn-secondary";
    btnXlsx.type = "button";
    btnXlsx.textContent = "Excel";
    btnXlsx.onclick = (e) => {
      e.stopPropagation();
      descargarArchivo(
        `${API_BASE}/proyectos/${p.id}/export/excel`,
        `proyecto_${p.clave}_movimientos.xlsx`
      );
    };

    const btnPdf = document.createElement("button");
    btnPdf.className = "btn-secondary";
    btnPdf.type = "button";
    btnPdf.textContent = "PDF";
    btnPdf.onclick = (e) => {
      e.stopPropagation();
      descargarArchivo(
        `${API_BASE}/proyectos/${p.id}/export/pdf`,
        `proyecto_${p.clave}_movimientos.pdf`
      );
    };

    acciones.appendChild(btnXlsx);
    acciones.appendChild(btnPdf);

    if (esAdmin()) {
      if (estado === "archivado") {
        const btnRest = document.createElement("button");
        btnRest.className = "btn-secondary";
        btnRest.type = "button";
        btnRest.textContent = "Restaurar";
        btnRest.onclick = async (e) => {
          e.stopPropagation();

          const ok = confirm(`¿Restaurar el proyecto ${p.clave} - ${p.nombre}?`);
          if (!ok) return;

          const r = await apiFetch(`${API_BASE}/proyectos/${p.id}/restaurar`, { method: "PATCH" });
          const result = await r.json().catch(() => ({}));
          if (!result.ok) return alert(result.message || "Error al restaurar proyecto");

          alert("Proyecto restaurado");
          cargarProyectos();
        };

        acciones.appendChild(btnRest);
      } else {
        const btnArch = document.createElement("button");
        btnArch.className = "btn-secondary";
        btnArch.type = "button";
        btnArch.textContent = "Archivar";
        btnArch.onclick = async (e) => {
          e.stopPropagation();

          const ok = confirm(`¿Archivar el proyecto ${p.clave} - ${p.nombre}?`);
          if (!ok) return;

          const r = await apiFetch(`${API_BASE}/proyectos/${p.id}/archivar`, { method: "PATCH" });
          const result = await r.json().catch(() => ({}));
          if (!result.ok) return alert(result.message || "Error al archivar proyecto");

          alert("Proyecto archivado");
          cargarProyectos();
        };

        acciones.appendChild(btnArch);
      }

      const btnDel = document.createElement("button");
      btnDel.className = "btn-danger";
      btnDel.type = "button";
      btnDel.textContent = "Borrar";
      btnDel.onclick = async (e) => {
        e.stopPropagation();

        const ok = confirm(
          `¿Borrar DEFINITIVAMENTE el proyecto ${p.clave} - ${p.nombre}?\n\nEsto elimina etapas y movimientos y regresa stock.`
        );
        if (!ok) return;

        const r = await apiFetch(`${API_BASE}/proyectos/${p.id}`, { method: "DELETE" });
        const result = await r.json().catch(() => ({}));
        if (!result.ok) return alert(result.message || "Error al borrar proyecto");

        if (Number(proyectoSeleccionadoId) === Number(p.id)) {
          proyectoSeleccionadoId = null;
          etapaActivaId = null;
          const infoSel = document.getElementById("info-proyecto-seleccionado");
          if (infoSel) infoSel.textContent = "—";
        }

        alert("Proyecto borrado definitivamente");
        cargarProyectos();
      };

      acciones.appendChild(btnDel);
    }

    li.appendChild(info);
    li.appendChild(acciones);
    ul.appendChild(li);
  });
}

async function seleccionarProyecto(proyecto) {
  proyectoSeleccionadoId = proyecto.id;

 
  document.querySelectorAll("#lista-proyectos li").forEach(li => {
    li.classList.toggle("seleccionado", Number(li.dataset.id) === Number(proyecto.id));
  });

  document.getElementById("info-proyecto-seleccionado").textContent =
    `${proyecto.clave} - ${proyecto.nombre}`;

  etapaSeleccionadaId = "__ALL__";
  const selectEtapa = document.getElementById("select-etapa");
  if (selectEtapa) selectEtapa.value = "__ALL__";

  await cargarEtapaActiva(proyectoSeleccionadoId);
  await cargarEtapasProyecto(proyectoSeleccionadoId);
  await cargarMaterialesEnSelectProyecto({ limpiarFiltro: true });
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

  const data = await res.json().catch(() => ({}));
  if (!data.ok) return alert(data.message || "Error al crear proyecto");

  alert("Proyecto creado");
  form.reset();
  await cargarProyectos();
});

/* ==================== ETAPAS ==================== */

async function cargarEtapaActiva(proyectoId) {
  const res = await apiFetch(`${API_BASE}/proyectos/${proyectoId}/etapas/activa`);
  const data = await res.json().catch(() => ({}));

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
  const data = await res.json().catch(() => ({}));

  const select = document.getElementById("select-etapa");
  const resumen = document.getElementById("etapas-resumen");
  if (!select) return;

  select.innerHTML = `<option value="__ALL__">Todas</option>`;

  if (!data.ok) {
    if (resumen) resumen.textContent = "No se pudieron cargar etapas.";
    return;
  }

  (data.etapas || []).forEach(et => {
    const opt = document.createElement("option");
    opt.value = String(et.id);
    opt.textContent = `${et.nombre} (${et.estado})`;
    select.appendChild(opt);
  });

  select.value = String(etapaSeleccionadaId);

  if (resumen) {
    const total = (data.etapas || []).length;
    const activas = (data.etapas || []).filter(e => e.estado === "ACTIVA").length;
    const cerradas = (data.etapas || []).filter(e => e.estado === "CERRADA").length;
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

  const data = await res.json().catch(() => ({}));
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
  const data = await res.json().catch(() => ({}));
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

  select.innerHTML = "";

  (lista || []).forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;

    const codigoTxt = (m.codigo && String(m.codigo).trim() !== "") ? String(m.codigo).trim() : "S/C";
    const unidadTxt = (m.unidad && String(m.unidad).trim() !== "") ? String(m.unidad).trim() : "pza";
    const stockTxt  = (m.stock_actual !== undefined && m.stock_actual !== null) ? m.stock_actual : 0;

    opt.textContent = `${codigoTxt} - ${m.nombre} (${unidadTxt}) | stock: ${stockTxt}`;

    
    opt.dataset.unidad = unidadTxt;

    select.appendChild(opt);
  });

  refrescarUnidadCantidadProyecto();
}

function refrescarUnidadCantidadProyecto() {
  const select = document.getElementById("select-material-proyecto");
  if (!select) return;

  const u = select.selectedOptions?.[0]?.dataset?.unidad || "pza";


  const sp = document.getElementById("unidad-seleccionada");
  if (sp) sp.textContent = `(${u})`;

 
  const inputQty = document.querySelector('#form-salida-proyecto input[name="cantidad"]');
  if (inputQty) {
    inputQty.step = (u === "pza") ? "1" : "0.01";
    inputQty.min  = (u === "pza") ? "1" : "0.01";
  }
}

document.getElementById("select-material-proyecto")
  ?.addEventListener("change", refrescarUnidadCantidadProyecto);

function filtrarMaterialesSelect(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return materialesSelectCache;

  return materialesSelectCache.filter(m => {
    const codigo = (m.codigo ?? "").toString();
    const nombre = (m.nombre ?? "").toString();
    const unidad = (m.unidad ?? "").toString();

    
    const texto = `${codigo} ${nombre} ${unidad}`.toLowerCase();
    return texto.includes(q);
  });
}

async function cargarMaterialesEnSelectProyecto({ limpiarFiltro = false } = {}) {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json().catch(() => ({}));

  if (!data.ok) {
    alert(data.message || "Error al cargar materiales para proyectos");
    return;
  }

  materialesSelectCache = data.materiales || [];

  
  const inputBuscar = document.getElementById("buscar-material-proyecto");
  if (limpiarFiltro && inputBuscar) inputBuscar.value = "";

  const q = inputBuscar?.value || "";
  renderSelectMateriales(filtrarMaterialesSelect(q));
}

document.getElementById("buscar-material-proyecto")?.addEventListener("input", (e) => {
  renderSelectMateriales(filtrarMaterialesSelect(e.target.value));
});

/* ==================== MOVIMIENTOS PROYECTO (TABLA) ==================== */

async function cargarMovimientosDeProyecto(proyectoId) {
  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoId}/movimientos`);
  const data = await res.json().catch(() => ({}));

  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar movimientos del proyecto");

  (data.movimientos || []).forEach(mv => {
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
  const data = await res.json().catch(() => ({}));

  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar movimientos de la etapa");

  (data.movimientos || []).forEach(mv => {
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

  const data = await res.json().catch(() => ({}));
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
  const dataAll = await resAll.json().catch(() => ({}));
  if (!dataAll.ok) return;

  const totalProyecto = (dataAll.movimientos || []).reduce((acc, mv) => {
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
  const dataEt = await resEt.json().catch(() => ({}));
  if (!dataEt.ok) return;

  const totalEtapa = (dataEt.movimientos || []).reduce((acc, mv) => {
    const total = mv.total ?? (Number(mv.precio_unitario || 0) * Number(mv.cantidad || 0));
    return acc + Number(total || 0);
  }, 0);

  const te = document.getElementById("total-etapa");
  if (te) te.textContent = money(totalEtapa);
}



document.getElementById("btn-export-etapa-excel")?.addEventListener("click", (e) => {
  e.preventDefault();

  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero.");


  if (etapaSeleccionadaId === "__ALL__" || !etapaSeleccionadaId) {
    return descargarArchivo(
      `${API_BASE}/proyectos/${proyectoSeleccionadoId}/export/excel`,
      `proyecto_${proyectoSeleccionadoId}_movimientos.xlsx`
    );
  }

  
  descargarArchivo(
    `${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/excel`,
    `proyecto_${proyectoSeleccionadoId}_etapa_${etapaSeleccionadaId}.xlsx`
  );
});

document.getElementById("btn-export-etapa-pdf")?.addEventListener("click", (e) => {
  e.preventDefault();

  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero.");


  if (etapaSeleccionadaId === "__ALL__" || !etapaSeleccionadaId) {
    return descargarArchivo(
      `${API_BASE}/proyectos/${proyectoSeleccionadoId}/export/pdf`,
      `proyecto_${proyectoSeleccionadoId}_movimientos.pdf`
    );
  }

 
  descargarArchivo(
    `${API_BASE}/proyectos/${proyectoSeleccionadoId}/etapas/${etapaSeleccionadaId}/export/pdf`,
    `proyecto_${proyectoSeleccionadoId}_etapa_${etapaSeleccionadaId}.pdf`
  );
});


/* ==================== ADMIN ALMACÉN (material + lotes) ==================== */

let adminMaterialSeleccionado = null;
let adminMaterialesCache = [];
let adminLotesCache = [];
let loteEditando = null;

function setAdminPanelVisible(visible) {
  const panel = document.getElementById("admin-panel");
  const vacio = document.getElementById("admin-panel-vacio");
  if (panel) panel.style.display = visible ? "block" : "none";
  if (vacio) vacio.style.display = visible ? "none" : "block";
}

function toggleProtocoloCrearLote() {
  const sel = document.getElementById("select-lote-requiere-protocolo");
  const grupo = document.getElementById("grupo-lote-protocolo");
  if (!sel || !grupo) return;
  grupo.style.display = sel.value === "1" ? "block" : "none";
}
document.getElementById("select-lote-requiere-protocolo")?.addEventListener("change", toggleProtocoloCrearLote);

function toggleProtocoloEditarLote() {
  const sel = document.getElementById("select-editar-lote-requiere-protocolo");
  const grupo = document.getElementById("grupo-editar-lote-protocolo");
  if (!sel || !grupo) return;
  grupo.style.display = sel.value === "1" ? "block" : "none";
}
document.getElementById("select-editar-lote-requiere-protocolo")?.addEventListener("change", toggleProtocoloEditarLote);

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
        <button class="btn-secondary" type="button" data-ver="${m.id}">Ver</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-ver]").forEach(btn => {
    btn.onclick = () => seleccionarMaterialAdmin(btn.dataset.ver);
  });
}

async function cargarAdminMateriales(silencioso = false) {
  if (!esAdmin()) return;

  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json().catch(() => ({}));

  if (!data.ok) {
    if (!silencioso) alert(data.message || "Error al cargar materiales (admin)");
    return;
  }

  adminMaterialesCache = data.materiales || [];
  const q = document.getElementById("buscar-admin-material")?.value || "";
  const filtrados = q
    ? adminMaterialesCache.filter(m => `${m.codigo} ${m.nombre}`.toLowerCase().includes(q.toLowerCase()))
    : adminMaterialesCache;

  renderAdminMaterialesTabla(filtrados);

  if (adminMaterialSeleccionado) {
    const existe = adminMaterialesCache.find(x => String(x.id) === String(adminMaterialSeleccionado.id));
    if (existe) await seleccionarMaterialAdmin(existe.id, true);
  }
}

async function seleccionarMaterialAdmin(materialId, silencioso = false) {
  const mat = adminMaterialesCache.find(x => String(x.id) === String(materialId));
  if (!mat) return;

  adminMaterialSeleccionado = mat;
  loteEditando = null;
  document.getElementById("panel-editar-lote").style.display = "none";

  const lbl = document.getElementById("admin-material-seleccionado");
  if (lbl) lbl.textContent = `${mat.codigo} - ${mat.nombre}`;

  setAdminPanelVisible(true);

  const f = document.getElementById("form-editar-material-base");
  if (f) {
    f.nombre.value = mat.nombre || "";
    f.codigo.value = mat.codigo || "";
    if (f.unidad) f.unidad.value = (mat.unidad || "pza");
    f.stock_minimo.value = mat.stock_minimo ?? 0;
    f.ubicacion.value = mat.ubicacion || "";
    
  }

  document.getElementById("btn-desactivar-material")?.addEventListener("click", async () => {
    await desactivarMaterialSeleccionado();
  });

  await cargarProveedores();
  await cargarLotesMaterial(mat.id, silencioso);
}

async function cargarLotesMaterial(materialId, silencioso = false) {
  const res = await apiFetch(`${API_BASE}/materiales/${materialId}/lotes`);
  const data = await res.json().catch(() => ({}));

  if (!data.ok) {
    if (!silencioso) alert(data.message || "No se pudieron cargar lotes");
    return;
  }

  adminLotesCache = data.lotes || [];

  const tbody = document.querySelector("#tabla-admin-lotes tbody");
  if (tbody) tbody.innerHTML = "";

  const selectAjuste = document.getElementById("select-ajuste-lote");
  if (selectAjuste) selectAjuste.innerHTML = "";

  adminLotesCache.forEach(l => {
    const nombreLote = l.nombre_lote || l.lote_codigo || `Lote ${l.id}`;
    const prov = l.proveedor_nombre || "";
    const precioTxt = (l.precio_unitario != null && l.precio_unitario !== "") ? Number(l.precio_unitario).toFixed(2) : "";

    if (tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${l.id}</td>
        <td>${nombreLote}</td>
        <td>${prov}</td>
        <td>${precioTxt}</td>
        <td>${l.ticket_numero || ""}</td>
        <td>${l.requiere_protocolo ? (l.protocolo_texto || "Sí") : "No"}</td>
        <td>${l.cantidad_inicial ?? ""}</td>
        <td>${l.cantidad_disponible ?? ""}</td>
        <td style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-secondary" type="button" data-edit-lote="${l.id}">✏️ Editar</button>
          <button class="btn-secondary" type="button" data-del-lote="${l.id}">🗑 Desactivar</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (selectAjuste) {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = `${nombreLote}${prov ? " · " + prov : ""}${precioTxt ? " · $" + precioTxt : ""} · disp:${l.cantidad_disponible}`;
      selectAjuste.appendChild(opt);
    }
  });

  tbody?.querySelectorAll("button[data-del-lote]")?.forEach(btn => {
    btn.onclick = () => eliminarLote(btn.dataset.delLote);
  });

  tbody?.querySelectorAll("button[data-edit-lote]")?.forEach(btn => {
    btn.onclick = () => abrirEditorLote(btn.dataset.editLote);
  });
}

/* ====== Editar material base ====== */

document.getElementById("form-editar-material-base")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");
  if (!adminMaterialSeleccionado) return alert("Selecciona un material.");

  const form = e.target;

  const payload = {
    nombre: form.nombre.value.trim(),
    codigo: (form.codigo?.value ?? "").trim(),
    unidad: (form.unidad?.value ?? "pza").trim(),
    stock_minimo: Number(form.stock_minimo.value || 0),
    ubicacion: form.ubicacion.value.trim() || null
  };

  const res = await apiFetch(`${API_BASE}/materiales/${adminMaterialSeleccionado.id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!data.ok) return alert(data.message || "No se pudo actualizar el material");

  alert("Material actualizado");
  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
  await cargarAdminMateriales(true);
});

document.getElementById("form-crear-lote")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");
  if (!adminMaterialSeleccionado) return alert("Selecciona un material.");

  const form = e.target;

  const requiere = form.requiere_protocolo.value === "1";

  const loteCodigo = (form.lote_codigo?.value || form.nombre_lote?.value || "").trim();
  if (!loteCodigo) return alert("Lote / Código de lote es requerido.");

  const payload = {
    lote_codigo: loteCodigo,
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

  const data = await res.json().catch(() => ({}));
  if (!data.ok) return alert(data.message || "No se pudo crear el lote");

  alert("Lote creado y stock actualizado");
  form.reset();
  toggleProtocoloCrearLote();

  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
  await cargarAdminMateriales(true);
  await cargarLotesMaterial(adminMaterialSeleccionado.id, true);
});



/* ====== Ajuste de stock SIN LOTE (desde Editar material) ====== */
document.getElementById("form-ajustar-material-sin-lote")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");
  if (!adminMaterialSeleccionado) return alert("Selecciona un material.");

  const form = e.target;

  const tipo = String(form.tipo.value || "").toLowerCase(); // entrada | salida
  const qty = Number(form.cantidad.value);
  const comentario = form.comentario.value.trim() || null;

  if (!Number.isFinite(qty) || qty <= 0) {
    return alert("Cantidad debe ser mayor a 0.");
  }

  const endpoint = (tipo === "entrada")
    ? `${API_BASE}/movimientos/entrada-general`
    : `${API_BASE}/movimientos/salida-general`;

  const payload = {
    material_id: adminMaterialSeleccionado.id,
    cantidad: qty,
    comentario
  };

  const res = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!data.ok) return alert(data.message || "No se pudo aplicar el ajuste");

  alert(tipo === "entrada" ? "Entrada registrada" : "Salida registrada");
  form.reset();

  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
  await cargarAdminMateriales(true);
});


/* ====== Editar lote ====== */

function abrirEditorLote(loteId) {
  const l = adminLotesCache.find(x => String(x.id) === String(loteId));
  if (!l) return;

  loteEditando = l;

  const panel = document.getElementById("panel-editar-lote");
  panel.style.display = "block";

  const form = document.getElementById("form-editar-lote");
  const nombreLote = l.nombre_lote || l.lote_codigo || "";

  form.nombre_lote.value = nombreLote;
  form.proveedor_id.value = l.proveedor_id || "";
  form.precio_unitario.value = (l.precio_unitario ?? "");
  form.ticket_numero.value = l.ticket_numero || "";
  form.requiere_protocolo.value = l.requiere_protocolo ? "1" : "0";
  form.protocolo_texto.value = l.protocolo_texto || "";

  toggleProtocoloEditarLote();
}

document.getElementById("btn-cancelar-editar-lote")?.addEventListener("click", () => {
  loteEditando = null;
  document.getElementById("panel-editar-lote").style.display = "none";
});

document.getElementById("form-editar-lote")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!esAdmin()) return alert("Solo admin.");
  if (!loteEditando) return alert("No hay lote seleccionado para editar.");

  const form = e.target;
  const nombreLote = (form.nombre_lote.value || "").trim();
  if (!nombreLote) return alert("Nombre de lote es requerido.");

  const requiere = form.requiere_protocolo.value === "1";

  const payload = {
    lote_codigo: nombreLote,
    proveedor_id: form.proveedor_id.value ? Number(form.proveedor_id.value) : null,
    precio_unitario: form.precio_unitario.value !== "" ? Number(form.precio_unitario.value) : null,
    ticket_numero: form.ticket_numero.value.trim() || null,
    requiere_protocolo: requiere ? 1 : 0,
    protocolo_texto: requiere ? (form.protocolo_texto.value.trim() || null) : null
  };

  const res = await apiFetch(`${API_BASE}/lotes/${loteEditando.id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!data.ok) return alert(data.message || "No se pudo actualizar el lote");

  alert("Lote actualizado");
  loteEditando = null;
  document.getElementById("panel-editar-lote").style.display = "none";

  await cargarAdminMateriales(true);
  if (adminMaterialSeleccionado) await cargarLotesMaterial(adminMaterialSeleccionado.id, true);
});

/* ====== Eliminar lote/material ====== */

async function eliminarLote(loteId) {
  if (!esAdmin()) return alert("Solo admin.");
  if (!confirm("¿Desactivar este lote? (No se borra historial)")) return;

  const res = await apiFetch(`${API_BASE}/lotes/${loteId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));

  if (!data.ok) return alert(data.message || "No se pudo desactivar el lote");

  alert("Lote desactivado");
  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
  await cargarAdminMateriales(true);
  if (adminMaterialSeleccionado) await cargarLotesMaterial(adminMaterialSeleccionado.id, true);
}

async function desactivarMaterialSeleccionado() {
  if (!esAdmin()) return alert("Solo admin.");
  if (!adminMaterialSeleccionado) return alert("Selecciona un material.");
  if (!confirm("¿Desactivar este material?")) return;

  const res = await apiFetch(`${API_BASE}/materiales/${adminMaterialSeleccionado.id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));

  if (!data.ok) return alert(data.message || "Error al desactivar material");

  alert("Material desactivado");
  adminMaterialSeleccionado = null;
  setAdminPanelVisible(false);

  await cargarMateriales();
  await cargarMaterialesEnSelectProyecto();
  await cargarAdminMateriales(true);
}

/* ==================== MOVIMIENTOS GLOBALES ==================== */

async function cargarMovimientosGlobal() {
  const res = await apiFetch(`${API_BASE}/movimientos`);
  const data = await res.json().catch(() => ({}));

  const tbody = document.querySelector("#tabla-movimientos-global tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "Error al cargar movimientos globales");

  (data.movimientos || []).forEach(mv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>${new Date(mv.creado_en).toLocaleString()}</td>
  <td>${mv.material_nombre || mv.nombre || "-"}</td>
  <td>${mv.proyecto_id ? `${mv.proyecto_clave || ""} - ${mv.proyecto_nombre || ""}`.trim() : "-"}</td>
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
  const data = await res.json().catch(() => ({}));

  const tbody = document.querySelector("#tabla-usuarios tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return alert(data.message || "No se pudo cargar usuarios");

  (data.usuarios || []).forEach(u => {
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

  const data = await res.json().catch(() => ({}));
  if (!data.ok) return alert(data.message || "Error al crear usuario");

  alert("Usuario creado");
  form.reset();
  await cargarUsuarios();
});
/* ==================== PROVEEDORES ==================== */

async function apiFetchAuth(url, options = {}) {
  const headers = options.headers || {};
  const token = getToken?.() || localStorage.getItem("token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

function limpiarFormProveedor() {
  document.getElementById("prov_id").value = "";
  document.getElementById("formProveedor").reset();
  document.getElementById("btnGuardarProveedor").textContent = "Guardar proveedor";
}

function getProveedorFormData() {
  return {
    nombre_comercial: document.getElementById("prov_nombre_comercial").value.trim(),
    razon_social: document.getElementById("prov_razon_social").value.trim(),
    rfc: document.getElementById("prov_rfc").value.trim(),
    regimen_fiscal: document.getElementById("prov_regimen").value.trim(),
    uso_cfdi: document.getElementById("prov_uso_cfdi").value.trim(),
    contacto: document.getElementById("prov_contacto").value.trim(),
    telefono: document.getElementById("prov_telefono").value.trim(),
    correo: document.getElementById("prov_correo").value.trim(),
    direccion: document.getElementById("prov_direccion").value.trim(),
    notas: document.getElementById("prov_notas").value.trim(),
  };
}

async function cargarProveedores() {
  const q = (document.getElementById("prov_buscar")?.value || "").trim();
  const activo = document.getElementById("prov_filtro_activo")?.value ?? "1";

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (activo !== "all") params.set("activo", activo);

  const res = await apiFetchAuth(`${API_BASE}/proveedores?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error cargando proveedores");

  const tbody = document.getElementById("tbodyProveedores");
  tbody.innerHTML = "";

  (data.proveedores || []).forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(p.nombre_comercial || "")}</strong><br/>
        <span class="muted">${escapeHtml(p.razon_social || "")}</span>
      </td>
      <td>${escapeHtml(p.rfc || "")}</td>
      <td>${escapeHtml(p.contacto || "")}</td>
      <td>${escapeHtml(p.telefono || "")}</td>
      <td>${escapeHtml(p.correo || "")}</td>
      <td>${p.activo ? "Activo" : "Inactivo"}</td>
      <td>
        <button class="btn" onclick='editarProveedor(${JSON.stringify(p).replaceAll("'", "\\'")})'>Editar</button>
        ${
          p.activo
            ? `<button class="btn" onclick="desactivarProveedor(${p.id})">Desactivar</button>`
            : `<button class="btn" onclick="activarProveedor(${p.id})">Activar</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editarProveedor(p) {
  document.getElementById("prov_id").value = p.id;
  document.getElementById("prov_nombre_comercial").value = p.nombre_comercial || "";
  document.getElementById("prov_razon_social").value = p.razon_social || "";
  document.getElementById("prov_rfc").value = p.rfc || "";
  document.getElementById("prov_regimen").value = p.regimen_fiscal || "";
  document.getElementById("prov_uso_cfdi").value = p.uso_cfdi || "";
  document.getElementById("prov_contacto").value = p.contacto || "";
  document.getElementById("prov_telefono").value = p.telefono || "";
  document.getElementById("prov_correo").value = p.correo || "";
  document.getElementById("prov_direccion").value = p.direccion || "";
  document.getElementById("prov_notas").value = p.notas || "";
  document.getElementById("btnGuardarProveedor").textContent = "Actualizar proveedor";
  document.getElementById("proveedores").scrollIntoView({ behavior: "smooth" });
}

async function guardarProveedor(e) {
  e.preventDefault();
  const id = document.getElementById("prov_id").value;
  const payload = getProveedorFormData();

  if (!payload.nombre_comercial || !payload.razon_social) {
    alert("Nombre comercial y razón social son obligatorios.");
    return;
  }

  const url = id ? `${API_BASE}/proveedores/${id}` : `${API_BASE}/proveedores`;
  const method = id ? "PUT" : "POST";

  const res = await apiFetchAuth(url, { method, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error guardando proveedor");

  limpiarFormProveedor();
  await cargarProveedores();
  alert(id ? "Proveedor actualizado." : "Proveedor registrado.");
}

async function desactivarProveedor(id) {
  if (!confirm("¿Desactivar proveedor? (No se borra, solo queda inactivo)")) return;
  const res = await apiFetchAuth(`${API_BASE}/proveedores/${id}/desactivar`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error desactivando");
  await cargarProveedores();
}

async function activarProveedor(id) {
  const res = await apiFetchAuth(`${API_BASE}/proveedores/${id}/activar`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Error activando");
  await cargarProveedores();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initProveedoresUI() {
  const form = document.getElementById("formProveedor");
  if (form) form.addEventListener("submit", guardarProveedor);

  document.getElementById("btnLimpiarProveedor")?.addEventListener("click", limpiarFormProveedor);
  document.getElementById("btnRefrescarProveedores")?.addEventListener("click", cargarProveedores);

  document.getElementById("prov_buscar")?.addEventListener("input", () => {
    clearTimeout(window.__provTimer);
    window.__provTimer = setTimeout(cargarProveedores, 250);
  });

  document.getElementById("prov_filtro_activo")?.addEventListener("change", cargarProveedores);
}

initProveedoresUI();

/// Cargar proveedores en selects
async function cargarProveedoresSelects() {
  const selects = [
    document.getElementById("select-proveedor-material"),
    document.getElementById("select-proveedor-lote"),
  ].filter(Boolean);

  if (!selects.length) return;

  const res = await apiFetchAuth(`${API_BASE}/proveedores?activo=1`);
  const data = await res.json();

  selects.forEach(sel => {
    sel.innerHTML = `<option value="">— Selecciona proveedor —</option>`;
    (data.proveedores || []).forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.nombre_comercial;
      sel.appendChild(opt);
    });
  });
}


/* ==================== INIT ==================== */

(function init() {
  if (!getToken()) return logout();

  aplicarUIporRol();
  document.getElementById("btn-logout")?.addEventListener("click", logout);

  cargarMateriales();
  cargarProyectos();
  cargarMaterialesEnSelectProyecto();
  cargarProveedores();

  setAdminPanelVisible(false);

  if (!esAdmin()) {
    const secAdmin = document.getElementById("admin-almacen");
    if (secAdmin) secAdmin.style.display = "none";
    const secUsuarios = document.getElementById("usuarios");
    if (secUsuarios) secUsuarios.style.display = "none";
  }
})();
(function initToggleArchivados(){
  const t = document.getElementById("toggle-ver-archivados");
  if (!t) return;
  t.addEventListener("change", cargarProyectos);
})();

