import { campus, legacyRestaurants, restaurants } from './restaurants.js'

export { campus, restaurants }
export const days = ['일', '월', '화', '수', '목', '금', '토']
export const categories = ['전체', '중식', '한식', '일식', '분식', '양식', '베트남식']
export const hours = [10, 11, 12, 13, 14, 15, 16]
export const ratingLabels = ['불만족', '보통', '만족']
const restaurantRecords = new Map([...restaurants, ...legacyRestaurants].map(restaurant => [restaurant.id, restaurant]))
export const restaurantForRecord = id => restaurantRecords.get(id)

export function straightDistance(origin, destination) {
  if (!destination) return null
  const radians = degrees => degrees * Math.PI / 180
  const deltaLat = radians(destination.latitude - origin.latitude)
  const deltaLon = radians(destination.longitude - origin.longitude)
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(deltaLon / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

export function formatDistance(meters) {
  if (meters == null) return '직선거리 정보 확인 필요'
  return '직선거리 ' + (meters < 1000 ? Math.min(999, Math.round(meters)) + ' m' : (meters / 1000).toFixed(2) + ' km')
}

export function compareDistance(a, b) {
  return (a.meters ?? Infinity) - (b.meters ?? Infinity) || a.name.localeCompare(b.name, 'ko')
}

export function requestLocation(geolocation, onSuccess, onError) {
  if (!geolocation) {
    onError('이 브라우저에서 위치를 사용할 수 없어요.')
    return
  }
  geolocation.getCurrentPosition(({ coords }) => {
    const { latitude, longitude, accuracy } = coords
    onSuccess({ latitude, longitude, accuracy })
  }, error => {
    onError(error.code === 1
      ? '위치 권한이 거부됐어요. 브라우저 설정에서 허용한 뒤 다시 요청할 수 있어요.'
      : '현재 위치를 가져오지 못했어요. 잠시 후 다시 요청해 주세요.')
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
}

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
    filters: { budget: 10000, maxWait: 10, category: '전체' },
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
    restaurantRecords.has(item.restaurantId)
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
  const dayOffset = (weekday(date) + restaurant.id.length) % 3 - 1
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
    restaurant.menu.some(([, price]) => Number.isFinite(price) && price <= filters.budget) &&
    (filters.category === '전체' || restaurant.category === filters.category),
  ).sort((a, b) => Boolean(a.offset) - Boolean(b.offset) || a.wait - b.wait || compareDistance(a, b))
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
