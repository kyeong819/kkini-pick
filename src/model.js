export const days = ['일', '월', '화', '수', '목', '금', '토']
export const categories = ['전체', '중식', '한식', '일식', '분식', '양식']
export const hours = [10, 11, 12, 13, 14, 15, 16]
export const ratingLabels = ['불만족', '보통', '만족']
export const restaurants = [
  { id: 'cheong', name: '중화요리 청', icon: '🥟', category: '중식', meters: 250, wait: 5, x: 35, y: 24, menu: [['짜장면', 6500], ['짬뽕', 8500]] },
  { id: 'momo', name: '모모키친', icon: '🍛', category: '일식', meters: 420, wait: 6, x: 75, y: 29, menu: [['카레라이스', 9500], ['치즈 돈카츠', 12000]] },
  { id: 'bap', name: '캠퍼스 한끼', icon: '🍚', category: '한식', meters: 160, wait: 3, x: 20, y: 51, menu: [['제육 덮밥', 8000], ['순두부찌개', 8500]] },
  { id: 'hong', name: '홍홍 마라', icon: '🍜', category: '중식', meters: 380, wait: 8, x: 56, y: 61, menu: [['미니 마라탕', 9000], ['꿔바로우 세트', 13500]] },
  { id: 'bunsik', name: '정문 앞 분식', icon: '🍙', category: '분식', meters: 310, wait: 4, x: 24, y: 82, menu: [['떡볶이', 4500], ['참치 김밥', 4000]] },
  { id: 'ming', name: '밍키 짜장', icon: '🥢', category: '중식', meters: 460, wait: 10, x: 82, y: 54, menu: [['간짜장', 8500], ['볶음밥', 9000]] },
  { id: 'pasta', name: '초록 파스타', icon: '🍝', category: '양식', meters: 570, wait: 14, x: 77, y: 83, menu: [['토마토 파스타', 10500], ['크림 파스타', 11500]] },
]

export const storageKey = 'kkini-pick.v1'
export const dateObject = date => new Date(date + 'T00:00:00Z')
export const weekday = date => dateObject(date).getUTCDay()
export function tomorrow(date) {
  const next = dateObject(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

export function initialState() {
  return {
    date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()),
    filters: { budget: 10000, maxWait: 10, category: '중식' },
    visits: [],
    pending: [],
  }
}

export function loadState() {
  const defaults = initialState()
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (!saved) return defaults
    const filters = saved.filters ?? {}
    return {
      date: validDate(saved.date) ? saved.date : defaults.date,
      filters: {
        budget: validNumber(filters.budget) ? Number(filters.budget) : defaults.filters.budget,
        maxWait: validNumber(filters.maxWait) ? Number(filters.maxWait) : defaults.filters.maxWait,
        category: categories.includes(filters.category) ? filters.category : defaults.filters.category,
      },
      visits: Array.isArray(saved.visits)
        ? saved.visits.filter(visit => validVisit(visit) &&
          Number.isFinite(visit.actual) && visit.actual >= 0 && [0, 1, 2].includes(visit.rating) &&
          typeof visit.name === 'string' && categories.includes(visit.category) &&
          (visit.reason == null || typeof visit.reason === 'string'))
        : [],
      pending: Array.isArray(saved.pending)
        ? saved.pending.filter(item => validVisit(item) && Number.isFinite(item.due))
        : [],
    }
  } catch {
    return defaults
  }
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = dateObject(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validNumber(value) {
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
    Number.isFinite(Number(value)) && Number(value) >= 0
}

function validVisit(item) {
  return item && typeof item.id === 'string' && validDate(item.date) &&
    Number.isFinite(item.predicted) && item.predicted >= 0 &&
    restaurants.some(restaurant => restaurant.id === item.restaurantId)
}

export function newVisitId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function predict(restaurant, date, visits, hour = 12) {
  const history = visits.filter(visit => visit.restaurantId === restaurant.id)
  const last = history.at(-1)
  const offset = last && last.actual - last.predicted >= 5 ? 10 : 0
  const blockedFirst = history.slice(-2).length === 2 && history.slice(-2).every(visit => visit.rating === 0)
  const dayOffset = restaurant.id === 'cheong' ? 0 : (weekday(date) + restaurant.meters) % 3 - 1
  const base = Math.max(0, restaurant.wait + dayOffset - Math.abs(hour - 12) * 3)
  const wait = base + offset
  return { ...restaurant, wait, offset, blockedFirst, queue: Math.ceil(wait / 3), crowd: crowdLabel(wait) }
}

export function crowdLabel(wait) {
  return wait <= 5 ? '여유' : wait <= 10 ? '보통' : '혼잡'
}

export function recommend(dining, filters) {
  const sorted = dining.filter(restaurant =>
    restaurant.wait <= filters.maxWait &&
    restaurant.menu.some(([, price]) => price <= filters.budget) &&
    (filters.category === '전체' || restaurant.category === filters.category),
  ).sort((a, b) => Boolean(a.offset) - Boolean(b.offset) || a.wait - b.wait || a.meters - b.meters)
  const first = sorted.find(restaurant => !restaurant.blockedFirst)
  const remaining = sorted.filter(restaurant => restaurant !== first)
  return [
    ...(first ? [{ ...first, rank: 1 }] : []),
    ...remaining.slice(0, 2).map((restaurant, index) => ({ ...restaurant, rank: index + 2 })),
  ]
}

export function summarize(visits, groupBy) {
  const groups = new Map()
  for (const visit of visits) {
    const key = groupBy(visit)
    const group = groups.get(key) ?? { key, count: 0, rating: 0, wait: 0 }
    group.count++
    group.rating += visit.rating + 1
    group.wait += visit.actual
    groups.set(key, group)
  }
  return [...groups.values()].map(group => ({
    ...group, rating: group.rating / group.count, wait: group.wait / group.count,
  })).sort((a, b) => b.count - a.count || b.rating - a.rating)
}
