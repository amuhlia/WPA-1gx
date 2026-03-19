const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const publicKey = process.env.STRIPE_PUBLIC_KEY;

  if (!publicKey || publicKey.includes('AQUI_PEGA')) {
    console.error('❌ STRIPE_PUBLIC_KEY not configured');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'STRIPE_PUBLIC_KEY not configured in Netlify environment variables' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      publicKey,
      enableCardVerification: process.env.ENABLE_CARD_VERIFICATION === 'true',
      bankingCurrency: process.env.BANKING_CURRENCY || 'MXN',
      stripeCountry: process.env.STRIPE_COUNTRY || 'MX'
    })
  };
};
