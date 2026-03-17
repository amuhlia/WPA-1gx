const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BANKING_CURRENCY = process.env.BANKING_CURRENCY || 'MXN';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

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

    const intent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      metadata: {
        type: data.type || 'donation',
        description: data.description || '',
        banking_currency: BANKING_CURRENCY
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        clientSecret: intent.client_secret,
        publicKey: process.env.STRIPE_PUBLIC_KEY,
        bankingCurrency: BANKING_CURRENCY
      })
    };
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
