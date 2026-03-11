<script setup>
import { ref, computed, watch } from 'vue'
import { buildMatchFn } from '@/utils/matchCriteria'

const props = defineProps({
  bundle: { type: Object, default: null },  // null = create mode
  products: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'cancel'])

const isNew = computed(() => !props.bundle)

// ── Form state ──────────────────────────────────────────────────────────────

const id = ref(props.bundle?.id ?? '')
const label = ref(props.bundle?.label ?? '')
const type = ref(props.bundle?.type ?? 'quantity')
const group = ref(props.bundle?.group ?? '')
const displayCategory = ref(props.bundle?.displayCategory ?? '')
const quantity = ref(props.bundle?.quantity ?? 2)
const bundlePrice = ref(props.bundle?.bundlePrice ?? 0)
const unitPrice = ref(props.bundle?.unitPrice ?? 0)
const sortOrder = ref(props.bundle?.sortOrder ?? 0)
const enabled = ref(props.bundle?.enabled ?? true)

// Schedule
const scheduleDays = ref(props.bundle?.scheduleDays ? [...props.bundle.scheduleDays] : [])
const scheduleDates = ref(props.bundle?.scheduleDates ? [...props.bundle.scheduleDates] : [])
const scheduleDateInput = ref('')

// Match criteria
const criteria = ref({
  nameContains: props.bundle?.matchCriteria?.nameContains ? [...props.bundle.matchCriteria.nameContains] : [],
  nameContainsAll: props.bundle?.matchCriteria?.nameContainsAll ? [...props.bundle.matchCriteria.nameContainsAll] : [],
  nameExcludes: props.bundle?.matchCriteria?.nameExcludes ? [...props.bundle.matchCriteria.nameExcludes] : [],
  subcategoryEquals: props.bundle?.matchCriteria?.subcategoryEquals ?? '',
  subcategoryNotEquals: props.bundle?.matchCriteria?.subcategoryNotEquals ?? '',
  unitWeightContains: props.bundle?.matchCriteria?.unitWeightContains ? [...props.bundle.matchCriteria.unitWeightContains] : [],
})

// Tag inputs
const nameContainsInput = ref('')
const nameContainsAllInput = ref('')
const nameExcludesInput = ref('')
const unitWeightInput = ref('')

function addNameContains() {
  const val = nameContainsInput.value.trim()
  if (val && !criteria.value.nameContains.includes(val)) criteria.value.nameContains.push(val)
  nameContainsInput.value = ''
}
function addNameContainsAll() {
  const val = nameContainsAllInput.value.trim()
  if (val && !criteria.value.nameContainsAll.includes(val)) criteria.value.nameContainsAll.push(val)
  nameContainsAllInput.value = ''
}
function addNameExcludes() {
  const val = nameExcludesInput.value.trim()
  if (val && !criteria.value.nameExcludes.includes(val)) criteria.value.nameExcludes.push(val)
  nameExcludesInput.value = ''
}
function addUnitWeight() {
  const val = unitWeightInput.value.trim()
  if (val && !criteria.value.unitWeightContains.includes(val)) criteria.value.unitWeightContains.push(val)
  unitWeightInput.value = ''
}

function removeTag(list, index) {
  list.splice(index, 1)
}

function addScheduleDate() {
  const n = parseInt(scheduleDateInput.value)
  if (n >= 1 && n <= 31 && !scheduleDates.value.includes(n)) {
    scheduleDates.value.push(n)
    scheduleDates.value.sort((a, b) => a - b)
  }
  scheduleDateInput.value = ''
}

function toggleDay(day) {
  const idx = scheduleDays.value.indexOf(day)
  if (idx >= 0) scheduleDays.value.splice(idx, 1)
  else scheduleDays.value.push(day)
}

// ── Live preview ────────────────────────────────────────────────────────────

const matchingProducts = computed(() => {
  const cleaned = cleanCriteria()
  if (!Object.keys(cleaned).length) return []
  const fn = buildMatchFn(cleaned)
  return props.products.filter(p => fn({
    name: p.Name,
    category: p.Category,
    subcategory: p.Subcategory ?? '',
    unitWeight: p['Unit Weight'] ?? '',
    price: p.Price ?? 0,
    qty: 1,
  }))
})

// ── Auto-generate ID from label ─────────────────────────────────────────────

watch(label, (val) => {
  if (isNew.value) {
    id.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
})

// ── Save ────────────────────────────────────────────────────────────────────

const saveError = ref('')

function cleanCriteria() {
  const c = {}
  if (criteria.value.nameContains.length) c.nameContains = criteria.value.nameContains
  if (criteria.value.nameContainsAll.length) c.nameContainsAll = criteria.value.nameContainsAll
  if (criteria.value.nameExcludes.length) c.nameExcludes = criteria.value.nameExcludes
  if (criteria.value.subcategoryEquals) c.subcategoryEquals = criteria.value.subcategoryEquals
  if (criteria.value.subcategoryNotEquals) c.subcategoryNotEquals = criteria.value.subcategoryNotEquals
  if (criteria.value.unitWeightContains.length) c.unitWeightContains = criteria.value.unitWeightContains
  return c
}

async function handleSubmit() {
  saveError.value = ''
  if (!id.value.trim()) { saveError.value = 'ID is required'; return }
  if (!label.value.trim()) { saveError.value = 'Label is required'; return }

  const data = {
    id: id.value.trim(),
    label: label.value.trim(),
    type: type.value,
    group: group.value.trim() || null,
    displayCategory: displayCategory.value || null,
    quantity: type.value === 'quantity' ? quantity.value : null,
    bundlePrice: type.value === 'quantity' ? bundlePrice.value : null,
    unitPrice: type.value === 'timed' ? unitPrice.value : null,
    scheduleDays: scheduleDays.value.length ? scheduleDays.value : null,
    scheduleDates: scheduleDates.value.length ? scheduleDates.value : null,
    matchCriteria: cleanCriteria(),
    sortOrder: sortOrder.value,
    enabled: enabled.value,
  }

  try {
    await emit('save', data)
  } catch (e) {
    saveError.value = e.message
  }
}

const DAY_LABELS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const CATEGORIES = ['Flower', 'Pre-Rolls', 'Edibles', 'Vapes', 'Dabs']

const SUBCATEGORIES = [
  'DRINKS', 'SINGLES', 'PACKS', 'CARTRIDGES', 'DISPOSABLES',
  'FLOWER', 'PRE_ROLLS', 'EDIBLES', 'CONCENTRATES',
  'TINCTURES', 'TOPICALS', 'TABLETS', 'CHOCOLATES', 'GUMMIES',
]
</script>

<template>
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" @click.stop>
    <h2 class="text-xl font-black mb-6">{{ isNew ? 'New Bundle' : 'Edit Bundle' }}</h2>

    <form @submit.prevent="handleSubmit" class="space-y-5">

      <!-- Label + ID -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Label</label>
          <input v-model="label" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Any 4 Drinks — $20" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">ID</label>
          <input v-model="id" :disabled="!isNew" class="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400" />
        </div>
      </div>

      <!-- Type + Display Category -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Type</label>
          <div class="flex gap-2">
            <button type="button" @click="type = 'quantity'"
              :class="['px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors', type === 'quantity' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500']"
            >Quantity</button>
            <button type="button" @click="type = 'timed'"
              :class="['px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors', type === 'timed' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'border-gray-200 text-gray-500']"
            >Timed</button>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Display Category</label>
          <select v-model="displayCategory" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">None</option>
            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <!-- Pricing -->
      <div class="grid grid-cols-3 gap-4">
        <div v-if="type === 'quantity'">
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Quantity</label>
          <input v-model.number="quantity" type="number" min="1" class="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div v-if="type === 'quantity'">
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Bundle Price ($)</label>
          <input v-model.number="bundlePrice" type="number" min="0" step="0.01" class="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div v-if="type === 'timed'">
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Unit Price ($)</label>
          <input v-model.number="unitPrice" type="number" min="0" step="0.01" class="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Group</label>
          <input v-model="group" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional group name" />
        </div>
      </div>

      <!-- Schedule -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Schedule (leave empty for always-on)</label>
        <div class="flex flex-wrap gap-1.5 mb-2">
          <button
            v-for="d in DAY_LABELS" :key="d.value" type="button"
            @click="toggleDay(d.value)"
            :class="['px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
              scheduleDays.includes(d.value) ? 'bg-teal-100 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-400']"
          >{{ d.label }}</button>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="scheduleDateInput" type="number" min="1" max="31" placeholder="Day of month" class="w-32 border rounded-lg px-3 py-1.5 text-sm" @keydown.enter.prevent="addScheduleDate" />
          <button type="button" @click="addScheduleDate" class="text-xs font-semibold text-teal-600">Add</button>
          <div class="flex gap-1">
            <span v-for="(d, i) in scheduleDates" :key="d" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-100 text-teal-700 text-xs font-semibold">
              {{ d }}
              <button type="button" @click="removeTag(scheduleDates, i)" class="text-teal-400 hover:text-teal-600">×</button>
            </span>
          </div>
        </div>
      </div>

      <!-- Match Criteria -->
      <div class="border-t pt-5">
        <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Match Criteria</label>

        <!-- Name contains -->
        <div class="mb-3">
          <label class="block text-xs text-gray-500 mb-1">Product name must contain at least one of:</label>
          <div class="flex items-center gap-2 mb-1">
            <input v-model="nameContainsInput" class="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. juicy stickz" @keydown.enter.prevent="addNameContains()" />
            <button type="button" @click="addNameContains()" class="text-xs font-semibold text-teal-600">Add</button>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="(tag, i) in criteria.nameContains" :key="tag" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">
              {{ tag }}
              <button type="button" @click="removeTag(criteria.nameContains, i)" class="text-blue-400 hover:text-blue-600">×</button>
            </span>
          </div>
        </div>

        <!-- Name contains ALL -->
        <div class="mb-3">
          <label class="block text-xs text-gray-500 mb-1">Product name must contain ALL of:</label>
          <div class="flex items-center gap-2 mb-1">
            <input v-model="nameContainsAllInput" class="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. mac" @keydown.enter.prevent="addNameContainsAll()" />
            <button type="button" @click="addNameContainsAll()" class="text-xs font-semibold text-teal-600">Add</button>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="(tag, i) in criteria.nameContainsAll" :key="tag" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-semibold">
              {{ tag }}
              <button type="button" @click="removeTag(criteria.nameContainsAll, i)" class="text-indigo-400 hover:text-indigo-600">×</button>
            </span>
          </div>
        </div>

        <!-- Name excludes -->
        <div class="mb-3">
          <label class="block text-xs text-gray-500 mb-1">Product name must NOT contain any of:</label>
          <div class="flex items-center gap-2 mb-1">
            <input v-model="nameExcludesInput" class="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. cloud bar" @keydown.enter.prevent="addNameExcludes()" />
            <button type="button" @click="addNameExcludes()" class="text-xs font-semibold text-teal-600">Add</button>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="(tag, i) in criteria.nameExcludes" :key="tag" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">
              {{ tag }}
              <button type="button" @click="removeTag(criteria.nameExcludes, i)" class="text-red-400 hover:text-red-600">×</button>
            </span>
          </div>
        </div>

        <!-- Subcategory -->
        <div class="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Subcategory must equal:</label>
            <select v-model="criteria.subcategoryEquals" class="w-full border rounded-lg px-3 py-1.5 text-sm">
              <option value="">Any</option>
              <option v-for="s in SUBCATEGORIES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Subcategory must NOT equal:</label>
            <select v-model="criteria.subcategoryNotEquals" class="w-full border rounded-lg px-3 py-1.5 text-sm">
              <option value="">None</option>
              <option v-for="s in SUBCATEGORIES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>

        <!-- Unit weight -->
        <div class="mb-3">
          <label class="block text-xs text-gray-500 mb-1">Unit weight must contain at least one of:</label>
          <div class="flex items-center gap-2 mb-1">
            <input v-model="unitWeightInput" class="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. 1g" @keydown.enter.prevent="addUnitWeight()" />
            <button type="button" @click="addUnitWeight()" class="text-xs font-semibold text-teal-600">Add</button>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="(tag, i) in criteria.unitWeightContains" :key="tag" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">
              {{ tag }}
              <button type="button" @click="removeTag(criteria.unitWeightContains, i)" class="text-green-400 hover:text-green-600">×</button>
            </span>
          </div>
        </div>
      </div>

      <!-- Live preview -->
      <div class="border-t pt-4">
        <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
          Matching Products
          <span class="ml-1 text-teal-600">({{ matchingProducts.length }})</span>
        </p>
        <div v-if="matchingProducts.length === 0" class="text-xs text-gray-400">
          No products match the current criteria.
        </div>
        <div v-else class="flex flex-wrap gap-1">
          <span v-for="p in matchingProducts.slice(0, 8)" :key="p.id" class="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
            {{ p.Name }}
          </span>
          <span v-if="matchingProducts.length > 8" class="px-2 py-0.5 text-gray-400 text-xs">
            + {{ matchingProducts.length - 8 }} more
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="saveError" class="text-sm text-red-600 font-semibold">{{ saveError }}</div>
      <div class="flex items-center justify-end gap-3 pt-2">
        <button type="button" @click="emit('cancel')" class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
        <button type="submit" class="px-6 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors">
          {{ isNew ? 'Create' : 'Save Changes' }}
        </button>
      </div>
    </form>
  </div>
</template>
