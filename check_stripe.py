# Script para verificar configuración de Stripe
import os
from dotenv import load_dotenv
load_dotenv()

print('🔍 Verificando configuración de Stripe...')
print()
pk = os.getenv('STRIPE_PUBLIC_KEY')
sk = os.getenv('STRIPE_SECRET_KEY')
ba = os.getenv('STRIPE_BANK_ACCOUNT_ID')

if pk and pk.startswith('pk_test_') and 'AQUI_PEGA' not in pk:
    print('✅ Public Key: Configurada (Test Mode)')
elif pk and pk.startswith('pk_live_') and 'AQUI_PEGA' not in pk:
    print('✅ Public Key: Configurada (Live Mode)')
else:
    print('❌ Public Key: NO configurada (reemplaza AQUI_PEGA_TU_CLAVE_PUBLICA)')

if sk and sk.startswith('sk_test_') and 'AQUI_PEGA' not in sk:
    print('✅ Secret Key: Configurada (Test Mode)')
elif sk and sk.startswith('sk_live_') and 'AQUI_PEGA' not in sk:
    print('✅ Secret Key: Configurada (Live Mode)')
else:
    print('❌ Secret Key: NO configurada (reemplaza AQUI_PEGA_TU_CLAVE_SECRETA)')

if ba and ba.startswith('ba_') and 'AQUI_PEGA' not in ba:
    print('✅ Bank Account ID: Configurado')
else:
    print('❌ Bank Account ID: NO configurado (reemplaza AQUI_PEGA_EL_ID_DEL_BANCO)')

if pk and sk and ba:
    print('🎉 ¡Todo listo! Puedes ejecutar los servidores')
else:
    print('⚠️  Revisa STRIPE_SETUP.md para completar la configuración')
