let deferredPrompt = null;

const style = document.createElement('style');
style.textContent = `
  #finora-install-btn {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 99999;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 14px;
    padding: 11px 15px;
    background: #6d4aff;
    color: #fff;
    font: 700 13px/1 system-ui, sans-serif;
    box-shadow: 0 12px 32px rgba(0,0,0,.35);
    cursor: pointer;
    display: none;
  }
  #finora-install-btn:active { transform: translateY(1px); }
  @media (max-width: 640px) {
    #finora-install-btn { right: 14px; bottom: 14px; }
  }
`;
document.head.appendChild(style);

const installButton = document.createElement('button');
installButton.id = 'finora-install-btn';
installButton.type = 'button';
installButton.textContent = '＋ Instal FINORA';
document.body.appendChild(installButton);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.style.display = 'block';
});

installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installButton.style.display = 'none';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('FINORA PWA service worker registration failed:', error);
    });
  });
}
