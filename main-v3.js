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
const toast = document.getElementById("toast");

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
    showToast(`Gracias por tu donación de $${value}!`);
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
    hideWalletStrip();
    showToast(`Método de pago seleccionado: ${method}`);
  });
});

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
});
