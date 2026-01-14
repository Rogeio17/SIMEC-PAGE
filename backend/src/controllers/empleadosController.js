import pool from "../config/db.js";

/* ==================== EMPLEADOS (CRUD BÁSICO) ==================== */

// Listar empleados (por defecto solo activos si ?activo=1)
export async function listarEmpleados(req, res) {
  try {
    const { activo } = req.query;
    const where = String(activo) === "1" ? "WHERE e.activo = 1" : "";
    const [rows] = await pool.query(
      `SELECT e.id, e.nombre, e.puesto, e.telefono, e.activo, e.created_at
       FROM empleados e
       ${where}
       ORDER BY e.nombre ASC`
    );
    return res.json({ ok: true, empleados: rows });
  } catch (err) {
    console.error("❌ listarEmpleados:", err);
    return res.status(500).json({ ok: false, message: "Error al listar empleados" });
  }
}

// Crear empleado
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

// Actualizar empleado (nombre/puesto/telefono/activo)
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

    // construir update dinámico
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

    await pool.query(
      `UPDATE empleados SET ${sets.join(", ")} WHERE id = ?`,
      vals
    );

    return res.json({ ok: true, message: "Empleado actualizado" });
  } catch (err) {
    console.error("❌ actualizarEmpleado:", err);
    return res.status(500).json({ ok: false, message: "Error al actualizar empleado" });
  }
}
