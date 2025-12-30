import pool from "../config/db.js";

export async function listarProveedores(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, telefono, email, notas, activo, created_at
       FROM proveedores
       WHERE activo = 1
       ORDER BY nombre ASC`
    );
    res.json({ ok: true, proveedores: rows });
  } catch (err) {
    console.error("❌ listarProveedores:", err);
    res.status(500).json({ ok: false, message: "Error al listar proveedores" });
  }
}

export async function crearProveedor(req, res) {
  try {
    const { nombre, telefono = null, email = null, notas = null } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre es requerido" });
    }

    // Evitar duplicados por nombre (opcional)
    const [existe] = await pool.query(
      "SELECT id FROM proveedores WHERE nombre = ? LIMIT 1",
      [nombre.trim()]
    );
    if (existe.length) {
      return res.status(409).json({ ok: false, message: "Ese proveedor ya existe" });
    }

    await pool.query(
      `INSERT INTO proveedores (nombre, telefono, email, notas, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [nombre.trim(), telefono, email, notas]
    );

    res.json({ ok: true, message: "Proveedor creado" });
  } catch (err) {
    console.error("❌ crearProveedor:", err);
    res.status(500).json({ ok: false, message: "Error al crear proveedor" });
  }
}
