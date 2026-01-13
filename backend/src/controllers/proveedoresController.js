import pool from "../config/db.js";

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
