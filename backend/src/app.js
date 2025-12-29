import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import materialRoutes from "./routes/materiales.js";
import proyectoRoutes from "./routes/proyectos.js";
import movimientoRoutes from "./routes/movimientos.js";
import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "2mb" }));

// CORS (en prod pon tu dominio en CORS_ORIGIN)
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend estático (carpeta /frontend en la raíz del proyecto)
const frontendPath = path.join(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// API
app.use("/api/materiales", materialRoutes);
app.use("/api/proyectos", proyectoRoutes);
app.use("/api/movimientos", movimientoRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Error handler (siempre al final)
app.use(errorHandler);

export default app;
