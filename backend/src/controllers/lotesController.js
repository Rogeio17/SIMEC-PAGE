import pool from "../db.js";


export async function ajustarLote(req, res) {
  const { loteId } = req.params;
  const { tipo, cantidad, comentario } = req.body;

  const userId = req.user?.id || null; // depende de tu middleware auth
  const qty = Number(cantidad);

  if (!["sumar", "restar"].includes(tipo)) {
    return res.status(400).json({ ok: false, message: "tipo inválido (sumar/restar)" });
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ ok: false, message: "cantidad inválida" });
  }
  if (!comentario || !String(comentario).trim()) {
    return res.status(400).json({ ok: false, message: "comentario es obligatorio" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

   
    const [lotes] = await conn.query(
      `SELECT id, material_id, cantidad_disponible
       FROM material_lotes
       WHERE id = ? AND activo = 1
       LIMIT 1`,
      [loteId]
    );

    if (!lotes.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Lote no encontrado" });
    }

    const lote = lotes[0];
    const delta = tipo === "sumar" ? qty : -qty;

   
    const nuevaDisp = Number(lote.cantidad_disponible) + delta;
    if (nuevaDisp < 0) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        message: `No puedes restar más de lo disponible en el lote. Disponible: ${lote.cantidad_disponible}`
      });
    }

   
    await conn.query(
      `UPDATE material_lotes
       SET cantidad_disponible = ?
       WHERE id = ?`,
      [nuevaDisp, loteId]
    );

    
    await conn.query(
      `UPDATE materiales
       SET stock_actual = stock_actual + ?
       WHERE id = ?`,
      [delta, lote.material_id]
    );


    await conn.query(
      `INSERT INTO movimientos
        (material_id, lote_id, tipo, cantidad, comentario, creado_por_usuario_id, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        lote.material_id,
        loteId,
        tipo === "sumar" ? "AJUSTE_ENTRADA" : "AJUSTE_SALIDA",
        qty,
        String(comentario).trim(),
        userId
      ]
    );

    await conn.commit();
    return res.json({ ok: true, message: "Lote ajustado", lote_id: Number(loteId), nueva_disponible: nuevaDisp });
  } catch (err) {
    await conn.rollback();
    console.error("ajustarLote:", err);
    return res.status(500).json({ ok: false, message: "Error al ajustar lote" });
  } finally {
    conn.release();
  }
}
