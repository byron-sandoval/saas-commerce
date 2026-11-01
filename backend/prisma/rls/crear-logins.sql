-- Uso manual con psql, conectado como propietario a la base de DESARROLLO.
-- Primero aplica las migraciones. No guardar passwords en este archivo.
-- Neon necesita recibir la password original: no usar \password de psql (envia un hash).
CREATE ROLE saas_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION IN ROLE saas_negocio;
CREATE ROLE saas_auth LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION IN ROLE saas_identidad;
\echo 'Roles creados. Asigna sus passwords desde Reset password en Neon o con ALTER ROLE ... WITH PASSWORD en una sesion privada.'
