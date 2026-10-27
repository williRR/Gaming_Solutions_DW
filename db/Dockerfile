FROM postgres:16-alpine
# El orden alfabético es el orden de ejecución. Solo corren con el volumen VACÍO.
COPY db/init/00_roles.sh        /docker-entrypoint-initdb.d/00_roles.sh
COPY sql/10_supabase_schema.sql /docker-entrypoint-initdb.d/10_supabase_schema.sql
COPY db/init/12_fixes.sql       /docker-entrypoint-initdb.d/12_fixes.sql
COPY db/init/15_grants.sql      /docker-entrypoint-initdb.d/15_grants.sql
COPY sql/datos.sql              /docker-entrypoint-initdb.d/20_datos.sql
COPY db/init/25_admin_user.sh   /docker-entrypoint-initdb.d/25_admin_user.sh
