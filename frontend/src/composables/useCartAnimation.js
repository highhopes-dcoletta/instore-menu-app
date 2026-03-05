import { ref, nextTick } from 'vue'

const toastTrigger = ref(0)
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer = null

export function useCartAnimation() {
  async function fire(x, y, imageUrl, destX, destY) {
    if (destX == null || destY == null) {
      await nextTick()
      const target = document.querySelector('[data-cart-counter]')
      if (!target) return
      const rect = target.getBoundingClientRect()
      destX = rect.left + rect.width / 2
      destY = rect.top + rect.height / 2
    }
    _launchBubble(x, y, destX, destY, imageUrl)
  }

  function fireToast(message = 'You just started a shopping cart!') {
    toastMessage.value = message
    clearTimeout(toastTimer)
    toastVisible.value = true
    toastTimer = setTimeout(() => (toastVisible.value = false), 3500)
  }

  function dismissToast() {
    clearTimeout(toastTimer)
    toastVisible.value = false
  }

  return { toastTrigger, toastVisible, toastMessage, fire, fireToast, dismissToast, BUBBLE_DURATION: 1600 }
}

function _launchBubble(sx, sy, ex, ey, imageUrl) {
  const size = imageUrl ? '180px' : '28px'
  let el
  if (imageUrl) {
    el = document.createElement('img')
    el.src = imageUrl
    Object.assign(el.style, {
      objectFit: 'cover',
      background: 'white',
      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
    })
  } else {
    el = document.createElement('div')
    Object.assign(el.style, {
      background: '#14b8a6',
      color: 'white',
      fontSize: '16px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    })
    el.textContent = '+'
  }
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: size,
    height: size,
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: '9999',
    willChange: 'transform, opacity',
  })
  document.body.appendChild(el)

  // Phase 1: click → screen center (expand, ease-out)
  // Pause at center
  // Phase 2: screen center → cart (shrink + fade, ease-in)
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2

  const P1 = 700   // ms: travel to center, growing to full size
  const REST = 250 // ms: hold at full size at center
  const P2 = 650   // ms: travel to cart, shrink + fade

  const start = performance.now()

  function frame(now) {
    const elapsed = now - start
    let x, y, scale, opacity

    if (elapsed < P1) {
      // ease-out cubic: travel to center, grow from small to full
      const t = elapsed / P1
      const e = 1 - Math.pow(1 - t, 3)
      x = sx + (midX - sx) * e
      y = sy + (midY - sy) * e
      scale = 0.2 + 0.8 * e
      opacity = 1
    } else if (elapsed < P1 + REST) {
      x = midX
      y = midY
      scale = 1
      opacity = 1
    } else if (elapsed < P1 + REST + P2) {
      // ease-in cubic: slow start from center, fast into cart
      const t = (elapsed - P1 - REST) / P2
      const e = t * t * t
      x = midX + (ex - midX) * e
      y = midY + (ey - midY) * e
      scale = 1 - 0.8 * e
      opacity = 1
    } else {
      el.remove()
      return
    }

    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`
    el.style.opacity = String(opacity)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
