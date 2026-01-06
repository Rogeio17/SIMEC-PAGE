import pool from "../config/db.js";

export async function listarMateriales(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id, m.codigo, m.nombre, m.stock_actual, m.stock_minimo, m.ubicacion,
         m.activo, m.creado_en,
         m.proveedor_id, p.nombre AS proveedor_nombre,
         m.ticket_numero, m.requiere_protocolo, m.protocolo_texto,
         m.precio_unitario,
         m.creado_por_usuario_id,
         u1.nombre AS creado_por_nombre,
         u1.email  AS creado_por_email,
         m.actualizado_por_usuario_id,
         u2.nombre AS actualizado_por_nombre,
         u2.email  AS actualizado_por_email
       FROM materiales m
       LEFT JOIN proveedores p ON p.id = m.proveedor_id
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
    } = req.body;

    if (!codigo || !nombre) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Código y nombre son requeridos" });
    }

    const reqProto = Number(requiere_protocolo) === 1 ? 1 : 0;
    const protoText = reqProto ? (protocolo_texto || null) : null;

    const [existe] = await conn.query(
      "SELECT id FROM materiales WHERE codigo = ? LIMIT 1",
      [codigo]
    );
    if (existe.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, message: "Ese código ya existe" });
    }

    const stockInicialNum = Number(stock_inicial) || 0;

   
    const [ins] = await conn.query(
      `INSERT INTO materiales
        (codigo, nombre, stock_actual, stock_minimo, ubicacion, activo, creado_en,
         proveedor_id, ticket_numero, requiere_protocolo, protocolo_texto, precio_unitario,
         creado_por_usuario_id, actualizado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, 1, NOW(),
               ?, ?, ?, ?, ?,
               ?, ?)`,
      [
        String(codigo).trim(),
        String(nombre).trim(),
        stockInicialNum,
        Number(stock_minimo) || 0,
        ubicacion || null,
        proveedor_id ? Number(proveedor_id) : null,
        ticket_numero || null,
        reqProto,
        protoText,
        (precio_unitario !== "" && precio_unitario !== null && precio_unitario !== undefined)
          ? Number(precio_unitario)
          : null,
        req.user?.id ?? null,
        req.user?.id ?? null,
      ]
    );

    const materialId = ins.insertId;

    
    if (stockInicialNum > 0) {
      await conn.query(
        `INSERT INTO material_lotes
          (material_id, lote_codigo, proveedor_id, precio_unitario, ticket_numero,
           requiere_protocolo, protocolo_texto,
           cantidad_inicial, cantidad_disponible,
           activo, creado_en, creado_por_usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)`,
        [
          materialId,
          "INICIAL",
          proveedor_id ? Number(proveedor_id) : null,
          (precio_unitario !== "" && precio_unitario !== null && precio_unitario !== undefined)
            ? Number(precio_unitario)
            : null,
          ticket_numero || null,
          reqProto,
          protoText,
          stockInicialNum,
          stockInicialNum,
          req.user?.id ?? null
        ]
      );
    }

    await conn.commit();
    res.json({ ok: true, message: "Material creado" });
  } catch (err) {
    await conn.rollback();
    console.error("❌ crearMaterial:", err);
    res.status(500).json({ ok: false, message: "Error al crear material" });
  } finally {
    conn.release();
  }
}

export async function actualizarMaterial(req, res) {
  try {
    const id = Number(req.params.id);

    const {
      codigo,
      nombre,
      stock_minimo = 0,
      ubicacion = null,
    } = req.body;

    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, message: "ID inválido" });
    }

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ ok: false, message: "Nombre es requerido" });
    }

   
    if (codigo !== undefined) {
      const cod = String(codigo ?? "").trim();

      if (cod !== "") {
       
        const [dup] = await pool.query(
          `SELECT id FROM materiales WHERE codigo = ? AND id <> ? LIMIT 1`,
          [cod, id]
        );
        if (dup.length) {
          return res.status(409).json({ ok: false, message: "Ese código ya existe" });
        }

        await pool.query(
          `UPDATE materiales
           SET codigo = ?,
               nombre = ?,
               stock_minimo = ?,
               ubicacion = ?,
               actualizado_por_usuario_id = ?
           WHERE id = ?`,
          [
            cod,
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
           SET codigo = NULL,
               nombre = ?,
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
      }
    } else {
 
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
    }

    return res.json({ ok: true, message: "Material actualizado" });
  } catch (err) {
    console.error("❌ actualizarMaterial:", err);
    return res.status(500).json({ ok: false, message: "Error al actualizar material" });
  }
}


export async function eliminarMaterial(req, res) {
  try {
    const id = Number(req.params.id);

    await pool.query(
      `UPDATE materiales
       SET activo = 0,
           actualizado_por_usuario_id = ?
       WHERE id = ?`,
      [req.user?.id ?? null, id]
    );

    res.json({ ok: true, message: "Material desactivado" });
  } catch (err) {
    console.error("❌ eliminarMaterial:", err);
    res.status(500).json({ ok: false, message: "Error al desactivar material" });
  }
}
