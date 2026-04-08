import pool from "../config/db.js";

function normalizarEstadoResguardo(v) {
  const x = String(v || "").trim().toLowerCase();
  return x === "devuelto" ? "devuelto" : "activo";
}

function normalizarTipoMaterial(v) {
  const x = String(v || "").trim().toLowerCase();
  return x === "herramienta" ? "herramienta" : "material";
}

export async function listarEmpleados(req, res) {
  try {
    const { activo } = req.query;
    const where = [];

    if (String(activo) === "1") where.push("e.activo = 1");
    if (String(activo) === "0") where.push("e.activo = 0");

    const [rows] = await pool.query(
      `SELECT
         e.id, e.nombre, e.puesto, e.telefono, e.activo, e.created_at,
         COALESCE((
           SELECT COUNT(*)
           FROM empleado_herramientas eh
           WHERE eh.empleado_id = e.id AND eh.estado = 'activo'
         ), 0) AS herramientas_activas
       FROM empleados e
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY e.nombre ASC`
    );

    return res.json({ ok: true, empleados: rows });
  } catch (err) {
    console.error("❌ listarEmpleados:", err);
    return res.status(500).json({ ok: false, message: "Error al listar empleados" });
  }
}

export async function crearEmpleado(req, res) {
  try {
    const { nombre, puesto = null, telefono = null } = req.body;

    const n = String(nombre || "").trim();
    if (!n) {
      return res.status(400).json({ ok: false, message: "Nombre requerido" });
    }

    const p = String(puesto || "").trim() || null;
    const t = String(telefono || "").trim() || null;

    const [r] = await pool.query(
      `INSERT INTO empleados (nombre, puesto, telefono, activo, created_at)
       VALUES (?, ?, ?, 1, NOW())`,
      [n, p, t]
    );

    return res.json({ ok: true, id: r.insertId, message: "Empleado creado" });
  } catch (err) {
    console.error("❌ crearEmpleado:", err);
    return res.status(500).json({ ok: false, message: "Error al crear empleado" });
  }
}

export async function actualizarEmpleado(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const { nombre, puesto, telefono, activo } = req.body;

    const n = nombre !== undefined ? String(nombre || "").trim() : undefined;
    const p = puesto !== undefined ? (String(puesto || "").trim() || null) : undefined;
    const t = telefono !== undefined ? (String(telefono || "").trim() || null) : undefined;

    const act = activo !== undefined ? Number(activo) : undefined;
    const activoVal = act === 1 ? 1 : act === 0 ? 0 : undefined;

    const sets = [];
    const vals = [];

    if (n !== undefined) {
      if (!n) return res.status(400).json({ ok: false, message: "Nombre no puede ir vacío" });
      sets.push("nombre = ?");
      vals.push(n);
    }
    if (p !== undefined) { sets.push("puesto = ?"); vals.push(p); }
    if (t !== undefined) { sets.push("telefono = ?"); vals.push(t); }
    if (activoVal !== undefined) { sets.push("activo = ?"); vals.push(activoVal); }

    if (!sets.length) {
      return res.status(400).json({ ok: false, message: "Nada que actualizar" });
    }

    vals.push(id);
    await pool.query(`UPDATE empleados SET ${sets.join(", ")} WHERE id = ?`, vals);

    return res.json({ ok: true, message: "Empleado actualizado" });
  } catch (err) {
    console.error("❌ actualizarEmpleado:", err);
    return res.status(500).json({ ok: false, message: "Error al actualizar empleado" });
  }
}

export async function listarResguardosHerramientas(req, res) {
  try {
    const empleadoId = req.query.empleado_id ? Number(req.query.empleado_id) : null;
    const estado = req.query.estado ? normalizarEstadoResguardo(req.query.estado) : null;

    const where = [];
    const params = [];

    if (empleadoId && Number.isFinite(empleadoId)) {
      where.push("eh.empleado_id = ?");
      params.push(empleadoId);
    }
    if (estado) {
      where.push("eh.estado = ?");
      params.push(estado);
    }

    const [rows] = await pool.query(
      `SELECT
         eh.id,
         eh.empleado_id,
         eh.material_id,
         eh.cantidad,
         eh.fecha_salida,
         eh.fecha_devolucion,
         eh.estado,
         eh.comentario,
         eh.created_at,
         e.nombre AS empleado_nombre,
         e.puesto AS empleado_puesto,
         m.codigo AS material_codigo,
         m.nombre AS material_nombre,
         m.unidad AS material_unidad,
         COALESCE(m.tipo_material, 'material') AS tipo_material,
         ue.nombre AS usuario_entrega_nombre,
         ur.nombre AS usuario_recibe_nombre
       FROM empleado_herramientas eh
       JOIN empleados e ON e.id = eh.empleado_id
       JOIN materiales m ON m.id = eh.material_id
       LEFT JOIN usuarios ue ON ue.id = eh.usuario_entrega_id
       LEFT JOIN usuarios ur ON ur.id = eh.usuario_recibe_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY CASE WHEN eh.estado = 'activo' THEN 0 ELSE 1 END, eh.fecha_salida DESC, eh.id DESC`,
      params
    );

    return res.json({ ok: true, resguardos: rows });
  } catch (err) {
    console.error("❌ listarResguardosHerramientas:", err);
    return res.status(500).json({ ok: false, message: "Error al listar resguardos" });
  }
}

export async function crearResguardoHerramienta(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const empleadoId = Number(req.body?.empleado_id);
    const materialId = Number(req.body?.material_id);
    const cantidad = Number(req.body?.cantidad || 1);
    const fechaSalida = String(req.body?.fecha_salida || "").trim() || null;
    const comentario = String(req.body?.comentario || "").trim() || null;

    if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Empleado inválido" });
    }
    if (!Number.isFinite(materialId) || materialId <= 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Herramienta inválida" });
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Cantidad inválida" });
    }

    const [[emp]] = await conn.query(`SELECT id FROM empleados WHERE id = ? AND activo = 1 LIMIT 1`, [empleadoId]);
    if (!emp) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Empleado no encontrado o inactivo" });
    }

    const [[mat]] = await conn.query(
      `SELECT id, stock_actual, COALESCE(tipo_material, 'material') AS tipo_material
       FROM materiales
       WHERE id = ? AND activo = 1
       LIMIT 1`,
      [materialId]
    );
    if (!mat) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Material no encontrado" });
    }

    if (normalizarTipoMaterial(mat.tipo_material) !== "herramienta") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "El material seleccionado no está marcado como herramienta" });
    }

    if (Number(mat.stock_actual || 0) < cantidad) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Stock insuficiente para asignar esa herramienta" });
    }

    await conn.query(
      `UPDATE materiales SET stock_actual = stock_actual - ?, actualizado_por_usuario_id = ? WHERE id = ?`,
      [cantidad, req.user?.id ?? null, materialId]
    );

    const [ins] = await conn.query(
      `INSERT INTO empleado_herramientas
        (empleado_id, material_id, cantidad, fecha_salida, estado, comentario, usuario_entrega_id, created_at)
       VALUES (?, ?, ?, COALESCE(?, NOW()), 'activo', ?, ?, NOW())`,
      [empleadoId, materialId, cantidad, fechaSalida, comentario, req.user?.id ?? null]
    );

    await conn.commit();
    return res.json({ ok: true, id: ins.insertId, message: "Herramienta asignada" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ crearResguardoHerramienta:", err);
    return res.status(500).json({ ok: false, message: "Error al asignar herramienta" });
  } finally {
    conn.release();
  }
}

export async function devolverResguardoHerramienta(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const id = Number(req.params.id);
    const fechaDevolucion = String(req.body?.fecha_devolucion || "").trim() || null;

    if (!Number.isFinite(id) || id <= 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    const [[row]] = await conn.query(
      `SELECT id, material_id, cantidad, estado
       FROM empleado_herramientas
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!row) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Resguardo no encontrado" });
    }

    if (row.estado === "devuelto") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "La herramienta ya fue devuelta" });
    }

    await conn.query(
      `UPDATE materiales SET stock_actual = stock_actual + ?, actualizado_por_usuario_id = ? WHERE id = ?`,
      [Number(row.cantidad || 0), req.user?.id ?? null, row.material_id]
    );

    await conn.query(
      `UPDATE empleado_herramientas
       SET estado = 'devuelto',
           fecha_devolucion = COALESCE(?, NOW()),
           usuario_recibe_id = ?
       WHERE id = ?`,
      [fechaDevolucion, req.user?.id ?? null, id]
    );

    await conn.commit();
    return res.json({ ok: true, message: "Herramienta devuelta" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ devolverResguardoHerramienta:", err);
    return res.status(500).json({ ok: false, message: "Error al devolver herramienta" });
  } finally {
    conn.release();
  }
}
