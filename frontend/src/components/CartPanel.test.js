import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'

// ── Dependency mocks ──────────────────────────────────────────────────────────

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/composables/useCartAnimation', () => ({
  useCartAnimation: () => ({
    dismissToast: vi.fn(),
    fireToast: vi.fn(),
    fire: vi.fn(),
    BUBBLE_DURATION: 0,
  }),
}))

vi.mock('@/composables/useDragToCart', () => ({
  useDragToCart: () => ({
    isDragging: { value: false },
    isOverCart: { value: false },
  }),
}))

vi.mock('qrcode', () => ({
  default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/utils/quotaCalc', () => ({
  calcQuota: () => ({ usedGrams: 3.5, pct: 0.125, overLimit: false }),
}))

vi.mock('@/stores/session', () => ({
  useSessionStore: () => ({
    selections: {
      'sku-1': { name: 'Test Flower', qty: 1, price: 20, unitWeight: '3.5g', image: null },
    },
    sessionId: 'test-session',
    selectionCount: 1,
    updateQuantity: vi.fn(),
    submitOrder: vi.fn(),
    restoreSession: vi.fn(),
  }),
}))

// Canvas stubs needed for QR code generation
global.URL.createObjectURL = vi.fn(() => 'blob:mock')
global.URL.revokeObjectURL = vi.fn()
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillStyle: '',
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  drawImage: vi.fn(),
}))
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')

// ── Tests ─────────────────────────────────────────────────────────────────────

import CartPanel from './CartPanel.vue'

describe('CartPanel — totals positioning', () => {
  it('quota bar and totals are inside the same scroll container as the items list', () => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { cart: { title: 'Your Cart', dropToAdd: 'Drop to add', empty: 'Cart is empty', sendToBudtender: 'Send to Budtender', sending: 'Sending…', overLimitTitle: 'Over Daily Limit', overLimitMessage: 'Your cart exceeds the 28g daily limit. A budtender will assist you.', dailyLimit: 'Daily limit', dailyLimitReached: 'Daily limit reached', or: 'or', copyToPhone: 'Copy your cart to your phone!', beforeTax: 'before tax', dealPrice: 'deal price', afterTax: 'after tax (20%)', crossSell: 'You might also like', addMore: 'Add {n} more for', orderSubmitted: 'Order submitted', orderSentMessage: 'Please give your order number to the budtender!', returningToMenu: 'Returning to menu in {n}…', startNewOrder: 'Start a new order!', goBackToPrevious: 'Go Back to Previous Order', orderSent: 'Your order has been sent!', budtenderCallNumber: 'A budtender will call your number shortly.', reminderToast: "When you're done, tap Send to Budtender", outOfStock: 'Removed from cart (out of stock): {items}' } } } })
    const wrapper = mount(CartPanel, { global: { plugins: [createPinia(), i18n] } })

    // The scroll container wraps items + quota + totals
    const scrollContainer = wrapper.find('.overflow-y-auto')
    expect(scrollContainer.exists()).toBe(true)

    // Items list is inside the scroll container
    expect(scrollContainer.find('[data-cart-list]').exists()).toBe(true)

    // Quota bar label is inside the scroll container
    const dailyLimitLabel = scrollContainer.findAll('span').find(s => s.text() === 'Daily limit')
    expect(dailyLimitLabel).toBeTruthy()

    // Totals are inside the scroll container
    const afterTax = scrollContainer.findAll('span').find(s => s.text().includes('after tax'))
    expect(afterTax).toBeTruthy()
  })

  it('quota bar and totals are NOT siblings of the scroll container at panel level', () => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { cart: { title: 'Your Cart', dropToAdd: 'Drop to add', empty: 'Cart is empty', sendToBudtender: 'Send to Budtender', sending: 'Sending…', overLimitTitle: 'Over Daily Limit', overLimitMessage: 'Your cart exceeds the 28g daily limit. A budtender will assist you.', dailyLimit: 'Daily limit', dailyLimitReached: 'Daily limit reached', or: 'or', copyToPhone: 'Copy your cart to your phone!', beforeTax: 'before tax', dealPrice: 'deal price', afterTax: 'after tax (20%)', crossSell: 'You might also like', addMore: 'Add {n} more for', orderSubmitted: 'Order submitted', orderSentMessage: 'Please give your order number to the budtender!', returningToMenu: 'Returning to menu in {n}…', startNewOrder: 'Start a new order!', goBackToPrevious: 'Go Back to Previous Order', orderSent: 'Your order has been sent!', budtenderCallNumber: 'A budtender will call your number shortly.', reminderToast: "When you're done, tap Send to Budtender", outOfStock: 'Removed from cart (out of stock): {items}' } } } })
    const wrapper = mount(CartPanel, { global: { plugins: [createPinia(), i18n] } })

    const scrollContainer = wrapper.find('.overflow-y-auto')
    const panelEl = scrollContainer.element.parentElement

    // Siblings of the scroll container should not contain quota or totals text
    const siblingText = [...panelEl.children]
      .filter(el => el !== scrollContainer.element)
      .map(el => el.textContent)
      .join(' ')

    expect(siblingText).not.toContain('Daily limit')
    expect(siblingText).not.toContain('after tax')
  })
})
