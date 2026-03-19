console.log('Loading main.js v3');

let images = [];
let currentIndex = 0;

const carouselImage = document.getElementById("carouselImage");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const donateBtn = document.getElementById("donateBtn");
const donateStrip = document.getElementById("donateStrip");
const closeDonate = document.getElementById("closeDonate");
const donateOptions = document.querySelectorAll(".donate-option");
const walletBtn = document.getElementById("walletBtn");
const walletStrip = document.getElementById("walletStrip");
const closeWallet = document.getElementById("closeWallet");
const walletOptions = document.querySelectorAll(".wallet-option");
const cardModal = document.getElementById("cardModal");
const closeCardModal = document.getElementById("closeCardModal");
const addCardBtn = document.getElementById("addCardBtn");
const cardFormModal = document.getElementById("cardFormModal");
const closeCardForm = document.getElementById("closeCardForm");
const cardForm = document.getElementById("cardForm");
const cardList = document.getElementById("cardList");
const toast = document.getElementById("toast");

function getCardLast4(card) {
  if (!card) {
    return '----';
  }

  const digits = String(card.last4 || card.number || '').replace(/\D/g, '');
  return digits.slice(-4) || '----';
}

function sanitizeSavedCards(rawCards) {
  if (!Array.isArray(rawCards)) {
    return [];
  }

  return rawCards
    .map((card) => {
      const last4 = getCardLast4(card);
      const name = String(card?.name || '').trim();
      const expiry = String(card?.expiry || '').trim();

      if (!name || last4 === '----') {
        return null;
      }

      // Keep only non-sensitive metadata in localStorage.
      return {
        name,
        last4,
        expiry
      };
    })
    .filter(Boolean);
}

let savedCards = sanitizeSavedCards(JSON.parse(localStorage.getItem('cards')) || []);
localStorage.setItem('cards', JSON.stringify(savedCards));
let activeCardIndex = Number(localStorage.getItem('activeCardIndex'));
if (Number.isNaN(activeCardIndex)) activeCardIndex = null;
if (activeCardIndex !== null && (activeCardIndex < 0 || activeCardIndex >= savedCards.length)) {
  activeCardIndex = null;
  localStorage.removeItem('activeCardIndex');
}
let lastEmail = localStorage.getItem('lastEmail') || '';

const getActiveCard = () => {
  if (activeCardIndex === null) return null;
  return savedCards[activeCardIndex] || null;
};

const setActiveCard = (index) => {
  if (!Number.isInteger(index) || index < 0 || index >= savedCards.length) {
    activeCardIndex = null;
    localStorage.removeItem('activeCardIndex');
  } else {
    activeCardIndex = index;
    localStorage.setItem('activeCardIndex', String(index));
  }
  renderCardList();
  updateActiveCardDisplay();
  updateDonateButtonState();
};

// Payment system
const API_URL = '/.netlify/functions';
let stripe = null;
let elements = null;
let cardElement = null;
let currentDonationAmount = 0;
let pendingPaymentContext = null;
let enableCardVerification = false;
let pendingPaymentData = null;
let bankingCurrency = 'usd';

const successModal = document.getElementById("successModal");
const closeSuccessModal = document.getElementById("closeSuccessModal");
const paymentErrorModal = document.getElementById("paymentErrorModal");
const closePaymentErrorModal = document.getElementById("closePaymentErrorModal");
const dismissPaymentErrorModal = document.getElementById("dismissPaymentErrorModal");
const watermarkTrigger = document.getElementById("watermarkTrigger");
const watermarkInfoModal = document.getElementById("watermarkInfoModal");
const closeWatermarkInfoModal = document.getElementById("closeWatermarkInfoModal");
const paymentModal = document.getElementById("paymentModal");
const closePaymentModal = document.getElementById("closePaymentModal");
const paymentForm = document.getElementById("paymentForm");
const paymentAmount = document.getElementById("paymentAmount");
const submitPayment = document.getElementById("submitPayment");
const savedCardSummary = document.getElementById("savedCardSummary");
const verificationModal = document.getElementById("verificationModal");
const closeVerificationModal = document.getElementById("closeVerificationModal");
const confirmVerificationBtn = document.getElementById("confirmVerificationBtn");
const cancelVerificationBtn = document.getElementById("cancelVerificationBtn");
const savedCardLabel = document.getElementById("savedCardLabel");
const savedCardExpiry = document.getElementById("savedCardExpiry");
const changeSavedCardBtn = document.getElementById("changeSavedCardBtn");
const cardElementWrapper = document.getElementById("cardElementWrapper");
const cardElementHint = document.getElementById("cardElementHint");
const verifyCardCvvInput = document.getElementById("verifyCardCvv");

let successModalFadeTimeout = null;
let successModalAutoCloseTimeout = null;

function updateActiveCardDisplay() {
  const activeCard = getActiveCard();
  const infoEl = document.getElementById('activeCardInfo');
  if (activeCard) {
    infoEl.innerHTML = `<small>${activeCard.name}</small><br><small>****${getCardLast4(activeCard)}</small>`;
    infoEl.hidden = false;
  } else {
    infoEl.hidden = true;
  }
}

function updateImage() {
  if (!images.length) {
    return;
  }

  const src = images[currentIndex];
  console.log('Updating image to:', src, 'index:', currentIndex);
  carouselImage.src = src;
  carouselImage.alt = `Imagen ${currentIndex + 1} del carrusel`;
}

async function loadCarouselImages() {
  try {
    const response = await fetch(`${API_URL}/list-images`);
    const data = await response.json();

    if (Array.isArray(data.images) && data.images.length > 0) {
      images = data.images;
      currentIndex = 0;
      updateImage();
      console.log('Carousel images loaded from /images:', images.length);
      return;
    }
  } catch (error) {
    console.warn('Could not load image list from /images:', error.message);
  }

  // Fallback to current image already present in the DOM
  const fallbackSrc = carouselImage.getAttribute('src');
  images = fallbackSrc ? [fallbackSrc] : [];
  currentIndex = 0;
  updateImage();
}

function blurFocusedElementWithin(container) {
  const activeElement = document.activeElement;
  if (container && activeElement && container.contains(activeElement) && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
}

function showDonateStrip() {
  donateStrip.setAttribute("aria-hidden", "false");
}

function hideDonateStrip() {
  blurFocusedElementWithin(donateStrip);
  donateStrip.setAttribute("aria-hidden", "true");
}

function updateDonateButtonState() {
  // Payments now always use Stripe Elements, so Donar never depends on wallet cards.
  donateBtn.disabled = false;
  donateBtn.setAttribute('aria-disabled', 'false');
  donateBtn.removeAttribute('title');
}

function showWalletStrip() {
  walletStrip.setAttribute("aria-hidden", "false");
}

function hideWalletStrip() {
  blurFocusedElementWithin(walletStrip);
  walletStrip.setAttribute("aria-hidden", "true");
}

function showCardModal() {
  cardModal.setAttribute("aria-hidden", "false");
  renderCardList();
}

function hideCardModal() {
  blurFocusedElementWithin(cardModal);
  cardModal.setAttribute("aria-hidden", "true");
}

function showCardFormModal() {
  cardFormModal.setAttribute("aria-hidden", "false");
}

function hideCardFormModal() {
  blurFocusedElementWithin(cardFormModal);
  cardFormModal.setAttribute("aria-hidden", "true");
  cardForm.reset();
}

function renderCardList() {
  updateDonateButtonState();

  if (savedCards.length === 0) {
    cardList.innerHTML = '<p class="card-list__empty">No tienes tarjetas registradas</p>';
    return;
  }

  cardList.innerHTML = savedCards.map((card, index) => `
    <div class="card-item ${index === activeCardIndex ? 'active' : ''}">
      <div class="card-item__info">
        <p class="card-item__name">${card.name}</p>
        <p class="card-item__number">•••• •••• •••• ${getCardLast4(card)}</p>
        <p class="card-item__expiry">Vence: ${card.expiry}</p>
      </div>
      <div class="card-item__actions">
        <button class="card-item__use" data-index="${index}">Usar</button>
        <button class="card-item__delete" data-index="${index}" aria-label="Eliminar">✕</button>
      </div>
    </div>
  `).join('');
  
  document.querySelectorAll('.card-item__use').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      setActiveCard(index);
      hideCardModal();
      updatePaymentModalCardUI();

      if (pendingPaymentContext) {
        hideWalletStrip();
        openPaymentModal(pendingPaymentContext.amount, pendingPaymentContext.description);
        pendingPaymentContext = null;
      }

      console.log('Tarjeta activa seleccionada'); // Temporarily replace showToast
    });
  });

  document.querySelectorAll('.card-item__delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      savedCards.splice(index, 1);
      localStorage.setItem('cards', JSON.stringify(savedCards));

      if (activeCardIndex === index) {
        activeCardIndex = null;
        localStorage.removeItem('activeCardIndex');
      }

      // If we removed a card before the active index, shift the active index down
      if (activeCardIndex !== null && index < activeCardIndex) {
        setActiveCard(activeCardIndex - 1);
      } else {
        renderCardList();
        updateActiveCardDisplay();
      }
    });
  });
}

function formatCardLast4(value) {
  return value.replace(/\D/g, '').slice(0, 4);
}

function formatExpiry(value) {
  value = value.replace(/\D/g, '');
  if (value.length >= 2) {
    return value.slice(0, 2) + '/' + value.slice(2, 4);
  }
  return value;
}

prevBtn.addEventListener("click", () => {  if (!images.length) return; console.log('Prev button clicked');  currentIndex = (currentIndex - 1 + images.length) % images.length;
  updateImage();
});

nextBtn.addEventListener("click", () => {  if (!images.length) return; console.log('Next button clicked');  currentIndex = (currentIndex + 1) % images.length;
  updateImage();
});

donateBtn.addEventListener("click", () => {
  if (donateBtn.disabled) {
    return;
  }

  showDonateStrip();
});

closeDonate.addEventListener("click", () => {
  hideDonateStrip();
});

donateOptions.forEach((button) => {
  button.addEventListener("click", () => {
    const value = Number(button.dataset.value);
    const formattedValue = Number.isFinite(value)
      ? value.toLocaleString('es-MX')
      : String(button.dataset.value || '0');
    hideDonateStrip();
    currentDonationAmount = Number.isFinite(value) ? value : 0;
    openPaymentModal(currentDonationAmount, `Donación de $${formattedValue}`);
  });
});

walletBtn.addEventListener("click", () => {
  showWalletStrip();
});

closeWallet.addEventListener("click", () => {
  hideWalletStrip();
  pendingPaymentContext = null;
});

walletOptions.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
      return;
    }

    const method = button.dataset.method;
    if (method === "card") {
      hideWalletStrip();
      showCardModal();
    } else {
      hideWalletStrip();
      pendingPaymentContext = null;
      console.log(`Método seleccionado: ${button.textContent.trim()}`); // Temporarily replace showToast
    }
  });
});

closeCardModal.addEventListener("click", () => {
  hideCardModal();
  pendingPaymentContext = null;
});

addCardBtn.addEventListener("click", () => {
  showCardFormModal();
});

closeCardForm.addEventListener("click", () => {
  hideCardFormModal();
});

document.getElementById("cardNumber").addEventListener("input", (e) => {
  e.target.value = formatCardLast4(e.target.value);
});

document.getElementById("cardExpiry").addEventListener("input", (e) => {
  e.target.value = formatExpiry(e.target.value);
});

cardForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const cardNumberInput = document.getElementById("cardNumber");
  const sanitizedLast4 = formatCardLast4(cardNumberInput.value);
  if (sanitizedLast4.length !== 4) {
    cardNumberInput.setCustomValidity('Ingresa exactamente 4 digitos.');
    cardNumberInput.reportValidity();
    return;
  }
  cardNumberInput.setCustomValidity('');

  const newCard = {
    name: document.getElementById("cardName").value,
    last4: sanitizedLast4,
    expiry: document.getElementById("cardExpiry").value
  };
  savedCards.push(newCard);
  localStorage.setItem('cards', JSON.stringify(savedCards));
  setActiveCard(savedCards.length - 1);
  hideCardFormModal();
  showCardModal();
  console.log('Tarjeta agregada exitosamente'); // Temporarily replace showToast
});

// Payment System Functions
function initializeStripe(publicKey) {
  console.log('✅ initializeStripe con publicKey:', publicKey.slice(0, 12) + '...');
  if (!stripe) {
    stripe = Stripe(publicKey);
    elements = stripe.elements();
    cardElement = elements.create('card');
    cardElement.mount('#card-element');
    
    cardElement.addEventListener('change', (event) => {
      const displayError = document.getElementById('card-errors');
      if (event.error) {
        displayError.textContent = event.error.message;
      } else {
        displayError.textContent = '';
      }
    });

    // Enable submit button now that stripe is ready
    submitPayment.disabled = false;
    const errEl = document.getElementById('card-errors');
    if (errEl && errEl.dataset.stripeError) {
      errEl.textContent = '';
      delete errEl.dataset.stripeError;
    }
  }
}

function setStripeUnavailable(message) {
  stripe = null;
  // Show error inside the payment modal so the user lo vea
  const errEl = document.getElementById('card-errors');
  if (errEl) {
    errEl.textContent = message;
    errEl.dataset.stripeError = '1';
  }
  submitPayment.disabled = true;
  submitPayment.title = message;
  donateBtn.disabled = true;
  donateBtn.title = message;
  console.error('🚫 Stripe no disponible:', message);
}

function updatePaymentModalCardUI() {
  const activeCard = getActiveCard();
  const payerNameInput = document.getElementById('payerName');

  if (activeCard) {
    savedCardLabel.textContent = `•••• •••• •••• ${getCardLast4(activeCard)}`;
    savedCardExpiry.textContent = activeCard.expiry ? `(${activeCard.expiry})` : '';
    savedCardSummary.hidden = false;

    // Autofill non-sensitive payer data from the selected wallet card.
    if (payerNameInput) {
      payerNameInput.value = activeCard.name;
    }

    if (cardElementHint) {
      const expiryText = activeCard.expiry ? `, vence ${activeCard.expiry}` : '';
      cardElementHint.textContent = `Tarjeta seleccionada: **** ${getCardLast4(activeCard)}${expiryText}. Stripe requiere capturar los datos en este campo por seguridad.`;
      cardElementHint.hidden = false;
    }
  } else {
    savedCardSummary.hidden = true;

    if (cardElementHint) {
      cardElementHint.textContent = 'Ingresa los datos de la tarjeta para completar el pago seguro con Stripe.';
      cardElementHint.hidden = false;
    }
  }

  // Always capture payment details in Stripe Elements.
  cardElementWrapper.style.display = 'block';
}

function openPaymentModal(amount, description) {
  hidePaymentConfirmationError();
  paymentAmount.textContent = amount.toFixed(2);
  const currencySpan = document.getElementById('paymentCurrency');
  if (currencySpan) {
    currencySpan.textContent = bankingCurrency.toUpperCase();
  }
  paymentModal.setAttribute("aria-hidden", "false");
  paymentForm.dataset.amount = amount;
  paymentForm.dataset.description = description;

  updatePaymentModalCardUI();

  // Pre-fill email from localStorage
  const payerEmailInput = document.getElementById('payerEmail');
  if (payerEmailInput && lastEmail && !payerEmailInput.value) {
    payerEmailInput.value = lastEmail;
  }

  if (cardElement) {
    cardElement.clear();
    setTimeout(() => {
      cardElement.focus();
    }, 0);
  }
}

function closePaymentModalFn() {
  hidePaymentConfirmationError();
  blurFocusedElementWithin(paymentModal);
  paymentModal.setAttribute("aria-hidden", "true");
  paymentForm.reset();
}

function showVerificationModal(paymentData) {
  pendingPaymentData = paymentData;
  
  // Fill verification modal with data
  document.getElementById('verifyName').textContent = paymentData.name || '-';
  document.getElementById('verifyEmail').textContent = paymentData.email || '-';
  document.getElementById('verifyAmount').textContent = `$${paymentData.amount.toFixed(2)} ${bankingCurrency.toUpperCase()}`;
  document.getElementById('verifyDescription').textContent = paymentData.description || '-';

  // Show card section only if using a saved card
  const cardSection = document.getElementById('verifyCardSection');
  if (paymentData.card) {
    cardSection.style.display = 'block';
    document.getElementById('verifyCardName').textContent = paymentData.card.name || '-';
    document.getElementById('verifyCardNumber').textContent = `•••• •••• •••• ${getCardLast4(paymentData.card)}`;
    document.getElementById('verifyCardExpiry').textContent = paymentData.card.expiry || '-';
  } else {
    cardSection.style.display = 'none';
  }

  if (verifyCardCvvInput) {
    verifyCardCvvInput.value = '';
    verifyCardCvvInput.setCustomValidity('');
    verifyCardCvvInput.disabled = true;
  }

  const cvvGroup = document.querySelector('.verification-inline-group--cvv');
  if (cvvGroup) {
    cvvGroup.style.display = 'none';
  }

  verificationModal.setAttribute("aria-hidden", "false");
}

function persistVerificationCvv() {
  // CVV verification is not used when card data is handled only by Stripe Elements.
  return true;
}

function hideVerificationModal() {
  blurFocusedElementWithin(verificationModal);
  verificationModal.setAttribute("aria-hidden", "true");
  if (verifyCardCvvInput) {
    verifyCardCvvInput.value = '';
  }
  pendingPaymentData = null;
}

function hidePaymentConfirmationError() {
  if (paymentErrorModal) {
    paymentErrorModal.hidden = true;
  }
}

function showPaymentConfirmationError() {
  const errorTextElement = document.getElementById('paymentErrorText');
  if (errorTextElement) {
    errorTextElement.textContent = 'Verifique sus datos de la targeta.';
  }

  if (paymentErrorModal) {
    paymentErrorModal.hidden = false;
  }
}

function hideWatermarkInfoModal() {
  if (watermarkInfoModal) {
    watermarkInfoModal.hidden = true;
  }
}

function showWatermarkInfoModal() {
  if (watermarkInfoModal) {
    watermarkInfoModal.hidden = false;
  }
}

function clearSuccessModalTimers() {
  if (successModalAutoCloseTimeout) {
    clearTimeout(successModalAutoCloseTimeout);
    successModalAutoCloseTimeout = null;
  }
  if (successModalFadeTimeout) {
    clearTimeout(successModalFadeTimeout);
    successModalFadeTimeout = null;
  }
}

function hideSuccessModal() {
  clearSuccessModalTimers();
  successModal.hidden = true;
  successModal.style.opacity = '1';
}

function showSuccessModal() {
  clearSuccessModalTimers();
  successModal.hidden = false;
  successModal.style.opacity = '1';

  // Auto-hide with fade after a short delay.
  successModalAutoCloseTimeout = setTimeout(() => {
    successModal.style.opacity = '0';
    successModalFadeTimeout = setTimeout(() => {
      hideSuccessModal();
    }, 500);
  }, 3000);
}

async function processPayment(e) {
  e.preventDefault();
  console.log('🔵 processPayment called');
  
  if (submitPayment.disabled) {
    console.log('⏳ Payment already in progress');
    return;
  }
  
  const amount = parseFloat(paymentForm.dataset.amount);
  const name = document.getElementById("payerName").value;
  const email = document.getElementById("payerEmail").value;
  
  console.log('📋 Form data:', { amount, name, email });
  
  // Save email for next time
  lastEmail = email;
  localStorage.setItem('lastEmail', email);

  const cardErrorsElement = document.getElementById('card-errors');
  cardErrorsElement.textContent = '';
  hidePaymentConfirmationError();
  
  try {
    if (!stripe || !cardElement) {
      console.error('❌ stripe no inicializado');
      cardErrorsElement.textContent = 'El sistema de pagos no está disponible. Revisa la configuración de las claves de Stripe en Netlify.';
      return;
    }

    const activeCard = getActiveCard();
    console.log('💳 activeCard:', activeCard ? `****${getCardLast4(activeCard)}` : 'ninguna (usando Stripe Element)');
    console.log('🔧 stripe inicializado:', !!stripe, '| cardElement:', !!cardElement);

    const currentImagePath = images[currentIndex] || carouselImage.getAttribute('src') || '';
    const currentImageName = String(currentImagePath).split('/').pop() || 'imagen';
    const currentImageBaseName = currentImageName.replace(/\.[^/.]+$/, '');
    const baseDescription = paymentForm.dataset.description || `Donacion de $${amount}`;
    const donationDescription = `${baseDescription} a ${currentImageBaseName}`;

    const paymentPayload = {
      amount: amount,
      currency: bankingCurrency,
      description: donationDescription,
      type: 'donation',
      name,
      email
    };

    console.log('✅ paymentPayload listo:', {
      amount: paymentPayload.amount,
      currency: paymentPayload.currency,
      description: paymentPayload.description,
      type: paymentPayload.type,
      hasCardReference: Boolean(activeCard)
    });
    console.log('🔒 enableCardVerification:', enableCardVerification);

    // If card verification is enabled, show verification modal instead of processing immediately
    if (enableCardVerification) {
      const verificationData = {
        name: name,
        email: email,
        amount: amount,
        description: donationDescription,
        cardIndex: activeCard ? activeCardIndex : null,
        card: activeCard ? {
          name: activeCard.name,
          last4: getCardLast4(activeCard),
          expiry: activeCard.expiry
        } : null,
        payload: paymentPayload
      };
      
      showVerificationModal(verificationData);
      return;
    }

    // Otherwise, process payment directly
    await executePayment(paymentPayload);
    
  } catch (err) {
    console.error('❌ Error en processPayment:', err);
    const cardErrorsElement = document.getElementById('card-errors');
    cardErrorsElement.textContent = 'Error: ' + err.message;
  } finally {
    submitPayment.disabled = false;
    submitPayment.textContent = "Pagar Ahora";
  }
}

async function executePayment(paymentPayload) {
  const cardErrorsElement = document.getElementById('card-errors');
  submitPayment.disabled = true;
  submitPayment.textContent = "Procesando...";
  
  try {
    // Create a PaymentIntent server-side, then confirm with Stripe.js.
    console.log('📤 Solicitando PaymentIntent:', {
      url: `${API_URL}/create-payment-intent`,
      payload: {
        amount: paymentPayload.amount,
        currency: paymentPayload.currency,
        description: paymentPayload.description,
        type: paymentPayload.type
      }
    });

    const intentResponse = await fetch(`${API_URL}/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: paymentPayload.amount,
        currency: paymentPayload.currency,
        description: paymentPayload.description,
        type: paymentPayload.type
      })
    });

    const intentData = await intentResponse.json();
    if (!intentResponse.ok) {
      throw new Error(intentData.error || 'No se pudo inicializar el pago seguro.');
    }

    if (!intentData.clientSecret) {
      throw new Error('No se recibio clientSecret de Stripe.');
    }

    const confirmResult = await stripe.confirmCardPayment(intentData.clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: paymentPayload.name,
          email: paymentPayload.email
        }
      }
    });

    if (confirmResult.error) {
      cardErrorsElement.textContent = confirmResult.error.message || 'Error al confirmar el pago.';
      showPaymentConfirmationError();
      return;
    }

    const paymentIntent = confirmResult.paymentIntent;
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      throw new Error(`Estado de pago no completado: ${paymentIntent ? paymentIntent.status : 'desconocido'}`);
    }

    // Optional post-processing (e.g., payout/status bookkeeping) without blocking checkout success.
    fetch(`${API_URL}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        amount: paymentPayload.amount,
        currency: paymentPayload.currency,
        description: paymentPayload.description,
        type: paymentPayload.type
      })
    }).catch((postProcessError) => {
      console.warn('No se pudo notificar post-procesamiento:', postProcessError);
    });

    closePaymentModalFn();
    hideVerificationModal();
    hidePaymentConfirmationError();

    // Show success modal with confetti
    showSuccessModal();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch (err) {
    console.log('Payment error:', err);
    cardErrorsElement.textContent = 'Error: ' + err.message;
    showPaymentConfirmationError();
  } finally {
    submitPayment.disabled = false;
    submitPayment.textContent = "Pagar Ahora";
  }
}

// Payment Modal Event Listeners
closePaymentModal.addEventListener("click", closePaymentModalFn);
changeSavedCardBtn.addEventListener("click", () => {
  const amount = parseFloat(paymentForm.dataset.amount || '0');
  const description = paymentForm.dataset.description || '';

  pendingPaymentContext = {
    amount,
    description
  };

  closePaymentModalFn();
  showWalletStrip();
});
paymentForm.addEventListener("submit", processPayment);

// Verification Modal Event Listeners
closeVerificationModal.addEventListener("click", hideVerificationModal);

cancelVerificationBtn.addEventListener("click", () => {
  hideVerificationModal();
  // Modal de pago sigue abierto
});

confirmVerificationBtn.addEventListener("click", async () => {
  if (pendingPaymentData && pendingPaymentData.payload) {
    if (!persistVerificationCvv()) {
      return;
    }
    const payload = pendingPaymentData.payload; // save before hideVerificationModal nullifies it
    hideVerificationModal();
    await executePayment(payload);
  }
});

// Success Modal Event Listener
closeSuccessModal.addEventListener("click", () => {
  hideSuccessModal();
});

successModal.addEventListener("click", (event) => {
  // Close only when clicking the dark backdrop, not content.
  if (event.target === successModal) {
    hideSuccessModal();
  }
});

if (closePaymentErrorModal) {
  closePaymentErrorModal.addEventListener("click", hidePaymentConfirmationError);
}

if (dismissPaymentErrorModal) {
  dismissPaymentErrorModal.addEventListener("click", hidePaymentConfirmationError);
}

if (paymentErrorModal) {
  paymentErrorModal.addEventListener("click", (event) => {
    if (event.target === paymentErrorModal) {
      hidePaymentConfirmationError();
    }
  });
}

if (watermarkTrigger) {
  watermarkTrigger.addEventListener("mouseenter", showWatermarkInfoModal);
  watermarkTrigger.addEventListener("click", showWatermarkInfoModal);
  watermarkTrigger.addEventListener("touchstart", (event) => {
    event.preventDefault();
    showWatermarkInfoModal();
  }, { passive: false });
}

if (closeWatermarkInfoModal) {
  closeWatermarkInfoModal.addEventListener("click", hideWatermarkInfoModal);
}

if (watermarkInfoModal) {
  watermarkInfoModal.addEventListener("click", (event) => {
    if (event.target === watermarkInfoModal) {
      hideWatermarkInfoModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !successModal.hidden) {
    hideSuccessModal();
  }
  if (event.key === "Escape" && paymentErrorModal && !paymentErrorModal.hidden) {
    hidePaymentConfirmationError();
  }
  if (event.key === "Escape" && watermarkInfoModal && !watermarkInfoModal.hidden) {
    hideWatermarkInfoModal();
  }
});

window.addEventListener("load", async () => {
  await loadCarouselImages();
  updateActiveCardDisplay();
  updateDonateButtonState();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js')
      .then((reg) => {
        console.log('Service worker registrado:', reg);
      })
      .catch((err) => {
        console.warn('No se pudo registrar el service worker:', err);
      });
  }
  
  // Load config and initialize Stripe
  fetch(`${API_URL}/config`)
  .then(r => r.json())
  .then(data => {
    console.log('⚙️ Config recibida:', { publicKey: data.publicKey ? '✅' : '❌', enableCardVerification: data.enableCardVerification });

    if (data.error) {
      console.error('❌ Error de configuración:', data.error);
      setStripeUnavailable('Sistema de pagos no disponible: ' + data.error);
      return;
    }

    if (data.publicKey) {
      initializeStripe(data.publicKey);
    } else {
      console.error('❌ No se recibió publicKey');
      setStripeUnavailable('Sistema de pagos no disponible: clave pública no encontrada.');
    }

    if (data.enableCardVerification !== undefined) {
      enableCardVerification = data.enableCardVerification;
    }
    if (data.bankingCurrency) {
      bankingCurrency = data.bankingCurrency.toLowerCase();
      console.log('💱 Moneda de pago:', bankingCurrency.toUpperCase());
    }
  })
  .catch(err => {
    console.error('❌ Error cargando configuración:', err);
    setStripeUnavailable('No se pudo conectar con el servidor de pagos.');
  });
});
