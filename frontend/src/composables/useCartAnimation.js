import { ref, nextTick } from 'vue'

const toastTrigger = ref(0)

export function useCartAnimation() {
  async function fire(x, y) {
    await nextTick() // wait for cart counter to appear if this is the first item
    const target = document.querySelector('[data-cart-counter]')
    if (!target) return
    const rect = target.getBoundingClientRect()
    _launchBubble(x, y, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function fireToast() {
    toastTrigger.value++
  }

  return { toastTrigger, fire, fireToast }
}

function _launchBubble(sx, sy, ex, ey) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#14b8a6',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: '9999',
    willChange: 'transform, opacity',
  })
  el.textContent = '+'
  document.body.appendChild(el)

  // Arc control point: lifted above the midpoint of the path
  const cx = (sx + ex) / 2
  const cy = (sy + ey) / 2 - 80

  const duration = 680
  const start = performance.now()

  function frame(now) {
    const t = Math.min((now - start) / duration, 1)
    // Ease-in along the bezier parameter
    const e = t * t
    // Quadratic bezier position
    const bx = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * ex
    const by = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ey
    const scale = 1 - t * 0.85
    const opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4

    el.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -50%) scale(${scale})`
    el.style.opacity = String(opacity)

    if (t < 1) requestAnimationFrame(frame)
    else el.remove()
  }

  requestAnimationFrame(frame)
}
