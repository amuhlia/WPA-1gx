const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function mapPaymentMethod(pm) {
  const card = pm.card || {};
  const expMonth = Number(card.exp_month || 0);
  const expYear = Number(card.exp_year || 0);

  return {
    id: pm.id,
    brand: String(card.brand || '').toLowerCase(),
    last4: String(card.last4 || ''),
    expMonth,
    expYear,
    name: String(pm.billing_details?.name || ''),
    email: String(pm.billing_details?.email || '').toLowerCase()
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const customerId = String(data.customerId || '').trim();

    if (!customerId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'customerId es requerido' })
      };
    }

    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 20
    });

    const customer = await stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId =
      typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id || null;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        customerId,
        defaultPaymentMethodId,
        paymentMethods: methods.data.map(mapPaymentMethod)
      })
    };
  } catch (error) {
    console.error('list-payment-methods error:', error.message);
    return {
      statusCode: error.statusCode || 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
