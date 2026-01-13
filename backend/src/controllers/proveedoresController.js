import pool from "../config/db.js";

function toNull (v) {
  const x = (v ?? "").toString().trim();
  return x === "" ? null : x;
}
export async function listarProveedores(req, res) {
  try {
    const activo = req.query.activo; 
    const q = (req.query.q || "").trim();

    const where = [];
    const params = [];


    if (activo === "1" || activo === "0") {
      where.push("activo = ?");
      params.push(Number(activo));
    }

   
    if (q) {
      where.push(`(
        nombre_comercial LIKE ?
        OR razon_social LIKE ?
        OR rfc LIKE ?
        OR telefono LIKE ?
        OR email LIKE ?
      )`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        nombre_comercial,
        razon_social,
        rfc,
        regimen_fiscal,
        uso_cfdi,
        contacto,
        telefono,
        email,
        direccion,
        notas,
        activo,
        created_at
      FROM proveedores
      ${whereSql}
      ORDER BY nombre_comercial ASC
      `,
      params
    );

    res.json({ ok: true, proveedores: rows });
  } catch (err) {
    console.error("❌ listarProveedores:", err);
    res.status(500).json({ ok: false, message: "Error al listar proveedores" });
  }
}

 export async function crearProveedor(req, res) {
  try {
    const nombre_comercial = toNull(req.body.nombre_comercial ?? req.body.nombre);
    const razon_social = toNull(req.body.razon_social);
    const rfc = toNull(req.body.rfc);
    const regimen_fiscal = toNull(req.body.regimen_fiscal);
    const uso_cfdi = toNull(req.body.uso_cfdi);
    const contacto = toNull(req.body.contacto);
    const telefono = toNull(req.body.telefono);
    const email = toNull(req.body.email);
    const direccion = toNull(req.body.direccion);
    const notas = toNull(req.body.notas);

    if (!nombre_comercial) {
      return res.status(400).json({ ok: false, message: "El nombre comercial es requerido" });
    } 

    const [lins] = await pool.query(
      `INSERT INTO proveedores
        (nombre_comercial, razon_social, rfc, regimen_fiscal, uso_cfdi, contacto, telefono, email, direccion, notas, activo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        nombre_comercial,
        razon_social,
        rfc,
        regimen_fiscal,
        uso_cfdi,
        contacto,
        telefono,
        email,
        direccion,
        notas
      ]
    );

    res.json({ ok: true, message: "Proveedor creado" });
  } catch (err) {
    console.error("❌ crearProvedor:", err);
    res.status(500).json({ ok: false, message: "Error al crear proveedor" });
  }
}

  export async function actualizarProvedor(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const nombre_comercial = toNull(req.body.nombre_comercial ?? req.body.nombre);
    const razon_social = toNull(req.body.razon_social);
    const rfc = toNull(req.body.rfc);
    const regimen_fiscal = toNull(req.body.regimen_fiscal);
    const uso_cfdi = toNull(req.body.uso_cfdi);
    const contacto = toNull(req.body.contacto);
    const telefono = toNull(req.body.telefono);
    const email = toNull(req.body.email);
    const direccion = toNull(req.body.direccion);
    const notas = toNull(req.body.notas);
    const activo = req.body.activo === 1 ? 1 : 0;

    if (!nombre_comercial) {
      return res.status(400).json({ ok: false, message: "El nombre comercial es requerido" });
    }

    await pool.query(
      `UPDATE proveedores SET
        nombre_comercial = ?, razon_social = ?, rfc = ?, regimen_fiscal = ?, uso_cfdi = ?,
        contacto = ?, telefono = ?, email = ?, direccion = ?, notas = ?, activo = ?
      WHERE id = ?`,
      [
        nombre_comercial,
        razon_social,
        rfc,
        regimen_fiscal,
        uso_cfdi,
        contacto,
        telefono,
        email,
        direccion,
        notas,
        activo,
        id
      ]
    );

    res.json({ ok: true, message: "Proveedor actualizado" });
  } catch (err) {
    console.error("❌ actualizarProvedor:", err);
    res.status(500).json({ ok: false, message: "Error al actualizar proveedor" });
  }

}
  export async function desactivarProveedor(req, res) {
  try {
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE proveedores SET activo = 0 WHERE id = ?`,
      [id]
    );
    res.json({ ok: true, message: "Proveedor desactivado" });
  } catch (err) {
    console.error("❌ desactivarProveedor:", err);
    res.status(500).json({ ok: false, message: "Error al desactivar proveedor" });
  }
}
  export async function activarProveedor(req, res) {
  try {
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE proveedores SET activo = 1 WHERE id = ?`,
      [id]
    );
    res.json({ ok: true, message: "Proveedor activado" });
  } catch (err) {
    console.error("❌ activarProveedor:", err);
    res.status(500).json({ ok: false, message: "Error al activar proveedor" });
  }
}