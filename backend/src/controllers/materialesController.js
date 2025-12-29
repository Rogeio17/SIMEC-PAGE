
import pool from "../config/db.js";


export const crearMaterial = async (req, res) => {
  try {
    const { codigo, nombre, descripcion, stock_inicial, stock_minimo, ubicacion } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ ok: false, message: "Código y nombre son obligatorios" });
    }

    const [result] = await pool.query(
      `INSERT INTO materiales (codigo, nombre, descripcion, stock_actual, stock_minimo, ubicacion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        nombre,
        descripcion || "",
        stock_inicial || 0,
        stock_minimo || 0,
        ubicacion || ""
      ]
    );

    res.json({ ok: true, id: result.insertId });

  } catch (error) {
    console.error("❌ Error crearMaterial:", error);
    res.status(500).json({ ok: false, message: "Error al crear material" });
  }
};


export const listarMateriales = async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM materiales WHERE activo = 1`);
    res.json({ ok: true, materiales: rows });
  } catch (error) {
    console.error("❌ Error listarMateriales:", error);
    res.status(500).json({ ok: false, message: "Error al obtener materiales" });
  }
};


export const actualizarMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, stock_minimo, ubicacion, activo } = req.body;

    await pool.query(
      `UPDATE materiales
       SET nombre = ?, descripcion = ?, stock_minimo = ?, ubicacion = ?, activo = ?
       WHERE id = ?`,
      [nombre, descripcion, stock_minimo, ubicacion, activo ?? 1, id]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error("❌ Error actualizarMaterial:", error);
    res.status(500).json({ ok: false, message: "Error al actualizar material" });
  }
};

export const entradaMaterial = async (req, res) => {
  try {
    const { id, cantidad } = req.body;

    if (!id || !cantidad) {
      return res.status(400).json({ ok: false, message: "Datos incompletos" });
    }

    // Aumentar stock
    await pool.query(
      `UPDATE materiales SET stock_actual = stock_actual + ? WHERE id = ?`,
      [cantidad, id]
    );

    // Registrar movimiento
    await pool.query(
      `INSERT INTO movimientos (id_material, tipo, cantidad, fecha)
       VALUES (?, 'entrada', ?, NOW())`,
      [id, cantidad]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error("❌ Error entradaMaterial:", error);
    res.status(500).json({ ok: false, message: "Error al registrar entrada" });
  }
};
export const salidaMaterial = async (req, res) => {
  try {
    const { id, cantidad } = req.body;

    if (!id || !cantidad) {
      return res.status(400).json({ ok: false, message: "Datos incompletos" });
    }

    // Disminuir stock
    await pool.query(
      `UPDATE materiales SET stock_actual = stock_actual - ? WHERE id = ?`,
      [cantidad, id]
    );

    // Registrar movimiento
    await pool.query(
      `INSERT INTO movimientos (id_material, tipo, cantidad, fecha)
       VALUES (?, 'salida', ?, NOW())`,
      [id, cantidad]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error("❌ Error salidaMaterial:", error);
    res.status(500).json({ ok: false, message: "Error al registrar salida" });
  }
};

export const eliminarMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "UPDATE materiales SET activo = 0 WHERE id = ?",
      [id]
    );

    // Registrar movimiento (opcional pero recomendado)
    await pool.query(
      "INSERT INTO movimientos (tipo, descripcion) VALUES (?, ?)",
      ["ELIMINACION", `Material ID ${id} eliminado`]
    );

    res.json({ success: true, message: "Material eliminado correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al eliminar material" });
  }
};



