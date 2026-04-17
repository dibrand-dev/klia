# ConsultorioApp — Guía de configuración

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar Supabase

### 2a. Crear proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com) y crear un nuevo proyecto
2. En **Settings → API**, copiar:
   - `Project URL`
   - `anon/public` key

### 2b. Variables de entorno
```bash
cp .env.local.example .env.local
```
Editar `.env.local` con tus credenciales:
```
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 2c. Ejecutar migraciones
En el **SQL Editor** de Supabase, pegar y ejecutar el contenido de:
```
supabase/migrations/001_initial_schema.sql
```

### 2d. Configurar Auth
En **Authentication → Settings**:
- Site URL: `http://localhost:3000`
- Redirect URLs: agregar `http://localhost:3000/auth/callback`

## 3. Iniciar en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Estructura de la base de datos

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil del terapeuta (vinculado a auth.users) |
| `pacientes` | Datos de los pacientes |
| `turnos` | Turnos/sesiones con estado y modalidad |

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/login` | Inicio de sesión |
| `/registro` | Registro de cuenta |
| `/agenda` | Agenda semanal (página principal) |
| `/pacientes` | Lista de pacientes |
| `/pacientes/nuevo` | Alta de paciente |
