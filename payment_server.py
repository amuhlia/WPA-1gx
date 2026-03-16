import stripe
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/create-payment-intent', methods=['POST'])
def create_payment_intent():
    try:
        data = request.get_json()
        amount = int(data.get('amount') * 100)  # Convert to cents
        currency = data.get('currency', 'usd')
        
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata={
                'type': data.get('type', 'donation'),
                'description': data.get('description', '')
            }
        )
        
        return jsonify({
            'clientSecret': intent.client_secret,
            'publicKey': os.getenv('STRIPE_PUBLIC_KEY')
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
        token = data.get('token')
        
        charge = stripe.Charge.create(
            amount=amount,
            currency=data.get('currency', 'usd'),
            source=token,
            description=data.get('description', 'PWA Donation'),
            metadata={
                'type': data.get('type', 'donation')
            }
        )
        
        return jsonify({
            'success': True,
            'chargeId': charge.id,
            'amount': charge.amount / 100
        }), 200
    except stripe.error.CardError as e:
        return jsonify({'error': 'Card declined: ' + str(e)}), 400
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Internal server error: ' + str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
