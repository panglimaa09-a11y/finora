import { supabase } from './main.js'

const app = document.getElementById('app')
let mode = 'signin'

function renderEmailAuth() {
  if (!app || !supabase || !app.querySelector('.auth-card')) return
  const card = app.querySelector('.auth-card')
  if (card.querySelector('[data-email-auth]')) return

  const panel = document.createElement('div')
  panel.dataset.emailAuth = '1'
  panel.className = 'email-auth-panel'
  panel.innerHTML = `
    <div class="email-auth-divider"><span>Email anggota</span></div>
    <div class="email-auth-note">Anggota DAPIN mendaftar sendiri memakai email yang terdaftar pada data keanggotaan. Setelah berhasil login, akun akan dihubungkan otomatis.</div>
    <form data-email-form class="email-auth-form" novalidate>
      <label ${mode === 'signin' ? 'hidden' : ''}>Nama Lengkap
        <input name="name" autocomplete="name" placeholder="Nama lengkap">
      </label>
      <label>Email
        <input name="email" type="email" autocomplete="email" required placeholder="nama@email.com">
      </label>
      <label>Password
        <input name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="Minimal 8 karakter">
      </label>
      <label class="email-auth-confirm" ${mode === 'signin' ? 'hidden' : ''}>Konfirmasi Password
        <input name="confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Ulangi password">
      </label>
      <div class="email-auth-message" data-email-message role="status"></div>
      <button class="email-auth-submit" type="submit" data-email-submit>${mode === 'signin' ? 'Masuk dengan Email' : 'Daftar Akun Anggota'}</button>
    </form>
    <div class="email-auth-links">
      ${mode === 'signin' ? '<button type="button" data-email-mode="signup">Belum punya akun? Daftar</button><button type="button" data-email-forgot>Lupa password?</button>' : '<button type="button" data-email-mode="signin">Sudah punya akun? Masuk</button>'}
    </div>
  `
  card.appendChild(panel)

  panel.querySelector('[data-email-form]').addEventListener('submit', submitEmailAuth)
  panel.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-email-mode]')
    if (modeButton) {
      mode = modeButton.dataset.emailMode
      panel.remove()
      renderEmailAuth()
      return
    }
    const forgot = event.target.closest('[data-email-forgot]')
    if (forgot) forgotPassword()
  })
  injectStyle()
}

async function submitEmailAuth(event) {
  event.preventDefault()
  const form = event.currentTarget
  const message = form.querySelector('[data-email-message]')
  const submit = form.querySelector('[data-email-submit]')
  const data = new FormData(form)
  const email = String(data.get('email') || '').trim().toLowerCase()
  const password = String(data.get('password') || '')
  const name = String(data.get('name') || '').trim()
  const confirm = String(data.get('confirm') || '')

  const show = (text, error = false) => {
    message.textContent = text
    message.className = `email-auth-message ${error ? 'error' : 'success'}`
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return show('Masukkan email yang valid.', true)
  if (password.length < 8) return show('Password minimal 8 karakter.', true)
  if (mode === 'signup' && password !== confirm) return show('Konfirmasi password tidak cocok.', true)

  submit.disabled = true
  submit.textContent = mode === 'signup' ? 'Mendaftarkan…' : 'Memproses…'

  try {
    if (mode === 'signup') {
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name || email.split('@')[0] } },
      })
      if (error) throw error

      if (result.session) {
        show('Pendaftaran berhasil. Menghubungkan akun ke DAPIN…')
        return
      }

      show('Pendaftaran berhasil. Cek email untuk verifikasi, lalu login menggunakan email dan password tersebut.')
      form.reset()
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      show('Login berhasil. Akun DAPIN akan dicek otomatis…')
    }
  } catch (error) {
    show(error?.message || 'Autentikasi gagal.', true)
  } finally {
    submit.disabled = false
    submit.textContent = mode === 'signup' ? 'Daftar Akun Anggota' : 'Masuk dengan Email'
  }
}

async function forgotPassword() {
  const email = window.prompt('Masukkan email untuk reset password:')
  if (!email) return
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    })
    if (error) throw error
    window.alert('Link reset password sudah dikirim ke email tersebut jika tersedia.')
  } catch (error) {
    window.alert(error?.message || 'Gagal mengirim reset password.')
  }
}

function injectStyle() {
  if (document.getElementById('email-auth-style')) return
  const style = document.createElement('style')
  style.id = 'email-auth-style'
  style.textContent = `
    .email-auth-panel{margin-top:18px}.email-auth-divider{display:flex;align-items:center;gap:10px;margin:15px 0 8px;color:#718097;font-size:11px}.email-auth-divider:before,.email-auth-divider:after{content:'';height:1px;background:#233148;flex:1}.email-auth-note{margin:0 0 14px;color:#8492a7;font-size:10px;line-height:1.55}.email-auth-form{display:grid;gap:11px}.email-auth-form label{display:grid;gap:6px;color:#97a5b8;font-size:10px;font-weight:700}.email-auth-form input{width:100%;box-sizing:border-box;border:1px solid #293a55;background:#101925;color:#edf2f8;border-radius:10px;padding:11px 12px;outline:none;font-size:12px}.email-auth-form input:focus{border-color:#7464c9;box-shadow:0 0 0 3px rgba(116,100,201,.12)}.email-auth-submit{border:0;border-radius:10px;padding:11px 12px;background:#6956bd;color:#fff;font-weight:800;cursor:pointer}.email-auth-submit:disabled{opacity:.6;cursor:not-allowed}.email-auth-message{min-height:16px;font-size:10px;line-height:1.45}.email-auth-message.error{color:#f0a4a4}.email-auth-message.success{color:#72d9aa}.email-auth-links{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px}.email-auth-links button{border:0;background:transparent;color:#9eaafc;padding:2px 0;cursor:pointer;font-size:10px}
  `
  document.head.appendChild(style)
}

const observer = new MutationObserver(() => {
  if (app?.querySelector('.auth-card') && !app.querySelector('[data-email-auth]')) renderEmailAuth()
})
observer.observe(app, { childList: true, subtree: true })

renderEmailAuth()
