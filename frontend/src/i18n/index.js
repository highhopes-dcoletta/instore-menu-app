import { createI18n } from 'vue-i18n'

import enNav from './en/nav.json'
import enGuided from './en/guided.json'
import enCart from './en/cart.json'
import enMessages from './en/messages.json'

import esNav from './es/nav.json'
import esGuided from './es/guided.json'
import esCart from './es/cart.json'
import esMessages from './es/messages.json'

import ptNav from './pt/nav.json'
import ptGuided from './pt/guided.json'
import ptCart from './pt/cart.json'
import ptMessages from './pt/messages.json'

function flatten(ns) {
  return { ...ns.nav, ...ns.guided, ...ns.cart, ...ns.messages }
}

// We prefix keys by namespace to avoid collisions:
// nav.home, guided.experience.question, cart.title, messages.loading
function nest(ns) {
  return {
    nav: ns.nav,
    guided: ns.guided,
    cart: ns.cart,
    msg: ns.messages,
  }
}

const savedLocale = localStorage.getItem('locale') || 'en'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en: nest({ nav: enNav, guided: enGuided, cart: enCart, messages: enMessages }),
    es: nest({ nav: esNav, guided: esGuided, cart: esCart, messages: esMessages }),
    pt: nest({ nav: ptNav, guided: ptGuided, cart: ptCart, messages: ptMessages }),
  },
})

export default i18n

export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
}
