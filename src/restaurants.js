export const campus = {
  latitude: 36.3520635,
  longitude: 127.3014114,
  source: 'https://findby.co.kr/details/34158-302002010003-st-652b1f2f8c641f9e3893f856',
}

const hakha = '학하서로121번길 '
const sharedAddressSource = 'https://findby.co.kr/details/34159-302004301529-st-652b1f2c8c641f9e3893f76b'

// Coordinates are published address or business registry points. Unverified points are omitted.
const listings = [
  { id: 'hb-budae', name: '부대통령뚝배기 한밭대점', icon: '🥘', category: '한식',
    street: hakha + '130', menu: [['뚝배기 부대찌개', 7500], ['뚝배기 제육볶음', 7500]],
    source: 'https://www.diningcode.com/profile.php?rid=UuUdKSeVxP9S' },
  { id: 'hb-gukbap', name: '국민돼지국밥 한밭대점', icon: '🍲', category: '한식',
    street: hakha + '71-20', menu: [['수육국밥', 9000, true], ['순대국밥', 8000, true]],
    source: 'https://www.daangn.com/kr/local-profile/국민돼지국밥-한밭대점-vrzbq9movd1t/' },
  { id: 'hb-pho', name: '헬로베트남쌀국수 대전한밭대점', icon: '🍜', category: '베트남식',
    street: hakha + '31-3', position: { latitude: 36.3488058, longitude: 127.2995886 },
    menu: [['소쌀국수', 6400], ['분짜', 9400]], source: 'https://www.diningcode.com/profile.php?rid=endIPoAbiPYA',
    coordinateSource: 'https://findby.co.kr/details/34159-302004301529-st-652b1f2d8c641f9e3893f7c6' },
  { id: 'hb-momomen', name: '모모멘 한밭대점', icon: '🍜', category: '일식',
    street: '학하서로 140-4', position: { latitude: 36.346713519092, longitude: 127.30201071987 },
    menu: [['차슈라멘', null]], source: 'https://www.tabling.co.kr/place/677cd5b266de5f06988fabaa',
    coordinateSource: 'https://jusoga.com/b/3020011300106030002000001/대전광역시-유성구-학하서로-140-4-덕명동' },
  { id: 'hb-bongs', name: '봉스키친', icon: '🍚', category: '한식',
    street: hakha + '71-14', menu: [], source: 'https://opengo.kr/5601fb6f0e887edf2cef8612' },
  { id: 'hb-ilmi', name: '일미닭갈비파전', icon: '🍗', category: '한식',
    street: hakha + '71-10', position: { latitude: 36.350051780854, longitude: 127.2978617766 },
    menu: [['닭갈비', null], ['파전', null]], source: 'https://www.114.co.kr/biznumber/detail/f4a46a131f6a',
    coordinateSource: 'https://jusoga.com/b/3020011300101580001000001/대전광역시-유성구-학하서로121번길-71-10-덕명동' },
  { id: 'hb-myeon', name: '면식당 한밭대점', icon: '🍜', category: '일식',
    street: hakha + '71-8', position: { latitude: 36.3501763, longitude: 127.2978745 },
    menu: [['돈코츠라멘', 8400]], source: 'https://www.diningcode.com/profile.php?rid=4q399Z8bXPBR',
    coordinateSource: sharedAddressSource },
  { id: 'hb-siru', name: '시루향기 콩나물국밥 한밭대점', icon: '🍲', category: '한식',
    street: hakha + '71-8', position: { latitude: 36.3501763, longitude: 127.2978745 },
    menu: [['콩나물국밥', 8000]], source: 'https://sgeng2325.tistory.com/510', coordinateSource: sharedAddressSource },
  { id: 'hb-sinjeon', name: '신전떡볶이 한밭대점', icon: '🍢', category: '분식',
    street: hakha + '17', position: { latitude: 36.3483488060673, longitude: 127.300003512807 },
    menu: [['신전떡볶이', 4500], ['로제떡볶이', 6500]], source: 'https://www.diningcode.com/profile.php?rid=8PegJ0KKgpQU',
    coordinateSource: 'https://ykm.purpleo.kr/article/24837' },
  { id: 'hb-tang', name: '탕화쿵푸마라탕 한밭대점', icon: '🥢', category: '중식',
    street: hakha + '45-21', position: { latitude: 36.3492599, longitude: 127.2979891 }, menu: [['마라탕', null]],
    coordinateSource: 'https://findby.co.kr/details/34159-302004301529-st-652b1f2b8c641f9e3893f70d',
    source: 'https://place.clariosync.com/p/708745/탕화쿵푸마라탕-한밭대점' },
  { id: 'hb-isaac', name: '이삭토스트 한밭대점', icon: '🥪', category: '분식',
    street: hakha + '51', menu: [], source: 'https://dining.ayo.pe.kr/snack/1808f35d5f84707cdb27304e10f7b99c' },
]

export const restaurants = listings.map(({ street, ...restaurant }) => {
  const address = '대전광역시 유성구 ' + street
  return {
    ...restaurant,
    address,
    wait: 8, // Shared example baseline, with no live queue data.
    mapUrl: 'https://map.kakao.com/?q=' + encodeURIComponent(restaurant.name + ' ' + address),
  }
})

// Keep v1 visit and pending IDs separate from real restaurants.
export const legacyRestaurants = [
  ['cheong', '중화요리 청', '🥟', '중식'],
  ['momo', '모모키친', '🍛', '일식'],
  ['bap', '캠퍼스 한끼', '🍚', '한식'],
  ['hong', '홍홍 마라', '🍜', '중식'],
  ['bunsik', '정문 앞 분식', '🍙', '분식'],
  ['ming', '밍키 짜장', '🥢', '중식'],
  ['pasta', '초록 파스타', '🍝', '양식'],
].map(([id, name, icon, category]) => ({ id, name, icon, category }))
