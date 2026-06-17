/**
 * Razorpay client-side helper.
 *
 * Loads the Razorpay checkout SDK lazily (idempotent — subsequent calls just
 * resolve immediately) and exposes a Promise-shaped openCheckout() that
 * resolves on success and rejects with a structured reason on dismissal or
 * payment failure.
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loaderPromise = null;

function loadScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('not_in_browser'));
  }
  if (window.Razorpay) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loaderPromise = null;
      reject(new Error('razorpay_script_failed'));
    };
    document.body.appendChild(s);
  });
  return loaderPromise;
}

/**
 * Open the Razorpay modal. Resolves with the payment details when the user
 * completes the flow; rejects with { code, message } if dismissed or failed.
 *
 * @param {Object} options
 *   key, amount, currency, orderId, name, description, themeColor?,
 *   prefill?: { name, email, contact }
 */
export async function openCheckout(options) {
  await loadScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: options.key,
      amount: options.amount,
      currency: options.currency || 'INR',
      order_id: options.orderId,
      name: options.name || 'VastuVerse',
      description: options.description || 'Plan unlock',
      image: options.image,
      prefill: options.prefill || {},
      notes: options.notes || {},
      theme: { color: options.themeColor || '#2E7D32' },
      modal: {
        ondismiss: () => reject({ code: 'dismissed', message: 'Payment cancelled' }),
        escape: true,
        backdropclose: false,
      },
      handler: (response) => {
        // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
        resolve(response);
      },
    });

    rzp.on('payment.failed', (resp) => {
      reject({
        code: 'failed',
        message: resp?.error?.description || 'Payment failed',
        razorpay: resp?.error,
      });
    });

    rzp.open();
  });
}

export default { openCheckout };
