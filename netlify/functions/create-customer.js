const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

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
    const email = String(data.email || '').trim().toLowerCase();
    const name = String(data.name || '').trim();
    const providedCustomerId = String(data.customerId || '').trim();

    if (!email && !providedCustomerId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'email o customerId es requerido' })
      };
    }

    let customer = null;

    if (providedCustomerId) {
      try {
        const retrieved = await stripe.customers.retrieve(providedCustomerId);
        if (retrieved && !retrieved.deleted) {
          customer = retrieved;
        }
      } catch (error) {
        customer = null;
      }
    }

    if (!customer && email) {
      const existing = await stripe.customers.list({
        email,
        limit: 1
      });
      customer = existing.data[0] || null;
    }

    if (!customer) {
      customer = await stripe.customers.create({
        email: email || undefined,
        name: name || undefined,
        metadata: {
          app: 'zakia-dogs-cats'
        }
      });
    } else {
      const updatePayload = {};

      if (email && customer.email !== email) {
        updatePayload.email = email;
      }

      if (name && customer.name !== name) {
        updatePayload.name = name;
      }

      if (Object.keys(updatePayload).length > 0) {
        customer = await stripe.customers.update(customer.id, updatePayload);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        customerId: customer.id,
        email: customer.email || email,
        name: customer.name || name
      })
    };
  } catch (error) {
    console.error('create-customer error:', error.message);
    return {
      statusCode: error.statusCode || 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
