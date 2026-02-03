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

function drawSimecHeader(doc, { title, subtitle = "" }) {
  const left = doc.page.margins.left;
  const top = 22;
  const right = doc.page.width - doc.page.margins.right;

  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, left, top, { width: 150 });
    }
  } catch {
    // ignore logo errors
  }

  const textX = left + 165;
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("SIMEC INGENIERIA", textX, top + 6, { width: right - textX, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .text("SOLUCIÓN INTEGRAL DE SISTEMAS ELÉCTRICOS", textX, top + 26, {
      width: right - textX,
      align: "right",
    });

  doc.moveTo(left, 78).lineTo(right, 78).lineWidth(1).strokeColor("#C8C8C8").stroke();

  doc.fillColor("#111").font("Helvetica-Bold").fontSize(13).text(title, left, 90, {
    width: right - left,
    align: "left",
  });

  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#333")
      .text(subtitle, left, 108, { width: right - left, align: "left" });
  }

  const now = new Date();
  const meta = `Fecha: ${now.toLocaleDateString()}  Hora: ${now.toLocaleTimeString()}`;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444")
    .text(meta, left, subtitle ? 128 : 110, { width: right - left, align: "left" });

  doc.fillColor("#111");
  doc.y = subtitle ? 152 : 135;
}

function drawSimpleTable(doc, { columns, rows }) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const rowH = 18;

  const totalColW = columns.reduce((s, c) => s + c.w, 0);
  const colWs = columns.map(c => (c.w / totalColW) * tableWidth);

  function ensureSpace(extra = rowH * 2) {
    if (doc.y + extra > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }

  ensureSpace();
  let x = left;
  doc.font("Helvetica-Bold").fontSize(9);
  columns.forEach((c, i) => {
    doc.text(c.label, x + 2, doc.y + 4, { width: colWs[i] - 4, align: c.align || "left" });
    x += colWs[i];
  });
  doc
    .moveTo(left, doc.y + rowH)
    .lineTo(right, doc.y + rowH)
    .lineWidth(1)
    .strokeColor("#C8C8C8")
    .stroke();
  doc.y += rowH + 2;

  doc.font("Helvetica").fontSize(9).fillColor("#111");
  rows.forEach(r => {
    ensureSpace();
    let xx = left;
    r.forEach((val, i) => {
      doc.text(String(val ?? ""), xx + 2, doc.y + 4, {
        width: colWs[i] - 4,
        align: columns[i].align || "left",
      });
      xx += colWs[i];
    });
    doc.y += rowH;
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .lineWidth(0.5)
      .strokeColor("#EFEFEF")
      .stroke();
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
       m.precio_unitario,
       (IFNULL(m.precio_unitario,0) * mv.cantidad) AS total
     FROM movimientos mv
     JOIN proyectos p ON p.id = mv.proyecto_id
     LEFT JOIN proyecto_etapas e ON e.id = mv.etapa_id
     JOIN materiales m ON m.id = mv.material_id
     LEFT JOIN usuarios u ON u.id = mv.usuario_id
     WHERE mv.proyecto_id = ? ${whereEtapa}
     ORDER BY mv.creado_en ASC`,
    params
  );

  return rows;
}

/* ==================== EXPORT PROYECTO (EXCEL) ==================== */
export async function exportProyectoExcel(req, res) {
  try {
    const proyectoId = Number(req.params.id);
    const rows = await queryMovimientos({ proyectoId });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Proyecto");

    sheet.columns = [
      { header: "Proyecto", key: "proyecto_nombre", width: 25 },
      { header: "Etapa", key: "etapa_nombre", width: 20 },
      { header: "Código", key: "material_codigo", width: 15 },
      { header: "Material", key: "material_nombre", width: 30 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Tipo", key: "tipo", width: 10 },
      { header: "Precio unitario", key: "precio_unitario", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Usuario", key: "usuario_nombre", width: 20 },
      { header: "Email", key: "usuario_email", width: 25 },
      { header: "Fecha", key: "creado_en", width: 22 },
      { header: "Comentario", key: "comentario", width: 30 }
    ];

    rows.forEach(r => sheet.addRow(r));

    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename=proyecto_${proyectoId}.xlsx`);

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
      drawSimecHeader(doc, {
        title: "Reporte de Proyecto",
        subtitle: `${proyectoNombre} ${proyectoClave}`.trim(),
      });
    applyHeader();
    doc.on("pageAdded", applyHeader);

    let totalGeneral = 0;
    rows.forEach(r => (totalGeneral += Number(r.total || 0)));

    drawSimpleTable(doc, {
      columns: [
        { label: "Etapa", w: 18 },
        { label: "Código", w: 12 },
        { label: "Material", w: 40 },
        { label: "Cant", w: 8, align: "right" },
        { label: "Tipo", w: 10 },
        { label: "Total", w: 12, align: "right" },
      ],
      rows: rows.map(r => [
        r.etapa_nombre || "-",
        r.material_codigo,
        r.material_nombre,
        String(r.cantidad ?? ""),
        r.tipo,
        `$${Number(r.total || 0).toFixed(2)}`,
      ]),
    });

    doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(11).text(`TOTAL GENERAL: $${totalGeneral.toFixed(2)}`, {
      align: "right",
    });

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
    const sheet = workbook.addWorksheet("Etapa");

    sheet.columns = [
      { header: "Proyecto", key: "proyecto_nombre", width: 25 },
      { header: "Etapa", key: "etapa_nombre", width: 20 },
      { header: "Código", key: "material_codigo", width: 15 },
      { header: "Material", key: "material_nombre", width: 30 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Tipo", key: "tipo", width: 10 },
      { header: "Precio unitario", key: "precio_unitario", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Usuario", key: "usuario_nombre", width: 20 },
      { header: "Email", key: "usuario_email", width: 25 },
      { header: "Fecha", key: "creado_en", width: 22 },
      { header: "Comentario", key: "comentario", width: 30 }
    ];

    rows.forEach(r => sheet.addRow(r));

    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename=proyecto_${proyectoId}_etapa_${etapaId}.xlsx`);

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
    res.setHeader("Content-Disposition", `attachment; filename=proyecto_${proyectoId}_etapa_${etapaId}.pdf`);
    doc.pipe(res);

    const proyectoNombre = rows[0]?.proyecto_nombre || `Proyecto #${proyectoId}`;
    const etapaNombre = rows[0]?.etapa_nombre || `Etapa #${etapaId}`;

    const applyHeader = () =>
      drawSimecHeader(doc, {
        title: "Reporte de Etapa",
        subtitle: `${proyectoNombre} — ${etapaNombre}`,
      });
    applyHeader();
    doc.on("pageAdded", applyHeader);

    let totalGeneral = 0;
    rows.forEach(r => (totalGeneral += Number(r.total || 0)));

    drawSimpleTable(doc, {
      columns: [
        { label: "Código", w: 14 },
        { label: "Material", w: 52 },
        { label: "Cant", w: 10, align: "right" },
        { label: "Tipo", w: 12 },
        { label: "Total", w: 12, align: "right" },
      ],
      rows: rows.map(r => [
        r.material_codigo,
        r.material_nombre,
        String(r.cantidad ?? ""),
        r.tipo,
        `$${Number(r.total || 0).toFixed(2)}`,
      ]),
    });

    doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(11).text(`TOTAL ETAPA: $${totalGeneral.toFixed(2)}`, {
      align: "right",
    });

    doc.end();
  } catch (err) {
    console.error("❌ exportEtapaPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar PDF de etapa" });
  }
}
