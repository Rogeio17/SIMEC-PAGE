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
       LEFT JOIN users u ON u.id = mv.usuario_id
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
