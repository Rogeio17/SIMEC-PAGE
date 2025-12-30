const API_BASE = "/api";

/* ==================== AUTH HELPERS ==================== */

function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  location.href = "/login.html";
}

// fetch con JWT + manejo de 401/403
async function apiFetch(url, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    alert("No hay conexión con el servidor.");
    throw e;
  }

  if (res.status === 401) logout();
  return res;
}

/* ==================== PERMISOS UI ==================== */

let CURRENT_USER = null;

async function cargarUsuarioActual() {
  try {
    const res = await apiFetch(`${API_BASE}/auth/me`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data.ok) return;

    CURRENT_USER = data.user;

    // Ocultar botones si no es admin
    if (!esAdmin()) {
      const btnAdminAlmacen = document.querySelector('.nav-btn[data-section="admin-almacen"]');
      const btnUsuarios = document.querySelector('.nav-btn[data-section="usuarios"]');

      if (btnAdminAlmacen) btnAdminAlmacen.style.display = "none";
      if (btnUsuarios) btnUsuarios.style.display = "none";

      // Ocultar form nuevo proyecto
      const formProyecto = document.getElementById("form-proyecto");
      if (formProyecto) {
        const footer = formProyecto.closest(".card-footer");
        if (footer) footer.style.display = "none";
      }

      // Ocultar creación de proveedor
      const btnNuevoProv = document.getElementById("btn-nuevo-proveedor");
      const panelNuevoProv = document.getElementById("panel-nuevo-proveedor");
      if (btnNuevoProv) btnNuevoProv.style.display = "none";
      if (panelNuevoProv) panelNuevoProv.style.display = "none";

      // Ocultar botones de etapas (crear/cerrar)
      const btnCrearEtapa = document.getElementById("btn-crear-etapa");
      const btnCerrarEtapa = document.getElementById("btn-cerrar-etapa");
      if (btnCrearEtapa) btnCrearEtapa.style.display = "none";
      if (btnCerrarEtapa) btnCerrarEtapa.style.display = "none";
    }
  } catch (e) {
    console.error("No se pudo cargar /auth/me:", e);
  }
}

function esAdmin() {
  return CURRENT_USER?.rol === "admin";
}

/* ==================== PROVEEDORES + PROTOCOLO ==================== */

async function cargarProveedoresEnSelect(selectEl) {
  if (!selectEl) return;

  const res = await apiFetch(`${API_BASE}/proveedores`);
  const data = await res.json();

  selectEl.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— Sin proveedor —";
  selectEl.appendChild(opt0);

  if (!data.ok) return;

  data.proveedores.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nombre;
    selectEl.appendChild(opt);
  });
}

function setupProtocoloToggle(selectId, inputId) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  if (!sel || !inp) return;

  const apply = () => {
    const yes = String(sel.value) === "1";
    inp.disabled = !yes;
    if (!yes) inp.value = "";
  };

  sel.addEventListener("change", apply);
  apply();
}

function setupProveedorUI() {
  const btnNuevo = document.getElementById("btn-nuevo-proveedor");
  const panel = document.getElementById("panel-nuevo-proveedor");
  const btnGuardar = document.getElementById("btn-guardar-proveedor");

  if (btnNuevo && panel) {
    btnNuevo.onclick = () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    };
  }

  if (btnGuardar) {
    btnGuardar.onclick = async () => {
      if (!esAdmin()) return alert("Solo admin puede crear proveedores.");

      const nombre = document.getElementById("prov-nombre")?.value?.trim();
      const telefono = document.getElementById("prov-telefono")?.value?.trim() || null;
      const email = document.getElementById("prov-email")?.value?.trim() || null;
      const notas = document.getElementById("prov-notas")?.value?.trim() || null;

      if (!nombre) return alert("Nombre proveedor es requerido");

      const res = await apiFetch(`${API_BASE}/proveedores`, {
        method: "POST",
        body: JSON.stringify({ nombre, telefono, email, notas })
      });

      const data = await res.json();

      if (data.ok) {
        alert("Proveedor creado");
        document.getElementById("prov-nombre").value = "";
        document.getElementById("prov-telefono").value = "";
        document.getElementById("prov-email").value = "";
        document.getElementById("prov-notas").value = "";
        document.getElementById("panel-nuevo-proveedor").style.display = "none";

        await cargarProveedoresEnSelect(document.getElementById("select-proveedor-material"));
        await cargarProveedoresEnSelect(document.getElementById("select-proveedor-editar"));
      } else {
        alert(data.message || "Error al crear proveedor");
      }
    };
  }
}

/* ==================== EXPORT (Excel/PDF) ==================== */

async function descargarArchivo(url, nombreArchivo) {
  const res = await apiFetch(url);

  if (res.status === 403) {
    alert("No tienes permisos para exportar.");
    return;
  }

  if (!res.ok) {
    alert("No se pudo exportar.");
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

/* ==================== SECCIONES ==================== */

function mostrarSeccion(id) {
  if ((id === "admin-almacen" || id === "usuarios") && !esAdmin()) {
    alert("No tienes permisos para ver esta sección.");
    id = "materiales";
  }

  document.querySelectorAll(".seccion").forEach(sec => sec.classList.remove("activa"));
  document.getElementById(id)?.classList.add("activa");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("activa", btn.dataset.section === id);
  });

  if (id === "admin-almacen") cargarAdminMateriales();
  if (id === "movimientos") cargarMovimientosGlobal();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => mostrarSeccion(btn.dataset.section));
});

/* ==================== MATERIALES ==================== */

async function cargarMateriales() {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();
  const tbody = document.querySelector("#tabla-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (data.ok) {
    data.materiales.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.codigo}</td>
        <td>${m.nombre}</td>
        <td>${m.stock_actual}</td>
        <td>${m.ubicacion || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    alert(data.message || "Error al cargar materiales");
  }
}

document.getElementById("form-material")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) return alert("No tienes permisos para crear materiales.");

  const form = e.target;

  const payload = {
    codigo: form.codigo.value,
    nombre: form.nombre.value,
    stock_inicial: parseFloat(form.stock_inicial.value || 0),
    stock_minimo: parseFloat(form.stock_minimo.value || 0),
    ubicacion: form.ubicacion.value,

    proveedor_id: form.proveedor_id.value ? Number(form.proveedor_id.value) : null,
    ticket_numero: form.ticket_numero.value?.trim() || null,
    requiere_protocolo: Number(form.requiere_protocolo.value),
    protocolo_texto: form.protocolo_texto.value?.trim() || null,
    precio_unitario: form.precio_unitario.value ? Number(form.precio_unitario.value) : null,
  };

  const res = await apiFetch(`${API_BASE}/materiales`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Material guardado");
    form.reset();
    setupProtocoloToggle("requiere-protocolo", "protocolo-texto");
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
    cargarAdminMateriales();
  } else {
    alert(data.message || "Error al guardar material");
  }
});

/* ==================== PROYECTOS ==================== */

let proyectoSeleccionadoId = null;
let etapaActivaId = null;
let etapaSeleccionadaId = "__ALL__"; // "__ALL__" o id numérico

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
    info.textContent = `${p.clave} - ${p.nombre} (${p.estado})`;
    info.style.cursor = "pointer";
    info.onclick = () => seleccionarProyecto(p);

    const acciones = document.createElement("div");
    acciones.style.display = "flex";
    acciones.style.gap = "8px";

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

  // Por defecto mostrar todas las etapas
  etapaSeleccionadaId = "__ALL__";

  const selectEtapa = document.getElementById("select-etapa");
  if (selectEtapa) selectEtapa.value = "__ALL__";

  // Cargar datos del proyecto
  await cargarEtapaActiva(proyecto.id);
  await cargarEtapasProyecto(proyecto.id);

  // Mostrar movimientos según etapa seleccionada
  await refrescarMovimientosProyecto();
}


document.getElementById("form-proyecto")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) return alert("No tienes permisos para crear proyectos.");

  const form = e.target;
  const payload = {
    clave: form.clave.value,
    nombre: form.nombre.value,
    cliente: form.cliente.value,
    fecha_inicio: form.fecha_inicio.value,
    descripcion: form.descripcion.value
  };

  const res = await apiFetch(`${API_BASE}/proyectos`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Proyecto creado");
    form.reset();
    cargarProyectos();
  } else {
    alert(data.message || "Error al crear proyecto");
  }
});


/* ==================== ETAPAS (PROYECTOS) ==================== */


// Obtener la etapa activa del proyecto
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

// Cargar TODAS las etapas (activas y cerradas) en el select
async function cargarEtapasProyecto(proyectoId) {
  const res = await apiFetch(`${API_BASE}/proyectos/${proyectoId}/etapas`);
  const data = await res.json();

  const select = document.getElementById("select-etapa");
  const resumen = document.getElementById("etapas-resumen");

  if (!select) return;

  // Reset del select
  select.innerHTML = `<option value="__ALL__">Todas</option>`;

  if (!data.ok) {
    if (resumen) resumen.textContent = "No se pudieron cargar etapas.";
    return;
  }

  // Llenar select con etapas
  data.etapas.forEach(et => {
    const opt = document.createElement("option");
    opt.value = String(et.id);
    opt.textContent = `${et.nombre} (${et.estado})`;
    select.appendChild(opt);
  });

  // Mantener selección actual
  select.value = String(etapaSeleccionadaId);

  // Resumen visual
  if (resumen) {
    const total = data.etapas.length;
    const activas = data.etapas.filter(e => e.estado === "ACTIVA").length;
    const cerradas = data.etapas.filter(e => e.estado === "CERRADA").length;
    resumen.textContent = `Etapas: ${total} · Activas: ${activas} · Cerradas: ${cerradas}`;
  }

  // Evento al cambiar de etapa
  select.onchange = async () => {
    etapaSeleccionadaId = select.value;
    await refrescarMovimientosProyecto();
  };
}

// Decide si mostrar todas las etapas o solo una
async function refrescarMovimientosProyecto() {
  if (!proyectoSeleccionadoId) return;

  if (etapaSeleccionadaId === "__ALL__") {
    await cargarMovimientosDeProyecto(proyectoSeleccionadoId);
  } else {
    await cargarMovimientosDeProyectoPorEtapa(
      proyectoSeleccionadoId,
      etapaSeleccionadaId
    );
  }
}

// Cargar movimientos SOLO de una etapa
async function cargarMovimientosDeProyectoPorEtapa(proyectoId, etapaId) {
  const res = await apiFetch(
    `${API_BASE}/movimientos/proyecto/${proyectoId}/etapa/${etapaId}/movimientos`
  );

  const data = await res.json();
  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) {
    alert(data.message || "Error al cargar movimientos de la etapa");
    return;
  }

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

/* ==================== BOTONES ETAPAS ==================== */

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

  if (!res.ok || !data.ok) {
    return alert(data.message || "No se pudo crear la etapa");
  }

  alert("Etapa creada");

  // refrescar todo
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

  // si no hay etapa activa, no se puede cerrar
  if (!etapaActivaId) return alert("No hay etapa activa para cerrar.");

  if (!confirm("¿Cerrar la etapa activa?")) return;

  const res = await apiFetch(`${API_BASE}/etapas/${etapaActivaId}/cerrar`, {
    method: "POST"
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    return alert(data.message || "No se pudo cerrar la etapa");
  }

  alert("Etapa cerrada");

  // refrescar todo
  await cargarEtapaActiva(proyectoSeleccionadoId);
  etapaSeleccionadaId = "__ALL__";
  const select = document.getElementById("select-etapa");
  if (select) select.value = "__ALL__";
  await cargarEtapasProyecto(proyectoSeleccionadoId);
  await refrescarMovimientosProyecto();
});



/* ==================== MATERIALES EN PROYECTO ==================== */

async function cargarMaterialesEnSelectProyecto() {
  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const select = document.getElementById("select-material-proyecto");
  if (!select) return;
  select.innerHTML = "";

  if (data.ok) {
    data.materiales.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.codigo} - ${m.nombre} (stock: ${m.stock_actual})`;
      select.appendChild(opt);
    });
  }
}

document.getElementById("form-salida-proyecto")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) return alert("No tienes permisos para asignar material.");
  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");
  if (!etapaActivaId) return alert("No hay etapa activa. Crea una etapa primero.");

  const form = e.target;
  const payload = {
    material_id: parseInt(form.material_id.value),
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value,
    etapa_id: etapaActivaId
  };

  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/salida`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Material asignado al proyecto");
    form.reset();
    cargarMovimientosDeProyecto(proyectoSeleccionadoId);
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
    cargarAdminMateriales();
  } else {
    alert(data.message || "Error al asignar material");
  }
});

/* ==================== MOVIMIENTOS POR PROYECTO ==================== */

async function cargarMovimientosDeProyecto(idProyecto) {
  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${idProyecto}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (data.ok) {
    data.movimientos.forEach(mv => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(mv.creado_en).toLocaleString()}</td>
        <td>${mv.codigo} - ${mv.nombre}</td>
        <td>${mv.tipo}</td>
        <td>${mv.cantidad}</td>
        <td>${mv.comentario || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

/* ==================== ADMIN ALMACÉN ==================== */

async function cargarAdminMateriales() {
  if (!esAdmin()) return;

  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-admin-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) return;

  data.materiales.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.codigo}</td>
      <td>${m.nombre}</td>
      <td>${m.stock_actual}</td>
      <td>${m.ubicacion || ""}</td>
      <td>
        <button class="btn-edit" data-id="${m.id}">✏️ Editar</button>
        <button class="btn-delete" data-id="${m.id}">🗑 Eliminar</button>
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

  if (!data.ok) return;

  const mat = data.materiales.find(m => m.id == id);
  if (!mat) return;

  const form = document.getElementById("form-editar-material");
  if (!form) return;

  form.dataset.id = id;

  form.codigo.value = mat.codigo;
  form.nombre.value = mat.nombre;
  form.stock_minimo.value = mat.stock_minimo || 0;
  form.ubicacion.value = mat.ubicacion || "";

  // nuevas
  const selProv = document.getElementById("select-proveedor-editar");
  if (selProv) selProv.value = mat.proveedor_id || "";

  form.ticket_numero.value = mat.ticket_numero || "";
  document.getElementById("requiere-protocolo-editar").value = String(mat.requiere_protocolo || 0);
  form.protocolo_texto.value = mat.protocolo_texto || "";
  form.precio_unitario.value = mat.precio_unitario ?? "";

  setupProtocoloToggle("requiere-protocolo-editar", "protocolo-texto-editar");

  document.getElementById("admin-form-panel").style.display = "block";
}

document.getElementById("form-editar-material")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) return;

  const form = e.target;
  const id = form.dataset.id;

  const payload = {
    nombre: form.nombre.value,
    stock_minimo: parseFloat(form.stock_minimo.value),
    ubicacion: form.ubicacion.value,

    proveedor_id: form.proveedor_id.value ? Number(form.proveedor_id.value) : null,
    ticket_numero: form.ticket_numero.value?.trim() || null,
    requiere_protocolo: Number(form.requiere_protocolo.value),
    protocolo_texto: form.protocolo_texto.value?.trim() || null,
    precio_unitario: form.precio_unitario.value ? Number(form.precio_unitario.value) : null,
  };

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Material actualizado");
    cargarAdminMateriales();
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
  } else {
    alert(data.message || "Error al actualizar material");
  }
});

/* ==================== AJUSTES DE STOCK ==================== */

document.getElementById("form-ajuste-stock")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) return;

  const form = e.target;
  const idMaterial = document.getElementById("form-editar-material")?.dataset.id;

  const payload = {
    material_id: idMaterial,
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value
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

  if (data.ok) {
    alert("Movimiento registrado");
    cargarAdminMateriales();
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
  } else {
    alert(data.message || "Error al registrar movimiento");
  }
});

/* ==================== MOVIMIENTOS GLOBALES ==================== */

async function cargarMovimientosGlobal() {
  const res = await apiFetch(`${API_BASE}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-global tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (data.ok) {
    data.movimientos.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(m.creado_en).toLocaleString()}</td>
        <td>${m.nombre}</td>
        <td>${m.proyecto_id || "-"}</td>
        <td>${m.tipo}</td>
        <td>${m.cantidad}</td>
        <td>${m.comentario || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

/* ==================== ELIMINAR MATERIAL ==================== */

async function eliminarMaterial(id) {
  if (!esAdmin()) return;

  if (!confirm("¿Estás seguro de que deseas eliminar este material?")) return;

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (data.ok) {
    alert("Material eliminado (desactivado) correctamente");
    cargarAdminMateriales();
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
  } else {
    alert(data.message || "Error al eliminar material");
  }
}

/* ==================== INICIO ==================== */

document.addEventListener("DOMContentLoaded", async () => {
  await cargarUsuarioActual();

  await cargarProveedoresEnSelect(document.getElementById("select-proveedor-material"));
  await cargarProveedoresEnSelect(document.getElementById("select-proveedor-editar"));
  setupProveedorUI();

  setupProtocoloToggle("requiere-protocolo", "protocolo-texto");
  setupProtocoloToggle("requiere-protocolo-editar", "protocolo-texto-editar");

  document.getElementById("btn-export-materiales-excel")?.addEventListener("click", () => {
    descargarArchivo(`${API_BASE}/materiales/export/excel`, "materiales.xlsx");
  });

  document.getElementById("btn-export-materiales-pdf")?.addEventListener("click", () => {
    descargarArchivo(`${API_BASE}/materiales/export/pdf`, "materiales.pdf");
  });

  cargarMateriales();
  cargarProyectos();
  cargarMaterialesEnSelectProyecto();

  // default
  mostrarSeccion("materiales");
});
