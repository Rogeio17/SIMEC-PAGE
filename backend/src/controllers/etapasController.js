import pool from "../config/db.js";


export async function listarEtapasProyecto(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, proyecto_id, nombre, estado, inicio, fin, creado_por_usuario_id
       FROM proyecto_etapas
       WHERE proyecto_id = ?
       ORDER BY id DESC`,
      [proyectoId]
    );
    res.json({ ok: true, etapas: rows });
  } catch (err) {
    console.error("❌ listarEtapasProyecto:", err);
    res.status(500).json({ ok: false, message: "Error al listar etapas" });
  }
}


export async function crearEtapaProyecto(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const { nombre, cerrar_anterior = true } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre de etapa requerido" });
    }

 
    const [proj] = await pool.query(
      "SELECT id, estado FROM proyectos WHERE id = ? LIMIT 1",
      [proyectoId]
    );
    if (!proj.length) return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    if (proj[0].estado === "FINALIZADO") {
      return res.status(400).json({ ok: false, message: "El proyecto está finalizado" });
    }

    if (cerrar_anterior) {
      await pool.query(
        `UPDATE proyecto_etapas
         SET estado = 'CERRADA', fin = NOW()
         WHERE proyecto_id = ? AND estado = 'ACTIVA'`,
        [proyectoId]
      );
    }

    await pool.query(
      `INSERT INTO proyecto_etapas (proyecto_id, nombre, estado, inicio, creado_por_usuario_id)
       VALUES (?, ?, 'ACTIVA', NOW(), ?)`,
      [proyectoId, nombre.trim(), req.user?.id ?? null]
    );

    res.json({ ok: true, message: "Etapa creada" });
  } catch (err) {
    console.error("❌ crearEtapaProyecto:", err);
    res.status(500).json({ ok: false, message: "Error al crear etapa" });
  }
}


export async function cerrarEtapa(req, res) {
  try {
    const etapaId = Number(req.params.etapaId);

    const [et] = await pool.query(
      "SELECT id, estado FROM proyecto_etapas WHERE id = ? LIMIT 1",
      [etapaId]
    );
    if (!et.length) return res.status(404).json({ ok: false, message: "Etapa no encontrada" });
    if (et[0].estado === "CERRADA") return res.json({ ok: true, message: "Etapa ya estaba cerrada" });

    await pool.query(
      `UPDATE proyecto_etapas
       SET estado = 'CERRADA', fin = NOW()
       WHERE id = ?`,
      [etapaId]
    );

    res.json({ ok: true, message: "Etapa cerrada" });
  } catch (err) {
    console.error("❌ cerrarEtapa:", err);
    res.status(500).json({ ok: false, message: "Error al cerrar etapa" });
  }
}


export async function obtenerEtapaActiva(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, nombre, estado, inicio
       FROM proyecto_etapas
       WHERE proyecto_id = ? AND estado = 'ACTIVA'
       ORDER BY id DESC
       LIMIT 1`,
      [proyectoId]
    );

    res.json({ ok: true, etapa: rows[0] || null });
  } catch (err) {
    console.error("❌ obtenerEtapaActiva:", err);
    res.status(500).json({ ok: false, message: "Error al obtener etapa activa" });
  }
}
