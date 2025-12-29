import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export async function register(req, res) {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, message: "Faltan datos" });
    }

    const [exists] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (exists.length) return res.status(409).json({ ok: false, message: "Email ya registrado" });

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES (?, ?, ?, 'user', 1)",
      [nombre, email, password_hash]
    );

    return res.json({ ok: true, message: "Usuario creado" });
  } catch (err) {
    console.error("❌ register:", err);
    return res.status(500).json({ ok: false, message: "Error al registrar" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, message: "Faltan datos" });

    const [rows] = await pool.query(
      "SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = ? LIMIT 1",
      [email]
    );
    if (!rows.length) return res.status(401).json({ ok: false, message: "Credenciales inválidas" });

    const u = rows[0];
    if (!u.activo) return res.status(403).json({ ok: false, message: "Usuario inactivo" });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ ok: false, message: "Credenciales inválidas" });

    const token = jwt.sign(
      { id: u.id, email: u.email, rol: u.rol },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      ok: true,
      token,
      user: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol }
    });
  } catch (err) {
    console.error("❌ login:", err);
    return res.status(500).json({ ok: false, message: "Error al iniciar sesión" });
  }
}

export async function me(req, res) {
  return res.json({ ok: true, user: req.user });
}
