# 🏦 Configuración de Stripe con Bancoppel

## Instrucciones paso a paso para vincular tu cuenta de Bancoppel

### Paso 1: Agregar cuenta bancaria en Stripe Dashboard

1. **Ve a**: https://dashboard.stripe.com/settings/payouts
2. Click en **"Add bank account"**
3. **Selecciona país**: Mexico  🇲🇽
4. **Tipo de cuenta**: Cheque
5. **Nombre del banco**: Busca y selecciona **BANCOPPEL**
6. **Número de cuenta CLABE**: `137180102387026702`
7. **Nombre del titular**: Tu nombre completo
8. **RFC**: Tu RFC (Registro Federal de Contribuyentes)
9. Click en **"Create bank account"**

### Paso 2: Verificar cuenta (Stripe enviará 2 depósitos)

Stripe hará 2 pequeños depósitos (de $0.01 a $0.99 USD) a tu cuenta.
- Revisa tu cuenta Bancoppel después de 1-2 días
- Obtén los montos exactos
- Vuelve a https://dashboard.stripe.com/settings/payouts
- Haz click en la cuenta pendiente y verifica los montos

### Paso 3: Obtener el Bank Account ID

1. Una vez verificada, ve a: https://dashboard.stripe.com/settings/payouts
2. **Haz click** en tu cuenta de Bancoppel
3. En la URL o en los detalles, busca el **ID de la cuenta** (comienza con `ba_`)
4. Copia ese ID

Ejemplo: `ba_1Kr7C5IYvomjqQXHEjqM0K0G`

### Paso 4: Configurar el archivo .env

Crea archivo `/home/virusventor/WPA-1gx/.env`:

```bash
STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXX
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXX
STRIPE_BANK_ACCOUNT_ID=ba_XXXXXXXXXXXXXX
BANKING_CURRENCY=MXN
FLASK_PORT=5000
```

Donde:
- `pk_test_...` es tu **Publishable Key** de Stripe
- `sk_test_...` es tu **Secret Key** de Stripe
- `ba_...` es el **Bank Account ID** que obtuviste arriba
- `MXN` es la moneda mexicana

### Paso 5: Ejecutar el servidor

**Terminal 1** (Backend con pagos):
```bash
cd /home/virusventor/WPA-1gx
/home/virusventor/WPA-1gx/.venv/bin/python payment_server.py
```

**Terminal 2** (Frontend):
```bash
python3 -m http.server 8000
```

---

## 🧪 Prueba con tarjeta de prueba

1. Abre: http://localhost:8000
2. Click en **"Donar"** → **"$50"**
3. Llena el formulario
4. Usa tarjeta: **4242 4242 4242 4242**
   - Fecha: cualquier mes/año futuro (ej: 12/30)
   - CVC: cualquier 3 dígitos (ej: 123)
5. Click **"Pagar Ahora"**

---

## 📊 Cómo ver tus pagos en Stripe Dashboard

1. Ve a: https://dashboard.stripe.com/payments
2. Verás cada transacción con estado
3. Ve a: https://dashboard.stripe.com/payouts
4. Verás las transferencias a Bancoppel
5. Estado: **Pending** (en espera) → **Paid** (completado)

---

## ⏰ Tiempos de transferencia

- **Stripe recibe el dinero**: 2-3 días hábiles
- **Dinero en Bancoppel**: Su transferencia toma 1-2 días más
- **Total**: 3-5 días hábiles (pueden ser más en fin de semana)

---

## 🔐 Seguridad

✅ Nunca compartas tu Secret Key (`sk_test_...`)
✅ Nunca subas el archivo `.env` a GitHub (está en `.gitignore`)
✅ Cambiar a `pk_live_...` y `sk_live_...` cuando vayas a producción

---

## ❓ Preguntas frecuentes

**¿Cuánto cuesta usar Stripe?**
- 2.9% + $0.30 USD por transacción
- Ejemplo: una donación de $50 USD → Stripe cobra $1.78

**¿Qué pasa con el dinero rechazado?**
- No se transfiere nada a Bancoppel
- El dinero se pausa en Stripe (puedes revisar en Dashboard)

**¿Puedo cambiar el número de cuenta?**
- Sí, pero necesitas crear una nueva en Stripe
- Solo una cuenta puede ser el destino de pagos automáticos

**¿Test Mode o Live Mode?**
- Empieza en Test Mode (`pk_test_`, `sk_test_`)
- Cuando estés listo: cambia a Live (`pk_live_`, `sk_live_`)

---

**¿Necesitas ayuda?** Contacta a Stripe Support: https://support.stripe.com
