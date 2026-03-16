console.log('Loading main.js v3');

const images = [
  "images/photo_2026-03-15_19-45-32.jpg",
  "images/photo_2026-03-15_19-45-36.jpg",
  "images/photo_2026-03-15_19-45-41.jpg",
  "images/photo_2026-03-15_19-45-46.jpg",
  "images/photo_2026-03-15_19-45-49.jpg",
  "images/photo_2026-03-15_19-45-52.jpg",
  "images/photo_2026-03-15_19-45-55.jpg",
  "images/photo_2026-03-15_19-45-57.jpg",
  "images/photo_2026-03-15_19-46-00.jpg",
  "images/photo_2026-03-15_19-46-03.jpg",
  "images/photo_2026-03-15_19-46-05.jpg",
];
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

// Payment system
const API_URL = 'http://localhost:5000';
let stripe = null;
let elements = null;
let cardElement = null;
let currentDonationAmount = 0;

const paymentModal = document.getElementById("paymentModal");
const closePaymentModal = document.getElementById("closePaymentModal");
const paymentForm = document.getElementById("paymentForm");
const paymentAmount = document.getElementById("paymentAmount");
const submitPayment = document.getElementById("submitPayment");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toast._timeout);
  toast._timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function updateImage() {
  const src = images[currentIndex];
  console.log('Updating image to:', src, 'index:', currentIndex);
  carouselImage.src = src;
  carouselImage.alt = `Imagen ${currentIndex + 1} del carrusel`;
}

function showDonateStrip() {
  donateStrip.setAttribute("aria-hidden", "false");
}

function hideDonateStrip() {
  donateStrip.setAttribute("aria-hidden", "true");
}

function showWalletStrip() {
  walletStrip.setAttribute("aria-hidden", "false");
}

function hideWalletStrip() {
  walletStrip.setAttribute("aria-hidden", "true");
}

function showCardModal() {
  cardModal.setAttribute("aria-hidden", "false");
  renderCardList();
}

function hideCardModal() {
  cardModal.setAttribute("aria-hidden", "true");
}

function showCardFormModal() {
  cardFormModal.setAttribute("aria-hidden", "false");
}

function hideCardFormModal() {
  cardFormModal.setAttribute("aria-hidden", "true");
  cardForm.reset();
}

function renderCardList() {
  if (savedCards.length === 0) {
    cardList.innerHTML = '<p class="card-list__empty">No tienes tarjetas registradas</p>';
    return;
  }
  cardList.innerHTML = savedCards.map((card, index) => `
    <div class="card-item">
      <div class="card-item__info">
        <p class="card-item__name">${card.name}</p>
        <p class="card-item__number">•••• •••• •••• ${card.number.slice(-4)}</p>
        <p class="card-item__expiry">Vence: ${card.expiry}</p>
      </div>
      <button class="card-item__delete" data-index="${index}" aria-label="Eliminar">✕</button>
    </div>
  `).join('');
  
  document.querySelectorAll('.card-item__delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      savedCards.splice(index, 1);
      localStorage.setItem('cards', JSON.stringify(savedCards));
      renderCardList();
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

prevBtn.addEventListener("click", () => {  console.log('Prev button clicked');  currentIndex = (currentIndex - 1 + images.length) % images.length;
  updateImage();
});

nextBtn.addEventListener("click", () => {  console.log('Next button clicked');  currentIndex = (currentIndex + 1) % images.length;
  updateImage();
});

donateBtn.addEventListener("click", () => {
  showDonateStrip();
});

closeDonate.addEventListener("click", () => {
  hideDonateStrip();
});

donateOptions.forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.value;
    hideDonateStrip();
    currentDonationAmount = parseFloat(value);
    openPaymentModal(currentDonationAmount, `Donación de $${value}`);
  });
});

walletBtn.addEventListener("click", () => {
  showWalletStrip();
});

closeWallet.addEventListener("click", () => {
  hideWalletStrip();
});

walletOptions.forEach((button) => {
  button.addEventListener("click", () => {
    const method = button.dataset.method;
    if (method === "card") {
      hideWalletStrip();
      showCardModal();
    } else {
      hideWalletStrip();
      showToast(`Método seleccionado: ${button.textContent.trim()}`);
    }
  });
});

closeCardModal.addEventListener("click", () => {
  hideCardModal();
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
  hideCardFormModal();
  showCardModal();
  showToast('Tarjeta agregada exitosamente');
});

// Payment System Functions
function initializeStripe(publicKey) {
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
  }
}

function openPaymentModal(amount, description) {
  paymentAmount.textContent = amount.toFixed(2);
  paymentModal.setAttribute("aria-hidden", "false");
  paymentForm.dataset.amount = amount;
  paymentForm.dataset.description = description;
}

function closePaymentModalFn() {
  paymentModal.setAttribute("aria-hidden", "true");
  paymentForm.reset();
}

async function processPayment(e) {
  e.preventDefault();
  
  const amount = parseFloat(paymentForm.dataset.amount);
  const name = document.getElementById("payerName").value;
  const email = document.getElementById("payerEmail").value;
  
  submitPayment.disabled = true;
  submitPayment.textContent = "Procesando...";
  
  try {
    // Get payment method from Stripe
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: { name, email },
    });
    
    if (error) {
      document.getElementById('card-errors').textContent = error.message;
      return;
    }
    
    // Send payment to backend
    const response = await fetch(`${API_URL}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        currency: 'usd',
        payment_method: paymentMethod.id,
        description: paymentForm.dataset.description,
        type: 'donation'
      })
    });
    
    const data = await response.json();
    
    if (data.success || data.chargeId) {
      closePaymentModalFn();
      showToast(`¡Pago procesado! ID: ${data.chargeId || 'OK'}`);
    } else {
      document.getElementById('card-errors').textContent = data.error || 'Error en el pago';
    }
  } catch (err) {
    document.getElementById('card-errors').textContent = 'Error: ' + err.message;
  } finally {
    submitPayment.disabled = false;
    submitPayment.textContent = "Pagar Ahora";
  }
}

// Payment Modal Event Listeners
closePaymentModal.addEventListener("click", closePaymentModalFn);
paymentForm.addEventListener("submit", processPayment);

window.addEventListener("load", () => {
  updateImage();

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
  
  // Initialize Stripe with public key from backend
  fetch(`${API_URL}/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 0, currency: 'usd' })
  })
  .then(r => r.json())
  .then(data => {
    if (data.publicKey) {
      initializeStripe(data.publicKey);
    }
  })
  .catch(() => {
    console.warn('Payment system not available. Make sure Flask server is running on port 5000');
  });
});
