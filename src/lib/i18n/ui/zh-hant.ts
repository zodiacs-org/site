import type { UiCatalog } from './schema';

/**
 * Traditional Chinese chrome for the Chinese zodiac section, in wording read
 * the same way in Taiwan and Hong Kong. Only the keys the shared navigation,
 * footer and page frame print are here; a page that asks for any other key
 * fails the build (serverUiMessage) instead of printing English silently.
 */
const zhHant = {
  skipContent: '跳到正文',
  navPrimary: '主選單',
  navSigns: '星座',
  navTools: '工具',
  navLearn: '學習',
  navHoroscopes: '星座解讀',
  navCollect: 'Astrofolio',
  navSavedCharts: '已儲存的星盤',
  navSite: '本站',
  navTwelve: '十二星座',
  today: '今天',
  birthChart: '出生星盤',
  compatibility: '星盤配對',
  moonSign: '月亮星座',
  risingSign: '上升星座',
  moonPhase: '月相',
  saturnReturn: '土星回歸',
  transits: '行運',
  birthday: '生日星座',
  retrogrades: '逆行',
  footerTag: '免費的占星工具和星座指南，星盤在你自己的瀏覽器裡計算。',
  footerStartHere: '占星入門',
  footerPlanets: '行星',
  footerHouses: '宮位',
  footerZodiacDates: '星座日期',
  footerGlossary: '術語表',
  footerCompute: '星盤如何計算',
  footerRegistry: 'Registry',
  footerSdk: 'SDK',
  footerDisclosure: '聲明',
  trustFreeAnswer: '本站的占星工具和指南全部免費，無須註冊。Zodiacs.org 同時經營十二星座代幣收藏 Astrofolio。',
  trustDisclosure: '閱讀我們的聲明',
  footerAbout: '關於本站',
  footerPrivacy: '隱私',
  footerTerms: '使用條款',
  footerWidgets: '小工具',
  footerPlaceData: '地點資料',
  footerFonts: '字體授權',
  editedBy: '發布方',
  editorialHow: '編輯準則',
} as const satisfies Partial<UiCatalog>;

export default zhHant;
