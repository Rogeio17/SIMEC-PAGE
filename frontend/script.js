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

  const res = await fetch(url, { ...options, headers });

  // Si el backend exige login y no hay token o expiró
  if (res.status === 401) logout();

  return res;
}
// Descargar archivo (Excel/PDF)
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
document.getElementById("btn-export-materiales-excel")?.addEventListener("click", () => {
  descargarArchivo(`${API_BASE}/materiales/export/excel`, "materiales.xlsx");
});

document.getElementById("btn-export-materiales-pdf")?.addEventListener("click", () => {
  descargarArchivo(`${API_BASE}/materiales/export/pdf`, "materiales.pdf");
});


/* ==================== PERMISOS UI ==================== */

let CURRENT_USER = null;

async function cargarUsuarioActual() {
  try {
    const res = await apiFetch(`${API_BASE}/auth/me`);
    const data = await res.json();
    if (!data.ok) return;

    CURRENT_USER = data.user;
    const esAdmin = CURRENT_USER?.rol === "admin";

    // Ocultar botones del sidebar si no es admin
    const btnAdminAlmacen = document.querySelector('.nav-btn[data-section="admin-almacen"]');
    const btnUsuarios = document.querySelector('.nav-btn[data-section="usuarios"]');

    if (!esAdmin) {
      if (btnAdminAlmacen) btnAdminAlmacen.style.display = "none";
      if (btnUsuarios) btnUsuarios.style.display = "none";

      // Ocultar bloque "Nuevo Proyecto" (card-footer que contiene el form)
      const formProyecto = document.getElementById("form-proyecto");
      if (formProyecto) {
        const footer = formProyecto.closest(".card-footer");
        if (footer) footer.style.display = "none";
      }
    }
  } catch (e) {
    console.error("Permisos UI error:", e);
  }
}

function esAdmin() {
  return CURRENT_USER?.rol === "admin";
}

/* ==================== SECCIONES ==================== */

function mostrarSeccion(id) {
  // Bloqueo local de secciones admin
  if ((id === "admin-almacen" || id === "usuarios") && !esAdmin()) {
    alert("No tienes permisos para ver esta sección.");
    id = "materiales";
  }

  document.querySelectorAll(".seccion").forEach(sec => sec.classList.remove("activa"));
  const target = document.getElementById(id);
  if (target) target.classList.add("activa");

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

/* ==================== USUARIOS ==================== */

async function cargarUsuarios() {
  const res = await apiFetch(`${API_BASE}/users`);
  if (res.status === 403) {
    alert("No tienes permisos para ver Usuarios.");
    mostrarSeccion("materiales");
    return;
  }

  const data = await res.json();

  const tbody = document.querySelector("#tabla-usuarios tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) {
    alert(data.message || "No se pudo cargar usuarios");
    return;
  }

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

document.getElementById("form-usuario")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!esAdmin()) {
    alert("No tienes permisos para crear usuarios.");
    return;
  }

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

  if (res.status === 403) {
    alert("No tienes permisos para crear usuarios.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Usuario creado");
    form.reset();
    cargarUsuarios();
  } else {
    alert(data.message || "Error al crear usuario");
  }
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

  if (!esAdmin()) {
    alert("No tienes permisos para crear materiales.");
    return;
  }

  const form = e.target;
  const payload = {
    codigo: form.codigo.value,
    nombre: form.nombre.value,
    stock_inicial: parseFloat(form.stock_inicial.value || 0),
    stock_minimo: parseFloat(form.stock_minimo.value || 0),
    ubicacion: form.ubicacion.value
  };

  const res = await apiFetch(`${API_BASE}/materiales`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (res.status === 403) {
    alert("No tienes permisos para crear materiales.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Material guardado");
    form.reset();
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
  } else {
    alert(data.message || "Error al guardar material");
  }
});

/* ==================== PROYECTOS ==================== */

let proyectoSeleccionadoId = null;

async function cargarProyectos() {
  const res = await apiFetch(`${API_BASE}/proyectos`);
  const data = await res.json();

  const ul = document.getElementById("lista-proyectos");
  if (!ul) return;
  ul.innerHTML = "";

  if (data.ok) {
    data.proyectos.forEach(p => {
  const li = document.createElement("li");
  li.style.display = "flex";
  li.style.alignItems = "center";
  li.style.justifyContent = "space-between";
  li.style.gap = "10px";

  const info = document.createElement("span");
  info.textContent = `${p.clave} - ${p.nombre}`;
  info.style.cursor = "pointer";
  info.onclick = () => seleccionarProyecto(p);

  const acciones = document.createElement("div");
  acciones.style.display = "flex";
  acciones.style.gap = "8px";

  const btnExcel = document.createElement("button");
  btnExcel.className = "btn-secondary";
  btnExcel.textContent = "Excel";
  btnExcel.onclick = (e) => {
    e.stopPropagation();
    descargarArchivo(
      `${API_BASE}/proyectos/${p.id}/export/excel`,
      `proyecto_${p.clave}_movimientos.xlsx`
    );
  };

  const btnPdf = document.createElement("button");
  btnPdf.className = "btn-secondary";
  btnPdf.textContent = "PDF";
  btnPdf.onclick = (e) => {
    e.stopPropagation();
    descargarArchivo(
      `${API_BASE}/proyectos/${p.id}/export/pdf`,
      `proyecto_${p.clave}_movimientos.pdf`
    );
  };

  acciones.appendChild(btnExcel);
  acciones.appendChild(btnPdf);

  li.appendChild(info);
  li.appendChild(acciones);
  ul.appendChild(li);
});

  } else {
    alert(data.message || "Error al cargar proyectos");
  }
}

function seleccionarProyecto(proyecto) {
  proyectoSeleccionadoId = proyecto.id;
  const info = document.getElementById("info-proyecto-seleccionado");
  if (info) info.textContent = `${proyecto.clave} - ${proyecto.nombre}`;

  cargarMovimientosDeProyecto(proyecto.id);
}

document.getElementById("form-proyecto")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) {
    alert("No tienes permisos para crear proyectos.");
    return;
  }

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

  if (res.status === 403) {
    alert("No tienes permisos para crear proyectos.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Proyecto creado");
    form.reset();
    cargarProyectos();
  } else {
    alert(data.message || "Error al crear proyecto");
  }
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
  } else {
    alert(data.message || "Error al cargar materiales para proyectos");
  }
}

document.getElementById("form-salida-proyecto")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");

  if (!esAdmin()) {
    alert("No tienes permisos para asignar material (salida).");
    return;
  }

  const form = e.target;
  const payload = {
    material_id: parseInt(form.material_id.value),
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value
  };

  const res = await apiFetch(`${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/salida`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (res.status === 403) {
    alert("No tienes permisos para asignar material (salida).");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Material asignado al proyecto");
    form.reset();
    cargarMovimientosDeProyecto(proyectoSeleccionadoId);
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
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
  } else {
    alert(data.message || "Error al cargar movimientos del proyecto");
  }
}

/* ==================== ADMIN ALMACÉN ==================== */

async function cargarAdminMateriales() {
  if (!esAdmin()) {
    alert("No tienes permisos para Admin Almacén.");
    mostrarSeccion("materiales");
    return;
  }

  const res = await apiFetch(`${API_BASE}/materiales`);
  if (res.status === 403) {
    alert("No tienes permisos para Admin Almacén.");
    mostrarSeccion("materiales");
    return;
  }

  const data = await res.json();

  const tbody = document.querySelector("#tabla-admin-materiales tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data.ok) {
    alert(data.message || "Error al cargar admin materiales");
    return;
  }

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
  if (!esAdmin()) {
    alert("No tienes permisos para editar materiales.");
    return;
  }

  const res = await apiFetch(`${API_BASE}/materiales`);
  const data = await res.json();

  if (!data.ok) {
    alert(data.message || "Error al cargar materiales");
    return;
  }

  const mat = data.materiales.find(m => m.id == id);
  if (!mat) return;

  const form = document.getElementById("form-editar-material");
  if (!form) return;

  form.dataset.id = id;

  form.codigo.value = mat.codigo;
  form.nombre.value = mat.nombre;
  form.stock_minimo.value = mat.stock_minimo || 0;
  form.ubicacion.value = mat.ubicacion || "";

  const panel = document.getElementById("admin-form-panel");
  if (panel) panel.style.display = "block";
}

document.getElementById("form-editar-material")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) {
    alert("No tienes permisos para actualizar materiales.");
    return;
  }

  const form = e.target;
  const id = form.dataset.id;

  const payload = {
    nombre: form.nombre.value,
    stock_minimo: parseFloat(form.stock_minimo.value),
    ubicacion: form.ubicacion.value
  };

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  if (res.status === 403) {
    alert("No tienes permisos para actualizar materiales.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Material actualizado");
    cargarAdminMateriales();
    cargarMateriales();
  } else {
    alert(data.message || "Error al actualizar material");
  }
});

/* ==================== AJUSTES DE STOCK ==================== */

document.getElementById("form-ajuste-stock")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!esAdmin()) {
    alert("No tienes permisos para ajustar stock.");
    return;
  }

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

  if (res.status === 403) {
    alert("No tienes permisos para ajustar stock.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Movimiento registrado");
    cargarAdminMateriales();
    cargarMateriales();
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
  } else {
    alert(data.message || "Error al cargar movimientos globales");
  }
}

/* ==================== ELIMINAR MATERIAL / PROYECTO ==================== */

async function eliminarMaterial(id) {
  if (!esAdmin()) {
    alert("No tienes permisos para eliminar materiales.");
    return;
  }

  if (!confirm("¿Estás seguro de que deseas eliminar este material?")) return;

  const res = await apiFetch(`${API_BASE}/materiales/${id}`, {
    method: "DELETE"
  });

  if (res.status === 403) {
    alert("No tienes permisos para eliminar materiales.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Material eliminado correctamente");
    cargarAdminMateriales();
    cargarMateriales();
  } else {
    alert(data.message || "Error al eliminar material");
  }
}

async function eliminarProyecto(id) {
  if (!esAdmin()) {
    alert("No tienes permisos para eliminar proyectos.");
    return;
  }

  if (!confirm("¿Eliminar proyecto?")) return;

  const res = await apiFetch(`${API_BASE}/proyectos/${id}`, {
    method: "DELETE"
  });

  if (res.status === 403) {
    alert("No tienes permisos para eliminar proyectos.");
    return;
  }

  const data = await res.json();

  if (data.ok) {
    alert("Proyecto eliminado");
    cargarProyectos();
  } else {
    alert(data.message || "Error al eliminar proyecto");
  }
}

/* ==================== INICIO ==================== */

(async () => {
  await cargarUsuarioActual();
  cargarMateriales();
  cargarProyectos();
  cargarMaterialesEnSelectProyecto();
})();

