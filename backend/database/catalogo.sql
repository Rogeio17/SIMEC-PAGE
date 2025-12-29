
CREATE TABLE materiales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    stock_actual DECIMAL(10,2) DEFAULT 0,
    stock_minimo DECIMAL(10,2) DEFAULT 0,
    ubicacion VARCHAR(100),                -- estante, pasillo, etc
    activo TINYINT(1) DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,     -- número de contrato, OT, etc
    nombre VARCHAR(150) NOT NULL,
    cliente VARCHAR(150),
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado ENUM('abierto','cerrado','pausado') DEFAULT 'abierto',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE movimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    proyecto_id INT NULL,                  -- puede haber movimientos sin proyecto
    tipo ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL,
    comentario TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)
);
CREATE TABLE proyectos_materiales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT NOT NULL,
  material_id INT NOT NULL,
  cantidad INT NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
