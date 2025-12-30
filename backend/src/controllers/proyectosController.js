import pool from "../config/db.js";

export async function listarProyectos(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, clave, nombre, cliente, fecha_inicio, descripcion, estado, creado_en, finalizado_en, creado_por_usuario_id
       FROM proyectos
       ORDER BY id DESC`
    );
    res.json({ ok: true, proyectos: rows });
  } catch (err) {
    console.error("❌ listarProyectos:", err);
    res.status(500).json({ ok: false, message: "Error al listar proyectos" });
  }
}

export async function crearProyecto(req, res) {
  try {
    const { clave, nombre, cliente = null, fecha_inicio = null, descripcion = null } = req.body;

    if (!clave || !nombre) {
      return res.status(400).json({ ok: false, message: "Clave y nombre son requeridos" });
    }

    // Evitar duplicado por clave
    const [existe] = await pool.query(
      "SELECT id FROM proyectos WHERE clave = ? LIMIT 1",
      [clave]
    );
    if (existe.length) {
      return res.status(409).json({ ok: false, message: "Esa clave ya existe" });
    }

    await pool.query(
      `INSERT INTO proyectos (clave, nombre, cliente, fecha_inicio, descripcion, estado, creado_en, creado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, 'ACTIVO', NOW(), ?)`,
      [clave, nombre, cliente, fecha_inicio, descripcion, req.user?.id ?? null]
    );

    res.json({ ok: true, message: "Proyecto creado" });
  } catch (err) {
    console.error("❌ crearProyecto:", err);
    res.status(500).json({ ok: false, message: "Error al crear proyecto" });
  }
}

export async function eliminarProyecto(req, res) {
  try {
    const id = Number(req.params.id);

    // Tu ruta actual era PUT /eliminar/:id; aquí lo dejo como "finalizar" suave.
    await pool.query(
      `UPDATE proyectos
       SET estado = 'FINALIZADO',
           finalizado_en = NOW()
       WHERE id = ?`,
      [id]
    );

    res.json({ ok: true, message: "Proyecto finalizado" });
  } catch (err) {
    console.error("❌ eliminarProyecto/finalizar:", err);
    res.status(500).json({ ok: false, message: "Error al finalizar proyecto" });
  }
}

export async function obtenerMaterialesDeProyecto(req, res) {
  try {
    const proyectoId = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT
         mv.creado_en,
         mv.tipo,
         mv.cantidad,
         mv.comentario,
         mv.etapa_id,
         mat.codigo,
         mat.nombre
       FROM movimientos mv
       JOIN materiales mat ON mat.id = mv.material_id
       WHERE mv.proyecto_id = ?
       ORDER BY mv.creado_en DESC`,
      [proyectoId]
    );

    res.json({ ok: true, movimientos: rows });
  } catch (err) {
    console.error("❌ obtenerMaterialesDeProyecto:", err);
    res.status(500).json({ ok: false, message: "Error al obtener materiales del proyecto" });
  }
}

/**
 * Endpoint extra para finalizar explícitamente
 */
export async function finalizarProyecto(req, res) {
  try {
    const id = Number(req.params.id);

    await pool.query(
      `UPDATE proyectos
       SET estado = 'FINALIZADO',
           finalizado_en = NOW()
       WHERE id = ?`,
      [id]
    );

    res.json({ ok: true, message: "Proyecto finalizado" });
  } catch (err) {
    console.error("❌ finalizarProyecto:", err);
    res.status(500).json({ ok: false, message: "Error al finalizar proyecto" });
  }
}
