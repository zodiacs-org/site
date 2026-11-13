/** Fechas del zodiaco en español. */
import type { ZodiacDatesCopy } from './types';

export const es: ZodiacDatesCopy = {
  locale: 'es',
  title: (current, next) => `Fechas de los signos del zodiaco ${current} y ${next}`,
  h1: 'Fechas de los signos del zodiaco',
  description: (current, next) => `Los doce signos con sus fechas, elemento, modalidad y regente, y el minuto exacto en UTC en que el Sol entra en cada signo en ${current} y ${next}.`,
  lede: (current, next) => `Las fechas habituales de cada signo son aproximadas: el Sol cambia de signo en un momento distinto cada año. Aquí tienes el minuto exacto, en UTC, de cada entrada en ${current} y ${next}.`,
  crumbs: 'Aprender',
  tableHeading: 'Los doce signos en una tabla',
  tableCaption: (current, next) => `Fechas, correspondencias y entrada exacta del Sol en cada signo, ${current} y ${next}`,
  columns: {
    sign: 'Signo', dates: 'Fechas habituales', longitude: 'Longitud', element: 'Elemento', modality: 'Modalidad',
    ruler: 'Regente', seasons: 'Estación', ingress: (year) => `Entrada del Sol ${year}`,
  },
  north: 'Norte',
  south: 'Sur',
  season: { Spring: 'primavera', Summer: 'verano', Autumn: 'otoño', Winter: 'invierno' },
  explainerHeading: 'Qué significan las fechas exactas',
  explainer: [
    'El zodiaco tropical empieza en Aries, en el grado 0 de longitud eclíptica, y divide el círculo en doce signos iguales de 30 grados. Esos límites no cambian; lo que cambia es la fecha y la hora en que el Sol los cruza, porque un año no tiene un número exacto de días.',
    'Por eso dos personas nacidas el mismo día del calendario, en años distintos, pueden tener signos solares diferentes si nacieron cerca del cambio. Lo que se suele llamar «cúspide» no es un signo mixto: el Sol siempre está en un signo o en el otro.',
    'Si naciste cerca de una de estas fechas, comprueba tu signo con la fecha, la hora y el lugar de nacimiento. La hora local depende de la zona horaria de ese día, y el cálculo de la carta natal la tiene en cuenta.',
  ],
  calculatorLink: 'Calcula tu carta natal',
  methodLink: 'Cómo se calculan las fechas',
  csvLink: 'Descargar la tabla (CSV, en inglés)',
  faqHeading: 'Preguntas frecuentes',
  faq: (current) => [
    {
      q: '¿Por qué cambian las fechas de los signos cada año?',
      a: 'Porque el año del calendario y el año solar no coinciden al minuto. El Sol cruza el mismo punto del cielo cada año, pero a una hora distinta, y a veces en un día distinto.',
    },
    {
      q: `¿Cuándo empieza Aries en ${current}?`,
      a: 'La tabla da el minuto exacto en UTC. Para tu hora local, suma o resta la diferencia de tu zona horaria.',
    },
    {
      q: '¿Qué pasa si nací en una cúspide?',
      a: 'Tu Sol está en un solo signo. Calcula tu carta natal con la hora y el lugar de nacimiento para saber cuál.',
    },
  ],
};
