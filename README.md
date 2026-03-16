# Zákia Dogs&Cats - PWA con Sistema de Pagos

Una Progressive Web App completa con carrusel, donaciones y sistema de pagos con Stripe.

## Características

- ✅ Carrusel de imágenes
- ✅ Donaciones con montos predeterminados
- ✅ Gestión de tarjetas de crédito/débito
- ✅ Payments con Stripe
- ✅ Transferencias bancarias
- ✅ Soporte offline (PWA)

## Instalación

### 1. Clonar/Descargar el proyecto

```bash
cd /home/virusventor/WPA-1gx
```

### 2. Obtener Stripe API Keys

1. Ir a [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Crear cuenta si no tienes
3. En **Developers** → **API keys**, copiar:
   - `Publishable key` (pk_...)
   - `Secret key` (sk_...)

### 3. Configurar variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```bash
STRIPE_PUBLIC_KEY=pk_test_XXXX
STRIPE_SECRET_KEY=sk_test_XXXX
FLASK_PORT=5000
```

### 4. Ejecutar el servidor de pagos

En una terminal:

```bash
/home/virusventor/WPA-1gx/.venv/bin/python payment_server.py
```

El servidor se ejecutará en `http://localhost:5000`

### 5. En otra terminal, ejecutar el servidor web

```bash
python3 -m http.server 8000
```

Abrir: **http://localhost:8000**

## Estructura

```
WPA-1gx/
├── index.html              # HTML principal
├── style.css               # Estilos
├── main-v3.js              # JavaScript del cliente
├── payment_server.py       # Servidor Flask para pagos
├── service-worker.js       # Service worker para PWA
├── manifest.webmanifest    # Configuración PWA
├── images/                 # Fotos del carrusel
├── icons/                  # Icono de la app
└── .env                    # Claves Stripe (no subir a git)
```

## Cómo funciona

1. **Usuario hace click en "Donar"** → Selecciona monto ($50, $100, $500)
2. **Se abre modal de pago** → Completa datos (nombre, email, tarjeta)
3. **Stripe procesa de forma segura** → El servidor backend valida
4. **Se confirma el pago** → Se muestra mensaje de éxito

## Seguridad

- Las tarjetas **NUNCA** viajan al servidor - Stripe las procesa de forma segura
- El backend maneja todo con SSL/TLS
- Test mode por defecto (no carga reales)

## Para producción

1. Cambiar a `pk_live_...` y `sk_live_...` en Stripe
2. Usar HTTPS en el servidor
3. Agregar validación adicional en el backend
4. Implementar logging y monitoreo

## Desarrollo

- Terminal 1: `python payment_server.py` (backend en 5000)
- Terminal 2: `python3 -m http.server 8000` (frontend en 8000)

Luego acceder a: http://localhost:8000

