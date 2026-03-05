import { ref } from 'vue'

// Module-level so CartPanel can react to drag state
const isDragging = ref(false)
const isOverCart = ref(false)

export function useDragToCart() {
  // Call on touchstart — sets up the long-press drag gesture for one row
  function startDrag(e, product, addToCart) {
    const trEl = e.currentTarget
    const touch = e.changedTouches[0]
    const touchId = touch.identifier
    const startX = touch.clientX
    const startY = touch.clientY
    let activated = false
    let ghost = null

    function findTouch(touchList) {
      return Array.from(touchList).find(t => t.identifier === touchId)
    }

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

    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'

    function cleanup() {
      if (ghost) { ghost.remove(); ghost = null }
      isDragging.value = false
      isOverCart.value = false
      activated = false
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
      trEl.removeEventListener('touchmove', onMoveEarly)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }

    // 300ms hold activates drag
    const activationTimer = setTimeout(() => {
      activated = true
      isDragging.value = true
      ghost = createGhost(startX, startY)
      // Switch from element-level early-detection to document-level tracking
      trEl.removeEventListener('touchmove', onMoveEarly)
      document.addEventListener('touchmove', onMove, { passive: false })
    }, 300)

    // Before activation: cancel if finger moves > 8px (user is scrolling)
    function onMoveEarly(ev) {
      const t = findTouch(ev.changedTouches)
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.hypot(dx, dy) > 8) {
        clearTimeout(activationTimer)
        cleanup()
      }
    }

    // After activation: move ghost, detect cart overlap
    function onMove(ev) {
      const t = findTouch(ev.changedTouches)
      if (!t) return
      ev.preventDefault()
      if (ghost) ghost.style.transform = `translate(${t.clientX - 40}px,${t.clientY - 40}px)`
      isOverCart.value = t.clientX > window.innerWidth - 288
    }

    function onEnd(ev) {
      const t = findTouch(ev.changedTouches)
      if (!t) return
      clearTimeout(activationTimer)
      if (activated && isOverCart.value) addToCart()
      cleanup()
    }

    function onCancel() {
      clearTimeout(activationTimer)
      cleanup()
    }

    // Pre-activation: watch for scroll intent on the element (passive — don't block scroll)
    trEl.addEventListener('touchmove', onMoveEarly, { passive: true })
    // touchend/touchcancel on document from the start so a quick lift always cleans up
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onCancel)
  }

  return { isDragging, isOverCart, startDrag }
}
