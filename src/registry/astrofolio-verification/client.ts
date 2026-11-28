import { compareIdentifier, loadRegistry } from './checker';

const form = document.querySelector<HTMLFormElement>('#verify-form');
const input = document.querySelector<HTMLInputElement>('#verify-address');
const network = document.querySelector<HTMLSelectElement>('#verify-network');
const result = document.querySelector<HTMLDivElement>('#verify-result');
const submit = document.querySelector<HTMLButtonElement>('#verify-submit');

if (form && input && network && result && submit) {
  let attempt = 0;
  let controller: AbortController | undefined;
  const render = (state: string, text: string) => {
    result.dataset.state = state;
    result.replaceChildren();
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    result.append(paragraph);
  };
  const invalidate = () => {
    attempt += 1;
    controller?.abort();
    submit.disabled = false;
    render('idle', 'Ready to check this identifier and network.');
  };
  input.addEventListener('input', invalidate);
  network.addEventListener('change', invalidate);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    controller?.abort();
    controller = new AbortController();
    const currentAttempt = ++attempt;
    const identifier = input.value;
    const selectedNetwork = network.value;
    submit.disabled = true;
    render('loading', 'Fetching the published Registry…');
    try {
      const loaded = await loadRegistry({ expectedSha256: form.dataset.registrySha256 ?? '', signal: controller.signal });
      if (currentAttempt !== attempt) return;
      if (loaded.status !== 'ready') {
        render(loaded.status, loaded.message);
        return;
      }
      const comparison = compareIdentifier(identifier, selectedNetwork, loaded.registry);
      render(comparison.status, comparison.message);
      if (comparison.status === 'match' && comparison.record) {
        const { representation, displayName, sign } = comparison.record;
        const heading = document.createElement('strong');
        heading.textContent = `${displayName} · ${selectedNetwork === 'base' ? 'Base mainnet · 8453' : 'Solana mainnet'} · ${representation.kind}`;
        const address = document.createElement('code');
        address.textContent = representation.address;
        const recordLine = document.createElement('p');
        recordLine.append(address);
        const detail = document.createElement('p');
        detail.textContent = `Registry ${loaded.registry.version} fetched ${loaded.checkedAt}. Content agrees with this page’s source snapshot. This is a Registry comparison, not a live chain or safety check.`;
        const link = document.createElement('a');
        link.href = `/registry/${sign}/`;
        link.textContent = 'Open the Registry record →';
        result.prepend(heading);
        result.append(recordLine, detail, link);
      }
    } catch {
      if (currentAttempt === attempt) render('source-error', 'The Registry could not be checked. No result is established. Try again when the source is available.');
    } finally {
      if (currentAttempt === attempt) submit.disabled = false;
    }
  });
  document.querySelector<HTMLFieldSetElement>('#verify-fields')!.disabled = false;
  // No storage, query-string serialization, analytics event, or provider access.
  window.addEventListener('pagehide', () => { invalidate(); input.value = ''; });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-address]')) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const status = document.querySelector<HTMLElement>('#copy-status');
    try {
      await navigator.clipboard.writeText(button.dataset.copyAddress ?? '');
      if (status) status.textContent = 'Identifier copied. Keep its network with it when comparing.';
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    } catch {
      if (status) status.textContent = 'Copy was unavailable. Select and copy the full identifier shown beside this button.';
    }
  });
}
