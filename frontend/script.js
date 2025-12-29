const API_BASE = "/api";

/* ==================== SECCIONES ==================== */

function mostrarSeccion(id) {
  document.querySelectorAll(".seccion").forEach(sec => sec.classList.remove("activa"));
  document.getElementById(id).classList.add("activa");

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
  const res = await fetch(`${API_BASE}/materiales`);
  const data = await res.json();
  const tbody = document.querySelector("#tabla-materiales tbody");
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
  }
}

document.getElementById("form-material").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const payload = {
    codigo: form.codigo.value,
    nombre: form.nombre.value,
    stock_inicial: parseFloat(form.stock_inicial.value || 0),
    stock_minimo: parseFloat(form.stock_minimo.value || 0),
    ubicacion: form.ubicacion.value
  };

  const res = await fetch(`${API_BASE}/materiales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

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
  const res = await fetch(`${API_BASE}/proyectos`);
  const data = await res.json();

  const ul = document.getElementById("lista-proyectos");
  ul.innerHTML = "";

  if (data.ok) {
    data.proyectos.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.clave} - ${p.nombre}`;
      li.onclick = () => seleccionarProyecto(p);
      ul.appendChild(li);
    });
  }
}

function seleccionarProyecto(proyecto) {
  proyectoSeleccionadoId = proyecto.id;
  document.getElementById("info-proyecto-seleccionado").textContent =
    `${proyecto.clave} - ${proyecto.nombre}`;

  cargarMovimientosDeProyecto(proyecto.id);
}

document.getElementById("form-proyecto").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const payload = {
    clave: form.clave.value,
    nombre: form.nombre.value,
    cliente: form.cliente.value,
    fecha_inicio: form.fecha_inicio.value,
    descripcion: form.descripcion.value
  };

  const res = await fetch(`${API_BASE}/proyectos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

/* ==================== MATERIALES EN PROYECTO ==================== */

async function cargarMaterialesEnSelectProyecto() {
  const res = await fetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const select = document.getElementById("select-material-proyecto");
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

document.getElementById("form-salida-proyecto").addEventListener("submit", async e => {
  e.preventDefault();

  if (!proyectoSeleccionadoId) return alert("Selecciona un proyecto primero");

  const form = e.target;
  const payload = {
    material_id: parseInt(form.material_id.value),
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value
  };

  const res = await fetch(`${API_BASE}/movimientos/proyecto/${proyectoSeleccionadoId}/salida`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Material asignado al proyecto");
    form.reset();
    cargarMovimientosDeProyecto(proyectoSeleccionadoId);
    cargarMateriales();
    cargarMaterialesEnSelectProyecto();
  } else {
    alert(data.message);
  }
});


/* ==================== MOVIMIENTOS POR PROYECTO ==================== */

async function cargarMovimientosDeProyecto(idProyecto) {
  const res = await fetch(`${API_BASE}/movimientos/proyecto/${idProyecto}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-proyecto tbody");
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
  const res = await fetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-admin-materiales tbody");
  tbody.innerHTML = "";

  data.materiales.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.codigo}</td>
      <td>${m.nombre}</td>
      <td>${m.stock_actual}</td>
      <td>${m.ubicacion} </td>
     <td>
        <button class="btn-edit" data-id="${m.id}">
          ✏️ Editar
        </button>

        <button class="btn-delete" data-id="${m.id}">
          🗑 Eliminar
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });


  document.querySelectorAll(".btn-edit").forEach(btn => {
    btn.onclick = () => cargarEditorMaterial(btn.dataset.id);
  });
}

async function cargarEditorMaterial(id) {
  const res = await fetch(`${API_BASE}/materiales`);
  const data = await res.json();

  const mat = data.materiales.find(m => m.id == id);
  if (!mat) return;

  const form = document.getElementById("form-editar-material");
  form.dataset.id = id;

  form.codigo.value = mat.codigo;
  form.nombre.value = mat.nombre;
  form.stock_minimo.value = mat.stock_minimo || 0;
  form.ubicacion.value = mat.ubicacion || "";

  document.getElementById("admin-form-panel").style.display = "block";
}

document.getElementById("form-editar-material").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const id = form.dataset.id;

  const payload = {
    nombre: form.nombre.value,
    stock_minimo: parseFloat(form.stock_minimo.value),
    ubicacion: form.ubicacion.value
  };

  const res = await fetch(`${API_BASE}/materiales/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Material actualizado");
    cargarAdminMateriales();
    cargarMateriales();
  }
});

/* ==================== AJUSTES DE STOCK ==================== */

document.getElementById("form-ajuste-stock").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const idMaterial = document.getElementById("form-editar-material").dataset.id;

  const payload = {
    material_id: idMaterial,
    cantidad: parseFloat(form.cantidad.value),
    comentario: form.comentario.value
  };

  const endpoint =
    form.tipo.value === "entrada"
      ? `${API_BASE}/movimientos/entrada`
      : `${API_BASE}/movimientos/salida`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.ok) {
    alert("Movimiento registrado");
    cargarAdminMateriales();
    cargarMateriales();
  } else {
    alert(data.message);
  }
});

/* ==================== MOVIMIENTOS GLOBALES ==================== */

async function cargarMovimientosGlobal() {
  const res = await fetch(`${API_BASE}/movimientos`);
  const data = await res.json();

  const tbody = document.querySelector("#tabla-movimientos-global tbody");
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
/*-------ELIMINAR MATERIAL O PROYECTO-------*/

async function eliminarMaterial(id) {
  if (!confirm("¿Estás seguro de que deseas eliminar este material?")) return;

  const res = await feth('/api//materiales/${id}', {
    method: "DELETE"
  });

  const data = await res.json();

  if (data.success) {
    alert("Material eliminado correctamente");
    cargarMaterialesAdmin();
  }else {
    alert("Ërror al eliminar material");
  }
}

async function eliminarProyecto(id) {
  if (!confirm("¿Eliminar proyecto?")) return;

  const res = await fetch(`/api/proyectos/${id}`, {
    method: "DELETE"
  });

  const data = await res.json();

  if (data.success) {
    alert("Proyecto eliminado");
    cargarProyectos();
  } else {
    alert("Error al eliminar proyecto");
  }
}

/* ==================== INICIO ==================== */

cargarMateriales();
cargarProyectos();
cargarMaterialesEnSelectProyecto();
