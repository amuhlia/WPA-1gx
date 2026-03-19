const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BANKING_CURRENCY = process.env.BANKING_CURRENCY || 'MXN';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Validate environment variables at startup
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not configured in Netlify environment variables');
}
if (!process.env.STRIPE_PUBLIC_KEY) {
  console.error('❌ STRIPE_PUBLIC_KEY not configured in Netlify environment variables');
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
    const amount = Math.round(Number(data.amount || 0) * 100); // Convert to cents
    const currency = String(data.currency || 'usd').toLowerCase();
    const description = String(data.description || '').trim();
    const customerId = String(data.customerId || '').trim();
    const receiptEmail = String(data.receiptEmail || '').trim();
    const savePaymentMethod = data.savePaymentMethod === true;

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Monto invalido para PaymentIntent' })
      };
    }

    const intentParams = {
      amount,
      currency,
      description,
      payment_method_types: ['card'],
      metadata: {
        type: data.type || 'donation',
        description,
        banking_currency: BANKING_CURRENCY
      }
    };

    if (customerId) {
      intentParams.customer = customerId;

      if (savePaymentMethod) {
        // Ask Stripe to attach the card to this customer after successful confirmation.
        intentParams.setup_future_usage = 'off_session';
      }
    }

    if (receiptEmail) {
      intentParams.receipt_email = receiptEmail;
    }

    const intent = await stripe.paymentIntents.create(intentParams);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
        publicKey: process.env.STRIPE_PUBLIC_KEY,
        bankingCurrency: BANKING_CURRENCY,
        enableCardVerification: process.env.ENABLE_CARD_VERIFICATION === 'true'
      })
    };
  } catch (error) {
    console.error('Stripe initialization error:', error.message);
    
    // Check if it's an API key error
    if (error.message && error.message.includes('Invalid API Key')) {
      console.error('❌ STRIPE_SECRET_KEY is invalid. Check Netlify environment variables.');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Invalid Stripe API Key - please check Netlify environment variables',
          details: 'STRIPE_SECRET_KEY appears to be invalid or misconfigured'
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
