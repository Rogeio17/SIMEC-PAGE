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
export async function borrarProyecto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, message: "ID inválido" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [proj] = await conn.query("SELECT id FROM proyectos WHERE id = ? LIMIT 1", [id]);
    if (!proj.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    }

    
    const [salidas] = await conn.query(
      `SELECT material_id, SUM(cantidad) AS total
       FROM movimientos
       WHERE proyecto_id = ? AND LOWER(tipo) = 'salida'
       GROUP BY material_id`,
      [id]
    );

    for (const s of salidas) {
      const total = Number(s.total || 0);
      if (total > 0) {
        await conn.query(
          `UPDATE materiales
           SET stock_actual = stock_actual + ?
           WHERE id = ?`,
          [total, s.material_id]
        );
      }
    }

   
    await conn.query("DELETE FROM movimientos WHERE proyecto_id = ?", [id]);

 
    await conn.query("DELETE FROM proyecto_etapas WHERE proyecto_id = ?", [id]);

   
    await conn.query("DELETE FROM proyectos WHERE id = ?", [id]);

    await conn.commit();
    return res.json({ ok: true, message: "Proyecto borrado" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ borrarProyecto:", err);
    return res.status(500).json({ ok: false, message: "Error al borrar proyecto" });
  } finally {
    conn.release();
  }
}
export async function archivarProyecto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, message: "ID inválido" });
  }

  try {
    const [rows] = await pool.query(
      "UPDATE proyectos SET estado = 'ARCHIVADO' WHERE id = ?",
      [id]
    );

    if (!rows.affectedRows) {
      return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    }

    return res.json({ ok: true, message: "Proyecto archivado" });
  } catch (err) {
    console.error("❌ archivarProyecto:", err);
    return res.status(500).json({ ok: false, message: "Error al archivar proyecto" });
  }
}

export async function borrarProyecto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, message: "ID inválido" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [proj] = await conn.query("SELECT id FROM proyectos WHERE id = ? LIMIT 1", [id]);
    if (!proj.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    }

    // 1) Regresar stock (todas las SALIDAS del proyecto)
    const [salidas] = await conn.query(
      `SELECT material_id, SUM(cantidad) AS total
       FROM movimientos
       WHERE proyecto_id = ? AND LOWER(tipo) = 'salida'
       GROUP BY material_id`,
      [id]
    );

    for (const s of salidas) {
      const total = Number(s.total || 0);
      if (total > 0) {
        await conn.query(
          `UPDATE materiales
           SET stock_actual = stock_actual + ?
           WHERE id = ?`,
          [total, s.material_id]
        );
      }
    }

    // 2) Borrar movimientos, etapas, y proyecto
    await conn.query("DELETE FROM movimientos WHERE proyecto_id = ?", [id]);
    await conn.query("DELETE FROM proyecto_etapas WHERE proyecto_id = ?", [id]);
    await conn.query("DELETE FROM proyectos WHERE id = ?", [id]);

    await conn.commit();
    return res.json({ ok: true, message: "Proyecto borrado definitivamente" });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("❌ borrarProyecto:", err);
    return res.status(500).json({ ok: false, message: "Error al borrar proyecto" });
  } finally {
    conn.release();
  }
}
export async function restaurarProyecto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, message: "ID inválido" });
  }

  try {
    const [rows] = await pool.query(
      "UPDATE proyectos SET estado = 'ACTIVO' WHERE id = ?",
      [id]
    );

    if (!rows.affectedRows) {
      return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });
    }

    return res.json({ ok: true, message: "Proyecto restaurado" });
  } catch (err) {
    console.error("❌ restaurarProyecto:", err);
    return res.status(500).json({ ok: false, message: "Error al restaurar proyecto" });
  }
}

