const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BANK_ACCOUNT_ID = process.env.STRIPE_BANK_ACCOUNT_ID;
const BANKING_CURRENCY = process.env.BANKING_CURRENCY || 'MXN';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function normalizeCardNumber(number) {
  return String(number || '').replace(/\D/g, '');
}

function testTokenFromCardNumber(number) {
  const normalized = normalizeCardNumber(number);
  const tokenMap = {
    '4242424242424242': 'tok_visa',
    '4000056655665556': 'tok_visa_debit',
    '5555555555554444': 'tok_mastercard',
    '378282246310005': 'tok_amex',
    '6011111111111117': 'tok_discover',
    '3530111333300000': 'tok_jcb',
    '30569309025904': 'tok_diners',
  };
  return tokenMap[normalized];
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
    const amount = Math.round(data.amount * 100); // Convert to cents
    const currency = data.currency || 'usd';

    let token = data.token;
    const cardPayload = data.card;

    // If no token but card data, create token from card
    if (!token && cardPayload) {
      const number = normalizeCardNumber(cardPayload.number);

      // In test mode, prefer known test tokens
      if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
        token = testTokenFromCardNumber(number);
      }

      if (!token) {
        try {
          const expMonth = parseInt(cardPayload.exp_month);
          const expYear = parseInt(cardPayload.exp_year);

          if (isNaN(expMonth) || isNaN(expYear)) {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({
                error: 'La tarjeta guardada tiene fecha de vencimiento invalida'
              })
            };
          }

          const tokenObj = await stripe.tokens.create({
            card: {
              number: number,
              exp_month: expMonth,
              exp_year: expYear,
              cvc: cardPayload.cvc,
              name: cardPayload.name || ''
            }
          });

          token = tokenObj.id;
        } catch (error) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'No se pudo tokenizar la tarjeta guardada: ' + error.message
            })
          };
        }
      }
    }

    if (!token) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'No se recibio un token de pago valido'
        })
      };
    }

    // Create charge
    const charge = await stripe.charges.create({
      amount: amount,
      currency: currency,
      source: token,
      description: data.description || 'PWA Donation',
      metadata: {
        type: data.type || 'donation',
        payout_status: 'pending'
      }
    });

    let payoutStatus = 'no_bank_account';

    // Schedule automatic payout to bank account
    if (BANK_ACCOUNT_ID && charge.status === 'succeeded') {
      try {
        const payout = await stripe.payouts.create({
          amount: charge.amount,
          currency: currency,
          destination: BANK_ACCOUNT_ID,
          description: `Payout for ${data.description || 'Donation'}`,
          metadata: { charge_id: charge.id }
        });
        payoutStatus = payout.status;
      } catch (error) {
        payoutStatus = `error: ${error.message}`;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        chargeId: charge.id,
        amount: charge.amount / 100,
        currency: currency,
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
