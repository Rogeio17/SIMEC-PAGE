# SIMEC-PAGE

Proyecto con **frontend estático** (HTML/CSS/JS) y **backend API** (Express + MySQL).

## Estructura

```
SIMEC-PAGE/
  frontend/
  backend/
    src/
      app.js
      server.js
      routes/
      controllers/
      config/db.js
      middlewares/errorHandler.js
    database/catalogo.sql
```

## Backend (API)

1) Entrar a backend:

```bash
cd backend
npm install
```

2) Crear `.env` tomando como base `.env.example`.

3) Correr en desarrollo:

```bash
npm run dev
```

## Frontend

Abrir `frontend/index.html` o servirlo desde el backend (ya está configurado).
