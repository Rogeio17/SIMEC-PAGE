import bcrypt from "bcryptjs";
import pool from "../config/db.js";

export async function listarUsuarios(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY id DESC"
    );
    res.json({ ok: true, usuarios: rows });
  } catch (err) {
    console.error("❌ listarUsuarios:", err);
    res.status(500).json({ ok: false, message: "Error al listar usuarios" });
  }
}

export async function crearUsuario(req, res) {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, message: "Faltan datos" });
    }

    const userRol = rol === "admin" ? "admin" : "user";

    const [exists] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (exists.length) return res.status(409).json({ ok: false, message: "Ese email ya existe" });

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES (?, ?, ?, ?, 1)",
      [nombre, email, password_hash, userRol]
    );

    res.json({ ok: true, message: "Usuario creado" });
  } catch (err) {
    console.error("❌ crearUsuario:", err);
    res.status(500).json({ ok: false, message: "Error al crear usuario" });
  }
}
