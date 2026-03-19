console.log('Loading main.js v3');

const API_URL = '/.netlify/functions';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const isLocalhost = LOCAL_HOSTNAMES.has(window.location.hostname);
const isLikelyNetlifyDev = isLocalhost && (window.location.port === '8888' || window.location.port === '8889');
const USE_FUNCTIONS_API = !isLocalhost || isLikelyNetlifyDev;
const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|jpe?g|png|webp|svg)$/i;
const STORAGE_KEYS = {
  lastPayerName: 'lastPayerName',
  lastEmail: 'lastEmail',
  stripeCustomerId: 'stripeCustomerId',
  activeSavedMethodId: 'activeSavedMethodId'
};

let images = [];
let currentIndex = 0;
let stripe = null;
let elements = null;
let cardElement = null;
let paymentRequest = null;
let paymentRequestButtonElement = null;
let currentDonationAmount = 0;
let pendingPaymentData = null;
let enableCardVerification = false;
let bankingCurrency = 'usd';
let stripeCountry = 'MX';
let lastPayerName = localStorage.getItem(STORAGE_KEYS.lastPayerName) || '';
let lastEmail = localStorage.getItem(STORAGE_KEYS.lastEmail) || '';
let stripeCustomerId = String(localStorage.getItem(STORAGE_KEYS.stripeCustomerId) || '').trim();
let selectedSavedMethodId = String(localStorage.getItem(STORAGE_KEYS.activeSavedMethodId) || '').trim();
let savedPaymentMethods = [];

const carouselImage = document.getElementById('carouselImage');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const donateBtn = document.getElementById('donateBtn');
const donateStrip = document.getElementById('donateStrip');
const closeDonate = document.getElementById('closeDonate');
const donateOptions = document.querySelectorAll('.donate-option');

const successModal = document.getElementById('successModal');
const closeSuccessModal = document.getElementById('closeSuccessModal');
const paymentErrorModal = document.getElementById('paymentErrorModal');
const closePaymentErrorModal = document.getElementById('closePaymentErrorModal');
const dismissPaymentErrorModal = document.getElementById('dismissPaymentErrorModal');
const watermarkTrigger = document.getElementById('watermarkTrigger');
const watermarkInfoModal = document.getElementById('watermarkInfoModal');
const closeWatermarkInfoModal = document.getElementById('closeWatermarkInfoModal');

const paymentModal = document.getElementById('paymentModal');
const closePaymentModal = document.getElementById('closePaymentModal');
const paymentForm = document.getElementById('paymentForm');
const paymentAmount = document.getElementById('paymentAmount');
const submitPayment = document.getElementById('submitPayment');
const cardElementWrapper = document.getElementById('cardElementWrapper');
const cardElementHint = document.getElementById('cardElementHint');
const saveCardOption = document.getElementById('saveCardOption');
const saveCardForFuture = document.getElementById('saveCardForFuture');
const savedMethodsSection = document.getElementById('savedMethodsSection');
const useSavedMethodToggle = document.getElementById('useSavedMethodToggle');
const savedPaymentMethodSelect = document.getElementById('savedPaymentMethodSelect');
const walletPaySection = document.getElementById('walletPaySection');
const walletButtonContainer = document.getElementById('wallet-button');
const walletStatus = document.getElementById('walletStatus');

const verificationModal = document.getElementById('verificationModal');
const closeVerificationModal = document.getElementById('closeVerificationModal');
const confirmVerificationBtn = document.getElementById('confirmVerificationBtn');
const cancelVerificationBtn = document.getElementById('cancelVerificationBtn');
const verifyCardCvvInput = document.getElementById('verifyCardCvv');

let successModalFadeTimeout = null;
let successModalAutoCloseTimeout = null;

if (submitPayment) {
  submitPayment.disabled = true;
}

if (donateBtn) {
  donateBtn.disabled = false;
  donateBtn.removeAttribute('title');
}

function blurFocusedElementWithin(container) {
  const activeElement = document.activeElement;
  if (container && activeElement && container.contains(activeElement) && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
}

function setStripeCustomerId(customerId) {
  stripeCustomerId = String(customerId || '').trim();
  if (stripeCustomerId) {
    localStorage.setItem(STORAGE_KEYS.stripeCustomerId, stripeCustomerId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.stripeCustomerId);
  }
}

function setSelectedSavedMethodId(paymentMethodId) {
  selectedSavedMethodId = String(paymentMethodId || '').trim();
  if (selectedSavedMethodId) {
    localStorage.setItem(STORAGE_KEYS.activeSavedMethodId, selectedSavedMethodId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeSavedMethodId);
  }
}

function clearSavedMethodState() {
  savedPaymentMethods = [];
  setSelectedSavedMethodId('');

  if (useSavedMethodToggle) {
    useSavedMethodToggle.checked = false;
  }

  if (savedPaymentMethodSelect) {
    savedPaymentMethodSelect.innerHTML = '';
    savedPaymentMethodSelect.disabled = true;
  }

  if (savedMethodsSection) {
    savedMethodsSection.hidden = true;
  }
}

function updateImage() {
  if (!images.length || !carouselImage) {
    return;
  }

  const src = images[currentIndex];
  carouselImage.src = src;
  carouselImage.alt = `Imagen ${currentIndex + 1} del carrusel`;
}

function normalizeImageHref(href) {
  const raw = String(href || '').trim();
  if (!raw) {
    return '';
  }

  const withoutHash = raw.split('#')[0];
  const pathOnly = withoutHash.split('?')[0];
  if (!IMAGE_FILE_PATTERN.test(pathOnly)) {
    return '';
  }

  if (pathOnly.startsWith('http://') || pathOnly.startsWith('https://')) {
    return pathOnly;
  }

  if (pathOnly.startsWith('/images/')) {
    return pathOnly;
  }

  if (pathOnly.startsWith('images/')) {
    return `/${pathOnly}`;
  }

  const clean = pathOnly.replace(/^\.\//, '');
  if (!clean || clean.startsWith('../')) {
    return '';
  }

  return `/images/${clean}`;
}

function extractImagesFromDirectoryListing(html) {
  if (!html) {
    return [];
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const hrefs = Array.from(doc.querySelectorAll('a[href]'))
      .map((link) => link.getAttribute('href'))
      .map(normalizeImageHref)
      .filter(Boolean);

    return Array.from(new Set(hrefs));
  } catch (error) {
    return [];
  }
}

async function loadImagesFromDirectoryListing() {
  try {
    const response = await fetch('/images/', {
      headers: { Accept: 'text/html' }
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return extractImagesFromDirectoryListing(html);
  } catch (error) {
    return [];
  }
}

function formatExpiry(method) {
  const expMonth = Number(method.expMonth || 0);
  const expYear = Number(method.expYear || 0);
  if (!expMonth || !expYear) {
    return 'N/D';
  }
  return `${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}`;
}

function formatSavedMethodLabel(method) {
  const brand = String(method.brand || 'tarjeta').toUpperCase();
  const last4 = String(method.last4 || '----');
  return `${brand} •••• ${last4} (${formatExpiry(method)})`;
}

function usingSavedMethod() {
  return Boolean(
    useSavedMethodToggle &&
      useSavedMethodToggle.checked &&
      savedPaymentMethodSelect &&
      savedPaymentMethodSelect.value
  );
}

function updatePaymentModalCardUI() {
  const useSaved = usingSavedMethod();

  if (cardElementWrapper) {
    cardElementWrapper.style.display = useSaved ? 'none' : 'block';
  }

  if (saveCardOption) {
    saveCardOption.style.display = useSaved ? 'none' : 'flex';
  }

  if (saveCardForFuture) {
    saveCardForFuture.disabled = useSaved;
  }

  if (cardElementHint) {
    if (useSaved) {
      cardElementHint.textContent = '';
      cardElementHint.hidden = true;
    } else {
      cardElementHint.textContent = 'Ingresa los datos de la tarjeta para completar el pago seguro con Stripe.';
      cardElementHint.hidden = false;
    }
  }
}

function renderSavedMethodsUI() {
  if (!savedMethodsSection || !savedPaymentMethodSelect || !useSavedMethodToggle) {
    return;
  }

  if (!savedPaymentMethods.length) {
    clearSavedMethodState();
    updatePaymentModalCardUI();
    return;
  }

  savedMethodsSection.hidden = false;

  savedPaymentMethodSelect.innerHTML = savedPaymentMethods
    .map((method) => `<option value="${method.id}">${formatSavedMethodLabel(method)}</option>`)
    .join('');

  const hasSelected = savedPaymentMethods.some((method) => method.id === selectedSavedMethodId);
  if (!hasSelected) {
    setSelectedSavedMethodId(savedPaymentMethods[0].id);
  }

  savedPaymentMethodSelect.value = selectedSavedMethodId;
  savedPaymentMethodSelect.disabled = !useSavedMethodToggle.checked;

  updatePaymentModalCardUI();
}

async function loadCarouselImages() {
  if (!carouselImage) {
    return;
  }

  if (USE_FUNCTIONS_API) {
    try {
      const response = await fetch(`${API_URL}/list-images`, {
        headers: { Accept: 'application/json' }
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');

      if (response.ok && isJson) {
        const data = await response.json();
        if (Array.isArray(data.images) && data.images.length > 0) {
          images = data.images;
          currentIndex = 0;
          updateImage();
          return;
        }
      }
    } catch (error) {
      console.info('Image list function unavailable, trying /images/ listing.');
    }
  }

  const listedImages = await loadImagesFromDirectoryListing();
  if (listedImages.length > 0) {
    images = listedImages;
    currentIndex = 0;
    updateImage();
    return;
  }

  const fallbackSrc = carouselImage.getAttribute('src');
  images = fallbackSrc ? [fallbackSrc] : [];
  currentIndex = 0;
  updateImage();
}

async function loadPaymentConfig() {
  const response = await fetch(`${API_URL}/config`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Config endpoint HTTP ${response.status}`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error('Config endpoint did not return JSON');
  }

  return response.json();
}

function resetWalletUI(message = '') {
  if (!walletPaySection || !walletButtonContainer || !walletStatus) {
    return;
  }

  if (paymentRequestButtonElement) {
    paymentRequestButtonElement.unmount();
    paymentRequestButtonElement = null;
  }

  paymentRequest = null;
  walletButtonContainer.innerHTML = '';

  if (message) {
    walletPaySection.hidden = false;
    walletStatus.textContent = message;
  } else {
    walletPaySection.hidden = true;
  }
}

function showDonateStrip() {
  if (donateStrip) {
    donateStrip.setAttribute('aria-hidden', 'false');
  }
}

function hideDonateStrip() {
  if (!donateStrip) {
    return;
  }

  blurFocusedElementWithin(donateStrip);
  donateStrip.setAttribute('aria-hidden', 'true');
}

function buildDonationDescription(amount) {
  const currentImagePath = images[currentIndex] || carouselImage?.getAttribute('src') || '';
  const currentImageName = String(currentImagePath).split('/').pop() || 'imagen';
  const currentImageBaseName = currentImageName.replace(/\.[^/.]+$/, '');
  const baseDescription = paymentForm?.dataset.description || `Donacion de $${amount}`;
  return `${baseDescription} a ${currentImageBaseName}`;
}

function getPayerNameValue() {
  return String(document.getElementById('payerName')?.value || '').trim();
}

function getPayerEmailValue() {
  return String(document.getElementById('payerEmail')?.value || '').trim();
}

function setPayerFields(name, email) {
  const payerNameInput = document.getElementById('payerName');
  const payerEmailInput = document.getElementById('payerEmail');
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim();

  if (normalizedName) {
    lastPayerName = normalizedName;
    localStorage.setItem(STORAGE_KEYS.lastPayerName, normalizedName);
  }

  if (normalizedEmail) {
    lastEmail = normalizedEmail;
    localStorage.setItem(STORAGE_KEYS.lastEmail, normalizedEmail);
  }

  if (payerNameInput && normalizedName && !payerNameInput.value) {
    payerNameInput.value = normalizedName;
  }

  if (payerEmailInput && normalizedEmail && !payerEmailInput.value) {
    payerEmailInput.value = normalizedEmail;
  }
}

function openPaymentModal(amount, description) {
  hidePaymentConfirmationError();

  // Hide saved-card controls until Stripe confirms available methods.
  clearSavedMethodState();

  if (paymentAmount) {
    paymentAmount.textContent = amount.toFixed(2);
  }

  const currencySpan = document.getElementById('paymentCurrency');
  if (currencySpan) {
    currencySpan.textContent = bankingCurrency.toUpperCase();
  }

  if (paymentModal) {
    paymentModal.setAttribute('aria-hidden', 'false');
  }

  if (paymentForm) {
    paymentForm.dataset.amount = String(amount);
    paymentForm.dataset.description = description;
  }

  updatePaymentModalCardUI();

  const payerEmailInput = document.getElementById('payerEmail');
  const payerNameInput = document.getElementById('payerName');
  if (payerNameInput && lastPayerName && !payerNameInput.value) {
    payerNameInput.value = lastPayerName;
  }

  if (payerEmailInput && lastEmail && !payerEmailInput.value) {
    payerEmailInput.value = lastEmail;
  }

  if (cardElement) {
    cardElement.clear();
    setTimeout(() => {
      if (cardElementWrapper && cardElementWrapper.style.display !== 'none') {
        cardElement.focus();
      }
    }, 0);
  }

  if (USE_FUNCTIONS_API && stripeCustomerId) {
    loadSavedPaymentMethods().catch((error) => {
      console.warn('No se pudieron cargar tarjetas guardadas:', error.message);
      clearSavedMethodState();
    });
  } else {
    clearSavedMethodState();
  }

  setupWalletButton(amount, description).catch((error) => {
    console.warn('Wallet Stripe no disponible:', error.message);
    resetWalletUI();
  });
}

function closePaymentModalFn() {
  hidePaymentConfirmationError();

  if (paymentModal) {
    blurFocusedElementWithin(paymentModal);
    paymentModal.setAttribute('aria-hidden', 'true');
  }

  if (paymentForm) {
    paymentForm.reset();
  }

  if (useSavedMethodToggle) {
    useSavedMethodToggle.checked = false;
  }

  if (savedPaymentMethodSelect) {
    savedPaymentMethodSelect.disabled = true;
  }

  updatePaymentModalCardUI();
}

function showVerificationModal(paymentData) {
  pendingPaymentData = paymentData;

  const verifyName = document.getElementById('verifyName');
  const verifyEmail = document.getElementById('verifyEmail');
  const verifyAmount = document.getElementById('verifyAmount');
  const verifyDescription = document.getElementById('verifyDescription');

  if (verifyName) verifyName.textContent = paymentData.name || '-';
  if (verifyEmail) verifyEmail.textContent = paymentData.email || '-';
  if (verifyAmount) verifyAmount.textContent = `$${paymentData.amount.toFixed(2)} ${bankingCurrency.toUpperCase()}`;
  if (verifyDescription) verifyDescription.textContent = paymentData.description || '-';

  const cardSection = document.getElementById('verifyCardSection');
  if (cardSection) {
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

  if (verificationModal) {
    verificationModal.setAttribute('aria-hidden', 'false');
  }
}

function persistVerificationCvv() {
  return true;
}

function hideVerificationModal() {
  if (verificationModal) {
    blurFocusedElementWithin(verificationModal);
    verificationModal.setAttribute('aria-hidden', 'true');
  }

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

function showPaymentConfirmationError(customMessage = '') {
  const errorTextElement = document.getElementById('paymentErrorText');
  if (errorTextElement) {
    errorTextElement.textContent = customMessage || 'Verifique sus datos de la targeta.';
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
  if (!successModal) {
    return;
  }

  clearSuccessModalTimers();
  successModal.hidden = true;
  successModal.style.opacity = '1';
}

function showSuccessModal() {
  if (!successModal) {
    return;
  }

  clearSuccessModalTimers();
  successModal.hidden = false;
  successModal.style.opacity = '1';

  successModalAutoCloseTimeout = setTimeout(() => {
    successModal.style.opacity = '0';
    successModalFadeTimeout = setTimeout(() => {
      hideSuccessModal();
    }, 500);
  }, 3000);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });

  const rawBody = await response.text();
  let data = {};

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch (error) {
      throw new Error(`Respuesta invalida desde ${url}`);
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }

  return data;
}

function sanitizePaymentMethods(rawMethods) {
  if (!Array.isArray(rawMethods)) {
    return [];
  }

  return rawMethods
    .map((method) => {
      const id = String(method?.id || '').trim();
      const brand = String(method?.brand || '').trim();
      const last4 = String(method?.last4 || '').replace(/\D/g, '').slice(-4);
      const expMonth = Number(method?.expMonth || 0);
      const expYear = Number(method?.expYear || 0);

      if (!id || !last4) {
        return null;
      }

      return {
        id,
        brand,
        last4,
        expMonth,
        expYear,
        name: String(method?.name || '').trim(),
        email: String(method?.email || '').trim().toLowerCase()
      };
    })
    .filter(Boolean);
}

async function ensureStripeCustomer(email, name) {
  if (!USE_FUNCTIONS_API) {
    throw new Error('Funciones de Stripe no disponibles en este entorno local.');
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();

  if (!normalizedEmail) {
    throw new Error('Ingresa un correo para guardar la tarjeta.');
  }

  const customerData = await postJson(`${API_URL}/create-customer`, {
    customerId: stripeCustomerId || undefined,
    email: normalizedEmail,
    name: normalizedName
  });

  if (!customerData.customerId) {
    throw new Error('No se pudo crear u obtener el cliente en Stripe.');
  }

  setStripeCustomerId(customerData.customerId);
  return stripeCustomerId;
}

async function loadSavedPaymentMethods() {
  if (!USE_FUNCTIONS_API || !stripeCustomerId) {
    clearSavedMethodState();
    return;
  }

  const data = await postJson(`${API_URL}/list-payment-methods`, {
    customerId: stripeCustomerId
  });

  savedPaymentMethods = sanitizePaymentMethods(data.paymentMethods || []);

  if (!savedPaymentMethods.length) {
    clearSavedMethodState();
    return;
  }

  const defaultFromServer = String(data.defaultPaymentMethodId || '').trim();
  const hasSelected = savedPaymentMethods.some((method) => method.id === selectedSavedMethodId);
  if (!hasSelected) {
    if (defaultFromServer && savedPaymentMethods.some((method) => method.id === defaultFromServer)) {
      setSelectedSavedMethodId(defaultFromServer);
    } else {
      setSelectedSavedMethodId(savedPaymentMethods[0].id);
    }
  }

  renderSavedMethodsUI();
}

function initializeStripe(publicKey) {
  if (stripe || typeof Stripe !== 'function') {
    return;
  }

  stripe = Stripe(publicKey);
  elements = stripe.elements();
  cardElement = elements.create('card', {
    disableLink: true
  });
  cardElement.mount('#card-element');

  cardElement.addEventListener('change', (event) => {
    const displayError = document.getElementById('card-errors');
    if (!displayError) {
      return;
    }

    if (event.error) {
      displayError.textContent = event.error.message;
    } else {
      displayError.textContent = '';
    }
  });

  if (submitPayment) {
    submitPayment.disabled = false;
    submitPayment.removeAttribute('title');
  }

  if (donateBtn) {
    donateBtn.disabled = false;
    donateBtn.removeAttribute('title');
  }

  const errEl = document.getElementById('card-errors');
  if (errEl && errEl.dataset.stripeError) {
    errEl.textContent = '';
    delete errEl.dataset.stripeError;
  }

  if (USE_FUNCTIONS_API && stripeCustomerId) {
    loadSavedPaymentMethods().catch((error) => {
      console.warn('No se pudieron cargar tarjetas guardadas:', error.message);
      clearSavedMethodState();
    });
  }
}

function setStripeUnavailable(message) {
  stripe = null;
  cardElement = null;
  resetWalletUI();

  const errEl = document.getElementById('card-errors');
  if (errEl) {
    errEl.textContent = message;
    errEl.dataset.stripeError = '1';
  }

  if (submitPayment) {
    submitPayment.disabled = true;
    submitPayment.title = message;
  }

  if (donateBtn) {
    donateBtn.disabled = false;
    donateBtn.removeAttribute('title');
  }

  console.warn('Stripe no disponible:', message);
}

async function createAndConfirmPaymentIntent(paymentPayload) {
  const intentData = await postJson(`${API_URL}/create-payment-intent`, {
    amount: paymentPayload.amount,
    currency: paymentPayload.currency,
    description: paymentPayload.description,
    type: paymentPayload.type,
    customerId: paymentPayload.customerId || undefined,
    receiptEmail: paymentPayload.email || undefined,
    savePaymentMethod: paymentPayload.savePaymentMethod === true
  });

  if (!intentData.clientSecret) {
    throw new Error('No se recibio clientSecret de Stripe.');
  }

  let confirmResult;

  if (paymentPayload.paymentMethodId) {
    confirmResult = await stripe.confirmCardPayment(intentData.clientSecret, {
      payment_method: paymentPayload.paymentMethodId
    });
  } else {
    confirmResult = await stripe.confirmCardPayment(intentData.clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: paymentPayload.name,
          email: paymentPayload.email
        }
      }
    });
  }

  if (confirmResult.error) {
    throw new Error(confirmResult.error.message || 'Error al confirmar el pago.');
  }

  const paymentIntent = confirmResult.paymentIntent;
  if (!paymentIntent || paymentIntent.status !== 'succeeded') {
    throw new Error(`Estado de pago no completado: ${paymentIntent ? paymentIntent.status : 'desconocido'}`);
  }

  return paymentIntent;
}

async function postProcessSuccessfulPayment(paymentPayload, paymentIntent) {
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

  if (paymentPayload.savePaymentMethod && paymentPayload.customerId) {
    try {
      await loadSavedPaymentMethods();
    } catch (error) {
      console.warn('No se pudo refrescar la lista de tarjetas guardadas:', error.message);
    }
  }

  closePaymentModalFn();
  hideVerificationModal();
  hidePaymentConfirmationError();

  showSuccessModal();
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
}

async function setupWalletButton(amount, description) {
  if (!walletPaySection || !walletButtonContainer || !walletStatus) {
    return;
  }

  if (!USE_FUNCTIONS_API || !stripe || !elements || !Number.isFinite(amount) || amount <= 0) {
    resetWalletUI();
    return;
  }

  resetWalletUI('Comprobando wallet...');

  const amountInCents = Math.round(amount * 100);
  if (amountInCents <= 0) {
    resetWalletUI();
    return;
  }

  paymentRequest = stripe.paymentRequest({
    country: stripeCountry,
    currency: bankingCurrency,
    total: {
      label: description,
      amount: amountInCents
    },
    requestPayerName: true,
    requestPayerEmail: true
  });

  const canMakePayment = await paymentRequest.canMakePayment();
  if (!canMakePayment) {
    resetWalletUI();
    return;
  }

  walletPaySection.hidden = false;
  walletStatus.textContent = 'Paga con Apple Pay o Google Pay.';

  paymentRequestButtonElement = elements.create('paymentRequestButton', {
    paymentRequest,
    style: {
      paymentRequestButton: {
        type: 'default',
        theme: 'dark',
        height: '44px'
      }
    }
  });

  paymentRequestButtonElement.mount('#wallet-button');

  paymentRequest.on('paymentmethod', async (event) => {
    const cardErrorsElement = document.getElementById('card-errors');

    try {
      const amountValue = Number.parseFloat(paymentForm?.dataset.amount || String(amount));
      const walletDescription = buildDonationDescription(amountValue);
      const resolvedName = String(event.payerName || getPayerNameValue() || 'Donante').trim();
      const resolvedEmail = String(event.payerEmail || getPayerEmailValue() || '').trim();

      setPayerFields(event.payerName, event.payerEmail);

      let customerId = '';
      const wantsSaveCard = Boolean(saveCardForFuture && saveCardForFuture.checked);
      if (wantsSaveCard && resolvedEmail) {
        customerId = await ensureStripeCustomer(resolvedEmail, resolvedName);
      }

      const paymentPayload = {
        amount: amountValue,
        currency: bankingCurrency,
        description: walletDescription,
        type: 'donation',
        name: resolvedName,
        email: resolvedEmail,
        paymentMethodId: event.paymentMethod.id,
        customerId,
        savePaymentMethod: Boolean(customerId && wantsSaveCard)
      };

      const paymentIntent = await createAndConfirmPaymentIntent(paymentPayload);
      event.complete('success');

      await postProcessSuccessfulPayment(paymentPayload, paymentIntent);
    } catch (error) {
      event.complete('fail');
      if (cardErrorsElement) {
        cardErrorsElement.textContent = `Error: ${error.message}`;
      }
      showPaymentConfirmationError(error.message);
    }
  });
}

async function executePayment(paymentPayload) {
  const cardErrorsElement = document.getElementById('card-errors');

  if (!submitPayment) {
    return;
  }

  submitPayment.disabled = true;
  submitPayment.textContent = 'Procesando...';

  try {
    const paymentIntent = await createAndConfirmPaymentIntent(paymentPayload);
    await postProcessSuccessfulPayment(paymentPayload, paymentIntent);
  } catch (error) {
    if (cardErrorsElement) {
      cardErrorsElement.textContent = `Error: ${error.message}`;
    }
    showPaymentConfirmationError(error.message);
  } finally {
    submitPayment.disabled = false;
    submitPayment.textContent = 'Pagar Ahora';
  }
}

async function processPayment(e) {
  e.preventDefault();

  if (!paymentForm || !submitPayment || submitPayment.disabled) {
    return;
  }

  const amount = Number.parseFloat(paymentForm.dataset.amount || '0');
  const name = getPayerNameValue();
  const email = getPayerEmailValue();
  const cardErrorsElement = document.getElementById('card-errors');

  if (cardErrorsElement) {
    cardErrorsElement.textContent = '';
  }

  hidePaymentConfirmationError();

  if (!Number.isFinite(amount) || amount <= 0) {
    if (cardErrorsElement) {
      cardErrorsElement.textContent = 'Monto invalido.';
    }
    return;
  }

  lastPayerName = name;
  localStorage.setItem(STORAGE_KEYS.lastPayerName, name);

  lastEmail = email;
  localStorage.setItem(STORAGE_KEYS.lastEmail, email);

  try {
    if (!stripe) {
      throw new Error('El sistema de pagos no esta disponible. Revisa la configuracion de Stripe.');
    }

    const useSaved = usingSavedMethod();
    const description = buildDonationDescription(amount);

    let paymentMethodId = '';
    let customerId = '';
    let savePaymentMethod = false;

    if (useSaved) {
      if (!savedPaymentMethodSelect || !savedPaymentMethodSelect.value || !stripeCustomerId) {
        throw new Error('Selecciona una tarjeta guardada valida.');
      }

      paymentMethodId = savedPaymentMethodSelect.value;
      customerId = stripeCustomerId;
      setSelectedSavedMethodId(paymentMethodId);
    } else {
      if (!cardElement) {
        throw new Error('No se pudo inicializar el formulario seguro de tarjeta.');
      }

      const wantsSaveCard = Boolean(saveCardForFuture && saveCardForFuture.checked);
      if (wantsSaveCard) {
        customerId = await ensureStripeCustomer(email, name);
        savePaymentMethod = Boolean(customerId);
      }
    }

    const paymentPayload = {
      amount,
      currency: bankingCurrency,
      description,
      type: 'donation',
      name,
      email,
      paymentMethodId,
      customerId,
      savePaymentMethod
    };

    if (enableCardVerification) {
      showVerificationModal({
        name,
        email,
        amount,
        description,
        card: null,
        payload: paymentPayload
      });
      return;
    }

    await executePayment(paymentPayload);
  } catch (error) {
    if (cardErrorsElement) {
      cardErrorsElement.textContent = `Error: ${error.message}`;
    }
    showPaymentConfirmationError(error.message);
  }
}

if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    if (!images.length) {
      return;
    }

    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateImage();
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    if (!images.length) {
      return;
    }

    currentIndex = (currentIndex + 1) % images.length;
    updateImage();
  });
}

if (donateBtn) {
  donateBtn.addEventListener('click', () => {
    if (donateBtn.disabled) {
      return;
    }

    showDonateStrip();
  });
}

if (closeDonate) {
  closeDonate.addEventListener('click', () => {
    hideDonateStrip();
  });
}

if (donateOptions.length) {
  donateOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.value);
      const formattedValue = Number.isFinite(value)
        ? value.toLocaleString('es-MX')
        : String(button.dataset.value || '0');

      hideDonateStrip();
      currentDonationAmount = Number.isFinite(value) ? value : 0;
      openPaymentModal(currentDonationAmount, `Donacion de $${formattedValue}`);
    });
  });
}

if (useSavedMethodToggle) {
  useSavedMethodToggle.addEventListener('change', () => {
    if (savedPaymentMethodSelect) {
      savedPaymentMethodSelect.disabled = !useSavedMethodToggle.checked;
    }
    updatePaymentModalCardUI();
  });
}

if (savedPaymentMethodSelect) {
  savedPaymentMethodSelect.addEventListener('change', () => {
    setSelectedSavedMethodId(savedPaymentMethodSelect.value);
    updatePaymentModalCardUI();
  });
}

if (closePaymentModal) {
  closePaymentModal.addEventListener('click', closePaymentModalFn);
}

if (paymentForm) {
  paymentForm.addEventListener('submit', processPayment);
}

const payerNameInput = document.getElementById('payerName');
if (payerNameInput) {
  payerNameInput.addEventListener('input', () => {
    const nameValue = String(payerNameInput.value || '').trim();
    lastPayerName = nameValue;
    localStorage.setItem(STORAGE_KEYS.lastPayerName, nameValue);
  });
}

if (closeVerificationModal) {
  closeVerificationModal.addEventListener('click', hideVerificationModal);
}

if (cancelVerificationBtn) {
  cancelVerificationBtn.addEventListener('click', () => {
    hideVerificationModal();
  });
}

if (confirmVerificationBtn) {
  confirmVerificationBtn.addEventListener('click', async () => {
    if (pendingPaymentData && pendingPaymentData.payload) {
      if (!persistVerificationCvv()) {
        return;
      }

      const payload = pendingPaymentData.payload;
      hideVerificationModal();
      await executePayment(payload);
    }
  });
}

if (closeSuccessModal) {
  closeSuccessModal.addEventListener('click', hideSuccessModal);
}

if (successModal) {
  successModal.addEventListener('click', (event) => {
    if (event.target === successModal) {
      hideSuccessModal();
    }
  });
}

if (closePaymentErrorModal) {
  closePaymentErrorModal.addEventListener('click', hidePaymentConfirmationError);
}

if (dismissPaymentErrorModal) {
  dismissPaymentErrorModal.addEventListener('click', hidePaymentConfirmationError);
}

if (paymentErrorModal) {
  paymentErrorModal.addEventListener('click', (event) => {
    if (event.target === paymentErrorModal) {
      hidePaymentConfirmationError();
    }
  });
}

if (watermarkTrigger) {
  watermarkTrigger.addEventListener('mouseenter', showWatermarkInfoModal);
  watermarkTrigger.addEventListener('click', showWatermarkInfoModal);
  watermarkTrigger.addEventListener(
    'touchstart',
    (event) => {
      event.preventDefault();
      showWatermarkInfoModal();
    },
    { passive: false }
  );
}

if (closeWatermarkInfoModal) {
  closeWatermarkInfoModal.addEventListener('click', hideWatermarkInfoModal);
}

if (watermarkInfoModal) {
  watermarkInfoModal.addEventListener('click', (event) => {
    if (event.target === watermarkInfoModal) {
      hideWatermarkInfoModal();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && successModal && !successModal.hidden) {
    hideSuccessModal();
  }

  if (event.key === 'Escape' && paymentErrorModal && !paymentErrorModal.hidden) {
    hidePaymentConfirmationError();
  }

  if (event.key === 'Escape' && watermarkInfoModal && !watermarkInfoModal.hidden) {
    hideWatermarkInfoModal();
  }
});

window.addEventListener('load', async () => {
  await loadCarouselImages();
  renderSavedMethodsUI();

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

  if (!USE_FUNCTIONS_API) {
    setStripeUnavailable('Modo local detectado: las funciones de pago requieren Netlify Dev o despliegue en Netlify.');
    return;
  }

  try {
    const data = await loadPaymentConfig();

    if (data.error) {
      setStripeUnavailable(`Sistema de pagos no disponible: ${data.error}`);
      return;
    }

    if (data.publicKey) {
      initializeStripe(data.publicKey);
    } else {
      setStripeUnavailable('Sistema de pagos no disponible: clave publica no encontrada.');
    }

    if (data.enableCardVerification !== undefined) {
      enableCardVerification = Boolean(data.enableCardVerification);
    }

    if (data.bankingCurrency) {
      bankingCurrency = String(data.bankingCurrency).toLowerCase();
    }

    if (data.stripeCountry) {
      stripeCountry = String(data.stripeCountry).toUpperCase();
    }
  } catch (err) {
    console.warn('Error cargando configuracion:', err);
    setStripeUnavailable('No se pudo conectar con el servidor de pagos.');
  }
});
