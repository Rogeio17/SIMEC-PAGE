import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

/* ==================== PDF TEMPLATE (LOGO + HEADER) ==================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.join(__dirname, "..", "assets", "simec-logo.jpg");
const SIMEC_RED = "#b91c1c";

function drawSimecHeader(doc, title, subtitle = "") {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const usableWidth = right - left;

  // Logo
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, left, 18, { width: 140 });
    }
  } catch {}

  // Encabezado texto
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#111")
    .text("SIMEC INGENIERIA", left + 160, 22, {
      width: right - (left + 160),
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444")
    .text("SOLUCIÓN INTEGRAL DE SISTEMAS ELÉCTRICOS", left + 160, 40, {
      width: right - (left + 160),
      align: "right",
    });

  // Línea roja
  doc.moveTo(left, 70).lineTo(right, 70).lineWidth(1).strokeColor(SIMEC_RED).stroke();

  // Título del reporte
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111")
    .text(title, left, 82, {
      width: usableWidth,
      align: "center",
    });

  // Proyecto resaltado
  if (subtitle) {
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(SIMEC_RED)
      .text(subtitle, left, 104, {
        width: usableWidth,
        align: "center",
      });
  }

  // Meta
  const now = new Date();
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#666")
    .text(
      `Fecha: ${now.toLocaleDateString()}  Hora: ${now.toLocaleTimeString()}`,
      left,
      subtitle ? 126 : 106,
      {
        width: usableWidth,
        align: "center",
      }
    );

  doc.fillColor("#111");
  doc.y = subtitle ? 148 : 128;
}

/**
 * Tabla compacta estilo "Opción C"
 * columns: [{label, w, align?}]
 * rows: array de arrays (mismo orden que columns)
 */
function drawSimpleTable(doc, columns, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  const headerH = 18;
  const minRowH = 21;
  const fontSize = 10;

  const totalW = columns.reduce((s, c) => s + c.w, 0);
  const colW = columns.map(c => (c.w / totalW) * width);

  const drawTableHeader = () => {
    const headerTop = doc.y;
    doc.rect(left, headerTop, width, headerH).fill(SIMEC_RED);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10);

    let x = left;
    columns.forEach((c, i) => {
      doc.text(c.label, x + 6, headerTop + 4, {
        width: colW[i] - 12,
        align: c.align || "left",
      });
      x += colW[i];
    });

    doc.y = headerTop + headerH;
    doc.fillColor("#111").font("Helvetica").fontSize(fontSize);
  };

  drawTableHeader();

  rows.forEach(r => {
    const cellHeights = r.map((val, i) =>
      doc.heightOfString(String(val ?? ""), {
        width: colW[i] - 12,
        align: columns[i].align || "left",
      })
    );
    const rowH = Math.max(minRowH, Math.max(...cellHeights) + 9);

    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawTableHeader();
    }

    const rowTop = doc.y;
    let xx = left;

    r.forEach((val, i) => {
      doc
        .font("Helvetica")
        .fontSize(fontSize)
        .fillColor("#111")
        .text(String(val ?? ""), xx + 6, rowTop + 5, {
          width: colW[i] - 12,
          align: columns[i].align || "left",
        });
      xx += colW[i];
    });

    doc
      .moveTo(left, rowTop + rowH)
      .lineTo(right, rowTop + rowH)
      .lineWidth(0.5)
      .strokeColor("#e5e7eb")
      .stroke();

    doc.y = rowTop + rowH;
  });

  doc.moveDown(0.6);
}

/* ==================== HELPERS ==================== */
async function queryMovimientos({ proyectoId, etapaId = null }) {
  const params = [proyectoId];
  let whereEtapa = "";

  if (etapaId !== null) {
    whereEtapa = " AND mv.etapa_id = ? ";
    params.push(etapaId);
  }

  const [rows] = await pool.query(
    `SELECT
       p.clave AS proyecto_clave,
       p.nombre AS proyecto_nombre,
       e.nombre AS etapa_nombre,
       m.codigo AS material_codigo,
       m.nombre AS material_nombre,
       mv.cantidad,
       mv.tipo,
       mv.comentario,
       mv.creado_en,
       u.nombre AS usuario_nombre,
       u.email AS usuario_email,
       emp.nombre AS empleado_nombre,
       m.precio_unitario,
       (IFNULL(m.precio_unitario,0) * mv.cantidad) AS total
     FROM movimientos mv
     JOIN proyectos p ON p.id = mv.proyecto_id
     LEFT JOIN proyecto_etapas e ON e.id = mv.etapa_id
     JOIN materiales m ON m.id = mv.material_id
     LEFT JOIN usuarios u ON u.id = mv.usuario_id
     LEFT JOIN empleados emp ON emp.id = mv.entregado_a_empleado_id
     WHERE mv.proyecto_id = ? ${whereEtapa}
     ORDER BY mv.creado_en ASC`,
    params
  );

  return rows;
}

function formatFechaExacta(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);

  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildSalidasRows(rows) {
  return rows
    .filter(r => r.tipo === "SALIDA")
    .map(r => ({
      fecha_exacta: formatFechaExacta(r.creado_en),
      material_nombre: r.material_nombre,
      empleado_nombre: r.empleado_nombre || "-",
    }));
}

function styleSalidasSheet(sheet, titulo, proyectoNombre, etapaNombre = "") {
  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = titulo;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:C2");
  sheet.getCell("A2").value = etapaNombre ? `${proyectoNombre} — ${etapaNombre}` : proyectoNombre;
  sheet.getCell("A2").font = { bold: true, size: 13, color: { argb: "FFB91C1C" } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.addRow([]);
  sheet.addRow(["Fecha exacta", "Material", "Entregado a"]);

  const headerRow = sheet.getRow(4);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
  headerRow.alignment = { vertical: "middle" };

  sheet.columns = [
    { key: "fecha_exacta", width: 24 },
    { key: "material_nombre", width: 50 },
    { key: "empleado_nombre", width: 24 },
  ];
}

/* ==================== EXPORT PROYECTO (EXCEL) ==================== */
export async function exportProyectoExcel(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const rows = await queryMovimientos({ proyectoId });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte de Salidas");
    const proyectoNombre = rows[0]?.proyecto_nombre || `Proyecto #${proyectoId}`;
    const proyectoClave = rows[0]?.proyecto_clave ? `(${rows[0].proyecto_clave})` : "";

    styleSalidasSheet(
      sheet,
      "Reporte de Salidas",
      `${proyectoNombre} ${proyectoClave}`.trim()
    );

    buildSalidasRows(rows).forEach(r => sheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=proyecto_${proyectoId}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportProyectoExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar Excel" });
  }
}

/* ==================== EXPORT PROYECTO (PDF) ==================== */
export async function exportProyectoPdf(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const rows = await queryMovimientos({ proyectoId });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=proyecto_${proyectoId}.pdf`);
    doc.pipe(res);

    const proyectoNombre = rows[0]?.proyecto_nombre || `Proyecto #${proyectoId}`;
    const proyectoClave = rows[0]?.proyecto_clave ? `(${rows[0].proyecto_clave})` : "";

    const applyHeader = () =>
      drawSimecHeader(doc, "Reporte de Salidas", `${proyectoNombre} ${proyectoClave}`.trim());
    applyHeader();
    doc.on("pageAdded", applyHeader);

    const salidas = rows.filter(r => r.tipo === "SALIDA");

    drawSimpleTable(
      doc,
      [
        { label: "Fecha exacta", w: 24 },
        { label: "Material", w: 52 },
        { label: "Entregado a", w: 24 },
      ],
      salidas.map(r => [
        formatFechaExacta(r.creado_en),
        r.material_nombre,
        r.empleado_nombre || "-",
      ])
    );

    doc.end();
  } catch (err) {
    console.error("❌ exportProyectoPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar PDF" });
  }
}

/* ==================== EXPORT ETAPA (EXCEL) ==================== */
export async function exportEtapaExcel(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const etapaId = Number(req.params.etapaId);
    const rows = await queryMovimientos({ proyectoId, etapaId });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte de Salidas");
    const proyectoNombre = rows[0]?.proyecto_nombre || `Proyecto #${proyectoId}`;
    const etapaNombre = rows[0]?.etapa_nombre || `Etapa #${etapaId}`;

    styleSalidasSheet(sheet, "Reporte de Salidas", proyectoNombre, etapaNombre);

    buildSalidasRows(rows).forEach(r => sheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=proyecto_${proyectoId}_etapa_${etapaId}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportEtapaExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar Excel de etapa" });
  }
}

/* ==================== EXPORT ETAPA (PDF) ==================== */
export async function exportEtapaPdf(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const etapaId = Number(req.params.etapaId);
    const rows = await queryMovimientos({ proyectoId, etapaId });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=proyecto_${proyectoId}_etapa_${etapaId}.pdf`
    );
    doc.pipe(res);

    const proyectoNombre = rows[0]?.proyecto_nombre || `Proyecto #${proyectoId}`;
    const etapaNombre = rows[0]?.etapa_nombre || `Etapa #${etapaId}`;

    const applyHeader = () =>
      drawSimecHeader(doc, "Reporte de Salidas", `${proyectoNombre} — ${etapaNombre}`);
    applyHeader();
    doc.on("pageAdded", applyHeader);

    const salidas = rows.filter(r => r.tipo === "SALIDA");

    drawSimpleTable(
      doc,
      [
        { label: "Fecha exacta", w: 24 },
        { label: "Material", w: 52 },
        { label: "Entregado a", w: 24 },
      ],
      salidas.map(r => [
        formatFechaExacta(r.creado_en),
        r.material_nombre,
        r.empleado_nombre || "-",
      ])
    );

    doc.end();
  } catch (err) {
    console.error("❌ exportEtapaPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar PDF de etapa" });
  }
}
