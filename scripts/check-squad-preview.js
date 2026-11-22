// Run in the browser console on a league's Teams screen.
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const waitFor = (read) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;
    const timer = setInterval(() => {
      const value = read();
      if (value) { clearInterval(timer); resolve(value); }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('Preview check timed out')); }
    }, 50);
  });
  const image = () => document.querySelector('[role="dialog"] img[alt$=" squad poster"]');
  const trigger = Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Preview Posters');
  assert(trigger, 'Open a Teams screen with at least one team');
  let downloads = 0;
  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    if (blob.type === 'application/pdf') downloads++;
    return createObjectURL.call(URL, blob);
  };
  try {
    trigger.click();
    const first = await waitFor(() => image()?.complete && image().naturalWidth ? image() : null);
    assert(first.naturalWidth === 2520 && first.naturalHeight === 3564, 'Expected an A4 poster at approximately 300 DPI');
    const firstSrc = first.src;
    const next = document.querySelector('[aria-label="Next team"]');
    if (!next.disabled) {
      next.click();
      await waitFor(() => image()?.src !== firstSrc && image()?.complete && image()?.naturalWidth);
      document.querySelector('[aria-label="Previous team"]').click();
      await waitFor(() => image()?.src === firstSrc);
    }
    assert(downloads === 0, 'Preview must not trigger a PDF download');
    document.querySelector('[data-slot="dialog-close"]').click();
    await waitFor(() => !image());
    console.log('Squad poster preview check passed');
  } finally {
    URL.createObjectURL = createObjectURL;
  }
})();
