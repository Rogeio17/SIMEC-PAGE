import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { crearProyecto, listarProyectos } from "../controllers/proyectosController.js";
import { exportProyectoExcel, exportProyectoPdf } from "../controllers/exportController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listarProyectos);
router.post("/", requireRole("admin"), crearProyecto);

router.get("/:id/export/excel", exportProyectoExcel);
router.get("/:id/export/pdf", exportProyectoPdf);

export default router;

