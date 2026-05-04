# Hibot Interactions Dashboard

Dashboard analítico en Next.js 14 + TypeScript + Tailwind CSS + Shadcn/UI + Prisma + Supabase Postgres.

## Qué hace

- Sube archivos Excel `.xlsx` / `.xls`.
- Busca la hoja `Interacciones`.
- Mapea columnas reales del reporte Hibot.
- Guarda cada carga como un lote en `UploadBatch`.
- Anexa registros en Supabase, sin sobrescribir datos anteriores.
- Permite filtrar por carga.
- Muestra KPIs, gráficos y tabla con buscador.

## Instalación local

```bash
npm install
cp .env.example .env
```

Completá `.env` con las URLs de Supabase.

Después:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Abrí:

```txt
http://localhost:3000/dashboard
```

## Crear Supabase desde cero

1. Entrá a Supabase y creá una cuenta.
2. Creá un proyecto nuevo.
3. Guardá la contraseña de la base de datos. La vas a necesitar para `DATABASE_URL` y `DIRECT_URL`.
4. Entrá en `Project Settings > Database`.
5. Buscá `Connection string`.
6. Para Prisma, usá dos URLs:
   - `DATABASE_URL`: connection pooling, normalmente puerto `6543`.
   - `DIRECT_URL`: conexión directa, normalmente puerto `5432`.

Ejemplo:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

Reemplazá:

- `PROJECT_REF`
- `PASSWORD`
- `REGION`

## Migrar tablas a Supabase

```bash
npx prisma migrate dev --name init
```

Luego podés ver las tablas en Supabase:

```txt
Table Editor > UploadBatch
Table Editor > Interaction
```

## Deploy en Vercel

1. Subí el proyecto a GitHub.
2. Importá el repo en Vercel.
3. En `Settings > Environment Variables`, agregá:

```env
DATABASE_URL=...
DIRECT_URL=...
```

4. En Vercel, el build debería correr:

```bash
npm run build
```

Si Prisma no genera el cliente en build, cambiá el script `build` del `package.json` a:

```json
"build": "prisma generate && next build"
```

## Columnas mapeadas

El mapeo actual contempla estas columnas del archivo Hibot:

- `ID DE CONVERSACIÓN`
- `AGENTE`
- `CONTACTO`
- `NÚMERO DE CONTACTO`
- `CORREO`
- `ETIQUETAS`
- `N° INACTIVIDADES`
- `IN/OUT`
- `TIPO DE CONTACTO`
- `TIPO DE CANAL`
- `CANAL`
- `CLIENTE`
- `AGENTE DE LA CONVERSACIÓN PADRE`
- `ID CONVERSACIÓN PADRE`
- `PROYECTO`
- `CAMPAÑA`
- `MÉTODO DE ASIGNACIÓN`
- `R/TIPIFICACIÓN` / `TIPIFICACIÓN`
- `SUB-TIPIFICACIÓN`
- `FECHA DE INICIO`
- `FECHA DE DELEGACIÓN`
- `FECHA DE ASIGNACIÓN`
- `TIEMPO DE ESPERA`
- `HORA DE ATENCIÓN`
- `TIEMPO DE RESPUESTA`
- `FECHA FIN`
- `DURACIÓN`
- `ESTADO DE DELEGACIÓN`
- `NOTAS`
- `ESTADO`

## Nota importante

La app guarda también la fila original en el campo `raw`, así que aunque una columna no esté mapeada todavía, no se pierde dentro de la base.
