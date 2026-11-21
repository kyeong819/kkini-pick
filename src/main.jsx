import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { categories, crowdLabel, days, hours, initialState, loadState, newVisitId, predict, ratingLabels, recommend, restaurants, storageKey, summarize, tomorrow, weekday } from './model'
import './style.css'

const won = value => value.toLocaleString('ko-KR') + '원'
const niceDate = date => date.slice(5).replace('-', '.') + ' (' + days[weekday(date)] + ')'
const menus = ['지도', '마이픽', '내 기록']
const reasons = ['가격', '거리', '대기시간', '메뉴', '기타']

function App() {
  const [state, setState] = useState(loadState)
  const [view, setView] = useState('지도')
  const [detail, setDetail] = useState(null)
  const [draft, setDraft] = useState(state.filters)
  const [active, setActive] = useState(null)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)
  const { date, visits, pending, filters } = state
  const dining = restaurants.map(restaurant => predict(restaurant, date, visits))
  const picks = recommend(dining, filters)
  const current = dining.find(restaurant => restaurant.id === detail)

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
    setNotice('')
    window.scrollTo(0, 0)
  }

  function openDetail(id) {
    setDetail(id)
    window.scrollTo(0, 0)
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
    const restaurant = restaurants.find(entry => entry.id === item.restaurantId)
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
      {current ? <Detail restaurant={current} date={date} visits={visits} onBack={() => setDetail(null)} onPick={() => pick(current)} />
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
              <div className="section-title"><h2>캠퍼스 주변</h2><span className="badge">데모 지도</span></div>
              <div className="map">
                <div className="park park-a" /><div className="park park-b" />
                <div className="road road-a" /><div className="road road-b" /><div className="road road-c" /><div className="road road-d" />
                <div className="map-label campus">🎓 캠퍼스</div><div className="map-label gate">정문</div><div className="map-label library">중앙도서관</div>
                {dining.map(restaurant => {
                  const rank = picks.find(item => item.id === restaurant.id)?.rank
                  return <button key={restaurant.id} className={'pin ' + (rank ? 'ranked' : '')} style={{ left: restaurant.x + '%', top: restaurant.y + '%' }}
                    aria-label={restaurant.name + ', ' + restaurant.crowd + ', 예상 ' + restaurant.wait + '분'} onClick={() => openDetail(restaurant.id)}>
                    <span>{restaurant.icon}</span>{rank && <b>{rank}</b>}<small>{restaurant.wait}분</small>
                  </button>
                })}
              </div>
              <div className="map-legend"><span>● 추천 식당</span><span>지도 위 식당을 눌러 자세히 보기</span></div>
            </section>
            <section className="panel picks">
              <div className="section-title"><h2>오늘의 추천</h2><span className="badge">{picks.length}곳</span></div>
              <p className="muted">{won(Number(filters.budget))} 이하 · {filters.maxWait}분 이내 · {filters.category}</p>
              {picks.length ? picks.map(restaurant => <button className="pick-row" key={restaurant.id} onClick={() => openDetail(restaurant.id)}>
                <span className="food-icon">{restaurant.icon}</span><span className="pick-copy"><small>{restaurant.rank}순위 · {restaurant.category}</small><strong>{restaurant.name}</strong><small>{won(Math.min(...restaurant.menu.map(([, price]) => price)))}부터 · {restaurant.meters}m</small></span><span className={'wait ' + restaurant.crowd}>{restaurant.wait}분</span>
              </button>) : <p className="empty">조건에 맞는 식당이 없어요. 예산이나 허용 대기시간을 늘려 보세요.</p>}
              <p className="muted fine">예측 대기시간과 혼잡도는 테스트 데이터예요.</p>
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

function Detail({ restaurant, date, visits, onBack, onPick }) {
  const values = hours.map(hour => predict(restaurant, date, visits, hour).wait)
  const max = Math.max(1, ...values)
  return <>
    <button className="secondary back" onClick={onBack}>돌아가기</button>
    <section className="panel content">
      <div className="detail-heading"><span className="food-icon">{restaurant.icon}</span><div><p className="eyebrow">{restaurant.category} · 캠퍼스에서 {restaurant.meters}m</p><h1>{restaurant.name}</h1></div></div>
      <div className="stats"><div>예측 대기 <strong>{restaurant.wait}분</strong></div><div>예측 대기 인원 <strong>{restaurant.queue}명</strong></div><div>예측 혼잡도 <strong>{restaurant.crowd}</strong></div></div>
      {restaurant.offset > 0 && <p className="notice">최근 방문 기록을 반영해 예측 대기시간에 {restaurant.offset}분을 더했어요.</p>}
      <h2>대표 메뉴</h2>
      {restaurant.menu.map(([name, price]) => <div className="line" key={name}><span>{name}</span><strong>{won(price)}</strong></div>)}
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
      return <div className="line weekday" key={day}><strong>{days[day]}요일</strong>{restaurant ? <><button className="text-button" onClick={() => openDetail(restaurant.id)}>{restaurant.name}</button><span>{crowdLabel(averageWait)} · 평균 {averageWait.toFixed(1)}분</span></> : <span className="muted">기록 없음</span>}</div>
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
    {pending.length > 0 && <><h2>기록을 기다리는 식당</h2>{pending.map(item => <div className="line" key={item.id}><div><strong>{dining.find(entry => entry.id === item.restaurantId).name}</strong><br /><small>{niceDate(item.date)} · 예측 {item.predicted}분</small></div><button className="secondary" onClick={() => onOpen(item)}>지금 기록</button></div>)}</>}
    <h2>저장한 방문 ({visits.length})</h2>
    {visits.length ? [...visits].reverse().map(item => <article className="line" key={item.id}><div><strong>{item.name}</strong><br /><small>{item.date} ({days[weekday(item.date)]}) · 예측 {item.predicted}분 · 실제 {item.actual}분{item.reason && ' · ' + item.reason}</small></div><span className="badge">{ratingLabels[item.rating]}</span></article>) : <p className="empty">아직 저장한 방문이 없어요.</p>}
  </section>
}

function VisitForm({ item, onClose, onSave }) {
  const restaurant = restaurants.find(entry => entry.id === item.restaurantId)
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
