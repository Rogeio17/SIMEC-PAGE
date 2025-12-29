import pool from "../config/db.js";

/* -------- ENTRADA GENERAL (sin proyecto) -------- */
export const registrarEntradaGeneral = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { material_id, cantidad, comentario } = req.body;

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario)
       VALUES (?,?,?,?)`,
      [material_id, "ENTRADA", cantidad, comentario || ""]
    );

    await connection.query(
      `UPDATE materiales SET stock_actual = stock_actual + ? WHERE id = ?`,
      [cantidad, material_id]
    );

    await connection.commit();
    res.json({ ok: true });

  } catch (error) {
    await connection.rollback();
    console.error("Error registrarEntradaGeneral:", error);
    res.status(500).json({ ok: false, message: "Error registrando entrada" });
  } finally {
    connection.release();
  }
};

/* -------- SALIDA GENERAL (sin proyecto) -------- */
export const registrarSalidaGeneral = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { material_id, cantidad, comentario } = req.body;

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO movimientos (material_id, tipo, cantidad, comentario)
       VALUES (?,?,?,?)`,
      [material_id, "SALIDA", cantidad, comentario || ""]
    );

    await connection.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [cantidad, material_id]
    );

    await connection.commit();
    res.json({ ok: true });

  } catch (error) {
    await connection.rollback();
    console.error("Error registrarSalidaGeneral:", error);
    res.status(500).json({ ok: false, message: "Error registrando salida" });
  } finally {
    connection.release();
  }
};

/* -------- SALIDA A PROYECTO -------- */
export const registrarSalida = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params; // id del proyecto
    const { material_id, cantidad, comentario } = req.body;

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO movimientos (material_id, proyecto_id, tipo, cantidad, comentario)
       VALUES (?,?,?,?,?)`,
      [material_id, id, "SALIDA", cantidad, comentario || ""]
    );

    await connection.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [cantidad, material_id]
    );

    await connection.commit();
    res.json({ ok: true });

  } catch (error) {
    await connection.rollback();
    console.error("Error registrarSalida proyecto:", error);
    res.status(500).json({ ok: false, message: "Error registrando salida de proyecto" });
  } finally {
    connection.release();
  }
};

/* -------- MOVIMIENTOS POR PROYECTO -------- */
export const listarMovimientosPorProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT mv.*, m.codigo, m.nombre
       FROM movimientos mv
       JOIN materiales m ON mv.material_id = m.id
       WHERE mv.proyecto_id = ?
       ORDER BY mv.creado_en DESC`,
      [id]
    );

    res.json({ ok: true, movimientos: rows });

  } catch (error) {
    console.error("Error listarMovimientosPorProyecto:", error);
    res.status(500).json({ ok: false, message: "Error obteniendo movimientos del proyecto" });
  }
};

/* -------- MOVIMIENTOS GLOBALES -------- */
export const listarMovimientosGlobal = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mv.*, m.nombre
       FROM movimientos mv
       JOIN materiales m ON mv.material_id = m.id
       ORDER BY mv.creado_en DESC`
    );

    res.json({ ok: true, movimientos: rows });

  } catch (error) {
    console.error("Error listarMovimientosGlobal:", error);
    res.status(500).json({ ok: false, message: "Error obteniendo movimientos" });
  }
};

/* -------- AJUSTAR MOVIMIENTO -------- */
export const ajustarMovimiento = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { movimiento_id } = req.params;

    const [[mov]] = await connection.query(
      `SELECT * FROM movimientos WHERE id = ?`,
      [movimiento_id]
    );

    if (!mov) {
      return res.status(404).json({ ok: false, message: "Movimiento no encontrado" });
    }

    const ajuste = mov.tipo === "SALIDA" ? mov.cantidad : -mov.cantidad;

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO movimientos (material_id, proyecto_id, tipo, cantidad, comentario)
       VALUES (?,?,?,?,?)`,
      [
        mov.material_id,
        mov.proyecto_id,
        "AJUSTE",
        ajuste,
        "Reverso de movimiento " + mov.id
      ]
    );

    await connection.query(
      `UPDATE materiales SET stock_actual = stock_actual + ? WHERE id = ?`,
      [ajuste, mov.material_id]
    );

    await connection.commit();
    res.json({ ok: true });

  } catch (error) {
    await connection.rollback();
    console.error("Error ajustarMovimiento:", error);
    res.status(500).json({ ok: false, message: "Error ajustando movimiento" });
  } finally {
    connection.release();
  }
};
