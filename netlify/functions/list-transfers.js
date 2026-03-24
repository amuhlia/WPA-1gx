const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseUnixTimestamp(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toAmountInMajorUnits(amountInMinor) {
  const value = Number(amountInMinor || 0);
  return value / 100;
}

function mapTransferStatus(transfer) {
  if (transfer.reversed) {
    return 'revertida';
  }
  return 'pagada';
}

function mapPayoutStatus(payout) {
  const rawStatus = String(payout.status || '').toLowerCase();
  if (rawStatus === 'paid') {
    return 'pagada';
  }
  if (rawStatus === 'in_transit' || rawStatus === 'pending') {
    return 'pendiente';
  }
  if (rawStatus === 'failed' || rawStatus === 'canceled') {
    return 'fallida';
  }
  return rawStatus || 'desconocido';
}

function isPendingStatus(status) {
  return status === 'pendiente';
}

function extractDonorName(nameValue) {
  const normalized = String(nameValue || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) {
    return 'anónimo';
  }

  const [firstWord] = normalized.split(' ');
  return firstWord || 'anónimo';
}

function mapChargeStatus(charge) {
  if (charge.refunded || charge.amount_refunded > 0) {
    return 'reembolsada';
  }
  if (charge.paid && charge.status === 'succeeded') {
    return 'pagada';
  }
  if (charge.status === 'pending') {
    return 'pendiente';
  }
  if (charge.status === 'failed') {
    return 'fallida';
  }
  return String(charge.status || 'desconocido');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!stripe) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Stripe secret key is not configured.' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(parsePositiveInt(params.limit, 25), 100);
    const fromTimestamp = parseUnixTimestamp(params.from);
    const toTimestamp = parseUnixTimestamp(params.to);

    const createdFilter = {};
    if (fromTimestamp) {
      createdFilter.gte = fromTimestamp;
    }
    if (toTimestamp) {
      createdFilter.lte = toTimestamp;
    }

    const listParams = {
      limit
    };

    if (Object.keys(createdFilter).length) {
      listParams.created = createdFilter;
    }

    const [transferList, payoutList, chargeList] = await Promise.all([
      stripe.transfers.list(listParams),
      stripe.payouts.list(listParams),
      stripe.charges.list(listParams)
    ]);

    const transferItems = (transferList.data || []).map((transfer) => ({
      id: transfer.id,
      created: transfer.created,
      amount: toAmountInMajorUnits(transfer.amount),
      currency: transfer.currency,
      description: String(transfer.description || transfer.metadata?.description || '').trim(),
      destination: transfer.destination || '',
      status: mapTransferStatus(transfer),
      source: 'transfer'
    }));

    const payoutItems = (payoutList.data || []).map((payout) => ({
      id: payout.id,
      created: payout.created,
      amount: toAmountInMajorUnits(payout.amount),
      currency: payout.currency,
      description: String(payout.description || payout.statement_descriptor || '').trim(),
      destination: payout.destination || '',
      status: mapPayoutStatus(payout),
      source: 'payout'
    }));

    const chargeItems = (chargeList.data || []).map((charge) => {
      const destination = extractDonorName(charge.billing_details?.name);

      return {
        id: charge.id,
        created: charge.created,
        amount: toAmountInMajorUnits(charge.amount),
        currency: charge.currency,
        description: String(charge.description || charge.statement_descriptor || '').trim(),
        destination,
        status: mapChargeStatus(charge),
        source: 'charge'
      };
    });

    const primaryItems = [...transferItems, ...payoutItems];
    const sourceItems = primaryItems.length ? primaryItems : chargeItems;

    const items = sourceItems
      .sort((a, b) => Number(b.created || 0) - Number(a.created || 0))
      .slice(0, limit);

    const totals = items.reduce(
      (accumulator, item) => {
        if (item.status === 'pagada') {
          accumulator.totalAmount += Number(item.amount || 0);
        }
        accumulator.count += 1;
        if (isPendingStatus(item.status)) {
          accumulator.pending += 1;
        }
        return accumulator;
      },
      {
        totalAmount: 0,
        count: 0,
        pending: 0,
        currency: (items[0] && items[0].currency) || 'usd'
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        items,
        totals,
        hasMore: Boolean(transferList.has_more || payoutList.has_more || chargeList.has_more),
        reportMode: primaryItems.length ? 'transfers_and_payouts' : 'charges_fallback'
      })
    };
  } catch (error) {
    console.error('List transfers error:', error.message);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
