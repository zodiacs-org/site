import type { UiCatalog } from './schema';

/**
 * Simplified Chinese chrome for the Chinese zodiac section. Only the keys the
 * shared navigation, footer and page frame print are here; a page that asks
 * for any other key fails the build (serverUiMessage) instead of printing
 * English silently.
 */
const zhHans = {
  skipContent: '跳到正文',
  navPrimary: '主导航',
  navSigns: '星座',
  navTools: '工具',
  navLearn: '学习',
  navHoroscopes: '星座解读',
  navCollect: 'Astrofolio',
  navSavedCharts: '已保存的星盘',
  navSite: '本站',
  navTwelve: '十二星座',
  today: '今天',
  birthChart: '出生星盘',
  compatibility: '星盘配对',
  moonSign: '月亮星座',
  risingSign: '上升星座',
  moonPhase: '月相',
  saturnReturn: '土星回归',
  transits: '行运',
  birthday: '生日星座',
  retrogrades: '逆行',
  footerTag: '免费的占星工具和星座指南，星盘在你自己的浏览器里计算。',
  footerStartHere: '占星入门',
  footerPlanets: '行星',
  footerHouses: '宫位',
  footerZodiacDates: '星座日期',
  footerGlossary: '术语表',
  footerCompute: '星盘如何计算',
  footerRegistry: 'Registry',
  footerSdk: 'SDK',
  footerDisclosure: '声明',
  trustFreeAnswer: '本站的占星工具和指南全部免费，无需注册。Zodiacs.org 同时运营十二星座代币收藏 Astrofolio。',
  trustDisclosure: '阅读我们的声明',
  footerAbout: '关于本站',
  footerPrivacy: '隐私',
  footerTerms: '使用条款',
  footerWidgets: '小组件',
  footerPlaceData: '地点数据',
  footerFonts: '字体许可',
  editedBy: '发布方',
  editorialHow: '编辑准则',
} as const satisfies Partial<UiCatalog>;

export default zhHans;
