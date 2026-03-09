import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import FlowerView from '@/views/FlowerView.vue'
import PreRollsView from '@/views/PreRollsView.vue'
import EdiblesView from '@/views/EdiblesView.vue'
import VapesView from '@/views/VapesView.vue'
import DabsView from '@/views/DabsView.vue'
import TincturesTopicalsView from '@/views/TincturesTopicalsView.vue'
import SleepView from '@/views/SleepView.vue'
import PainView from '@/views/PainView.vue'
import BudtenderView from '@/views/BudtenderView.vue'
import AnalyticsView from '@/views/AnalyticsView.vue'
import CartShareView from '@/views/CartShareView.vue'
import GuidedView from '@/views/GuidedView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/guide', component: GuidedView },
    { path: '/flower', component: FlowerView },
    { path: '/pre-rolls', component: PreRollsView },
    { path: '/edibles', component: EdiblesView },
    { path: '/vapes', component: VapesView },
    { path: '/concentrates', component: DabsView },
    { path: '/tinctures-and-topicals', component: TincturesTopicalsView },
    { path: '/sleep', component: SleepView },
    { path: '/pain', component: PainView },
    { path: '/budtender', component: BudtenderView },
    { path: '/analytics', component: AnalyticsView },
    { path: '/cart/:sessionId', component: CartShareView },
  ],
})

export default router
