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

  return { toastTrigger, toastVisible, toastMessage, fire, fireToast, dismissToast, BUBBLE_DURATION: 1800 }
}

function _launchBubble(sx, sy, ex, ey, imageUrl) {
  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '0', top: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    willChange: 'transform, opacity',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  })

  // Passenger: product image or + bubble, sits on top of the airplane
  const passenger = document.createElement(imageUrl ? 'img' : 'div')
  if (imageUrl) {
    passenger.src = imageUrl
    Object.assign(passenger.style, {
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2.5px solid white',
      boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    })
  } else {
    passenger.textContent = '+'
    Object.assign(passenger.style, {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: '#14b8a6',
      color: 'white',
      fontSize: '18px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    })
  }

  const plane = document.createElement('div')
  plane.textContent = '✈️'
  Object.assign(plane.style, {
    fontSize: '52px',
    lineHeight: '1',
    marginTop: '-10px',
  })

  wrapper.appendChild(passenger)
  wrapper.appendChild(plane)
  document.body.appendChild(wrapper)

  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2

  // Phase timings
  const P1   = 600   // ms: click → screen center
  const LOOP = 600   // ms: one full loop-de-loop
  const P2   = 600   // ms: center → cart

  // Loop-de-loop: circle centered directly above midpoint, radius R.
  // Entry/exit point is (midX, midY) at the bottom of the circle.
  // Clockwise in screen coords: right → top → left → bottom.
  // θ starts at π/2 (bottom) and decreases by 2π over LOOP ms.
  const R = 80 // px

  // Heading for a clockwise circle traversal at angle θ:
  // tangent direction = (sin θ, -cos θ), so heading = atan2(-cos θ, sin θ)
  function loopPos(t) {
    const theta = Math.PI / 2 - 2 * Math.PI * t
    return {
      x: midX + R * Math.cos(theta),
      y: (midY - R) + R * Math.sin(theta),
      angle: Math.atan2(-Math.cos(theta), Math.sin(theta)) * 180 / Math.PI,
    }
  }

  function travelAngle(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax) * 180 / Math.PI
  }

  function lerpAngle(a, b, t) {
    const diff = ((b - a + 540) % 360) - 180
    return a + diff * t
  }

  const d1 = travelAngle(sx, sy, midX, midY)
  const d2 = travelAngle(midX, midY, ex, ey)
  const loopEntryAngle = loopPos(0).angle // ~0° (pointing right)

  const start = performance.now()

  function frame(now) {
    const elapsed = now - start
    let x, y, angle, scale, opacity

    if (elapsed < P1) {
      // Ease-out cubic: fly to center
      const t = elapsed / P1
      const e = 1 - Math.pow(1 - t, 3)
      x = sx + (midX - sx) * e
      y = sy + (midY - sy) * e
      // Smoothly rotate from travel direction toward loop entry angle in last 30% of phase
      const rotT = Math.max(0, (t - 0.7) / 0.3)
      angle = lerpAngle(d1, loopEntryAngle, rotT)
      scale = 0.25 + 0.75 * e
      opacity = 1
    } else if (elapsed < P1 + LOOP) {
      // Loop-de-loop: trace a circle above midpoint
      const t = (elapsed - P1) / LOOP
      const pos = loopPos(t)
      x = pos.x
      y = pos.y
      angle = pos.angle
      scale = 1
      opacity = 1
    } else if (elapsed < P1 + LOOP + P2) {
      // Ease-in cubic: shrink and fly into cart
      const t = (elapsed - P1 - LOOP) / P2
      const e = t * t * t
      x = midX + (ex - midX) * e
      y = midY + (ey - midY) * e
      // Rotate from loop exit angle toward destination in first 20%
      const rotT = Math.min(1, t / 0.2)
      angle = lerpAngle(loopEntryAngle, d2, rotT)
      scale = 1 - 0.75 * e
      opacity = 1
    } else {
      wrapper.remove()
      return
    }

    wrapper.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}deg) scale(${scale})`
    wrapper.style.opacity = String(opacity)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
