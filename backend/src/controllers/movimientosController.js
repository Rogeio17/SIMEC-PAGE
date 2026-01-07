import pool from "../config/db.js";

/* ==================== ENTRADA / SALIDA GENERAL (SIN LOTE) ==================== */

export async function registrarEntradaGeneral(req, res) {
  const conn = await pool.getConnection();
  try {
    const { material_id, cantidad, comentario = null } = req.body;

    const matId = Number(material_id);
    const qty = Number(cantidad);

    if (!Number.isFinite(matId) || matId <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, message: "material_id y cantidad válidos requeridos" });
    }

    await conn.beginTransaction();


    const [m] = await conn.query(`SELECT id FROM materiales WHERE id = ? LIMIT 1`, [matId]);
    if (!m.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Material no encontrado" });
    }

    await conn.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario, proyecto_id, etapa_id, usuario_id, creado_en)
       VALUES (?, 'entrada', ?, ?, NULL, NULL, ?, NOW())`,
      [matId, qty, comentario, req.user?.id ?? null]
    );

    await conn.query(
      `UPDATE materiales SET stock_actual = stock_actual + ? WHERE id = ?`,
      [qty, matId]
    );

    await conn.commit();
    return res.json({ ok: true, message: "Entrada registrada" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ registrarEntradaGeneral:", err);
    return res.status(500).json({ ok: false, message: "Error al registrar entrada" });
  } finally {
    conn.release();
  }
}

export async function registrarSalidaGeneral(req, res) {
  const conn = await pool.getConnection();
  try {
    const { material_id, cantidad, comentario = null } = req.body;

    const matId = Number(material_id);
    const qty = Number(cantidad);

    if (!Number.isFinite(matId) || matId <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, message: "material_id y cantidad válidos requeridos" });
    }

    await conn.beginTransaction();

    const [mat] = await conn.query(`SELECT stock_actual FROM materiales WHERE id = ? LIMIT 1`, [matId]);
    if (!mat.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Material no encontrado" });
    }

    if (Number(mat[0].stock_actual || 0) < qty) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Stock insuficiente" });
    }

    await conn.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario, proyecto_id, etapa_id, usuario_id, creado_en)
       VALUES (?, 'salida', ?, ?, NULL, NULL, ?, NOW())`,
      [matId, qty, comentario, req.user?.id ?? null]
    );

    await conn.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [qty, matId]
    );

    await conn.commit();
    return res.json({ ok: true, message: "Salida registrada" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ registrarSalidaGeneral:", err);
    return res.status(500).json({ ok: false, message: "Error al registrar salida" });
  } finally {
    conn.release();
  }
}

/* ==================== LISTADOS ==================== */

export async function listarMovimientosGlobal(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         mv.id, mv.material_id, mv.tipo, mv.cantidad, mv.comentario,
         mv.proyecto_id, mv.etapa_id, mv.usuario_id, mv.creado_en,
         mat.nombre AS material_nombre,
         u.nombre AS usuario_nombre,
         u.email AS usuario_email,

         p.clave  AS proyecto_clave,
         p.nombre AS proyecto_nombre
       FROM movimientos mv
       JOIN materiales mat ON mat.id = mv.material_id
       LEFT JOIN usuarios u ON u.id = mv.usuario_id
       LEFT JOIN proyectos p ON p.id = mv.proyecto_id
       ORDER BY mv.id DESC`
    );

    res.json({ ok: true, movimientos: rows });
  } catch (err) {
    console.error("❌ listarMovimientosGlobal:", err);
    res.status(500).json({ ok: false, message: "Error al listar movimientos" });
  }
}


export async function listarMovimientosPorProyecto(req, res) {
  try {
    const proyectoId = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT
         mv.id, mv.material_id, mv.tipo, mv.cantidad, mv.comentario,
         mv.proyecto_id, mv.etapa_id, mv.usuario_id, mv.creado_en,
         mat.codigo, mat.nombre,
         u.nombre AS usuario_nombre,
         u.email  AS usuario_email
       FROM movimientos mv
       JOIN materiales mat ON mat.id = mv.material_id
       LEFT JOIN usuarios u ON u.id = mv.usuario_id
       WHERE mv.proyecto_id = ?
       ORDER BY mv.id DESC`,
      [proyectoId]
    );

    return res.json({ ok: true, movimientos: rows });
  } catch (err) {
    console.error("❌ listarMovimientosPorProyecto:", err);
    return res.status(500).json({ ok: false, message: "Error al listar movimientos del proyecto" });
  }
}

export async function listarMovimientosPorProyectoYEtapa(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const etapaId = Number(req.params.etapaId);

    const [rows] = await pool.query(
      `SELECT
         mv.id, mv.material_id, mv.tipo, mv.cantidad, mv.comentario,
         mv.proyecto_id, mv.etapa_id, mv.usuario_id, mv.creado_en,
         mat.codigo, mat.nombre,
         u.nombre AS usuario_nombre,
         u.email  AS usuario_email
       FROM movimientos mv
       JOIN materiales mat ON mat.id = mv.material_id
       LEFT JOIN usuarios u ON u.id = mv.usuario_id
       WHERE mv.proyecto_id = ? AND mv.etapa_id = ?
       ORDER BY mv.id DESC`,
      [proyectoId, etapaId]
    );

    return res.json({ ok: true, movimientos: rows });
  } catch (err) {
    console.error("❌ listarMovimientosPorProyectoYEtapa:", err);
    return res.status(500).json({ ok: false, message: "Error al listar movimientos por etapa" });
  }
}

/* ==================== SALIDA A PROYECTO (SIN LOTE) ==================== */

export async function registrarSalida(req, res) {
  const conn = await pool.getConnection();
  try {
    const proyectoId = Number(req.params.id);
    const { material_id, cantidad, comentario = null, etapa_id = null } = req.body;

    const matId = Number(material_id);
    const qty = Number(cantidad);
    const etapaId = Number(etapa_id);

    if (!Number.isFinite(matId) || matId <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ ok: false, message: "material_id y cantidad válidos requeridos" });
    }

    if (!Number.isFinite(etapaId) || etapaId <= 0) {
      return res.status(400).json({ ok: false, message: "Debe indicar etapa_id" });
    }

    await conn.beginTransaction();

    const [proj] = await conn.query(
      "SELECT id, estado FROM proyectos WHERE id = ? LIMIT 1",
      [proyectoId]
    );
    if (!proj.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    }

   
    if (String(proj[0].estado || "").toLowerCase() === "cerrado") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "El proyecto está cerrado" });
    }
    if (String(proj[0].estado || "").toLowerCase() === "archivado") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "El proyecto está archivado" });
    }

    const [et] = await conn.query(
      `SELECT id, proyecto_id, estado FROM proyecto_etapas WHERE id = ? LIMIT 1`,
      [etapaId]
    );
    if (!et.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Etapa no encontrada" });
    }
    if (Number(et[0].proyecto_id) !== proyectoId) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "La etapa no pertenece al proyecto" });
    }


    if (String(et[0].estado || "").toUpperCase() !== "ACTIVA") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "La etapa no está activa" });
    }

    const [mat] = await conn.query(`SELECT stock_actual FROM materiales WHERE id = ? LIMIT 1`, [matId]);
    if (!mat.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Material no encontrado" });
    }
    if (Number(mat[0].stock_actual || 0) < qty) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Stock insuficiente" });
    }

    await conn.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario, proyecto_id, etapa_id, usuario_id, creado_en)
       VALUES (?, 'salida', ?, ?, ?, ?, ?, NOW())`,
      [matId, qty, comentario, proyectoId, etapaId, req.user?.id ?? null]
    );

    await conn.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [qty, matId]
    );

    await conn.commit();
    return res.json({ ok: true, message: "Salida a proyecto registrada" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ registrarSalida:", err);
    return res.status(500).json({ ok: false, message: "Error al registrar salida a proyecto" });
  } finally {
    conn.release();
  }
}

export async function ajustarMovimiento(_req, res) {
  return res.status(501).json({ ok: false, message: "ajustarMovimiento no implementado (compatibilidad)" });
}
