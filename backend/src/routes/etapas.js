import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import pool from "../config/db.js";

const router = express.Router();

router.use(requireAuth);

// Listar etapas por proyecto
router.get("/proyectos/:id/etapas", async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, proyecto_id, nombre, estado, creado_en, cerrado_en
       FROM proyecto_etapas
       WHERE proyecto_id = ?
       ORDER BY id DESC`,
      [proyectoId]
    );
    res.json({ ok: true, etapas: rows });
  } catch (err) {
    console.error("❌ listar etapas:", err);
    res.status(500).json({ ok: false, message: "Error al listar etapas" });
  }
});

// Etapa activa
router.get("/proyectos/:id/etapas/activa", async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, proyecto_id, nombre, estado
       FROM proyecto_etapas
       WHERE proyecto_id = ? AND estado = 'ACTIVA'
       ORDER BY id DESC
       LIMIT 1`,
      [proyectoId]
    );
    res.json({ ok: true, etapa: rows[0] || null });
  } catch (err) {
    console.error("❌ etapa activa:", err);
    res.status(500).json({ ok: false, message: "Error al obtener etapa activa" });
  }
});

// Crear etapa (admin)
router.post("/proyectos/:id/etapas", requireRole("admin"), async (req, res) => {
  try {
    const proyectoId = Number(req.params.id);
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ ok: false, message: "Nombre requerido" });

    // cerrar etapas activas previas
    await pool.query(
      `UPDATE proyecto_etapas
       SET estado = 'CERRADA', cerrado_en = NOW()
       WHERE proyecto_id = ? AND estado = 'ACTIVA'`,
      [proyectoId]
    );

    await pool.query(
      `INSERT INTO proyecto_etapas (proyecto_id, nombre, estado, creado_en)
       VALUES (?, ?, 'ACTIVA', NOW())`,
      [proyectoId, nombre]
    );

    res.json({ ok: true, message: "Etapa creada" });
  } catch (err) {
    console.error("❌ crear etapa:", err);
    res.status(500).json({ ok: false, message: "Error al crear etapa" });
  }
});

// Cerrar etapa (admin)
router.post("/etapas/:etapaId/cerrar", requireRole("admin"), async (req, res) => {
  try {
    const etapaId = Number(req.params.etapaId);

    await pool.query(
      `UPDATE proyecto_etapas
       SET estado = 'CERRADA', cerrado_en = NOW()
       WHERE id = ?`,
      [etapaId]
    );

    res.json({ ok: true, message: "Etapa cerrada" });
  } catch (err) {
    console.error("❌ cerrar etapa:", err);
    res.status(500).json({ ok: false, message: "Error al cerrar etapa" });
  }
});

export default router;
