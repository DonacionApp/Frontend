-- ============================================
-- INSERT DE TIPOS DE DONACIÓN
-- ============================================
-- Ejecutar este script en tu base de datos para crear los tipos de donación
-- Ajusta los nombres de tabla y campos según tu esquema de base de datos
-- ============================================

-- Si la tabla se llama 'tags' o 'type_post' o 'donation_types', ajusta según corresponda

-- Opción 1: Si la tabla se llama 'tags' y tiene campos: id, tag, description, created_at, updated_at
INSERT INTO tags (tag, description, created_at, updated_at) VALUES
('Alimentos', 'Donaciones de alimentos y productos comestibles', NOW(), NOW()),
('Ropa', 'Ropa nueva o usada en buen estado', NOW(), NOW()),
('Medicamentos', 'Medicamentos y productos de salud', NOW(), NOW()),
('Materiales de Construcción', 'Materiales para construcción y reparación', NOW(), NOW()),
('Libros y Material Educativo', 'Libros, útiles escolares y material educativo', NOW(), NOW()),
('Muebles y Electrodomésticos', 'Muebles y electrodomésticos en buen estado', NOW(), NOW()),
('Juguetes', 'Juguetes para niños', NOW(), NOW()),
('Herramientas', 'Herramientas para trabajo y construcción', NOW(), NOW()),
('Tecnología', 'Dispositivos electrónicos y tecnológicos', NOW(), NOW()),
('Otros', 'Otros tipos de donación', NOW(), NOW())
ON CONFLICT DO NOTHING; -- Para PostgreSQL
-- En MySQL usa: ON DUPLICATE KEY UPDATE tag=tag;

-- Opción 2: Si la tabla se llama 'type_post' y tiene campos: id, type, description, created_at, updated_at
/*
INSERT INTO type_post (type, description, created_at, updated_at) VALUES
('Alimentos', 'Donaciones de alimentos y productos comestibles', NOW(), NOW()),
('Ropa', 'Ropa nueva o usada en buen estado', NOW(), NOW()),
('Medicamentos', 'Medicamentos y productos de salud', NOW(), NOW()),
('Materiales de Construcción', 'Materiales para construcción y reparación', NOW(), NOW()),
('Libros y Material Educativo', 'Libros, útiles escolares y material educativo', NOW(), NOW()),
('Muebles y Electrodomésticos', 'Muebles y electrodomésticos en buen estado', NOW(), NOW()),
('Juguetes', 'Juguetes para niños', NOW(), NOW()),
('Herramientas', 'Herramientas para trabajo y construcción', NOW(), NOW()),
('Tecnología', 'Dispositivos electrónicos y tecnológicos', NOW(), NOW()),
('Otros', 'Otros tipos de donación', NOW(), NOW());
*/

-- Opción 3: Si la tabla se llama 'donation_types' y tiene campos: id, name, description, created_at, updated_at
/*
INSERT INTO donation_types (name, description, created_at, updated_at) VALUES
('Alimentos', 'Donaciones de alimentos y productos comestibles', NOW(), NOW()),
('Ropa', 'Ropa nueva o usada en buen estado', NOW(), NOW()),
('Medicamentos', 'Medicamentos y productos de salud', NOW(), NOW()),
('Materiales de Construcción', 'Materiales para construcción y reparación', NOW(), NOW()),
('Libros y Material Educativo', 'Libros, útiles escolares y material educativo', NOW(), NOW()),
('Muebles y Electrodomésticos', 'Muebles y electrodomésticos en buen estado', NOW(), NOW()),
('Juguetes', 'Juguetes para niños', NOW(), NOW()),
('Herramientas', 'Herramientas para trabajo y construcción', NOW(), NOW()),
('Tecnología', 'Dispositivos electrónicos y tecnológicos', NOW(), NOW()),
('Otros', 'Otros tipos de donación', NOW(), NOW());
*/

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Verifica el nombre de tu tabla (puede ser 'tags', 'type_post', 'donation_types', etc.)
-- 2. Verifica los nombres de las columnas (puede ser 'tag', 'type', 'name', etc.)
-- 3. Descomenta la opción que corresponda a tu esquema
-- 4. Ejecuta el script en tu base de datos
-- 5. Verifica que los registros se hayan insertado:
--    SELECT * FROM tags;  -- o el nombre de tu tabla
-- ============================================

