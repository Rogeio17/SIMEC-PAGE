import mysql from "mysql2/promise";

const env = (k, fallback = "") => (process.env[k] ?? fallback).toString().trim();

const pool = mysql.createPool({
  host: env("DB_HOST"),
  port: Number(env("DB_PORT", "3306")),
  user: env("DB_USER"),
  password: env("DB_PASSWORD"),
  database: env("DB_NAME"),
  waitForConnections: true,
  connectionLimit: Number(env("DB_CONN_LIMIT", "10")),
  queueLimit: 0,
  ssl: env("DB_SSL") === "true" ? { rejectUnauthorized: false } : undefined,
});

export default pool;

