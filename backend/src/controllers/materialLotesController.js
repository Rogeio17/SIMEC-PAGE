import pool from "../config/db.js";


export async function listarLotesDeMaterial(req, res) {
  try {
    const materialId = Number(req.params.materialId);

    const [rows] = await pool.query(
      `SELECT
         l.id, l.material_id, l.lote_codigo,
         l.proveedor_id, p.nombre_comercial AS proveedor_nombre,
         l.precio_unitario, l.ticket_numero,
         l.requiere_protocolo, l.protocolo_texto,
         l.cantidad_inicial, l.cantidad_disponible,
         l.activo, l.creado_en,
         l.creado_por_usuario_id,
         u.nombre AS creado_por_nombre,
         u.email  AS creado_por_email
       FROM material_lotes l
       LEFT JOIN proveedores p ON p.id = l.proveedor_id
       LEFT JOIN usuarios u ON u.id = l.creado_por_usuario_id
       WHERE l.material_id = ? AND l.activo = 1
       ORDER BY l.id DESC`,
      [materialId]
    );

    res.json({ ok: true, lotes: rows });
  } catch (err) {
    console.error("❌ listarLotesDeMaterial:", err);
    res.status(500).json({ ok: false, message: "Error al obtener lotes" });
  }
}


export async function crearLoteParaMaterial(req, res) {
  const conn = await pool.getConnection();
  try {
    const materialId = Number(req.params.materialId);

    const {
      lote_codigo = null,
      proveedor_id = null,
      precio_unitario = null,
      ticket_numero = null,
      requiere_protocolo = 0,
      protocolo_texto = null,
      cantidad = 0,
    } = req.body;

    const qty = Number(cantidad) || 0;
    if (qty <= 0) {
      return res.status(400).json({ ok: false, message: "cantidad debe ser mayor a 0" });
    }

    const reqProto = Number(requiere_protocolo) === 1 ? 1 : 0;
    const protoText = reqProto ? (protocolo_texto || null) : null;

    await conn.beginTransaction();

   
    const [mat] = await conn.query(
      `SELECT id, stock_actual
       FROM materiales
       WHERE id = ? AND activo = 1
       LIMIT 1`,
      [materialId]
    );
    if (!mat.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Material no existe" });
    }

 
    let loteCode = (lote_codigo && String(lote_codigo).trim()) ? String(lote_codigo).trim() : null;
    if (!loteCode) {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
      loteCode = `LOT-${materialId}-${y}${m}${dd}-${rnd}`;
    }


    await conn.query(
      `INSERT INTO material_lotes
       (material_id, lote_codigo, proveedor_id, precio_unitario, ticket_numero,
        requiere_protocolo, protocolo_texto,
        cantidad_inicial, cantidad_disponible,
        activo, creado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        materialId,
        loteCode,
        proveedor_id ? Number(proveedor_id) : null,
        precio_unitario !== "" && precio_unitario !== null ? Number(precio_unitario) : null,
        ticket_numero || null,
        reqProto,
        protoText,
        qty,
        qty,
        req.user?.id ?? null,
      ]
    );


    await conn.query(
      `UPDATE materiales
       SET stock_actual = stock_actual + ?,
           actualizado_por_usuario_id = ?
       WHERE id = ?`,
      [qty, req.user?.id ?? null, materialId]
    );

    await conn.commit();
    res.json({ ok: true, message: "Lote creado", lote_codigo: loteCode });
  } catch (err) {
    await conn.rollback();
    console.error("❌ crearLoteParaMaterial:", err);
    res.status(500).json({ ok: false, message: "Error al crear lote" });
  } finally {
    conn.release();
  }
}


export async function actualizarLote(req, res) {
  try {
    const loteId = Number(req.params.loteId);

    const {
      lote_codigo,
      proveedor_id = null,
      precio_unitario = null,
      ticket_numero = null,
      requiere_protocolo = 0,
      protocolo_texto = null,
    } = req.body;

    if (!lote_codigo || !String(lote_codigo).trim()) {
      return res.status(400).json({ ok: false, message: "lote_codigo es requerido" });
    }

    const reqProto = Number(requiere_protocolo) === 1 ? 1 : 0;
    const protoText = reqProto ? (protocolo_texto || null) : null;

    await pool.query(
      `UPDATE material_lotes
       SET lote_codigo = ?,
           proveedor_id = ?,
           precio_unitario = ?,
           ticket_numero = ?,
           requiere_protocolo = ?,
           protocolo_texto = ?
       WHERE id = ? AND activo = 1`,
      [
        String(lote_codigo).trim(),
        proveedor_id ? Number(proveedor_id) : null,
        precio_unitario !== "" && precio_unitario !== null ? Number(precio_unitario) : null,
        ticket_numero || null,
        reqProto,
        protoText,
        loteId,
      ]
    );

    res.json({ ok: true, message: "Lote actualizado" });
  } catch (err) {
    console.error("❌ actualizarLote:", err);
    res.status(500).json({ ok: false, message: "Error al actualizar lote" });
  }
}


export async function ajustarCantidadLote(req, res) {
  const conn = await pool.getConnection();
  try {
    const loteId = Number(req.params.loteId);

    
    let delta = null;

    if (req.body?.delta !== undefined) {
      delta = Number(req.body.delta);
    } else if (req.body?.tipo && req.body?.cantidad !== undefined) {
      const qty = Number(req.body.cantidad);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ ok: false, message: "cantidad debe ser > 0" });
      }
      const tipo = String(req.body.tipo).toLowerCase();
      if (tipo !== "entrada" && tipo !== "salida") {
        return res.status(400).json({ ok: false, message: "tipo debe ser 'entrada' o 'salida'" });
      }
      delta = tipo === "entrada" ? qty : -qty;
    }

    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ ok: false, message: "Debes enviar delta o (tipo, cantidad)" });
    }

    await conn.beginTransaction();

 
    const [rows] = await conn.query(
      `SELECT id, material_id, cantidad_disponible
       FROM material_lotes
       WHERE id = ? AND activo = 1
       LIMIT 1`,
      [loteId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Lote no existe" });
    }

    const lote = rows[0];
    const nueva = Number(lote.cantidad_disponible) + delta;
    if (nueva < 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "No puedes dejar el lote en negativo" });
    }

    
    await conn.query(
      `UPDATE material_lotes
       SET cantidad_disponible = ?
       WHERE id = ?`,
      [nueva, loteId]
    );

   
    await conn.query(
      `UPDATE materiales
       SET stock_actual = stock_actual + ?,
           actualizado_por_usuario_id = ?
       WHERE id = ?`,
      [delta, req.user?.id ?? null, lote.material_id]
    );

    await conn.commit();
    res.json({ ok: true, message: "Cantidad ajustada", delta, nueva_cantidad_disponible: nueva });
  } catch (err) {
    await conn.rollback();
    console.error("❌ ajustarCantidadLote:", err);
    res.status(500).json({ ok: false, message: "Error al ajustar lote" });
  } finally {
    conn.release();
  }
}


export async function eliminarLote(req, res) {
  const conn = await pool.getConnection();
  try {
    const loteId = Number(req.params.loteId);

    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, material_id, cantidad_disponible
       FROM material_lotes
       WHERE id = ? AND activo = 1
       LIMIT 1`,
      [loteId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Lote no existe" });
    }

    const lote = rows[0];
    const disp = Number(lote.cantidad_disponible || 0);

    if (disp > 0) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        message: `No puedes desactivar un lote con stock disponible (${disp}). Ajusta a 0 primero.`,
      });
    }

    await conn.query(
      `UPDATE material_lotes
       SET activo = 0
       WHERE id = ?`,
      [loteId]
    );

    await conn.commit();
    res.json({ ok: true, message: "Lote desactivado" });
  } catch (err) {
    await conn.rollback();
    console.error("❌ eliminarLote:", err);
    res.status(500).json({ ok: false, message: "Error al eliminar lote" });
  } finally {
    conn.release();
  }
}
