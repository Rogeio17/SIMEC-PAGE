
import pool from "../config/db.js";

export const crearProyecto = async (req, res) => {
  try {
    const { clave, nombre, cliente, descripcion, fecha_inicio } = req.body;

    if (!clave || !nombre) {
      return res.status(400).json({ ok: false, message: "Clave y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      `INSERT INTO proyectos (clave, nombre, cliente, descripcion, fecha_inicio)
       VALUES (?, ?, ?, ?, ?)`,
      [clave, nombre, cliente || "", descripcion || "", fecha_inicio || null]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error("Error crearProyecto:", error);
    res.status(500).json({ ok: false, message: "Error al crear proyecto" });
  }
};

export const listarProyectos = async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM proyectos ORDER BY creado_en DESC`);
    res.json({ ok: true, proyectos: rows });
  } catch (error) {
    console.error("Error listarProyectos:", error);
    res.status(500).json({ ok: false, message: "Error al obtener proyectos" });
  }
};

export const obtenerMaterialesDeProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT m.id as material_id,
             m.codigo,
             m.nombre,
             SUM(CASE WHEN mv.tipo = 'SALIDA' THEN mv.cantidad
                      WHEN mv.tipo = 'ENTRADA' THEN -mv.cantidad
                      ELSE 0 END) AS cantidad_total
      FROM movimientos mv
      JOIN materiales m ON mv.material_id = m.id
      WHERE mv.proyecto_id = ?
      GROUP BY m.id, m.codigo, m.nombre
      `,
      [id]
    );

    res.json({ ok: true, materiales: rows });
  } catch (error) {
    console.error("Error obtenerMaterialesDeProyecto:", error);
    res.status(500).json({ ok: false, message: "Error al obtener materiales del proyecto" });
  }
};
export const asignarMaterialAProyecto = async (req, res) => {
  try {
    const { id } = req.params; 
    const { material_id, cantidad } = req.body;

    if (!material_id || !cantidad) {
      return res.status(400).json({ ok: false, message: "Datos incompletos" });
    }

    
    await pool.query(
      `INSERT INTO proyectos_materiales (proyecto_id, material_id, cantidad)
       VALUES (?, ?, ?)`,
      [id, material_id, cantidad]
    );

    
    await pool.query(
      `INSERT INTO movimientos (material_id, proyecto_id, tipo, cantidad, fecha)
       VALUES (?, ?, 'SALIDA', ?, NOW())`,
      [material_id, id, cantidad]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error("Error asignarMaterialAProyecto:", error);
    res.status(500).json({ ok: false, message: "Error al asignar material" });
  }
};
export const eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "UPDATE proyectos SET activo = 0 WHERE id = ?",
      [id]
    );

    await pool.query(
      "INSERT INTO movimientos (tipo, descripcion) VALUES (?, ?)",
      ["ELIMINACION", `Proyecto ID ${id} eliminado`]
    );

    res.json({ success: true, message: "Proyecto eliminado correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al eliminar proyecto" });
  }
};


