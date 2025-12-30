import pool from "../config/db.js";

export async function registrarEntradaGeneral(req, res) {
  try {
    const { material_id, cantidad, comentario = null } = req.body;

    if (!material_id || !cantidad) {
      return res.status(400).json({ ok: false, message: "material_id y cantidad requeridos" });
    }

    const matId = Number(material_id);
    const qty = Number(cantidad);

    await pool.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario, proyecto_id, etapa_id, usuario_id, creado_en)
       VALUES (?, 'entrada', ?, ?, NULL, NULL, ?, NOW())`,
      [matId, qty, comentario, req.user?.id ?? null]
    );

    await pool.query(
      `UPDATE materiales SET stock_actual = stock_actual + ? WHERE id = ?`,
      [qty, matId]
    );

    res.json({ ok: true, message: "Entrada registrada" });
  } catch (err) {
    console.error("❌ registrarEntradaGeneral:", err);
    res.status(500).json({ ok: false, message: "Error al registrar entrada" });
  }
}

export async function registrarSalidaGeneral(req, res) {
  try {
    const { material_id, cantidad, comentario = null } = req.body;

    if (!material_id || !cantidad) {
      return res.status(400).json({ ok: false, message: "material_id y cantidad requeridos" });
    }

    const matId = Number(material_id);
    const qty = Number(cantidad);

    const [mat] = await pool.query(`SELECT stock_actual FROM materiales WHERE id = ?`, [matId]);
    if (!mat.length) return res.status(404).json({ ok: false, message: "Material no encontrado" });
    if (Number(mat[0].stock_actual) < qty) {
      return res.status(400).json({ ok: false, message: "Stock insuficiente" });
    }

    await pool.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario, proyecto_id, etapa_id, usuario_id, creado_en)
       VALUES (?, 'salida', ?, ?, NULL, NULL, ?, NOW())`,
      [matId, qty, comentario, req.user?.id ?? null]
    );

    await pool.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [qty, matId]
    );

    res.json({ ok: true, message: "Salida registrada" });
  } catch (err) {
    console.error("❌ registrarSalidaGeneral:", err);
    res.status(500).json({ ok: false, message: "Error al registrar salida" });
  }
}

export async function listarMovimientosGlobal(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         mv.id, mv.material_id, mv.tipo, mv.cantidad, mv.comentario,
         mv.proyecto_id, mv.etapa_id, mv.usuario_id, mv.creado_en,
         mat.nombre AS material_nombre,
         u.nombre AS usuario_nombre,
         u.email AS usuario_email
       FROM movimientos mv
       JOIN materiales mat ON mat.id = mv.material_id
       LEFT JOIN usuarios u ON u.id = mv.usuario_id
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

    res.json({ ok: true, movimientos: rows });
  } catch (err) {
    console.error("❌ listarMovimientosPorProyecto:", err);
    res.status(500).json({ ok: false, message: "Error al listar movimientos del proyecto" });
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

    res.json({ ok: true, movimientos: rows });
  } catch (err) {
    console.error("❌ listarMovimientosPorProyectoYEtapa:", err);
    res.status(500).json({ ok: false, message: "Error al listar movimientos por etapa" });
  }
}

export async function registrarSalida(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const { material_id, cantidad, comentario = null, etapa_id = null } = req.body;

    if (!material_id || !cantidad) {
      return res.status(400).json({ ok: false, message: "material_id y cantidad requeridos" });
    }

    const [proj] = await pool.query(
      "SELECT id, estado FROM proyectos WHERE id = ? LIMIT 1",
      [proyectoId]
    );
    if (!proj.length) return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    if (proj[0].estado === "FINALIZADO") {
      return res.status(400).json({ ok: false, message: "El proyecto está finalizado" });
    }

    if (!etapa_id) return res.status(400).json({ ok: false, message: "Debe indicar etapa_id" });

    const etapaId = Number(etapa_id);
    const [et] = await pool.query(
      `SELECT id, proyecto_id, estado FROM proyecto_etapas WHERE id = ? LIMIT 1`,
      [etapaId]
    );
    if (!et.length) return res.status(400).json({ ok: false, message: "Etapa no encontrada" });
    if (Number(et[0].proyecto_id) !== proyectoId) {
      return res.status(400).json({ ok: false, message: "La etapa no pertenece al proyecto" });
    }
    if (et[0].estado !== "ACTIVA") {
      return res.status(400).json({ ok: false, message: "La etapa no está activa" });
    }

    const matId = Number(material_id);
    const qty = Number(cantidad);

    const [mat] = await pool.query(`SELECT stock_actual FROM materiales WHERE id = ?`, [matId]);
    if (!mat.length) return res.status(404).json({ ok: false, message: "Material no encontrado" });
    if (Number(mat[0].stock_actual) < qty) {
      return res.status(400).json({ ok: false, message: "Stock insuficiente" });
    }

    await pool.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario, proyecto_id, etapa_id, usuario_id, creado_en)
       VALUES (?, 'salida', ?, ?, ?, ?, ?, NOW())`,
      [matId, qty, comentario, proyectoId, etapaId, req.user?.id ?? null]
    );

    await pool.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [qty, matId]
    );

    res.json({ ok: true, message: "Salida a proyecto registrada" });
  } catch (err) {
    console.error("❌ registrarSalida:", err);
    res.status(500).json({ ok: false, message: "Error al registrar salida a proyecto" });
  }
}

export async function ajustarMovimiento(_req, res) {
  return res.status(501).json({ ok: false, message: "ajustarMovimiento no implementado (compatibilidad)" });
}
