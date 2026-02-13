---
title: "Guia de Despliegue en VPS - SIGMA Frontend"
fontsize: 10pt
geometry: margin=1in
header-includes:
  - \usepackage{fvextra}
  - \DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,breakanywhere,commandchars=\\\{\}}
  - \usepackage{xurl}
---

# Guia de Despliegue en VPS - SIGMA Frontend {#inicio}

Documento tecnico de despliegue para entornos de produccion del frontend Angular de SIGMA.

## Indice {#indice}

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Arquitectura objetivo](#2-arquitectura-objetivo)
3. [Prerequisitos](#3-prerequisitos)
4. [Provisionamiento base del servidor](#4-provisionamiento-base-del-servidor)
5. [Instalacion de Node.js y herramientas](#5-instalacion-de-nodejs-y-herramientas)
6. [Despliegue de la aplicacion](#6-despliegue-de-la-aplicacion)
7. [Configuracion de entorno del frontend](#7-configuracion-de-entorno-del-frontend)
8. [Publicacion con Nginx](#8-publicacion-con-nginx)
9. [HTTPS con Let's Encrypt](#9-https-con-lets-encrypt)
10. [Validacion funcional inicial](#10-validacion-funcional-inicial)
11. [Operacion, actualizaciones y rollback](#11-operacion-actualizaciones-y-rollback)
12. [Autodespliegue desde GitHub al VPS](#12-autodespliegue-desde-github-al-vps)
13. [Troubleshooting](#13-troubleshooting)
14. [Referencias al codigo del repositorio](#14-referencias-al-codigo-del-repositorio)

## 1. Objetivo y alcance {#1-objetivo-y-alcance}

Este documento describe un despliegue de produccion para `sigma-frontend` en un VPS Linux.

Resultado esperado:

- Aplicacion Angular compilada en modo produccion.
- Nginx sirviendo contenido estatico en `80/443`.
- HTTPS habilitado con certificados validos.
- Frontend conectado al backend SIGMA por `apiBaseUrl`.
- Procedimiento operativo de actualizacion y rollback.

## 2. Arquitectura objetivo {#2-arquitectura-objetivo}

Topologia recomendada para una instancia unica:

- Codigo fuente: `/opt/sigma-frontend`
- Build estatico: `/opt/sigma-frontend/dist/sigma/browser`
- Servidor web: Nginx en `80/443`
- Dominio frontend: `sigma.tudominio.com`
- API backend: `https://api.tudominio.com` (o dominio equivalente)

Estado actual del repositorio (Feb 2026):

- Build Angular genera salida en `dist/sigma/browser`.
- `environment.prod.ts` define `apiBaseUrl` para el backend de produccion.
- `environment.ts` (desarrollo) usa un backend local.

## 3. Prerequisitos {#3-prerequisitos}

- VPS Ubuntu 22.04 o 24.04
- Acceso SSH con usuario sudo
- Dominio apuntando al VPS (ejemplo: `sigma.tudominio.com`)
- Backend SIGMA desplegado y accesible por HTTPS
- Git instalado

Verificacion minima:

```bash
uname -a
curl -I https://api.tudominio.com/health
```

## 4. Provisionamiento base del servidor {#4-provisionamiento-base-del-servidor}

### 4.1 Actualizacion de paquetes {#41-actualizacion-de-paquetes}

```bash
sudo apt update && sudo apt upgrade -y
```

### 4.2 Paquetes base {#42-paquetes-base}

```bash
sudo apt install -y git curl ca-certificates gnupg nginx ufw
```

### 4.3 Usuario de despliegue {#43-usuario-de-despliegue}

```bash
sudo adduser --disabled-password --gecos "" sigma
sudo usermod -aG sudo sigma
```

### 4.4 Firewall {#44-firewall}

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 5. Instalacion de Node.js y herramientas {#5-instalacion-de-nodejs-y-herramientas}

Se recomienda Node.js LTS (20.x o superior) para Angular 20.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 6. Despliegue de la aplicacion {#6-despliegue-de-la-aplicacion}

### 6.1 Clonar repositorio {#61-clonar-repositorio}

```bash
sudo mkdir -p /opt/sigma-frontend
sudo chown -R sigma:sigma /opt/sigma-frontend
su - sigma
cd /opt/sigma-frontend
git clone <URL_DEL_REPOSITORIO_FRONTEND> .
```

### 6.2 Instalar dependencias {#62-instalar-dependencias}

```bash
cd /opt/sigma-frontend
npm ci
```

### 6.3 Compilar en produccion {#63-compilar-en-produccion}

```bash
cd /opt/sigma-frontend
npm run build
```

Salida esperada:

- Archivos estaticos en `dist/sigma/browser`

## 7. Configuracion de entorno del frontend {#7-configuracion-de-entorno-del-frontend}

El frontend consume la API usando `apiBaseUrl` desde:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Configura `environment.prod.ts` con el dominio real del backend:

```ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.tudominio.com'
};
```

Notas:

- Este valor se incrusta en el build, por lo que cualquier cambio requiere recompilar (`npm run build`).
- Si se usa otro dominio para frontend y backend, CORS debe estar permitido en el backend para el dominio del frontend.
- El frontend en HTTPS debe consumir API en HTTPS para evitar bloqueo por mixed content.

## 8. Publicacion con Nginx {#8-publicacion-con-nginx}

Crear `/etc/nginx/sites-available/sigma-frontend`:

```nginx
server {
    listen 80;
    server_name sigma.tudominio.com;

    root /opt/sigma-frontend/dist/sigma/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /favicon.ico {
        access_log off;
        log_not_found off;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
```

Habilitar y validar:

```bash
sudo ln -s /etc/nginx/sites-available/sigma-frontend /etc/nginx/sites-enabled/sigma-frontend
sudo nginx -t
sudo systemctl reload nginx
curl -I http://sigma.tudominio.com
```

## 9. HTTPS con Let's Encrypt {#9-https-con-lets-encrypt}

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sigma.tudominio.com
sudo certbot renew --dry-run
```

## 10. Validacion funcional inicial {#10-validacion-funcional-inicial}

Checklist minima:

1. El sitio carga por HTTPS: `https://sigma.tudominio.com`
2. No hay error de archivos estaticos en consola del navegador.
3. Las llamadas a API responden desde el dominio configurado.
4. Se verifica una operacion real (ejemplo: cargar escena o consultar regiones).

Validaciones rapidas:

```bash
curl -I https://sigma.tudominio.com
curl -I https://api.tudominio.com/health
```

## 11. Operacion, actualizaciones y rollback {#11-operacion-actualizaciones-y-rollback}

### 11.1 Actualizacion de version {#111-actualizacion-de-version}

```bash
su - sigma
cd /opt/sigma-frontend
git pull
npm ci
npm run build
sudo nginx -t
sudo systemctl reload nginx
```

### 11.2 Validacion posterior {#112-validacion-posterior}

```bash
curl -I https://sigma.tudominio.com
```

### 11.3 Rollback {#113-rollback}

```bash
su - sigma
cd /opt/sigma-frontend
git log --oneline -n 10
git checkout <COMMIT_ESTABLE>
npm ci
npm run build
sudo systemctl reload nginx
```

## 12. Autodespliegue desde GitHub al VPS {#12-autodespliegue-desde-github-al-vps}

Esta seccion configura CI/CD para desplegar automaticamente al hacer `push` a `main`.

### 12.1 Preparar llave SSH de despliegue {#121-preparar-llave-ssh-de-despliegue}

En tu maquina local (o en una maquina segura), generar un par de llaves sin passphrase:

```bash
ssh-keygen -t ed25519 -C "github-actions-sigma-frontend" -f ./sigma_frontend_deploy_key
```

Archivos generados:

- `sigma_frontend_deploy_key` (privada, va en GitHub Secret)
- `sigma_frontend_deploy_key.pub` (publica, va en el VPS)

### 12.2 Autorizar la llave publica en el VPS {#122-autorizar-la-llave-publica-en-el-vps}

Como usuario `sigma` en el VPS:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys
```

Pega el contenido de `sigma_frontend_deploy_key.pub`, guarda y luego:

```bash
chmod 600 ~/.ssh/authorized_keys
```

### 12.3 Crear script de despliegue en el VPS {#123-crear-script-de-despliegue-en-el-vps}

Crear `/opt/sigma-frontend/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /opt/sigma-frontend

git fetch --all
git reset --hard origin/main

npm ci
npm run build

sudo nginx -t
sudo systemctl reload nginx
```

Dar permisos:

```bash
chmod +x /opt/sigma-frontend/deploy.sh
```

Si `sigma` no puede ejecutar `sudo nginx -t` y `sudo systemctl reload nginx` sin password,
agregar regla sudoers:

```bash
sudo visudo -f /etc/sudoers.d/sigma-deploy
```

Contenido:

```text
sigma ALL=(root) NOPASSWD:/usr/sbin/nginx -t,/bin/systemctl reload nginx
```

### 12.4 Configurar Secrets en GitHub {#124-configurar-secrets-en-github}

En `Settings > Secrets and variables > Actions`, crear:

- `VPS_HOST`: IP o dominio del VPS
- `VPS_USER`: usuario SSH (ejemplo: `sigma`)
- `VPS_PORT`: puerto SSH (ejemplo: `22`)
- `VPS_SSH_KEY`: contenido completo de `sigma_frontend_deploy_key` (privada)

### 12.5 Crear workflow de GitHub Actions {#125-crear-workflow-de-github-actions}

Crear `.github/workflows/deploy-vps.yml`:

```yaml
name: Deploy SIGMA Frontend to VPS

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            /opt/sigma-frontend/deploy.sh
```

### 12.6 Validar autodespliegue {#126-validar-autodespliegue}

1. Hacer commit y push a `main`.
2. Revisar ejecución en `Actions` dentro de GitHub.
3. Verificar frontend en `https://sigma.tudominio.com`.
4. Si falla, revisar logs del job y ejecutar manualmente `/opt/sigma-frontend/deploy.sh` por SSH para diagnosticar.

## 13. Troubleshooting {#13-troubleshooting}

### 13.1 Pantalla en blanco o rutas 404 al refrescar {#131-pantalla-en-blanco-o-rutas-404-al-refrescar}

- Verificar `try_files $uri $uri/ /index.html;` en Nginx.
- Confirmar que `root` apunte a `dist/sigma/browser`.

### 13.2 Error de CORS al consumir la API {#132-error-de-cors-al-consumir-la-api}

- Confirmar `apiBaseUrl` correcto en `environment.prod.ts`.
- Revisar que backend permita el origen `https://sigma.tudominio.com`.

### 13.3 Cambios no visibles tras deploy {#133-cambios-no-visibles-tras-deploy}

- Confirmar que se ejecuto `npm run build` en el commit correcto.
- Limpiar cache del navegador o probar en modo incognito.

### 13.4 Build falla en VPS {#134-build-falla-en-vps}

- Revisar version de Node/NPM.
- Ejecutar instalacion limpia con `npm ci`.
- Revisar logs del comando de build.

### 13.5 Nginx no inicia o falla configuracion {#135-nginx-no-inicia-o-falla-configuracion}

- Validar sintaxis con `sudo nginx -t`.
- Revisar logs en `sudo journalctl -u nginx -n 200 --no-pager`.

## 14. Referencias al codigo del repositorio {#14-referencias-al-codigo-del-repositorio}

- Dependencias y scripts: `package.json`
- Configuracion Angular build/serve: `angular.json`
- Entorno produccion: `src/environments/environment.prod.ts`
- Entorno desarrollo: `src/environments/environment.ts`
- Servicios HTTP hacia API:
  - `src/app/features/services/scenes.service.ts`
  - `src/app/features/services/segments.service.ts`
  - `src/app/features/services/regions.service.ts`
  - `src/app/features/services/tiff-validation.service.ts`
  - Ruta de progreso de segmentacion:

    ```text
    src/app/features/components/segmentation-progress-dialog/
    segmentation-progress-dialog.component.ts
    ```
