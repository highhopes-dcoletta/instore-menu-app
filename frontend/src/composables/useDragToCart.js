import { ref } from 'vue'

// Module-level so CartPanel can react to drag state
const isDragging = ref(false)
const isOverCart = ref(false)

export function useDragToCart() {
  // Call on pointerdown — sets up the long-press drag gesture for one row
  function startDrag(e, product, addToCart) {
    const trEl = e.currentTarget
    const pointerId = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    let activated = false
    let ghost = null

    function createGhost(x, y) {
      const el = document.createElement('div')
      el.style.cssText = [
        'position:fixed', 'left:0', 'top:0',
        'pointer-events:none', 'z-index:9999',
        'display:flex', 'flex-direction:column', 'align-items:center', 'gap:6px',
        'opacity:0.85',
        `transform:translate(${x - 40}px,${y - 40}px)`,
      ].join(';')

      if (product.Image) {
        const img = document.createElement('img')
        img.src = product.Image
        img.style.cssText = 'width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3)'
        el.appendChild(img)
      } else {
        const circle = document.createElement('div')
        circle.style.cssText = 'width:80px;height:80px;border-radius:50%;background:#14b8a6;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3)'
        el.appendChild(circle)
      }

      const label = document.createElement('div')
      label.textContent = product.Name ?? ''
      label.style.cssText = 'font-size:12px;font-weight:600;color:white;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:12px;max-width:140px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
      el.appendChild(label)
      document.body.appendChild(el)
      return el
    }

    function cleanup() {
      if (ghost) { ghost.remove(); ghost = null }
      isDragging.value = false
      isOverCart.value = false
      activated = false
      document.body.style.touchAction = ''
      trEl.removeEventListener('pointermove', onMoveEarly)
      trEl.removeEventListener('pointermove', onMove)
      trEl.removeEventListener('pointerup', onUp)
      trEl.removeEventListener('pointercancel', onCancel)
    }

    // 300ms hold activates drag
    const activationTimer = setTimeout(() => {
      activated = true
      isDragging.value = true
      document.body.style.touchAction = 'none'
      trEl.setPointerCapture(pointerId)
      ghost = createGhost(startX, startY)
      trEl.removeEventListener('pointermove', onMoveEarly)
      trEl.addEventListener('pointermove', onMove, { passive: false })
    }, 300)

    // Before activation: cancel if finger moves > 8px (user is scrolling)
    function onMoveEarly(e) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.hypot(dx, dy) > 8) {
        clearTimeout(activationTimer)
        cleanup()
      }
    }

    // After activation: move ghost, detect cart overlap
    function onMove(e) {
      e.preventDefault()
      if (ghost) ghost.style.transform = `translate(${e.clientX - 40}px,${e.clientY - 40}px)`
      isOverCart.value = e.clientX > window.innerWidth - 288
    }

    function onUp() {
      clearTimeout(activationTimer)
      if (activated && isOverCart.value) addToCart()
      cleanup()
    }

    function onCancel() {
      clearTimeout(activationTimer)
      cleanup()
    }

    trEl.addEventListener('pointermove', onMoveEarly, { passive: false })
    trEl.addEventListener('pointerup', onUp)
    trEl.addEventListener('pointercancel', onCancel)
  }

  return { isDragging, isOverCart, startDrag }
}
