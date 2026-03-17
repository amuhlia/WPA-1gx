# 🚀 Desplegar en Netlify

Este proyecto ha sido configurado para funcionar como una **PWA estática con Netlify Functions**.

## Cambios realizados

1. ✅ **Convertido** `payment_server.py` (Flask) a **Netlify Functions** (Node.js)
2. ✅ **Creada** estructura `netlify/functions/` con:
   - `health.js` - Verificar estado del servidor
   - `create-payment-intent.js` - Crear intención de pago con Stripe
   - `process-payment.js` - Procesar pago y transferencia bancaria
   - `payout-status.js` - Consultar estado du payout
3. ✅ **Configurado** `netlify.toml` para servir funciones
4. ✅ **Actualizado** `main-v3.js` para usar `/.netlify/functions` en lugar de `http://localhost:5000`

## Pasos para desplegar

### 1. Instalar dependencias locales
```bash
npm install
```

### 2. Probar localmente con Netlify Dev
```bash
npm run dev
# O directamente:
# npx netlify dev
```

Esto sirve el sitio en `http://localhost:8888` y las funciones en `http://localhost:8888/.netlify/functions/`

### 3. Conectar con Git y Netlify

1. **Push a GitHub/GitLab/Bitbucket:**
   ```bash
   git add .
   git commit -m "Setup Netlify Functions for payment processing"
   git push
   ```

2. **Conectar con Netlify:**
   - Ve a https://netlify.com
   - Click en "New site from Git"
   - Selecciona tu repositorio
   - Las opciones por defecto deberían funcionar:
     - Build command: `npm run build` (vacío)
     - Publish directory: `.`
     - Functions directory: `netlify/functions`

### 4. Configurar variables de entorno en Netlify

En tu sitio de Netlify:
1. Ve a **Settings → Environment Variables**
2. Agrega las siguientes variables:

```

```

**⚠️ IMPORTANTE:** Mantén las claves secretas seguras. Netlify permite encriptar estas variables.

### 5. Deploy

Netlify automáticamente deployará tu sitio cuando hagas push a main/master.

## Probar en desarrollo

```bash
# Terminal 1: Servir con Netlify Dev
npm run dev

# Terminal 2: Abrir navegador
# http://localhost:8888
```

Las funciones estarán disponibles en:
- `http://localhost:8888/.netlify/functions/health`
- `http://localhost:8888/.netlify/functions/create-payment-intent`
- `http://localhost:8888/.netlify/functions/process-payment`
- `http://localhost:8888/.netlify/functions/payout-status`

## Estructura de archivo `.env` (solo para desarrollo local)

Si necesitas probar con variables de entorno locales:

```
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_BANK_ACCOUNT_ID=
BANKING_CURRENCY=MXN
```

⚠️ **NO** hagas commit del archivo `.env`. Ya está en `.gitignore`.

## Notas importantes

- El archivo `payment_server.py` ya no se usará en Netlify, pero puedes mantenerlo para desarrollo local si lo deseas
- El comando `npm start` aún ejecuta el servidor Python para desarrollo local con `python3 -m http.server 8000`
- Las funciones Netlify son **serverless**, así que no necesitas mantener un servidor corriendo
- El límite gratuito de Netlify incluye 125,000 invocaciones/mes en funciones

## Troubleshooting

### "Cannot find module 'stripe'"
```bash
npm install
# Luego reinicia netlify dev
```

### Errores 404 en funciones
- Verifica que los archivos estén en `netlify/functions/`
- Del formato correcto: `nombreFuncion.js` se mapea a `/.netlify/functions/nombreFuncion`

### Variables de entorno no se cargan
- Asegúrate de que estén configuradas en Netlify dashboard
- En desarrollo local, crea un archivo `.env` en la raíz

## Recursos

- [Documentación Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Documentación Stripe Node.js](https://github.com/stripe/stripe-node)
- [Netlify Dev Docs](https://docs.netlify.com/netlify-dev/overview/)
