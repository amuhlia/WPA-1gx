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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Extract charge_id from path
    const pathParts = event.path.split('/');
    const chargeId = pathParts[pathParts.length - 1];

    if (!chargeId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Charge ID is required' })
      };
    }

    const charge = await stripe.charges.retrieve(chargeId);
    const payouts = await stripe.payouts.list({
      limit: 1,
      metadata: { charge_id: chargeId }
    });

    const payoutInfo = payouts.data && payouts.data[0] ? payouts.data[0] : null;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        chargeId: charge.id,
        chargeStatus: charge.status,
        amount: charge.amount / 100,
        payout: {
          id: payoutInfo ? payoutInfo.id : null,
          status: payoutInfo ? payoutInfo.status : 'Not found',
          arrival_date: payoutInfo ? payoutInfo.arrival_date : null,
          destination: payoutInfo ? String(payoutInfo.destination) : null
        },
        bankingCurrency: BANKING_CURRENCY
      })
    };
  } catch (error) {
    if (error.code === 'resource_missing') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Charge not found' })
      };
    }

    console.error('Payout status error:', error);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
