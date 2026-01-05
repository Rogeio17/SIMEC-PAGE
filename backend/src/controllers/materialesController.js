import pool from "../config/db.js";

export async function listarMateriales(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id, m.codigo, m.nombre, m.stock_actual, m.stock_minimo, m.ubicacion,
         m.activo, m.creado_en,
         m.creado_por_usuario_id,
         u1.nombre AS creado_por_nombre,
         u1.email  AS creado_por_email,
         m.actualizado_por_usuario_id,
         u2.nombre AS actualizado_por_nombre,
         u2.email  AS actualizado_por_email
       FROM materiales m
       LEFT JOIN usuarios u1 ON u1.id = m.creado_por_usuario_id
       LEFT JOIN usuarios u2 ON u2.id = m.actualizado_por_usuario_id
       WHERE m.activo = 1
       ORDER BY m.id DESC`
    );

    res.json({ ok: true, materiales: rows });
  } catch (err) {
    console.error("❌ listarMateriales:", err);
    res.status(500).json({ ok: false, message: "Error al obtener materiales" });
  }
}

export async function crearMaterial(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      codigo,
      nombre,
      stock_inicial = 0,
      stock_minimo = 0,
      ubicacion = null,

     
      proveedor_id = null,
      ticket_numero = null,
      requiere_protocolo = 0,
      protocolo_texto = null,
      precio_unitario = null,

      
      lote_codigo = null,
      nombre_lote = null
    } = req.body;

    if (!codigo || !nombre) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Código y nombre son requeridos" });
    }

    const [existe] = await conn.query(
      "SELECT id FROM materiales WHERE codigo = ? LIMIT 1",
      [codigo]
    );
    if (existe.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, message: "Ese código ya existe" });
    }

    const stockInicialNum = Number(stock_inicial) || 0;

    const reqProto = Number(requiere_protocolo) === 1 ? 1 : 0;
    const protoText = reqProto ? (protocolo_texto || null) : null;

    // 1) Crear material
    const [ins] = await conn.query(
      `INSERT INTO materiales
        (codigo, nombre, stock_actual, stock_minimo, ubicacion, activo, creado_en,
         creado_por_usuario_id, actualizado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), ?, ?)`,
      [
        String(codigo).trim(),
        String(nombre).trim(),
        stockInicialNum,
        Number(stock_minimo) || 0,
        ubicacion || null,
        req.user?.id ?? null,
        req.user?.id ?? null
      ]
    );

    const materialId = ins.insertId;

    // 2) ✅ SIEMPRE crear lote inicial (aunque stockInicialNum sea 0)
    const loteInicial =
      (String(lote_codigo || nombre_lote || "").trim()) ||
      `INICIAL-${String(codigo).trim()}`;

    await conn.query(
      `INSERT INTO material_lotes
        (material_id, lote_codigo, proveedor_id, precio_unitario, ticket_numero,
         requiere_protocolo, protocolo_texto,
         cantidad_inicial, cantidad_disponible,
         activo, creado_en, creado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)`,
      [
        materialId,
        loteInicial,
        proveedor_id ? Number(proveedor_id) : null,
        (precio_unitario !== "" && precio_unitario !== null) ? Number(precio_unitario) : null,
        ticket_numero || null,
        reqProto,
        protoText,
        stockInicialNum,
        stockInicialNum,
        req.user?.id ?? null
      ]
    );

    await conn.commit();
    res.json({ ok: true, message: "Material creado (con lote inicial)" });
  } catch (err) {
    await conn.rollback();
    console.error("❌ crearMaterial:", err);
    res.status(500).json({ ok: false, message: "Error al crear material" });
  } finally {
    conn.release();
  }
}

/**
 * Actualiza SOLO datos base del material (no proveedor/precio/ticket/protocolo).
 * Eso se maneja por LOTES.
 */
export async function actualizarMaterial(req, res) {
  try {
    const id = Number(req.params.id);

    const {
      codigo = null,       
      nombre,
      stock_minimo = 0,
      ubicacion = null,
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ ok: false, message: "Nombre es requerido" });
    }

    let codigoFinal = null;
    if (codigo !== null && String(codigo).trim() !== "") {
      const cod = String(codigo).trim();

      const [dup] = await pool.query(
        "SELECT id FROM materiales WHERE codigo = ? AND id <> ? LIMIT 1",
        [cod, id]
      );
      if (dup.length) {
        return res.status(409).json({ ok: false, message: "Ese código ya existe en otro material" });
      }

      codigoFinal = cod;
    }

  
    if (codigoFinal === null) {
      await pool.query(
        `UPDATE materiales
         SET nombre = ?,
             stock_minimo = ?,
             ubicacion = ?,
             actualizado_por_usuario_id = ?
         WHERE id = ?`,
        [
          String(nombre).trim(),
          Number(stock_minimo) || 0,
          ubicacion || null,
          req.user?.id ?? null,
          id,
        ]
      );
    } else {
      await pool.query(
        `UPDATE materiales
         SET codigo = ?,
             nombre = ?,
             stock_minimo = ?,
             ubicacion = ?,
             actualizado_por_usuario_id = ?
         WHERE id = ?`,
        [
          codigoFinal,
          String(nombre).trim(),
          Number(stock_minimo) || 0,
          ubicacion || null,
          req.user?.id ?? null,
          id,
        ]
      );
    }

    res.json({ ok: true, message: "Material actualizado" });
  } catch (err) {
    console.error("❌ actualizarMaterial:", err);
    res.status(500).json({ ok: false, message: "Error al actualizar material" });
  }
}
