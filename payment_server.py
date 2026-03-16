import stripe
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
BANK_ACCOUNT_ID = os.getenv('STRIPE_BANK_ACCOUNT_ID')
BANKING_CURRENCY = os.getenv('BANKING_CURRENCY', 'MXN')

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'bank_configured': bool(BANK_ACCOUNT_ID)}), 200

@app.route('/create-payment-intent', methods=['POST'])
def create_payment_intent():
    try:
        data = request.get_json()
        amount = int(data.get('amount') * 100)  # Convert to cents
        # Convert USD to MXN if needed (approximate rate)
        currency = data.get('currency', 'usd')
        
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata={
                'type': data.get('type', 'donation'),
                'description': data.get('description', ''),
                'banking_currency': BANKING_CURRENCY
            }
        )
        
        return jsonify({
            'clientSecret': intent.client_secret,
            'publicKey': os.getenv('STRIPE_PUBLIC_KEY'),
            'bankingCurrency': BANKING_CURRENCY
        }), 200
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Internal server error: ' + str(e)}), 500

@app.route('/process-payment', methods=['POST'])
def process_payment():
    try:
        data = request.get_json()
        amount = int(data.get('amount') * 100)  # Convert to cents
        currency = data.get('currency', 'usd')
        
        # Create charge
        charge = stripe.Charge.create(
            amount=amount,
            currency=currency,
            source=data.get('token'),
            description=data.get('description', 'PWA Donation'),
            metadata={
                'type': data.get('type', 'donation'),
                'payout_status': 'pending'
            }
        )
        
        # Schedule automatic payout to bank account
        if BANK_ACCOUNT_ID and charge.status == 'succeeded':
            try:
                # Create payout to connected bank account
                payout = stripe.Payout.create(
                    amount=charge.amount,
                    currency=currency,
                    destination=BANK_ACCOUNT_ID,
                    description=f"Payout for {data.get('description', 'Donation')}",
                    metadata={'charge_id': charge.id}
                )
                payout_status = payout.status
            except stripe.error.StripeError as e:
                payout_status = f"error: {str(e)}"
        else:
            payout_status = "no_bank_account"
        
        return jsonify({
            'success': True,
            'chargeId': charge.id,
            'amount': charge.amount / 100,
            'currency': currency,
            'payoutStatus': payout_status,
            'bankingCurrency': BANKING_CURRENCY
        }), 200
    except stripe.error.CardError as e:
        return jsonify({'error': 'Card declined: ' + str(e)}), 400
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Internal server error: ' + str(e)}), 500

@app.route('/payout-status/<charge_id>', methods=['GET'])
def payout_status(charge_id):
    try:
        charge = stripe.Charge.retrieve(charge_id)
        payouts = stripe.Payout.list(limit=1, metadata={'charge_id': charge_id})
        
        payout_info = payouts.data[0] if payouts.data else None
        
        return jsonify({
            'chargeId': charge.id,
            'chargeStatus': charge.status,
            'amount': charge.amount / 100,
            'payout': {
                'id': payout_info.id if payout_info else None,
                'status': payout_info.status if payout_info else 'Not found',
                'arrival_date': payout_info.arrival_date if payout_info else None,
                'destination': str(payout_info.destination) if payout_info else None
            },
            'bankingCurrency': BANKING_CURRENCY
        }), 200
    except stripe.error.InvalidRequestError:
        return jsonify({'error': 'Charge not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    if not BANK_ACCOUNT_ID:
        print("⚠️  WARNING: STRIPE_BANK_ACCOUNT_ID not configured")
        print("   Set this in .env for automatic payouts to Bancoppel")
    else:
        print(f"✅ Bank account configured: {BANK_ACCOUNT_ID}")
    app.run(debug=False, host='0.0.0.0', port=port)

