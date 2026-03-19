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
let savedCards = JSON.parse(localStorage.getItem('cards')) || [];
let activeCardIndex = Number(localStorage.getItem('activeCardIndex'));
if (Number.isNaN(activeCardIndex)) activeCardIndex = null;
let lastEmail = localStorage.getItem('lastEmail') || '';

const getActiveCard = () => {
  if (activeCardIndex === null) return null;
  return savedCards[activeCardIndex] || null;
};

const setActiveCard = (index) => {
  activeCardIndex = index;
  localStorage.setItem('activeCardIndex', index);
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
const verifyCardCvvInput = document.getElementById("verifyCardCvv");

let successModalFadeTimeout = null;
let successModalAutoCloseTimeout = null;

function updateActiveCardDisplay() {
  const activeCard = getActiveCard();
  const infoEl = document.getElementById('activeCardInfo');
  if (activeCard) {
    infoEl.innerHTML = `<small>${activeCard.name}</small><br><small>****${activeCard.number.slice(-4)}</small>`;
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
  const hasSavedCards = savedCards.length > 0;
  donateBtn.disabled = !hasSavedCards;
  donateBtn.setAttribute('aria-disabled', String(!hasSavedCards));

  if (!hasSavedCards) {
    donateBtn.title = 'Agrega una tarjeta en Billetera para donar';
    hideDonateStrip();
  } else {
    donateBtn.removeAttribute('title');
  }
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
        <p class="card-item__number">•••• •••• •••• ${card.number.slice(-4)}</p>
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

function formatCardNumber(value) {
  return value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
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
  e.target.value = formatCardNumber(e.target.value);
});

document.getElementById("cardExpiry").addEventListener("input", (e) => {
  e.target.value = formatExpiry(e.target.value);
});

document.getElementById("cardCVC").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
});

cardForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const newCard = {
    name: document.getElementById("cardName").value,
    number: document.getElementById("cardNumber").value.replace(/\s/g, ''),
    expiry: document.getElementById("cardExpiry").value,
    cvc: document.getElementById("cardCVC").value
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

  if (activeCard) {
    savedCardLabel.textContent = `•••• •••• •••• ${activeCard.number.slice(-4)}`;
    savedCardExpiry.textContent = `(${activeCard.expiry})`;
    savedCardSummary.hidden = false;

    const payerNameInput = document.getElementById('payerName');
    if (payerNameInput && !payerNameInput.value) {
      payerNameInput.value = activeCard.name;
    }
  } else {
    savedCardSummary.hidden = true;
  }

  // If a wallet card is active, use it directly at charge time.
  cardElementWrapper.style.display = activeCard ? 'none' : 'block';
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
    document.getElementById('verifyCardNumber').textContent = `•••• •••• •••• ${paymentData.card.number.slice(-4)}`;
    document.getElementById('verifyCardExpiry').textContent = paymentData.card.expiry || '-';
    if (verifyCardCvvInput) {
      verifyCardCvvInput.value = paymentData.card.cvc || '';
      verifyCardCvvInput.setCustomValidity('');
      verifyCardCvvInput.disabled = false;
    }
  } else {
    cardSection.style.display = 'none';
    if (verifyCardCvvInput) {
      verifyCardCvvInput.value = '';
      verifyCardCvvInput.setCustomValidity('');
      verifyCardCvvInput.disabled = true;
    }
  }

  verificationModal.setAttribute("aria-hidden", "false");
}

function persistVerificationCvv() {
  if (!pendingPaymentData || !pendingPaymentData.payload || !pendingPaymentData.payload.card || !verifyCardCvvInput) {
    return true;
  }

  const sanitizedCvv = verifyCardCvvInput.value.replace(/\D/g, '').slice(0, 4);
  verifyCardCvvInput.value = sanitizedCvv;

  if (sanitizedCvv.length < 3) {
    verifyCardCvvInput.setCustomValidity('El CVV debe tener al menos 3 digitos.');
    verifyCardCvvInput.reportValidity();
    verifyCardCvvInput.focus();
    return false;
  }

  verifyCardCvvInput.setCustomValidity('');

  pendingPaymentData.payload.card.cvc = sanitizedCvv;

  const cardIndex = pendingPaymentData.cardIndex;
  if (Number.isInteger(cardIndex) && cardIndex >= 0 && savedCards[cardIndex]) {
    savedCards[cardIndex].cvc = sanitizedCvv;
    localStorage.setItem('cards', JSON.stringify(savedCards));
  }

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
    if (!stripe) {
      console.error('❌ stripe no inicializado');
      cardErrorsElement.textContent = 'El sistema de pagos no está disponible. Revisa la configuración de las claves de Stripe en Netlify.';
      return;
    }

    const activeCard = getActiveCard();
    console.log('💳 activeCard:', activeCard ? `****${activeCard.number.slice(-4)}` : 'ninguna (usando Stripe Element)');
    console.log('🔧 stripe inicializado:', !!stripe, '| cardElement:', !!cardElement);

    if (!activeCard && !cardElement) {
      console.error('❌ Sin tarjeta activa ni cardElement');
      cardErrorsElement.textContent = 'No se pudo inicializar el formulario de tarjeta.';
      return;
    }

    const currentImagePath = images[currentIndex] || carouselImage.getAttribute('src') || '';
    const currentImageName = String(currentImagePath).split('/').pop() || 'imagen';
    const currentImageBaseName = currentImageName.replace(/\.[^/.]+$/, '');
    const baseDescription = paymentForm.dataset.description || `Donacion de $${amount}`;
    const donationDescription = `${baseDescription} a ${currentImageBaseName}`;

    let paymentPayload = {
      amount: amount,
      currency: bankingCurrency,
      description: donationDescription,
      type: 'donation'
    };

    if (activeCard) {
      const [expMonthRaw, expYearRaw] = (activeCard.expiry || '').split('/');
      const expMonth = parseInt(expMonthRaw, 10);
      const expYear = parseInt(expYearRaw, 10);

      if (!expMonth || !expYear) {
        cardErrorsElement.textContent = 'La tarjeta guardada tiene fecha de vencimiento invalida.';
        return;
      }

      const normalizedNumber = String(activeCard.number || '').replace(/\s/g, '');
      const normalizedCvv = String(activeCard.cvc || '').replace(/\D/g, '').slice(0, 4);
      const fullYear = expYear < 100 ? 2000 + expYear : expYear;

      if (!enableCardVerification && normalizedCvv.length < 3) {
        cardErrorsElement.textContent = 'El CVV debe tener al menos 3 digitos.';
        return;
      }

      // Send selected wallet card so backend can prepare a token/charge.
      paymentPayload.card = {
        number: normalizedNumber,
        exp_month: expMonth,
        exp_year: fullYear,
        cvc: normalizedCvv,
        name: activeCard.name || name
      };
    } else {
      const tokenResult = await stripe.createToken(cardElement, { name });
      console.log('Token result:', tokenResult);

      if (tokenResult.error) {
        cardErrorsElement.textContent = tokenResult.error.message;
        return;
      }

      paymentPayload.token = tokenResult.token.id;
    }
    
    console.log('✅ paymentPayload listo:', { ...paymentPayload, card: paymentPayload.card ? '(card data present)' : undefined, token: paymentPayload.token || undefined });
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
          number: activeCard.number,
          expiry: activeCard.expiry,
          cvc: paymentPayload.card ? paymentPayload.card.cvc : ''
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
    // Send payment to backend
    console.log('📤 Enviando al servidor de pagos:', {
      url: `${API_URL}/process-payment`,
      payload: {
        ...paymentPayload,
        card: paymentPayload.card ? {
          ...paymentPayload.card,
          number: '****' + String(paymentPayload.card.number || '').slice(-4),
          cvc: '***'
        } : undefined
      }
    });
    const response = await fetch(`${API_URL}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentPayload)
    });
    
    const data = await response.json();
    console.log('Fetch response:', data);
    
    if (data.success || data.chargeId) {
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
    } else {
      cardErrorsElement.textContent = data.error || 'Error en el pago';
      showPaymentConfirmationError();
    }
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

if (verifyCardCvvInput) {
  verifyCardCvvInput.addEventListener("input", () => {
    verifyCardCvvInput.value = verifyCardCvvInput.value.replace(/\D/g, '').slice(0, 4);
    verifyCardCvvInput.setCustomValidity('');
  });
}

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
