/* DAPIN mobile drawer: delegated binding survives every DAPIN re-render. */
(() => {
  const close = () => {
    const shell = document.querySelector('.dapin-app');
    const sidebar = shell?.querySelector('.dapin-sidebar');
    if (!shell || !sidebar) return;
    sidebar.classList.remove('is-open');
    shell.classList.remove('dapin-menu-open');
  };

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-dapin-toggle]');
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      const shell = toggle.closest('.dapin-app');
      const sidebar = shell?.querySelector('.dapin-sidebar');
      if (!shell || !sidebar) return;
      const open = !sidebar.classList.contains('is-open');
      sidebar.classList.toggle('is-open', open);
      shell.classList.toggle('dapin-menu-open', open);
      return;
    }

    if (event.target.closest('.dapin-nav')) {
      setTimeout(close, 0);
      return;
    }

    if (event.target.closest('.dapin-sidebar') || event.target.closest('.dapin-mobile-head')) return;
  }, true);
})();
