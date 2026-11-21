import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { campus, categories, crowdLabel, days, formatDistance, hours, initialState, loadState, newVisitId, predict, ratingLabels, recommend, requestLocation, restaurantForRecord, restaurants, storageKey, straightDistance, summarize, tomorrow, weekday } from './model'
import CampusMap from './CampusMap'
import './style.css'

const won = value => value.toLocaleString('ko-KR') + '원'
const niceDate = date => date.slice(5).replace('-', '.') + ' (' + days[weekday(date)] + ')'
const menus = ['지도', '마이픽', '내 기록']
const reasons = ['가격', '거리', '대기시간', '메뉴', '기타']

function App() {
  const [state, setState] = useState(loadState)
  const [view, setView] = useState('지도')
  const [detail, setDetail] = useState(null)
  const [mapSelection, setMapSelection] = useState(null)
  const [mapCenterRevision, setMapCenterRevision] = useState(0)
  const [draft, setDraft] = useState(state.filters)
  const [active, setActive] = useState(null)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const { date, visits, pending, filters } = state
  const distanceOrigin = location ? '내 위치' : '국립한밭대학교 유성덕명캠퍼스'
  const dining = restaurants.map(restaurant => ({
    ...predict(restaurant, date, visits),
    meters: straightDistance(location ?? campus, restaurant.position),
  }))
  const picks = recommend(dining, filters)
  const current = dining.find(restaurant => restaurant.id === detail)
  const selectedOnMap = dining.find(restaurant => restaurant.id === mapSelection)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [state])

  useEffect(() => {
    if (active || !pending.length) return
    const next = [...pending].sort((a, b) => a.due - b.due)[0]
    const timer = setTimeout(() => setActive(next), Math.max(0, next.due - Date.now()))
    return () => clearTimeout(timer)
  }, [active, pending])

  function navigate(next) {
    setView(next)
    setDetail(null)
    setMapSelection(null)
    setNotice('')
    window.scrollTo(0, 0)
  }

  function openDetail(id) {
    setDetail(id)
    window.scrollTo(0, 0)
  }

  function findNearby() {
    setLocating(true)
    setLocationError('')
    const usePosition = position => {
      setLocation(position)
      setLocating(false)
    }
    const useCampus = message => {
      centerOnCampus()
      setLocationError(message)
      setLocating(false)
    }
    try {
      requestLocation(navigator.geolocation, usePosition, useCampus)
    } catch {
      useCampus('현재 위치를 사용할 수 없어요. 브라우저의 위치 권한을 확인해 주세요.')
    }
  }

  function centerOnCampus() {
    setLocation(null)
    setMapSelection(null)
    setMapCenterRevision(previous => previous + 1)
  }

  function pick(restaurant) {
    if (pending.some(item => item.restaurantId === restaurant.id && item.date === date)) {
      navigate('내 기록')
      return
    }
    const item = { id: newVisitId(), restaurantId: restaurant.id, date, predicted: restaurant.wait, due: Date.now() + 30 * 60 * 1000 }
    setState(previous => ({ ...previous, pending: [...previous.pending, item] }))
    navigate('내 기록')
    setNotice('식당을 골랐어요! 30분 뒤 기록 창이 열려요.')
  }

  function save(item, actual, rating, reason) {
    const restaurant = restaurantForRecord(item.restaurantId)
    const { id, date, predicted, restaurantId } = item
    const visit = { id, date, predicted, restaurantId, name: restaurant.name, category: restaurant.category, actual, rating, reason }
    setState(previous => ({
      ...previous,
      visits: [...previous.visits, visit],
      pending: previous.pending.filter(entry => entry.id !== id),
    }))
    setActive(null)
    navigate('내 기록')
    setNotice(actual - predicted >= 5 ? '기록을 저장했어요. 이 식당의 예측 대기시간에 10분을 더했어요.' : '방문 기록을 저장했어요.')
  }

  function reset() {
    if (!window.confirm('저장된 방문 기록과 설정을 모두 지울까요?')) return
    const fresh = initialState()
    setState(fresh)
    setDraft(fresh.filters)
    setActive(null)
    navigate('지도')
  }

  return <>
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('지도')}><span className="brand-icon" aria-hidden="true">🍙</span><span>끼니픽<small>KKINI PICK</small></span></button>
        <nav aria-label="주 메뉴">{menus.map((label, index) => <button key={label} aria-current={view === label ? 'page' : undefined} onClick={() => navigate(label)}><span aria-hidden="true">{['🗺️', '💚', '📝'][index]}</span> {label}</button>)}</nav>
        <span className="date">{niceDate(date)} 점심</span>
      </div>
    </header>
    <main>
      {storageError && <p role="alert" className="notice">브라우저 저장 공간을 사용할 수 없어요. 새로고침하면 변경 내용이 사라질 수 있어요.</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {current ? <Detail restaurant={current} date={date} visits={visits} location={location} distanceOrigin={distanceOrigin} recommendations={picks} onSelect={setDetail} onBack={() => setDetail(null)} onPick={() => pick(current)} />
        : view === '지도' ? <>
          <section className="intro">
            <div><p className="eyebrow">캠퍼스 점심 지도</p><h1>오늘 뭐 먹지<span>?</span></h1><p>예산과 시간에 딱 맞는 캠퍼스 근처 한 끼를 찾아봐요.</p></div>
            <div className="lunch" aria-hidden="true"><span>✦</span> 🍱 <span>✦</span></div>
          </section>
          <form className="panel filter" onSubmit={event => { event.preventDefault(); setState(previous => ({ ...previous, filters: draft })) }}>
            <label>💰 최대 예산 <div className="input-unit"><input type="number" min="0" required value={draft.budget} onChange={event => setDraft({ ...draft, budget: event.target.value })} /><span>원</span></div></label>
            <label>⏱ 허용 대기 <div className="input-unit"><input type="number" min="0" required value={draft.maxWait} onChange={event => setDraft({ ...draft, maxWait: event.target.value })} /><span>분</span></div></label>
            <label>🍴 선호 메뉴 <select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
            <button className="primary">조건 적용</button>
          </form>
          <div className="dashboard">
            <section className="panel map-card">
              <div className="section-title"><h2>캠퍼스 주변</h2><span className="badge">지도에 {restaurants.filter(restaurant => restaurant.position).length}곳</span></div>
              <div className="location-actions">
                <button className="primary" onClick={findNearby} disabled={locating}>
                  {locating ? '위치 확인 중…' : locationError ? '위치 권한 다시 요청하기' : '내 위치로 주변 식당 찾기'}
                </button>
                {(location || locationError) && <button className="secondary" disabled={locating} onClick={centerOnCampus}>학교 기준으로 보기</button>}
              </div>
              {locationError && <p role="status" className="muted fine">{locationError}</p>}
              <CampusMap location={location} selectedId={mapSelection} onSelect={setMapSelection} centerRevision={mapCenterRevision} recommendations={picks} />
              {selectedOnMap && <SelectedRestaurant restaurant={selectedOnMap} useCurrentLocation={Boolean(location)}
                onClose={() => setMapSelection(null)} onDetails={() => openDetail(selectedOnMap.id)} />}
            </section>
            <section className="panel picks">
              <div className="section-title"><h2>오늘의 추천</h2><span className="badge">{picks.length}곳</span></div>
              <p className="muted">{won(Number(filters.budget))} 이하 · {filters.maxWait}분 이내 · {filters.category}</p>
              {picks.length ? picks.map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} onOpen={openDetail} />)
                : <p className="empty">확인된 가격으로 조건에 맞는 식당이 없어요. 예산, 대기시간 또는 음식 종류를 바꿔 보세요.</p>}
            </section>
          </div>
        </> : view === '마이픽' ? <MyPick visits={visits} date={date} dining={dining} openDetail={openDetail} />
        : <Records date={date} visits={visits} pending={pending} dining={dining} onOpen={setActive} />}
      <footer><span>끼니픽 · 테스트 도구</span><div><button className="secondary" onClick={() => { setState(previous => ({ ...previous, date: tomorrow(previous.date) })); setNotice('테스트 날짜가 하루 바뀌었어요.') }}>다음 날로 이동</button><button className="quiet" onClick={reset}>처음부터 다시</button></div></footer>
    </main>
    {active && <VisitForm key={active.id} item={active} onSave={save} onClose={() => {
      setState(previous => ({ ...previous, pending: previous.pending.map(item => item.id === active.id && item.due <= Date.now() ? { ...item, due: Date.now() + 5 * 60 * 1000 } : item) }))
      setActive(null)
    }} />}
  </>
}

function RestaurantCard({ restaurant, onOpen }) {
  const prices = restaurant.menu.map(([, price]) => price).filter(Number.isFinite)
  return <button className="pick-row" onClick={() => onOpen(restaurant.id)}>
    <span className="food-icon" aria-hidden="true">{restaurant.icon}</span>
    <span className="pick-copy">
      <small>{restaurant.rank && restaurant.rank + '순위 · '}{restaurant.category}</small>
      <strong>{restaurant.name}</strong>
      <small>{prices.length ? won(Math.min(...prices)) + '부터' : '가격 정보 확인 필요'}</small>
      <small>{formatDistance(restaurant.meters)}</small>
    </span>
    <span className={'wait ' + restaurant.crowd}>예상 {restaurant.wait}분</span>
  </button>
}

function RestaurantLocation({ restaurant, distanceOrigin }) {
  return <p>{restaurant.category} · {restaurant.address}<br />{distanceOrigin} 기준 · {formatDistance(restaurant.meters)}</p>
}

function SelectedRestaurant({ restaurant, useCurrentLocation, onClose, onDetails }) {
  const [name, price, from] = restaurant.menu[0] ?? []
  const { latitude, longitude } = restaurant.position
  const destination = encodeURIComponent(latitude + ',' + longitude)
  return <section className="marker-detail" aria-label="선택한 식당" onKeyDown={event => {
    if (event.key === 'Escape') onClose()
  }}>
    <div className="section-title">
      <div><p className="muted fine">{restaurant.category}</p><h3>{restaurant.name}</h3></div>
      <button className="map-close" onClick={onClose} aria-label="선택한 식당 닫기">×</button>
    </div>
    <p>{name ?? '대표 메뉴 확인 필요'} · <strong>{menuPrice(price, from)}</strong></p>
    <p className="muted">{restaurant.address}</p>
    <p className="muted fine">{useCurrentLocation ? '내 위치' : '학교'} 기준 {formatDistance(restaurant.meters)}</p>
    <div className="location-actions">
      <a className="map-directions" href={'https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=' + destination}
        target="_blank" rel="noreferrer" aria-label="대중교통 길찾기">길찾기</a>
      <button className="secondary" onClick={onDetails}>상세 보기</button>
    </div>
  </section>
}

function ExternalMapLink({ restaurant }) {
  return <a href={restaurant.mapUrl} target="_blank" rel="noreferrer">{restaurant.position ? '외부 지도에서 위치 보기' : '외부 지도에서 식당 검색'}</a>
}

function menuPrice(price, from) {
  return price == null ? '가격 정보 확인 필요' : won(price) + (from ? '부터' : '')
}

function RestaurantMenu({ restaurant }) {
  return restaurant.menu.length ? restaurant.menu.map(([name, price, from]) => <div className="line" key={name}><span>{name}</span><strong>{menuPrice(price, from)}</strong></div>)
    : <p className="muted">메뉴와 가격 정보 확인 필요</p>
}

function Detail({ restaurant, date, visits, location, distanceOrigin, recommendations, onSelect, onBack, onPick }) {
  const values = hours.map(hour => predict(restaurant, date, visits, hour).wait)
  const max = Math.max(1, ...values)
  return <>
    <button className="secondary back" onClick={onBack} aria-label="상세 닫기">× 닫기</button>
    <section className="panel content">
      <div className="detail-heading"><span className="food-icon">{restaurant.icon}</span><h1>{restaurant.name}</h1></div>
      <RestaurantLocation restaurant={restaurant} distanceOrigin={distanceOrigin} />
      <div className="location-actions">
        <ExternalMapLink restaurant={restaurant} />
        <a href={restaurant.source} target="_blank" rel="noreferrer">식당 정보 출처</a>
        {restaurant.coordinateSource && <a href={restaurant.coordinateSource} target="_blank" rel="noreferrer">좌표 출처</a>}
      </div>
      {restaurant.position && <CampusMap location={location} selectedId={restaurant.id} onSelect={onSelect} recommendations={recommendations} />}
      <div className="stats"><div>예측 대기 <strong>{restaurant.wait}분</strong></div><div>예측 대기 인원 <strong>{restaurant.queue}명</strong></div><div>예측 혼잡도 <strong>{restaurant.crowd}</strong></div></div>
      {restaurant.offset > 0 && <p className="notice">최근 방문 기록을 반영해 예측 대기시간에 {restaurant.offset}분을 더했어요.</p>}
      <p className="muted fine">예상 대기시간, 대기 인원, 혼잡도는 예시예요.</p>
      <h2>대표 메뉴</h2>
      <RestaurantMenu restaurant={restaurant} />
      {restaurant.menu.some(([, price]) => price != null) && <p className="muted fine">공개 자료를 기준으로 표시한 가격이며 매장 가격은 달라질 수 있어요.</p>}
      <h2>시간대별 예측 대기시간</h2>
      <div className="chart">{values.map((wait, index) => <div key={hours[index]}><strong>{wait}분</strong><div className="bar-track"><span style={{ height: (wait / max * 100) + '%' }} /></div><small>{hours[index]}시</small></div>)}</div>
      <button className="primary full" onClick={onPick}>이 식당으로 픽!</button>
    </section>
  </>
}

function MyPick({ visits, date, dining, openDetail }) {
  const month = date.slice(0, 7)
  const monthly = visits.filter(visit => visit.date.startsWith(month))
  const byCategory = summarize(monthly, visit => visit.category)
  const best = summarize(monthly, visit => visit.name).sort((a, b) => b.rating - a.rating || b.count - a.count)[0]
  const frequent = summarize(visits, visit => visit.name)[0]
  return <section className="panel content">
    <p className="eyebrow">{Number(month.slice(5))}월 취향표</p><h1>마이픽 💚</h1>
    <p className="muted">이번 달의 취향과 지금까지 쌓인 요일별 방문 패턴을 확인해요.</p>
    {visits.length >= 5 && <p className="notice">🏅 자주 간 식당 · {frequent.key} ({frequent.count}회)</p>}
    <h2>나의 선호 카테고리</h2>
    {byCategory.length ? byCategory.map(group => <div className="line" key={group.key}><strong>{group.key}</strong><span>{group.count}회 · 평균 {group.rating.toFixed(1)}/3</span></div>) : <p className="empty">이번 달 방문 기록이 아직 없어요.</p>}
    {best && <p className="notice">🌟 가장 만족한 식당 · {best.key} ({best.rating.toFixed(1)}/3)</p>}
    <h2>요일별 픽과 혼잡도</h2>
    {[1, 2, 3, 4, 5, 6, 0].map(day => {
      const dayVisits = visits.filter(visit => weekday(visit.date) === day)
      const groups = summarize(dayVisits, visit => visit.restaurantId)
      const top = groups.sort((a, b) => b.rating - a.rating || b.count - a.count || a.wait - b.wait)[0]
      const restaurant = dining.find(item => item.id === top?.key)
      const averageWait = dayVisits.reduce((sum, visit) => sum + visit.actual, 0) / dayVisits.length
      return <div className="line weekday" key={day}><strong>{days[day]}요일</strong>{top ? <>{restaurant
        ? <button className="text-button" onClick={() => openDetail(restaurant.id)}>{restaurant.name}</button>
        : <span>{restaurantForRecord(top.key).name} (이전 테스트)</span>}
        <span>{crowdLabel(averageWait)} · 평균 {averageWait.toFixed(1)}분</span></> : <span className="muted">기록 없음</span>}</div>
    })}
  </section>
}

function Records({ date, visits, pending, dining, onOpen }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0].id)
  return <section className="panel content">
    <p className="eyebrow">나의 점심 일지</p><h1>내 기록 📝</h1>
    <form className="manual" onSubmit={event => {
      event.preventDefault()
      const restaurant = dining.find(item => item.id === restaurantId)
      const existing = pending.find(item => item.restaurantId === restaurantId && item.date === date)
      onOpen(existing ?? { id: newVisitId(), restaurantId, date, predicted: restaurant.wait })
    }}>
      <label>방문한 식당<select value={restaurantId} onChange={event => setRestaurantId(event.target.value)}>{dining.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button className="primary">방문 기록하기</button>
    </form>
    {pending.length > 0 && <><h2>기록을 기다리는 식당</h2>{pending.map(item => <div className="line" key={item.id}><div><strong>{restaurantForRecord(item.restaurantId).name}</strong><br /><small>{niceDate(item.date)} · 예측 {item.predicted}분</small></div><button className="secondary" onClick={() => onOpen(item)}>지금 기록</button></div>)}</>}
    <h2>저장한 방문 ({visits.length})</h2>
    {visits.length ? [...visits].reverse().map(item => <article className="line" key={item.id}><div><strong>{item.name}</strong><br /><small>{item.date} ({days[weekday(item.date)]}) · 예측 {item.predicted}분 · 실제 {item.actual}분{item.reason && ' · ' + item.reason}</small></div><span className="badge">{ratingLabels[item.rating]}</span></article>) : <p className="empty">아직 저장한 방문이 없어요.</p>}
  </section>
}

function VisitForm({ item, onClose, onSave }) {
  const restaurant = restaurantForRecord(item.restaurantId)
  const dialog = React.useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose() }}>
    <form onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      onSave(item, Number(data.get('actual')), Number(data.get('rating')), data.get('reason'))
    }}>
      <div className="section-title"><h2>오늘의 한 끼는 어땠나요?</h2><button type="button" className="quiet" onClick={onClose}>닫기</button></div>
      <p>{restaurant.icon} <strong>{restaurant.name}</strong> · {niceDate(item.date)} · 예측 {item.predicted}분</p>
      <label>실제 대기시간(분)<input autoFocus name="actual" type="number" min="0" required /></label>
      <fieldset><legend>만족도</legend><div className="ratings">{ratingLabels.map((label, index) => <label key={label}><input name="rating" type="radio" value={index} required />{label}</label>)}</div></fieldset>
      <label>식당 선택 이유 (선택)<select name="reason"><option value="">선택 안 함</option>{reasons.map(reason => <option key={reason}>{reason}</option>)}</select></label>
      <button className="primary full">기록 저장</button>
    </form>
  </dialog>
}

createRoot(document.getElementById('root')).render(<App />)
