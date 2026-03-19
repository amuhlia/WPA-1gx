#!/usr/bin/env python3
"""Small smoke test for current payment UI.

Checks that removed legacy wallet UI is absent and current Stripe/saved-card controls exist.
Run with:
  python3 scripts/ui_smoke_check.py
or:
  python3 scripts/ui_smoke_check.py http://localhost:8000
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8", errors="replace")


def check_absent(content: str, needles: list[str], label: str) -> list[str]:
    failures: list[str] = []
    for needle in needles:
        if needle in content:
            failures.append(f"[{label}] Unexpected match: {needle}")
    return failures


def check_present(content: str, needles: list[str], label: str) -> list[str]:
    failures: list[str] = []
    for needle in needles:
        if needle not in content:
            failures.append(f"[{label}] Missing expected content: {needle}")
    return failures


def main() -> int:
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    base_url = base_url.rstrip("/")

    index_url = f"{base_url}/index.html"
    js_url = f"{base_url}/main-v3.js"

    try:
        index_html = fetch_text(index_url)
        js_code = fetch_text(js_url)
    except urllib.error.URLError as exc:
        print(f"FAIL: Could not fetch app content from {base_url}: {exc}")
        print("Tip: start server with `python3 -m http.server 8000` and retry.")
        return 2

    index_must_exist = [
        'id="donateBtn"',
        'id="paymentModal"',
        'id="card-element"',
        'id="savedMethodsSection"',
        'id="saveCardForFuture"',
        'id="walletPaySection"',
    ]
    index_must_not_exist = [
        'id="walletBtn"',
        'id="walletStrip"',
        'Tarjeta de referencia',
        'id="cardModal"',
        'id="cardFormModal"',
        'id="activeCardInfo"',
        'id="toast"',
    ]

    js_must_exist = [
        "create-payment-intent",
        "stripe.confirmCardPayment",
        "create-customer",
        "list-payment-methods",
        "paymentRequest",
    ]
    js_must_not_exist = [
        "create-setup-intent",
        "detach-payment-method",
        "savedCards",
        "walletBtn",
        "cardModal",
        "cardFormModal",
    ]

    failures: list[str] = []
    failures.extend(check_present(index_html, index_must_exist, "index.html"))
    failures.extend(check_absent(index_html, index_must_not_exist, "index.html"))
    failures.extend(check_present(js_code, js_must_exist, "main-v3.js"))
    failures.extend(check_absent(js_code, js_must_not_exist, "main-v3.js"))

    if failures:
        print("FAIL: smoke check found issues")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("PASS: smoke check OK")
    print(f" - Checked: {index_url}")
    print(f" - Checked: {js_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
