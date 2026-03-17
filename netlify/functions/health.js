const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BANK_ACCOUNT_ID = process.env.STRIPE_BANK_ACCOUNT_ID;
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

  try {
    const response = {
      status: 'ok',
      bank_configured: !!BANK_ACCOUNT_ID
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
