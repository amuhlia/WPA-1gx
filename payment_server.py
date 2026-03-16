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


def _normalize_card_number(number):
    return ''.join(ch for ch in str(number or '') if ch.isdigit())


def _test_token_from_card_number(number):
    """Map common Stripe test card numbers to reusable test tokens."""
    normalized = _normalize_card_number(number)
    token_map = {
        '4242424242424242': 'tok_visa',
        '4000056655665556': 'tok_visa_debit',
        '5555555555554444': 'tok_mastercard',
        '378282246310005': 'tok_amex',
        '6011111111111117': 'tok_discover',
        '3530111333300000': 'tok_jcb',
        '30569309025904': 'tok_diners',
    }
    return token_map.get(normalized)

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

        token = data.get('token')
        card_payload = data.get('card')

        if not token and card_payload:
            number = _normalize_card_number(card_payload.get('number'))

            # In test mode, prefer known test tokens to avoid raw-card API restrictions.
            if stripe.api_key and stripe.api_key.startswith('sk_test_'):
                token = _test_token_from_card_number(number)

            if not token:
                try:
                    exp_month = int(card_payload.get('exp_month'))
                    exp_year = int(card_payload.get('exp_year'))
                except (TypeError, ValueError):
                    return jsonify({'error': 'La tarjeta guardada tiene fecha de vencimiento invalida'}), 400

                try:
                    token_obj = stripe.Token.create(
                        card={
                            'number': number,
                            'exp_month': exp_month,
                            'exp_year': exp_year,
                            'cvc': card_payload.get('cvc'),
                            'name': card_payload.get('name', '')
                        }
                    )
                    token = token_obj.id
                except stripe.error.StripeError as e:
                    return jsonify({'error': 'No se pudo tokenizar la tarjeta guardada: ' + str(e)}), 400

        if not token:
            return jsonify({'error': 'No se recibio un token de pago valido'}), 400
        
        # Create charge
        charge = stripe.Charge.create(
            amount=amount,
            currency=currency,
            source=token,
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

