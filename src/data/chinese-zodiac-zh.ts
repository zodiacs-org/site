import type { SectionLocale } from '../lib/i18n/core';
import type { CHINESE_ZODIAC_COPY } from './chinese-zodiac';

type ChineseZodiacCopy = Record<keyof typeof CHINESE_ZODIAC_COPY, string>;
interface ChineseZodiacAnimalCopy { name: string; association: string; context: string }

/**
 * Simplified and Traditional Chinese editions of the Chinese zodiac guide.
 * Written for Chinese readers rather than carried over sentence by sentence:
 * the same facts and limits as the English guide, with the calendar terms
 * (地支, 干支, 农历/農曆, 立春) a Chinese reader looks for. Traditional
 * Chinese avoids wording that reads differently in Taiwan and Hong Kong.
 */
export const CHINESE_ZODIAC_ZH: Record<SectionLocale, {
  copy: ChineseZodiacCopy;
  animals: Record<string, ChineseZodiacAnimalCopy>;
}> = {
  'zh-hans': {
    copy: {
      kicker: '十二生肖',
      hubTitle: '十二生肖，十二年一轮',
      hubIntro: '这是一份十二生肖的入门介绍：生肖的顺序、对应的年份、历史背景，以及为什么生肖年并不是从1月1日开始。',
      separateTitle: '和西方占星是两套不同的体系',
      separateBody: '西方占星采用回归黄道，把行星放进黄道的十二个区段里来看，并且需要精确的出生时刻。这里的十二生肖页面则从农历年和它对应的地支生肖讲起。两套体系可以对照着学，但彼此之间没有一一对应的换算。',
      historyTitle: '生肖与地支',
      historyBody: '十二种动物与十二地支一一相配。根据史料，最晚在公元前3世纪，中国已经把动物和历法联系在一起；到公元1世纪，这种对应已经十分稳定。地支还会与十天干相配，组成以六十为一轮的干支循环，也就是常说的六十甲子。',
      boundaryTitle: '生肖年从农历新年算起',
      boundaryBody: '生肖年不是在1月1日换的。如果生日在1月或2月，先查一查那一年的农历新年（春节）是哪一天，再确定生肖。另外，有些传统做法（例如排八字时的年柱）以立春为一年的起点；立春在每年2月4日前后，和以春节为界的习惯不同。亚洲各地的传统也有差异，并不是每个地方都使用同样的生肖。',
      sourceTitle: '博物馆与文化资料',
      sequenceTitle: '十二生肖的顺序',
      yearsTitle: '近年和未来几年的生肖',
      animalKicker: '生肖年份指南',
      branchLabel: '地支',
      sequenceLabel: '顺序',
      associationLabel: '传统寓意',
      yearsLabel: '生肖年份',
      yearsBoundary: '这里的年份指的是在该公历年内开始的农历年，旁边标注的是那一年的干支。1月和2月出生的人，可能属于前一个生肖。',
      limitsTitle: '它能说明什么，不能说明什么',
      limitsBody: '年份生肖只是历法中的一层。更完整的传统解读还会看天干与五行，以及出生的月、日、时。单凭一个生肖，既不能断定一个人的性格，也不能预言任何结果。',
      allAnimals: '全部十二个生肖',
      previous: '上一个生肖',
      next: '下一个生肖',
      westernLink: '了解西方星座的日期是怎么划分的（英文）',
      chartLink: '计算西方占星的出生星盘（英文）',
      iconRailNote: '这些彩色圆标是 Zodiacs.org 用来代表西方十二星座的站点标识，不代表十二生肖，也和生肖没有对应关系。',
      itemLink: '了解{animal}年',
      siteName: 'Zodiacs.org',
      learnLabel: '学习',
      metaHubTitle: '十二生肖：生肖顺序、年份对照与历史 | Zodiacs.org',
      metaAnimalTitle: '生肖{animal}：属{animal}的年份与传统寓意 | Zodiacs.org',
      metaAnimalDescription: '{animal}年对应地支“{branch}”。本页列出属{animal}的年份、这个生肖的传统寓意，以及以农历新年为界的换年规则。',
      yearOf: '{animal}年',
      numberLabel: '{number}',
      positionValue: '十二生肖中的第{position}位',
      sourceSmithsonian: '史密森尼学会：十二生肖的顺序与农历新年（英文）',
      sourceSmithsonianHub: '史密森尼学会：农历新年与生肖顺序（英文）',
      sourceMet: '大都会艺术博物馆：十二年生肖纪年及其历史（英文）',
      sourceMetHub: '大都会艺术博物馆：十二生肖纪年的历史（英文）',
      sourceMetBulletin: '大都会艺术博物馆馆刊：动物、地支与六十甲子（英文）',
    },
    animals: {
      rat: {
        name: '鼠',
        association: '传统上与机警、灵活应变，以及在局促处境中找到出路联系在一起。',
        context: '鼠排在十二生肖的第一位。现代的性格描述常说属鼠的人机灵、有办法，但这只是文化上的联想，并不是测量出来的特质。',
      },
      ox: {
        name: '牛',
        association: '传统上象征踏实勤劳、吃苦耐劳和务实负责。',
        context: '在中国艺术中，黄牛和水牛可能被视为同一个生肖。这个形象强调的是持久的劳作，而不是速度。',
      },
      tiger: {
        name: '虎',
        association: '传统上代表勇气、力量和守护。',
        context: '在中国的视觉文化里，虎既有勇猛的一面，也有护佑的一面，例如给孩子穿的虎头鞋。简短的性格清单只抓住了这个象征的一种用法。',
      },
      rabbit: {
        name: '兔',
        association: '传统上让人联想到警觉、优雅和谨慎的行动。',
        context: '英文资料里有时写作 Rabbit，有时写作 Hare。不同地区的生肖传统也可能换成别的动物，例如越南生肖里的猫，这也是本指南只讲中国生肖的原因之一。',
      },
      dragon: {
        name: '龙',
        association: '传统上象征祥瑞、生机和权威。',
        context: '龙是十二生肖里唯一的神话动物。它的文化意涵，和许多欧洲故事里与人为敌的恶龙很不一样。',
      },
      snake: {
        name: '蛇',
        association: '传统上与洞察力、内敛和蜕变相连。',
        context: '蛇在生肖循环中紧跟在龙之后。各种解读赋予它的特质，会因资料来源、家庭和地区而不同；它在历法中的位置才是确定的事实。',
      },
      horse: {
        name: '马',
        association: '传统上代表勤奋、勇敢、坚韧和奔走不息。',
        context: '马排在第七位。史密森尼学会为2026年丙午火马年准备的资料，着重介绍勤奋、勇敢和坚韧。',
      },
      goat: {
        name: '羊',
        association: '传统上与体贴、和睦以及用心培育事物联系在一起。',
        context: '英文里会写成 Goat、Ram 或 Sheep。中文的“羊”本来就同时涵盖山羊和绵羊，不必像英文那样区分。',
      },
      monkey: {
        name: '猴',
        association: '传统上象征机智、爱玩和随机应变。',
        context: '猴排在第九位。民间故事和流行的性格解读，给这个生肖添上了历法之外的许多层次，孙悟空的形象就是一例；这些层次在各地华人社群中并不一致。',
      },
      rooster: {
        name: '鸡',
        association: '传统上与勤奋、报晓守时和兢兢业业相连。',
        context: '大都会艺术博物馆指出，人们把勤勉与公鸡联系起来，是因为它清早就啼叫；同时，公鸡作为吉祥纹样，在艺术中也有很长的使用历史。',
      },
      dog: {
        name: '狗',
        association: '传统上代表忠诚、警觉和守护。',
        context: '狗排在第十一位。和本指南的每一页一样，这里说的寓意描述的是一种解读传统，而不是对性格的诊断。',
      },
      pig: {
        name: '猪',
        association: '传统上象征富足、慷慨和圆满。',
        context: '猪是生肖循环的最后一位，之后又回到鼠。英文资料里 Boar 和 Pig 两种写法都有。',
      },
    },
  },
  'zh-hant': {
    copy: {
      kicker: '十二生肖',
      hubTitle: '十二生肖，十二年一輪',
      hubIntro: '這是一份十二生肖的入門介紹：生肖的順序、對應的年份、歷史背景，以及為什麼生肖年並不是從1月1日開始。',
      separateTitle: '和西方占星是兩套不同的體系',
      separateBody: '西方占星採用回歸黃道，把行星放進黃道的十二個區段裡來看，並且需要精確的出生時刻。這裡的十二生肖頁面則從農曆年和它對應的地支生肖講起。兩套體系可以對照著學，但彼此之間沒有一一對應的換算。',
      historyTitle: '生肖與地支',
      historyBody: '十二種動物與十二地支一一相配。根據史料，最晚在西元前3世紀，中國已經把動物和曆法聯繫在一起；到西元1世紀，這種對應已經十分穩定。地支還會與十天干相配，組成以六十為一輪的干支循環，也就是常說的六十甲子。',
      boundaryTitle: '生肖年從農曆新年算起',
      boundaryBody: '生肖年不是在1月1日換的。如果生日在1月或2月，先查一查那一年的農曆新年（春節）是哪一天，再確定生肖。另外，有些傳統做法（例如排八字時的年柱）以立春為一年的起點；立春在每年2月4日前後，和以春節為界的習慣不同。亞洲各地的傳統也有差異，並不是每個地方都使用同樣的生肖。',
      sourceTitle: '博物館與文化資料',
      sequenceTitle: '十二生肖的順序',
      yearsTitle: '近年和未來幾年的生肖',
      animalKicker: '生肖年份指南',
      branchLabel: '地支',
      sequenceLabel: '順序',
      associationLabel: '傳統寓意',
      yearsLabel: '生肖年份',
      yearsBoundary: '這裡的年份指的是在該西曆年內開始的農曆年，旁邊標示的是那一年的干支。1月和2月出生的人，可能屬於前一個生肖。',
      limitsTitle: '它能說明什麼，不能說明什麼',
      limitsBody: '年份生肖只是曆法中的一層。更完整的傳統解讀還會看天干與五行，以及出生的月、日、時。單憑一個生肖，既不能斷定一個人的性格，也不能預言任何結果。',
      allAnimals: '全部十二個生肖',
      previous: '上一個生肖',
      next: '下一個生肖',
      westernLink: '了解西方星座的日期是怎麼劃分的（英文）',
      chartLink: '計算西方占星的出生星盤（英文）',
      iconRailNote: '這些彩色圓標是 Zodiacs.org 用來代表西方十二星座的網站標誌，不代表十二生肖，也和生肖沒有對應關係。',
      itemLink: '了解{animal}年',
      siteName: 'Zodiacs.org',
      learnLabel: '學習',
      metaHubTitle: '十二生肖：生肖順序、年份對照與歷史 | Zodiacs.org',
      metaAnimalTitle: '生肖{animal}：屬{animal}的年份與傳統寓意 | Zodiacs.org',
      metaAnimalDescription: '{animal}年對應地支「{branch}」。本頁列出屬{animal}的年份、這個生肖的傳統寓意，以及以農曆新年為界的換年規則。',
      yearOf: '{animal}年',
      numberLabel: '{number}',
      positionValue: '十二生肖中的第{position}位',
      sourceSmithsonian: '史密森尼學會：十二生肖的順序與農曆新年（英文）',
      sourceSmithsonianHub: '史密森尼學會：農曆新年與生肖順序（英文）',
      sourceMet: '大都會藝術博物館：十二年生肖紀年及其歷史（英文）',
      sourceMetHub: '大都會藝術博物館：十二生肖紀年的歷史（英文）',
      sourceMetBulletin: '大都會藝術博物館館刊：動物、地支與六十甲子（英文）',
    },
    animals: {
      rat: {
        name: '鼠',
        association: '傳統上與機警、靈活應變，以及在侷促處境中找到出路聯繫在一起。',
        context: '鼠排在十二生肖的第一位。現代的性格描述常說屬鼠的人機靈、有辦法，但這只是文化上的聯想，並不是測量出來的特質。',
      },
      ox: {
        name: '牛',
        association: '傳統上象徵踏實勤勞、吃苦耐勞和務實負責。',
        context: '在中國藝術中，黃牛和水牛可能被視為同一個生肖。這個形象強調的是持久的勞作，而不是速度。',
      },
      tiger: {
        name: '虎',
        association: '傳統上代表勇氣、力量和守護。',
        context: '在中國的視覺文化裡，虎既有勇猛的一面，也有護佑的一面，例如給孩子穿的虎頭鞋。簡短的性格清單只抓住了這個象徵的一種用法。',
      },
      rabbit: {
        name: '兔',
        association: '傳統上讓人聯想到警覺、優雅和謹慎的行動。',
        context: '英文資料裡有時寫作 Rabbit，有時寫作 Hare。不同地區的生肖傳統也可能換成別的動物，例如越南生肖裡的貓，這也是本指南只談中國生肖的原因之一。',
      },
      dragon: {
        name: '龍',
        association: '傳統上象徵祥瑞、生機和權威。',
        context: '龍是十二生肖裡唯一的神話動物。牠的文化意涵，和許多歐洲故事裡與人為敵的惡龍很不一樣。',
      },
      snake: {
        name: '蛇',
        association: '傳統上與洞察力、內斂和蛻變相連。',
        context: '蛇在生肖循環中緊跟在龍之後。各種解讀賦予牠的特質，會因資料來源、家庭和地區而不同；牠在曆法中的位置才是確定的事實。',
      },
      horse: {
        name: '馬',
        association: '傳統上代表勤奮、勇敢、堅韌和奔走不息。',
        context: '馬排在第七位。史密森尼學會為2026年丙午火馬年準備的資料，著重介紹勤奮、勇敢和堅韌。',
      },
      goat: {
        name: '羊',
        association: '傳統上與體貼、和睦以及用心培育事物聯繫在一起。',
        context: '英文裡會寫成 Goat、Ram 或 Sheep。中文的「羊」本來就同時涵蓋山羊和綿羊，不必像英文那樣區分。',
      },
      monkey: {
        name: '猴',
        association: '傳統上象徵機智、愛玩和隨機應變。',
        context: '猴排在第九位。民間故事和流行的性格解讀，給這個生肖添上了曆法之外的許多層次，孫悟空的形象就是一例；這些層次在各地華人社群中並不一致。',
      },
      rooster: {
        name: '雞',
        association: '傳統上與勤奮、報曉守時和兢兢業業相連。',
        context: '大都會藝術博物館指出，人們把勤勉與公雞聯繫起來，是因為牠清早就啼叫；同時，公雞作為吉祥紋樣，在藝術中也有很長的使用歷史。',
      },
      dog: {
        name: '狗',
        association: '傳統上代表忠誠、警覺和守護。',
        context: '狗排在第十一位。和本指南的每一頁一樣，這裡說的寓意描述的是一種解讀傳統，而不是對性格的診斷。',
      },
      pig: {
        name: '豬',
        association: '傳統上象徵富足、慷慨和圓滿。',
        context: '豬是生肖循環的最後一位，之後又回到鼠。英文資料裡 Boar 和 Pig 兩種寫法都有。',
      },
    },
  },
};

const HEAVENLY_STEMS = '甲乙丙丁戊己庚辛壬癸';
const EARTHLY_BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

/** The stem-branch (干支) name of the lunisolar year beginning in a Gregorian year; 1984 is 甲子. */
export function stemBranchYear(year: number): string {
  const offset = year - 1984;
  return HEAVENLY_STEMS[((offset % 10) + 10) % 10] + EARTHLY_BRANCHES[((offset % 12) + 12) % 12];
}
