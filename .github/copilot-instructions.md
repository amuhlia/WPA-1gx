# Copilot Instructions for WPA-1gx

This workspace contains a simple Progressive Web App (PWA) demo with a carousel and a donate UI.

### ✅ What this project includes
- Main screen carousel that cycles through a set of photos.
- A **Donate** button under the image.
- Clicking **Donate** opens a bottom strip with three preset donation values: **$50**, **$100**, **$500**.
- A **Wallet** button next to Donate.
- Clicking **Wallet** opens a bottom strip with payment methods: **Credit Card**, **PayPal**, **Bank Transfer**, **Cryptocurrency**.
- Basic PWA setup with a manifest and service worker to allow offline loading.

---

## Development Checklist

- [ ] Verify the project renders in a browser via `python3 -m http.server`.
- [ ] Ensure the service worker registers and caches assets.
- [ ] Confirm the donate strip appears after clicking the Donate button.
- [ ] Confirm the wallet strip appears after clicking the Wallet button.

---

## How to run

1. Open a terminal in this workspace.
2. Run:

```bash
python3 -m http.server 8000
```

3. Open: `http://localhost:8000`

---

## Notes

- This project is intentionally minimal to keep the implementation lightweight and easy to modify.
- Replace the placeholder carousel images in `index.html` with your own assets.
