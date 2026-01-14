import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";



import materialRoutes from "./routes/materiales.js";
import proyectoRoutes from "./routes/proyectos.js";
import movimientoRoutes from "./routes/movimientos.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import proveedoresRoutes from "./routes/proveedores.js";
import etapasRoutes from "./routes/etapas.js";
import lotesRoutes from "./routes/lotes.js";
import empleadosRoutes from "./routes/empleados.js";


const app = express();

app.use(express.json({ limit: "2mb" }));


const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const frontendPath = path.join(__dirname, "../../frontend");
app.use(express.static(frontendPath));


app.use("/api/materiales", materialRoutes);
app.use("/api/proyectos", proyectoRoutes);
app.use("/api/movimientos", movimientoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api", etapasRoutes);
app.use("/api/lotes", lotesRoutes);
app.use("/api/empleados", empleadosRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


app.use(errorHandler);

export default app;
