import pool from "../config/db.js";
import PDFDocument from "pdfkit";

const ESTADOS_VEHICULO = new Set(["activo", "en taller", "fuera de servicio"]);
const TIPOS_MANTENIMIENTO = new Set(["cambio de aceite", "frenos", "reparaciones"]);

function toNull(v) {
  const x = (v ?? "").toString().trim();
  return x === "" ? null : x;
}

function normalizarEstado(v) {
  const estado = (v || "activo").toString().trim().toLowerCase();
  return ESTADOS_VEHICULO.has(estado) ? estado : null;
}

function normalizarTipo(v) {
  const tipo = (v || "").toString().trim().toLowerCase();
  return TIPOS_MANTENIMIENTO.has(tipo) ? tipo : null;
}

let conductorColumnChecked = false;
async function asegurarCampoConductor() {
  if (conductorColumnChecked) return;
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vehiculos'
       AND COLUMN_NAME = 'conductor'
     LIMIT 1`
  );
  if (!cols.length) {
    await pool.query(`ALTER TABLE vehiculos ADD COLUMN conductor VARCHAR(150) NULL AFTER modelo`);
  }
  conductorColumnChecked = true;
}

function formatoFecha(fecha) {
  if (!fecha) return "—";
  const texto = String(fecha);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? texto : d.toLocaleDateString("es-MX");
}

export async function listarVehiculos(_req, res) { 
  try {
    await asegurarCampoConductor();
    const [rows] = await pool.query(` 
      SELECT
        v.id,
        v.codigo,
        v.placas,
        v.marca,
        v.modelo,
        v.conductor,
        v.anio,
        v.color,
        v.numero_serie,
        v.estado,
        (
          SELECT vm.fecha_proximo
          FROM vehiculo_mantenimientos vm
          WHERE vm.vehiculo_id = v.id
            AND vm.tipo_mantenimiento = 'cambio de aceite'
          ORDER BY vm.fecha_proximo ASC, vm.id DESC
          LIMIT 1
        ) AS proximo_mantenimiento,
        (
          SELECT vm.tipo_mantenimiento
          FROM vehiculo_mantenimientos vm
          WHERE vm.vehiculo_id = v.id
            AND vm.tipo_mantenimiento = 'cambio de aceite'
          ORDER BY vm.fecha_proximo ASC, vm.id DESC
          LIMIT 1
        ) AS proximo_tipo
      FROM vehiculos v
      ORDER BY v.codigo ASC, v.id ASC
    `);
    return res.json({ ok: true, vehiculos: rows });
  } catch (err) {
    console.error("listarVehiculos:", err);
    return res.status(500).json({ ok: false, message: "Error al listar vehículos" });
  }
}

export async function crearVehiculo(req, res) {
  try {
    await asegurarCampoConductor();
    const codigo = toNull(req.body.codigo);
    const placas = toNull(req.body.placas);
    const marca = toNull(req.body.marca);
    const modelo = toNull(req.body.modelo);
    const conductor = toNull(req.body.conductor);
    const anio = req.body.anio ? Number(req.body.anio) : null;
    const color = toNull(req.body.color);
    const numero_serie = toNull(req.body.numero_serie);
    const estado = normalizarEstado(req.body.estado);

    if (!codigo || !placas || !marca || !modelo || !estado) {
      return res.status(400).json({ ok: false, message: "Faltan datos obligatorios del vehículo" });
    }

    await pool.query(
      `INSERT INTO vehiculos
      (codigo, placas, marca, modelo, conductor, anio, color, numero_serie, estado, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [codigo, placas, marca, modelo, conductor, anio, color, numero_serie, estado]
    );

    return res.json({ ok: true, message: "Vehículo registrado" });
  } catch (err) {
    console.error("crearVehiculo:", err);
    return res.status(500).json({ ok: false, message: "Error al crear vehículo" });
  }
}

export async function actualizarVehiculo(req, res) {
  try {
    await asegurarCampoConductor();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const codigo = toNull(req.body.codigo);
    const placas = toNull(req.body.placas);
    const marca = toNull(req.body.marca);
    const modelo = toNull(req.body.modelo);
    const conductor = toNull(req.body.conductor);
    const anio = req.body.anio ? Number(req.body.anio) : null;
    const color = toNull(req.body.color);
    const numero_serie = toNull(req.body.numero_serie);
    const estado = normalizarEstado(req.body.estado);

    if (!codigo || !placas || !marca || !modelo || !estado) {
      return res.status(400).json({ ok: false, message: "Faltan datos obligatorios del vehículo" });
    }

    await pool.query(
      `UPDATE vehiculos
       SET codigo = ?, placas = ?, marca = ?, modelo = ?, conductor = ?, anio = ?, color = ?, numero_serie = ?, estado = ?
       WHERE id = ?`,
      [codigo, placas, marca, modelo, conductor, anio, color, numero_serie, estado, id]
    );

    return res.json({ ok: true, message: "Vehículo actualizado" });
  } catch (err) {
    console.error("actualizarVehiculo:", err);
    return res.status(500).json({ ok: false, message: "Error al actualizar vehículo" });
  }
}

export async function listarMantenimientos(req, res) {
  try {
    const vehiculoId = Number(req.params.vehiculoId);
    if (!Number.isInteger(vehiculoId)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const [rows] = await pool.query(`
      SELECT
        vm.id,
        vm.vehiculo_id,
        vm.tipo_mantenimiento,
        vm.fecha_realizado,
        vm.fecha_proximo,
        vm.costo,
        vm.proveedor,
        vm.observaciones,
        vm.archivo,
        vm.created_at,
        u.nombre AS usuario_nombre,
        u.email AS usuario_email
      FROM vehiculo_mantenimientos vm
      LEFT JOIN usuarios u ON u.id = vm.usuario_id
      WHERE vm.vehiculo_id = ?
      ORDER BY vm.fecha_proximo ASC, vm.fecha_realizado DESC, vm.id DESC
    `, [vehiculoId]);

    return res.json({ ok: true, mantenimientos: rows });
  } catch (err) {
    console.error("listarMantenimientos:", err);
    return res.status(500).json({ ok: false, message: "Error al listar mantenimientos" });
  }
}

export async function crearMantenimiento(req, res) {
  try {
    const vehiculoId = Number(req.params.vehiculoId);
    if (!Number.isInteger(vehiculoId)) return res.status(400).json({ ok: false, message: "ID inválido" });

    const tipo = normalizarTipo(req.body.tipo_mantenimiento);
    const fechaRealizado = toNull(req.body.fecha_realizado);
    const fechaProximo = toNull(req.body.fecha_proximo);
    const costo = req.body.costo === "" || req.body.costo == null ? null : Number(req.body.costo);
    const proveedor = toNull(req.body.proveedor);
    const observaciones = toNull(req.body.observaciones);
    const archivo = toNull(req.body.archivo);
    const usuarioId = req.user?.id || null;

    if (!tipo || !fechaRealizado || !fechaProximo) {
      return res.status(400).json({ ok: false, message: "Tipo y fechas son obligatorios" });
    }

    await pool.query(
      `INSERT INTO vehiculo_mantenimientos
      (vehiculo_id, tipo_mantenimiento, fecha_realizado, fecha_proximo, costo, proveedor, observaciones, archivo, usuario_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [vehiculoId, tipo, fechaRealizado, fechaProximo, costo, proveedor, observaciones, archivo, usuarioId]
    );

    return res.json({ ok: true, message: "Mantenimiento registrado" });
  } catch (err) {
    console.error("crearMantenimiento:", err);
    return res.status(500).json({ ok: false, message: "Error al registrar mantenimiento" });
  }
}

export async function exportarReporteVehiculosPdf(_req, res) {
  try {
    await asegurarCampoConductor();

    const [vehiculos] = await pool.query(`
      SELECT id, codigo, placas, marca, modelo, conductor, anio, color, numero_serie, estado
      FROM vehiculos
      ORDER BY codigo ASC, id ASC
    `);

    const [mantenimientos] = await pool.query(`
      SELECT vehiculo_id, tipo_mantenimiento, fecha_realizado, fecha_proximo, costo, proveedor, observaciones
      FROM vehiculo_mantenimientos
      ORDER BY fecha_realizado DESC, id DESC
    `);

    const porVehiculo = new Map();
    mantenimientos.forEach(m => {
      if (!porVehiculo.has(m.vehiculo_id)) porVehiculo.set(m.vehiculo_id, []);
      porVehiculo.get(m.vehiculo_id).push(m);
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="reporte_vehiculos.pdf"`);

    const doc = new PDFDocument({ margin: 36, size: "LETTER" });
    doc.pipe(res);

    doc.fontSize(18).text("Reporte de mantenimiento vehicular", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Generado: ${formatoFecha(new Date().toISOString())}`, { align: "center" });
    doc.moveDown(1);

    if (!vehiculos.length) {
      doc.fontSize(12).text("No hay vehículos registrados.");
      doc.end();
      return;
    }

    vehiculos.forEach((v, idx) => {
      if (idx > 0) doc.moveDown(0.8);
      if (doc.y > 690) doc.addPage();

      const historial = porVehiculo.get(v.id) || [];
      const ultimoAceite = historial.find(m => m.tipo_mantenimiento === "cambio de aceite");

      doc.fontSize(13).text(`${v.codigo || ""} - ${v.marca || ""} ${v.modelo || ""}`, { underline: true });
      doc.fontSize(10)
        .text(`Placas: ${v.placas || "—"}    Año: ${v.anio || "—"}    Estado: ${v.estado || "—"}`)
        .text(`Modelo: ${v.modelo || "—"}    Quien lo maneja: ${v.conductor || "—"}`)
        .text(`Último cambio de aceite: ${ultimoAceite ? formatoFecha(ultimoAceite.fecha_realizado) : "—"}`);

      doc.moveDown(0.35);
      doc.fontSize(10).text("Historial de mantenimientos / reparaciones:");

      if (!historial.length) {
        doc.text("  - Sin historial registrado.");
        return;
      }

      historial.forEach(m => {
        if (doc.y > 720) doc.addPage();
        const costo = m.costo != null ? ` | Costo: $${Number(m.costo).toFixed(2)}` : "";
        const taller = m.proveedor ? ` | Taller: ${m.proveedor}` : "";
        const obs = m.observaciones ? ` | Obs: ${m.observaciones}` : "";
        doc.text(`  - ${m.tipo_mantenimiento || "Mantenimiento"} | Realizado: ${formatoFecha(m.fecha_realizado)} | Próximo: ${formatoFecha(m.fecha_proximo)}${costo}${taller}${obs}`);
      });
    });

    doc.end();
  } catch (err) {
    console.error("exportarReporteVehiculosPdf:", err);
    return res.status(500).json({ ok: false, message: "Error al generar reporte de vehículos" });
  }
}

export async function listarAlertasVehiculos(_req, res) {
  try {
    await asegurarCampoConductor();
    const [rows] = await pool.query(`
      SELECT
        vm.id,
        vm.vehiculo_id,
        vm.tipo_mantenimiento,
        vm.fecha_realizado,
        vm.fecha_proximo,
        v.codigo,
        v.placas,
        v.marca,
        v.modelo,
        v.conductor,
        CASE
          WHEN vm.fecha_proximo < CURDATE() THEN 'vencido'
          WHEN vm.fecha_proximo <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'proximo'
          ELSE 'al_corriente'
        END AS alerta_estado,
        DATEDIFF(vm.fecha_proximo, CURDATE()) AS dias_restantes
      FROM vehiculo_mantenimientos vm
      INNER JOIN (
        SELECT vehiculo_id, tipo_mantenimiento, MIN(fecha_proximo) AS fecha_proximo_min
        FROM vehiculo_mantenimientos
        GROUP BY vehiculo_id, tipo_mantenimiento
      ) ult
        ON ult.vehiculo_id = vm.vehiculo_id
       AND ult.tipo_mantenimiento = vm.tipo_mantenimiento
       AND ult.fecha_proximo_min = vm.fecha_proximo
      INNER JOIN vehiculos v ON v.id = vm.vehiculo_id
      WHERE vm.fecha_proximo <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY vm.fecha_proximo ASC, v.codigo ASC
    `);

    return res.json({ ok: true, alertas: rows });
  } catch (err) {
    console.error("listarAlertasVehiculos:", err);
    return res.status(500).json({ ok: false, message: "Error al listar alertas" });
  }
}
