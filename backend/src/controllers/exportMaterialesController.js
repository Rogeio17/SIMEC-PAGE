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

function drawSimecHeader(doc, title) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, left, 18, { width: 140 });
    }
  } catch {}

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

  doc.moveTo(left, 70).lineTo(right, 70).lineWidth(1).strokeColor(SIMEC_RED).stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#111")
    .text(title, left, 82);

  const now = new Date();
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#666")
    .text(
      `Fecha: ${now.toLocaleDateString()}  Hora: ${now.toLocaleTimeString()}`,
      left,
      100
    );

  doc.fillColor("#111");
  doc.y = 120;
}

function drawSimpleTable(doc, columns, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  const headerH = 16;
  const rowH = 14;

  const totalW = columns.reduce((s, c) => s + c.w, 0);
  const colW = columns.map(c => (c.w / totalW) * width);

  // Header
  doc.rect(left, doc.y, width, headerH).fill(SIMEC_RED);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(9);

  let x = left;
  columns.forEach((c, i) => {
    doc.text(c.label, x + 4, doc.y + 4, {
      width: colW[i] - 8,
      align: c.align || "left",
    });
    x += colW[i];
  });

  doc.y += headerH;
  doc.fillColor("#111").font("Helvetica").fontSize(9);

  // Rows
  rows.forEach(r => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    let xx = left;
    r.forEach((val, i) => {
      doc.text(String(val ?? ""), xx + 4, doc.y + 1, {
        width: colW[i] - 8,
        align: columns[i].align || "left",
      });
      xx += colW[i];
    });

    doc
      .moveTo(left, doc.y + rowH)
      .lineTo(right, doc.y + rowH)
      .lineWidth(0.5)
      .strokeColor("#e5e7eb")
      .stroke();

    doc.y += rowH;
  });

  doc.moveDown(0.6);
}

/* ==================== EXPORT MATERIALES (EXCEL) ==================== */
export async function exportMaterialesExcel(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id,
         m.codigo,
         m.nombre,
         m.stock_actual,
         m.stock_minimo,
         m.ubicacion,
         m.nombre AS proveedor_nombre,
         m.ticket_numero,
         m.requiere_protocolo,
         m.protocolo_texto,
         m.precio_unitario
       FROM materiales m
       LEFT JOIN proveedores p ON p.id = m.proveedor_id
       WHERE m.activo = 1
       ORDER BY m.id DESC`
    );

    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet("Materiales");

    sh.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Código", key: "codigo", width: 15 },
      { header: "Nombre", key: "nombre", width: 30 },
      { header: "Stock", key: "stock_actual", width: 10 },
      { header: "Stock mínimo", key: "stock_minimo", width: 12 },
      { header: "Ubicación", key: "ubicacion", width: 15 },
      { header: "Proveedor", key: "proveedor_nombre", width: 20 },
      { header: "Ticket", key: "ticket_numero", width: 15 },
      { header: "Req. Protocolo", key: "requiere_protocolo", width: 14 },
      { header: "Protocolo", key: "protocolo_texto", width: 25 },
      { header: "Precio unitario", key: "precio_unitario", width: 14 },
    ];

    rows.forEach(r => sh.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=materiales.xlsx");

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportMaterialesExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales (Excel)" });
  }
}

/* ==================== EXPORT MATERIALES (PDF) ==================== */
export async function exportMaterialesPdf(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT codigo, nombre, stock_actual, ubicacion
       FROM materiales
       WHERE activo = 1
       ORDER BY id DESC`
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=materiales.pdf");
    doc.pipe(res);

    const applyHeader = () => drawSimecHeader(doc, "Reporte de Materiales");
    applyHeader();
    doc.on("pageAdded", applyHeader);

    drawSimpleTable(
      doc,
      [
        { label: "Código", w: 18 },
        { label: "Material", w: 52 },
        { label: "Cantidad", w: 15, align: "right" },
        { label: "Ubicación", w: 15 },
      ],
      rows.map(r => [
        r.codigo,
        r.nombre,
        String(r.stock_actual ?? 0),
        r.ubicacion || "-",
      ])
    );

    doc.end();
  } catch (err) {
    console.error("❌ exportMaterialesPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales (PDF)" });
  }
}
