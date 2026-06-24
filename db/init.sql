-- Habilitar la extensión PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de rutas
CREATE TABLE IF NOT EXISTS rutas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    color_identificativo VARCHAR(50) DEFAULT '#0000FF'
);

-- Tabla de trazados de las rutas
CREATE TABLE IF NOT EXISTS trazados (
    id SERIAL PRIMARY KEY,
    ruta_id INTEGER REFERENCES rutas(id) ON DELETE CASCADE,
    direccion VARCHAR(255),
    recorrido GEOGRAPHY(LineString, 4326)
);

-- Índice espacial GIST para búsquedas eficientes
CREATE INDEX IF NOT EXISTS trazados_recorrido_idx 
ON trazados USING GIST (recorrido);

-- Datos semilla: 2 rutas ficticias cerca a la Plaza de Armas de Cajamarca
-- Centro aprox de Cajamarca: Latitud -7.164, Longitud -78.518

INSERT INTO rutas (nombre, descripcion, color_identificativo)
VALUES 
    ('Combi Roja - Ruta A', 'Ruta desde Baños del Inca hasta el centro histórico', '#EF4444'),
    ('Micro Azul - Ruta B', 'Ruta desde la Universidad Nacional hasta el mercado', '#3B82F6');

-- Insertamos recorridos
-- Ruta A (Combi Roja): Atraviesa la Plaza de Armas de oeste a este
INSERT INTO trazados (ruta_id, direccion, recorrido)
VALUES (
    1, 
    'Ida',
    ST_GeomFromText('LINESTRING(-78.525 -7.165, -78.520 -7.164, -78.515 -7.163, -78.510 -7.162)', 4326)::geography
);

-- Ruta B (Micro Azul): Atraviesa cerca de la Plaza de norte a sur
INSERT INTO trazados (ruta_id, direccion, recorrido)
VALUES (
    2, 
    'Ida',
    ST_GeomFromText('LINESTRING(-78.519 -7.158, -78.518 -7.164, -78.517 -7.169)', 4326)::geography
);
