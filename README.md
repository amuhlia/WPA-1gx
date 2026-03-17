# Zákia Dogs&Cats - PWA con Sistema de Pagos

Una Progressive Web App completa con carrusel, donaciones y sistema de pagos con Stripe conectado a Bancoppel.

## Características

- ✅ Carrusel de imágenes
- ✅ Donaciones con montos predeterminados
- ✅ Gestión de tarjetas de crédito/débito
- ✅ Payments seguros con Stripe
- ✅ **Transferencias automáticas a Bancoppel** 🏦
- ✅ Soporte offline (PWA)

## ⚡ Inicio rápido

### 1. Configurar Stripe + Bancoppel

**Lee primero**: [STRIPE_SETUP.md](STRIPE_SETUP.md)

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com/settings/payouts)
2. Agrega tu cuenta **Bancoppel**: `137180102387026702`
3. Verifica con los depósitos de prueba
4. Copia el **Bank Account ID**

### 2. Crear `.env`

```bash

```

### 3. Ejecutar localmente

```bash
npm run dev
# o
netlify dev
```

Abre: **http://localhost:8888** (Netlify Dev incluye las Functions automáticamente)

---

## 💳 Prueba rápida

- Botón "Donar" → Selecciona monto
- Tarjeta: `4242 4242 4242 4242` (cualquier fecha/CVC)
- ✅ Dinero llega a Bancoppel en 3-5 días

---

## 🏦 Cómo funciona

1. **Usuario hace click en "Donar"** → Selecciona monto
2. **Se abre modal de pago** → Completa datos y tarjeta
3. **Stripe procesa** → Genera charge seguro
4. **Backend transfiere** → Automáticamente a Bancoppel
5. **Confirmación** → Usuario recibe notificación

Ver estado de pagos: https://dashboard.stripe.com/payouts

## 📁 Estructura

```
WPA-1gx/
├── index.html                 # UI principal
├── style.css                  # Estilos responsivos
├── main-v3.js                 # JavaScript cliente
├── netlify/functions/           # Backend serverless (Netlify Functions)
├── service-worker.js          # PWA offline
├── STRIPE_SETUP.md            # Guía de configuración
├── images/                    # Fotos carrusel
├── icons/                     # Icono PWA
└── .env                       # Claves (NO subir a Git)
```

## 🔒 Seguridad

- ✅ Tarjetas procesadas por Stripe (no ven tu servidor)
- ✅ Cifrado SSL/TLS
- ✅ Cumple PCI DSS
- ✅ Test Mode por defecto (sin cargos reales)

## 🚀 Pasar a Producción

1. Cambiar a `pk_live_...` y `sk_live_...` en variables de Netlify
2. Deploy automático en Netlify
3. CORS ya configurado en Netlify Functions
4. Implementar logging y webhooks de Stripe

## 📝 Más Información

- **Stripe Docs**: https://stripe.com/docs
- **Bancoppel**: Verifica estado en https://www.bancoppel.com.mx
- **Test Cards**: https://stripe.com/docs/testing

