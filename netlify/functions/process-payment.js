const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BANK_ACCOUNT_ID = process.env.STRIPE_BANK_ACCOUNT_ID;
const BANKING_CURRENCY = process.env.BANKING_CURRENCY || 'MXN';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function containsRawCardData(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (payload.card && typeof payload.card === 'object') {
    return true;
  }

  return Boolean(payload.cardNumber || payload.number || payload.cvc || payload.exp_month || payload.exp_year);
}

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);

    if (containsRawCardData(data)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'No se aceptan datos completos de tarjeta en el servidor. Usa Stripe.js con confirmCardPayment.'
        })
      };
    }

    const paymentIntentId = String(data.paymentIntentId || '').trim();
    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'paymentIntentId es requerido para completar el post-procesamiento'
        })
      };
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge']
    });

    if (paymentIntent.status !== 'succeeded') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `El PaymentIntent aun no esta completado: ${paymentIntent.status}`
        })
      };
    }

    const latestCharge = paymentIntent.latest_charge;
    const chargeId = typeof latestCharge === 'string' ? latestCharge : latestCharge?.id;
    const chargeAmount = paymentIntent.amount_received || paymentIntent.amount;
    const chargeCurrency = paymentIntent.currency || (data.currency || 'usd').toLowerCase();
    const paymentDescription = String(data.description || '').trim();

    let payoutStatus = 'automatic';

    // Only attempt a manual payout if a valid ba_ bank account ID is configured.
    // Without destination, Stripe uses its automatic payout schedule (default behavior).
    const isValidBankId = BANK_ACCOUNT_ID && BANK_ACCOUNT_ID.startsWith('ba_');
    if (isValidBankId && chargeAmount > 0) {
      try {
        const payoutParams = {
          amount: chargeAmount,
          currency: chargeCurrency,
          description: paymentDescription || 'Donation',
          metadata: {
            charge_id: chargeId || '',
            payment_intent_id: paymentIntent.id
          }
        };
        // Only set destination when we have a verified bank account ID
        payoutParams.destination = BANK_ACCOUNT_ID;
        const payout = await stripe.payouts.create(payoutParams);
        payoutStatus = payout.status;
      } catch (error) {
        // Payout failure does NOT reverse the charge; log and continue.
        console.error('Payout error (charge succeeded):', error.message);
        payoutStatus = `payout_error: ${error.message}`;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        paymentIntentId: paymentIntent.id,
        chargeId,
        amount: chargeAmount / 100,
        currency: chargeCurrency,
        payoutStatus: payoutStatus,
        bankingCurrency: BANKING_CURRENCY
      })
    };
  } catch (error) {
    console.error('Payment error:', error);
    
    let errorMessage = error.message;
    if (error.type === 'StripeCardError') {
      errorMessage = 'Card declined: ' + error.message;
    }

    return {
      statusCode: error.statusCode || 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: errorMessage })
    };
  }
};
