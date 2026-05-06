import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

function normalizarUnidadMaterial(unidad) {
  const u = String(unidad || "pza").trim();
  const key = u.toLowerCase();
  if (["m", "mt", "mts", "metro", "metros"].includes(key)) return "M";
  if (["kg", "kgs", "kilogramo", "kilogramos"].includes(key)) return "kg";
  if (["l", "lt", "lts", "litro", "litros"].includes(key)) return "Lt";
  return "pza";
}

function formatCantidadMaterial(cantidad, unidad) {
  const u = normalizarUnidadMaterial(unidad);
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return `${cantidad ?? 0} ${u}`;
  const txt = ["M", "kg", "Lt"].includes(u)
    ? n.toFixed(2)
    : (Number.isInteger(n) ? String(n) : String(n).replace(/\.00$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""));
  return `${txt} ${u}`;
}

/* ==================== PDF TEMPLATE (LOGO + HEADER) ==================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.join(__dirname, "..", "assets", "simec-logo.jpg");
const SIMEC_RED = "#b91c1c";

function drawSimecHeader(doc, title, subtitle = "") {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // Logo
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, left, 16, { width: 135 });
    }
  } catch {}

  // Encabezado texto
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#111")
    .text("SIMEC INGENIERIA", left + 155, 20, {
      width: right - (left + 155),
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444")
    .text("SOLUCIÓN INTEGRAL DE SISTEMAS ELÉCTRICOS", left + 155, 38, {
      width: right - (left + 155),
      align: "right",
    });

  // Línea roja
  doc.moveTo(left, 66).lineTo(right, 66).lineWidth(1).strokeColor(SIMEC_RED).stroke();

  // Título centrado
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111")
    .text(title, left, 78, {
      width,
      align: "center",
    });

  // Proyecto/etapa resaltado
  if (subtitle) {
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(SIMEC_RED)
      .text(subtitle, left, 99, {
        width,
        align: "center",
      });
  }

  // Meta
  const now = new Date();
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#666")
    .text(
      `Fecha: ${now.toLocaleDateString()}  Hora: ${now.toLocaleTimeString()}`,
      left,
      subtitle ? 122 : 102,
      { width, align: "center" }
    );

  doc.fillColor("#111");
  doc.y = subtitle ? 142 : 122;
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

  // Renglones compactos: todo queda dentro de la misma raya/fila.
  const headerH = 16;
  const rowH = 15;
  const fontSize = 9.2;
  const cellPadX = 4;
  const cellPadY = 3;

  const totalW = columns.reduce((s, c) => s + c.w, 0);
  const colW = columns.map(c => (c.w / totalW) * width);

  const drawHeader = () => {
    const headerY = doc.y;
    doc.rect(left, headerY, width, headerH).fill(SIMEC_RED);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(fontSize);

    let x = left;
    columns.forEach((c, i) => {
      doc.text(c.label, x + cellPadX, headerY + 3.5, {
        width: colW[i] - cellPadX * 2,
        height: headerH - 4,
        align: c.align || "left",
        lineBreak: false,
        ellipsis: true,
      });
      // PDFKit mueve doc.y después de text(); lo regresamos para que no descuadre columnas.
      doc.y = headerY;
      x += colW[i];
    });

    doc.y = headerY + headerH;
    doc.fillColor("#111").font("Helvetica").fontSize(fontSize);
  };

  drawHeader();

  rows.forEach(r => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }

    const rowY = doc.y;

    // Renglón completo, tipo hoja con rayas.
    doc
      .rect(left, rowY, width, rowH)
      .lineWidth(0.35)
      .strokeColor("#d1d5db")
      .stroke();

    let xx = left;
    r.forEach((val, i) => {
      // Separadores verticales suaves para que todo quede dentro de su columna.
      if (i > 0) {
        doc
          .moveTo(xx, rowY)
          .lineTo(xx, rowY + rowH)
          .lineWidth(0.25)
          .strokeColor("#e5e7eb")
          .stroke();
      }

      doc.fillColor("#111").font("Helvetica").fontSize(fontSize);
      doc.text(String(val ?? ""), xx + cellPadX, rowY + cellPadY, {
        width: colW[i] - cellPadX * 2,
        height: rowH - cellPadY,
        align: columns[i].align || "left",
        lineBreak: false,
        ellipsis: true,
      });
      // Mantiene todas las celdas al mismo nivel del renglón.
      doc.y = rowY;
      xx += colW[i];
    });

    doc.y = rowY + rowH;
  });

  doc.moveDown(0.25);
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
       m.unidad AS material_unidad,
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

  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatCantidad(cantidad, unidad) {
  return formatCantidadMaterial(cantidad, unidad);
}

function setupSalidasSheet(sheet) {
  sheet.columns = [
    { header: "Fecha exacta", key: "fecha_exacta", width: 24 },
    { header: "Material", key: "material_nombre", width: 42 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Entregado a", key: "empleado_nombre", width: 26 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB91C1C" },
  };

  sheet.columns.forEach(col => {
    col.alignment = { vertical: "middle", wrapText: false };
  });
}

function buildSalidasRows(rows) {
  return rows
    .filter(r => r.tipo === "SALIDA")
    .map(r => ({
      fecha_exacta: formatFechaExacta(r.creado_en),
      material_nombre: r.material_nombre,
      cantidad: formatCantidad(r.cantidad, r.material_unidad),
      empleado_nombre: r.empleado_nombre || "-",
    }));
}

const SALIDAS_PDF_COLUMNS = [
  { label: "Fecha exacta", w: 24 },
  { label: "Material", w: 42 },
  { label: "Cantidad", w: 10, align: "center" },
  { label: "Entregado a", w: 24 },
];

/* ==================== EXPORT PROYECTO (EXCEL) ==================== */
export async function exportProyectoExcel(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const rows = await queryMovimientos({ proyectoId });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Salidas");

    setupSalidasSheet(sheet);
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

    const salidas = buildSalidasRows(rows);

    drawSimpleTable(
      doc,
      SALIDAS_PDF_COLUMNS,
      salidas.map(r => [
        r.fecha_exacta,
        r.material_nombre,
        r.cantidad,
        r.empleado_nombre,
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
    const sheet = workbook.addWorksheet("Salidas");

    setupSalidasSheet(sheet);
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

    const salidas = buildSalidasRows(rows);

    drawSimpleTable(
      doc,
      SALIDAS_PDF_COLUMNS,
      salidas.map(r => [
        r.fecha_exacta,
        r.material_nombre,
        r.cantidad,
        r.empleado_nombre,
      ])
    );

    doc.end();
  } catch (err) {
    console.error("❌ exportEtapaPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar PDF de etapa" });
  }
}
