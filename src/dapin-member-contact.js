const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]))

function normalizeWhatsApp(value) {
  let v = String(value ?? '').replace(/\D/g, '')
  if (!v) return ''
  if (v.startsWith('62')) return v
  if (v.startsWith('0')) return `62${v.slice(1)}`
  return v
}

function enhanceMembers() {
  document.querySelectorAll('.dapin-member-list .member-row').forEach((row) => {
    if (row.dataset.waEnhanced === '1') return

    const name = row.querySelector('.member-main strong')?.textContent?.trim() || 'Anggota DAPIN'
    const code = row.querySelector('.member-main small')?.textContent?.match(/^(DAP-MBR-\d{6}|\S+)/)?.[1] || ''
    const phoneNode = row.querySelector('.member-meta > span:first-child')
    const phone = phoneNode?.textContent?.trim() || ''
    const normalized = normalizeWhatsApp(phone)

    const phoneWrap = document.createElement('span')
    phoneWrap.className = `dapin-wa-wrap${normalized ? '' : ' is-empty'}`

    if (normalized) {
      const message = `Halo ${name}, kami dari DAPIN Balongbendo. Ini menghubungi terkait data keanggotaan ${code}.`
      phoneWrap.innerHTML = `<a class="dapin-wa-link" href="https://wa.me/${esc(normalized)}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer" aria-label="Kirim WhatsApp ke ${esc(name)}">${esc(phone)}</a>`
    } else {
      phoneWrap.textContent = phone || 'Nomor WA belum ada'
    }

    phoneNode?.replaceWith(phoneWrap)
    row.dataset.waEnhanced = '1'
  })
}

function installStyle() {
  if (document.getElementById('dapin-member-contact-style')) return
  const style = document.createElement('style')
  style.id = 'dapin-member-contact-style'
  style.textContent = `.dapin-wa-wrap{display:inline-flex;align-items:center}.dapin-wa-link{color:#68e0b0;text-decoration:none;font-weight:700;transition:opacity .15s ease}.dapin-wa-link:hover{opacity:.8;text-decoration:underline}.dapin-wa-wrap.is-empty{color:#778398}.member-main small{overflow-wrap:anywhere}`
  document.head.appendChild(style)
}

installStyle()
enhanceMembers()
new MutationObserver(enhanceMembers).observe(document.documentElement, { childList: true, subtree: true })
