document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-dapin-toggle]')
  if (!toggle) return

  const shell = toggle.closest('.dapin-app')
  if (!shell) return

  shell.classList.toggle('dapin-sidebar-open')
})

document.addEventListener('click', (event) => {
  const nav = event.target.closest('.dapin-nav')
  if (!nav) return
  nav.closest('.dapin-app')?.classList.remove('dapin-sidebar-open')
})
