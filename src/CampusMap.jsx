import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { campus, restaurants } from './model'

const center = [campus.latitude, campus.longitude]
const markerGroups = new Map()
for (const restaurant of restaurants) {
  if (!restaurant.position) continue
  const { latitude, longitude } = restaurant.position
  const key = latitude + ',' + longitude
  const group = markerGroups.get(key) ?? []
  group.push(restaurant)
  markerGroups.set(key, group)
}

// Frame the verified restaurants around the campus, independent of GPS.
const campusExtent = L.latLngBounds([center])
for (const [latitude, longitude] of [...markerGroups.keys()].map(key => key.split(',').map(Number))) {
  campusExtent.extend([latitude, longitude])
  campusExtent.extend([2 * center[0] - latitude, 2 * center[1] - longitude])
}

function showCampus(map) {
  const zoom = Math.min(16, map.getBoundsZoom(campusExtent, false, [40, 64]))
  map.setView(center, zoom, { animate: false })
}

function createRestaurantMarkers(map, onSelect) {
  return [...markerGroups.values()].map(group => {
    const content = document.createElement('div')
    content.className = 'map-marker-group'
    L.DomEvent.disableClickPropagation(content)
    const buttons = group.map(restaurant => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'restaurant-marker'
      button.dataset.restaurant = restaurant.id
      button.title = restaurant.name
      button.setAttribute('aria-label', restaurant.name)
      button.textContent = restaurant.icon
      button.addEventListener('click', () => onSelect(restaurant.id))
      content.append(button)
      return button
    })
    const { latitude, longitude } = group[0].position
    const icon = L.divIcon({
      html: content,
      className: 'restaurant-marker-shell',
      iconSize: [40 * group.length + 2 * (group.length - 1), 40],
    })
    const marker = L.marker([latitude, longitude], { icon, keyboard: false, autoPanOnFocus: false }).addTo(map)
    return { buttons, marker }
  })
}

export default function CampusMap({ location, selectedId, onSelect, centerRevision, recommendations = [], children }) {
  const container = useRef(null)
  const instance = useRef(null)
  const [tileError, setTileError] = useState(false)
  const [locationOutside, setLocationOutside] = useState(false)

  useEffect(() => {
    const map = L.map(container.current, { scrollWheelZoom: false, minZoom: 3, maxZoom: 19 })
    showCampus(map)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19,
      noWrap: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
      .on('loading', () => setTileError(false))
      .on('tileerror', () => setTileError(true))
      .addTo(map)
    const markers = createRestaurantMarkers(map, onSelect)
    const userPane = map.createPane('gpsPoint')
    userPane.style.zIndex = '625'
    userPane.style.pointerEvents = 'none'
    const userMarker = L.circleMarker(center, {
      pane: 'gpsPoint',
      radius: 8, color: '#fff', weight: 3, fillColor: '#1d67d2', fillOpacity: 1, interactive: false,
      className: 'map-user-position',
    }).bindTooltip('내 위치', { permanent: true, direction: 'top', offset: [0, -6] })
    instance.current = { map, tiles, markers, userMarker }
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false, debounceMoveend: true }))
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      tiles.off()
      map.remove()
      instance.current = null
    }
  }, [onSelect])

  useEffect(() => {
    showCampus(instance.current.map)
  }, [centerRevision])

  useEffect(() => {
    const { map, userMarker } = instance.current
    if (!location) {
      userMarker.remove()
      setLocationOutside(false)
      return
    }
    // Render locally; GPS never changes the viewport or the raster tile requests.
    const point = L.latLng(location.latitude, location.longitude)
    userMarker.setLatLng(point).addTo(map)
    const checkVisibility = () => setLocationOutside(!map.getBounds().contains(point))
    checkVisibility()
    map.on('moveend', checkVisibility)
    return () => map.off('moveend', checkVisibility)
  }, [location, onSelect])

  useEffect(() => {
    const { map, markers } = instance.current
    for (const { buttons, marker } of markers) {
      let selected = false
      for (const button of buttons) {
        const active = button.dataset.restaurant === selectedId
        button.setAttribute('aria-pressed', String(active))
        selected ||= active
      }
      marker.setZIndexOffset(selected ? 1000 : 0)
      if (selected) map.panTo(marker.getLatLng(), { animate: false })
    }
  }, [selectedId, onSelect])

  useEffect(() => {
    const recommendedIds = new Set(recommendations.map(restaurant => restaurant.id))
    for (const { buttons } of instance.current.markers) {
      for (const button of buttons) {
        const recommended = recommendedIds.has(button.dataset.restaurant)
        button.classList.toggle('is-recommended', recommended)
        button.setAttribute('aria-label', recommended ? button.title + ' (추천)' : button.title)
      }
    }
  }, [recommendations, onSelect])

  return <div className="campus-map">
    <div className="campus-map-frame">
      <div className="campus-map-canvas" ref={container} role="region" aria-label="캠퍼스 주변 식당 지도" />
      <div className="campus-map-controls">
        <button className="secondary" aria-label="캠퍼스 중심으로 이동" title="캠퍼스 중심으로 이동" onClick={() => showCampus(instance.current.map)}>⌖</button>
        <details className="map-help">
          <summary aria-label="지도 도움말" title="지도 도움말">?</summary>
          <div className="map-help-copy">
            <p>마커를 눌러 식당을 확인하고, +와 −로 지도를 확대하거나 축소할 수 있어요.</p>
            <p className="map-recommendation-key">초록 점은 추천 식당이에요. 가격이 확인된 메뉴만 예산 추천에 반영되며, 예상 대기시간과 혼잡도는 예시예요.</p>
            <p>거리는 {location ? '내 위치' : '학교'} 기준 직선거리예요. 실제 이동 거리는 달라요.
              {location ? ` GPS 정확도 약 ±${Math.ceil(location.accuracy)} m.` : <> <a href={campus.source} target="_blank" rel="noreferrer">학교 기준점 확인</a></>}
            </p>
            {locationOutside && <p>내 위치가 현재 지도 범위 밖이에요. 지도를 직접 이동해 확인할 수 있어요.</p>}
            <p>좌표가 확인되지 않은 식당은 목록에서 볼 수 있어요.</p>
          </div>
        </details>
      </div>
      {children}
    </div>
    {tileError && <div className="campus-map-tools">
      <p role="status" className="muted">일부 지도 타일을 불러오지 못했어요. 마커와 식당 목록은 계속 이용할 수 있어요.</p>
      <button className="secondary" onClick={() => {
        setTileError(false)
        instance.current.tiles.redraw()
      }}>지도 다시 불러오기</button>
    </div>}
  </div>
}
