import type { Sign } from '../lib/signs';

export interface SpanishGuide {
  sign: string;
  title: string;
  description: string;
  intro: string[];
  sections: { heading: string; body: string[]; risingProfile?: boolean }[];
  faq: { q: string; a: string }[];
}

const edgeCopy = 'Si naciste cerca del límite, calcula tu carta natal: el Sol no cambia de signo a la misma hora todos los años.';
const edgeShort = 'Si naciste cerca del límite, calcula tu carta natal gratis.';

export const ES_GUIDES: Record<string, SpanishGuide> = {
  aries: {
    sign: 'aries',
    title: 'Aries: fechas, personalidad y compatibilidad',
    description: `Aries: fechas, personalidad, amor y compatibilidad, y qué significa Aries en tu carta. ${edgeShort}`,
    intro: [
      'Aries abre la rueda zodiacal. Es el impulso de empezar, la chispa que aparece antes del plan perfecto y la valentía de moverse aunque todavía no estén todas las respuestas.',
      'En una carta natal, Aries muestra dónde actúas con más franqueza. No siempre es paciencia; muchas veces es honestidad, deseo y una necesidad muy clara de sentir que la vida avanza.',
    ],
    sections: [
      {
        heading: 'Personalidad de Aries',
        body: [
          'Aries suele ser directo, rápido y transparente. Cuando algo le importa, se nota. Esta energía prefiere una respuesta clara a una conversación que nunca termina, y suele aprender haciendo más que esperando permiso.',
          'Su lado luminoso es la iniciativa: anima, enciende, abre camino. Su reto es sostener lo que empezó cuando la emoción inicial baja. La madurez de Aries no consiste en apagarse, sino en elegir mejor dónde gastar el fuego.',
        ],
      },
      {
        heading: 'Aries en el amor',
        body: [
          'En vínculos, Aries busca deseo vivo, honestidad y una persona con mundo propio. Le atraen las relaciones donde puede haber juego, reto y movimiento, sin tener que adivinar lo que el otro siente.',
          'Se lleva con facilidad con Leo, Sagitario y Géminis. Con Cáncer, Capricornio y Libra puede haber más roce, pero también mucha química si ambos aprenden a escuchar el ritmo del otro.',
        ],
      },
      {
        heading: 'Aries en tu carta',
        body: [
          'Todos tenemos Aries en alguna zona de la carta. Allí quieres decidir, intentar y sentir autonomía. El Sol en Aries lo vuelve identidad; la Luna en Aries lo vuelve emoción inmediata; Aries ascendente lo vuelve presencia y primera impresión.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Aries?', a: `Aproximadamente del 21 de marzo al 19 de abril. ${edgeCopy}` },
      { q: '¿Aries es signo de fuego?', a: 'Sí. Aries es fuego cardinal: energía que inicia, enciende y empuja algo a comenzar.' },
      { q: '¿Con quién es compatible Aries?', a: 'Suele fluir con Leo, Sagitario y Géminis. Para una lectura útil de pareja, compara las dos cartas completas.' },
    ],
  },
  taurus: {
    sign: 'taurus',
    title: 'Tauro: fechas, personalidad y compatibilidad',
    description: `Tauro: fechas, personalidad, amor y compatibilidad, y qué significa Tauro en tu carta. ${edgeShort}`,
    intro: [
      'Tauro llega cuando la primavera deja de prometer y empieza a sostener. Es el signo de lo que se cuida con tiempo: cuerpo, placer, estabilidad, recursos y amor que se demuestra en hechos.',
      'En una carta natal, Tauro muestra dónde necesitas seguridad real. No solo comodidad: también ritmo propio, buenos límites y la paciencia de construir algo que dure.',
    ],
    sections: [
      {
        heading: 'Personalidad de Tauro',
        body: [
          'Tauro suele ser calmado, sensorial y constante. Decide despacio, pero cuando decide, rara vez cambia por presión externa. Su confianza se gana con presencia repetida, no con promesas grandes.',
          'Su fortaleza es la permanencia. Su reto es notar cuándo la lealtad se convirtió en inercia. A veces soltar también es una forma de cuidar lo que vale.',
        ],
      },
      {
        heading: 'Tauro en el amor',
        body: [
          'Tauro ama con hechos: tiempo, comida, contacto, memoria y cuidado práctico. Necesita estabilidad y coherencia; las señales mixtas suelen agotarlo rápido.',
          'Suele fluir con Virgo, Capricornio y Cáncer. Con Leo, Acuario y Escorpio puede haber una atracción fuerte y terca, siempre que ambos aprendan a ceder sin sentirse vencidos.',
        ],
      },
      {
        heading: 'Tauro en tu carta',
        body: [
          'Tauro señala dónde buscas calma, valor y una vida que se sienta habitable. En Venus habla de gusto y deseo; en la Luna, de seguridad emocional; en el ascendente, de presencia tranquila y firme.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Tauro?', a: `Aproximadamente del 20 de abril al 20 de mayo. ${edgeCopy}` },
      { q: '¿Tauro es signo de tierra?', a: 'Sí. Tauro es tierra fija: estabilidad, cuerpo, recursos y resistencia.' },
      { q: '¿Qué planeta rige Tauro?', a: 'Venus, asociada con amor, placer, belleza y valor.' },
    ],
  },
  gemini: {
    sign: 'gemini',
    title: 'Géminis: fechas, personalidad y compatibilidad',
    description: `Géminis: fechas, personalidad, amor y compatibilidad, y qué significa Géminis en tu carta. ${edgeShort}`,
    intro: [
      'Géminis es aire en movimiento: preguntas, conversaciones, conexiones y la rapidez de una mente que necesita variedad para sentirse viva.',
      'En una carta natal, Géminis muestra dónde aprendes probando, hablando, leyendo, cambiando de ángulo y reuniendo información antes de quedarte con una sola respuesta.',
    ],
    sections: [
      {
        heading: 'Personalidad de Géminis',
        body: [
          'Géminis suele ser curioso, ágil y sociable. Percibe patrones, cambia de tema con facilidad y muchas veces piensa mejor en voz alta. Su don es abrir ventanas.',
          'El reto es no confundir movimiento con dirección. Cuando Géminis elige una pregunta importante y se queda con ella, su inteligencia deja de dispersarse y se vuelve oficio.',
        ],
      },
      {
        heading: 'Géminis en el amor',
        body: [
          'Géminis necesita conversación, juego mental y espacio para respirar. Una relación que no permite curiosidad suele sentirse pequeña.',
          'Fluye con Libra, Acuario y Aries. Con Virgo, Piscis y Sagitario puede haber tensión entre detalle, sueño y libertad; bien llevada, esa tensión enseña mucho.',
        ],
      },
      {
        heading: 'Géminis en tu carta',
        body: [
          'Géminis marca la zona donde te conviene preguntar más, hablar más claro y permitirte cambiar de idea. En Mercurio es especialmente fuerte: lenguaje, aprendizaje y ritmo mental.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Géminis?', a: `Aproximadamente del 21 de mayo al 20 de junio. ${edgeCopy}` },
      { q: '¿Géminis es signo de aire?', a: 'Sí. Géminis es aire mutable: ideas, intercambio y adaptación.' },
      { q: '¿Qué planeta rige Géminis?', a: 'Mercurio, el planeta asociado con comunicación, lenguaje y movimiento de información.' },
    ],
  },
  cancer: {
    sign: 'cancer',
    title: 'Cáncer: fechas, personalidad y compatibilidad',
    description: `Cáncer: fechas, personalidad, amor y compatibilidad, y qué significa Cáncer en tu carta. ${edgeShort}`,
    intro: [
      'Cáncer empieza con el solsticio de junio: mucha luz, mucha memoria y una vuelta hacia lo íntimo. Es el signo del cuidado, la pertenencia y la sensibilidad que protege.',
      'En una carta natal, Cáncer muestra dónde sientes antes de explicar. También dónde necesitas hogar, confianza y una forma de seguridad que no sea solo material.',
    ],
    sections: [
      {
        heading: 'Personalidad de Cáncer',
        body: [
          'Cáncer suele ser intuitivo, leal y más fuerte de lo que parece. Lee ambientes con rapidez y recuerda detalles que otros olvidan. Su cuidado puede ser muy concreto: preguntar, alimentar, acompañar.',
          'El reto es pedir de frente en vez de probar si alguien adivina. La sensibilidad de Cáncer es un talento, pero necesita palabras claras para no convertirse en coraza.',
        ],
      },
      {
        heading: 'Cáncer en el amor',
        body: [
          'Cáncer busca ternura confiable. Ama creando refugio: rutinas, memoria compartida, gestos que dicen "te tengo presente". Necesita reciprocidad emocional, no solo intensidad.',
          'Fluye con Escorpio, Piscis y Tauro. Con Aries, Libra y Capricornio puede haber choque de ritmo, pero también vínculos muy fuertes si hay cuidado y madurez.',
        ],
      },
      {
        heading: 'Cáncer en tu carta',
        body: [
          'Cáncer señala dónde proteges, recuerdas y necesitas pertenecer. En la Luna se expresa con especial fuerza; en el ascendente, como una presencia sensible y observadora.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Cáncer?', a: `Aproximadamente del 21 de junio al 22 de julio. ${edgeCopy}` },
      { q: '¿Cáncer es signo de agua?', a: 'Sí. Cáncer es agua cardinal: emoción que inicia el cuidado.' },
      { q: '¿Qué planeta rige Cáncer?', a: 'La Luna, asociada con memoria, instinto, cuerpo emocional y necesidades de seguridad.' },
    ],
  },
  leo: {
    sign: 'leo',
    title: 'Leo: fechas, personalidad y compatibilidad',
    description: `Leo: fechas, personalidad, amor y compatibilidad, y qué significa Leo en tu carta. ${edgeShort}`,
    intro: [
      'Leo es el corazón del verano: presencia, calor, creatividad y el deseo de ser visto por lo que realmente se es.',
      'En una carta natal, Leo muestra dónde necesitas expresarte con orgullo sano. No se trata solo de atención; se trata de autoría, juego y generosidad visible.',
    ],
    sections: [
      {
        heading: 'Personalidad de Leo',
        body: [
          'Leo suele ser cálido, expresivo y leal. Tiene una forma natural de ocupar espacio, animar a otros y hacer que una escena cobre vida.',
          'Su reto es no depender de aplausos para recordar su valor. Cuando Leo crea desde el centro y no desde la necesidad de aprobación, su luz se vuelve más generosa.',
        ],
      },
      {
        heading: 'Leo en el amor',
        body: [
          'Leo ama con entusiasmo y necesita sentirse elegido. La indiferencia le duele más que una discusión honesta; prefiere una relación viva a una educada pero apagada.',
          'Fluye con Aries, Sagitario y Libra. Con Tauro, Escorpio y Acuario puede haber orgullo fijo de ambos lados, pero también una atracción muy potente.',
        ],
      },
      {
        heading: 'Leo en tu carta',
        body: [
          'Leo marca dónde quieres crear, jugar, liderar o mostrar algo propio. En el Sol se vuelve identidad central; en Venus, amor expresivo; en el ascendente, presencia radiante.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Leo?', a: `Aproximadamente del 23 de julio al 22 de agosto. ${edgeCopy}` },
      { q: '¿Leo es signo de fuego?', a: 'Sí. Leo es fuego fijo: calor sostenido, creatividad y lealtad.' },
      { q: '¿Qué planeta rige Leo?', a: 'El Sol, asociado con identidad, vitalidad y expresión consciente.' },
    ],
  },
  virgo: {
    sign: 'virgo',
    title: 'Virgo: fechas, personalidad y compatibilidad',
    description: `Virgo: fechas, personalidad, amor y compatibilidad, y qué significa Virgo en tu carta. ${edgeShort}`,
    intro: [
      'Virgo llega con la cosecha: mirar de cerca, separar lo útil de lo que sobra y hacer que las cosas funcionen mejor.',
      'En una carta natal, Virgo muestra dónde mejoras la vida con atención. Su magia no es la perfección; es la capacidad de notar lo que necesita ajuste.',
    ],
    sections: [
      {
        heading: 'Personalidad de Virgo',
        body: [
          'Virgo suele ser observador, práctico y exigente consigo mismo. Ve detalles que otros pasan por alto y muchas veces expresa amor ayudando de forma concreta.',
          'Su reto es permitir que algo sea suficientemente bueno. El mismo ojo que mejora proyectos puede volverse duro con la propia persona si no aprende a descansar.',
        ],
      },
      {
        heading: 'Virgo en el amor',
        body: [
          'Virgo ama prestando atención: recuerda, organiza, cuida y corrige porque quiere que algo dure. Necesita confianza para mostrar ternura sin sentir que pierde control.',
          'Fluye con Tauro, Capricornio y Cáncer. Con Géminis, Sagitario y Piscis puede haber tensión entre análisis, libertad y sensibilidad.',
        ],
      },
      {
        heading: 'Virgo en tu carta',
        body: [
          'Virgo señala dónde te conviene afinar procesos, cuidar hábitos y volver útil lo que sabes. En Mercurio habla de análisis; en la casa seis, de rutinas y salud cotidiana.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Virgo?', a: `Aproximadamente del 23 de agosto al 22 de septiembre. ${edgeCopy}` },
      { q: '¿Virgo es signo de tierra?', a: 'Sí. Virgo es tierra mutable: detalle, adaptación y mejora práctica.' },
      { q: '¿Qué planeta rige Virgo?', a: 'Mercurio, usado aquí como mente que ordena, edita y aplica.' },
    ],
  },
  libra: {
    sign: 'libra',
    title: 'Libra: fechas, personalidad y compatibilidad',
    description: `Libra: fechas, personalidad, amor y compatibilidad, y qué significa Libra en tu carta. ${edgeShort}`,
    intro: [
      'Libra empieza cerca del equinoccio de septiembre, cuando día y noche se equilibran. Su tema central es la relación: proporción, belleza, justicia y elección mutua.',
      'En una carta natal, Libra muestra dónde piensas mejor con otro espejo. También dónde necesitas armonía, pero no a costa de tu propia voz.',
    ],
    sections: [
      {
        heading: 'Personalidad de Libra',
        body: [
          'Libra suele ser encantador, diplomático y sensible a lo injusto. Percibe matices sociales con rapidez y sabe mejorar una atmósfera sin imponer fuerza.',
          'Su reto es decidir sin esperar que todas las opciones queden perfectamente equilibradas. A veces la paz real requiere una conversación incómoda.',
        ],
      },
      {
        heading: 'Libra en el amor',
        body: [
          'Libra busca complicidad, belleza y reciprocidad. Ama sentirse elegido y también elegir: una relación como conversación viva, no como obligación.',
          'Fluye con Géminis, Acuario y Leo. Con Cáncer, Capricornio y Aries puede haber tensión entre cuidado, estructura e independencia.',
        ],
      },
      {
        heading: 'Libra en tu carta',
        body: [
          'Libra marca dónde aprendes por contraste y cooperación. En Venus se vuelve gusto relacional; en Marte puede dudar antes de actuar; en el ascendente, muestra gracia social.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Libra?', a: `Aproximadamente del 23 de septiembre al 22 de octubre. ${edgeCopy}` },
      { q: '¿Libra es signo de aire?', a: 'Sí. Libra es aire cardinal: ideas que buscan encuentro y equilibrio.' },
      { q: '¿Qué planeta rige Libra?', a: 'Venus, en su faceta de belleza, vínculo, proporción y elección.' },
    ],
  },
  scorpio: {
    sign: 'scorpio',
    title: 'Escorpio: fechas, carácter y compatibilidad',
    description: `Escorpio: fechas, personalidad, amor y compatibilidad, y qué significa Escorpio en tu carta. ${edgeShort}`,
    intro: [
      'Escorpio aparece cuando el año entra en profundidad. Es el signo de lo que no se dice en voz alta: deseo, pérdida, confianza, transformación y verdad emocional.',
      'En una carta natal, Escorpio muestra dónde no te conformas con la superficie. Allí necesitas honestidad, intimidad y una forma de poder que no sea control.',
    ],
    sections: [
      {
        heading: 'Personalidad de Escorpio',
        body: [
          'Escorpio suele ser intenso, reservado y perceptivo. Lee subtextos, guarda información y se compromete por completo cuando confía.',
          'Su reto es no convertir la protección en aislamiento. La lealtad de Escorpio es enorme, pero necesita permitir que otros se acerquen antes de pasar todas las pruebas.',
        ],
      },
      {
        heading: 'Escorpio en el amor',
        body: [
          'Escorpio busca profundidad y verdad. No le interesan vínculos decorativos; quiere presencia real, deseo honesto y una intimidad donde lo difícil también tenga lugar.',
          'Fluye con Cáncer, Piscis y Virgo. Con Leo, Acuario y Tauro puede haber magnetismo fuerte y roces de control, orgullo o terquedad.',
        ],
      },
      {
        heading: 'Escorpio en tu carta',
        body: [
          'Escorpio marca dónde transformas, investigas y aprendes a confiar. En Marte habla de deseo estratégico; en la Luna, de emoción intensa; en el ascendente, de presencia magnética.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Escorpio?', a: `Aproximadamente del 23 de octubre al 21 de noviembre. ${edgeCopy}` },
      { q: '¿Escorpio es signo de agua?', a: 'Sí. Escorpio es agua fija: emoción profunda, sostenida y difícil de ignorar.' },
      { q: '¿Qué planeta rige Escorpio?', a: 'La tradición usa Marte; la astrología moderna también considera Plutón.' },
    ],
  },
  sagittarius: {
    sign: 'sagittarius',
    title: 'Sagitario: fechas, carácter y compatibilidad',
    description: `Sagitario: fechas, personalidad, amor y compatibilidad, y qué significa Sagitario en tu carta. ${edgeShort}`,
    intro: [
      'Sagitario mira hacia el horizonte. Es búsqueda, verdad, viaje, humor y la necesidad de que la vida tenga sentido más allá de la rutina.',
      'En una carta natal, Sagitario muestra dónde creces al explorar: lugares, ideas, creencias, estudios o conversaciones que ensanchan el mundo.',
    ],
    sections: [
      {
        heading: 'Personalidad de Sagitario',
        body: [
          'Sagitario suele ser honesto, optimista y libre. Tiene talento para levantar la moral y para decir verdades que otros rodean durante demasiado tiempo.',
          'Su reto es recordar que la verdad también necesita tacto. No todo encierro es compromiso, pero no todo compromiso es jaula.',
        ],
      },
      {
        heading: 'Sagitario en el amor',
        body: [
          'Sagitario necesita aventura compartida y una relación que respire. Quiere una persona con horizonte propio, no alguien que lo convierta en todo el mapa.',
          'Fluye con Aries, Leo y Acuario. Con Virgo, Piscis y Géminis puede haber tensión entre detalle, sensibilidad y exceso de movimiento.',
        ],
      },
      {
        heading: 'Sagitario en tu carta',
        body: [
          'Sagitario señala dónde buscas propósito, enseñanza y expansión. En Júpiter se vuelve fe y apetito; en Mercurio, franqueza; en el ascendente, una presencia abierta y directa.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Sagitario?', a: `Aproximadamente del 22 de noviembre al 21 de diciembre. ${edgeCopy}` },
      { q: '¿Sagitario es signo de fuego?', a: 'Sí. Sagitario es fuego mutable: visión, entusiasmo y cambio de perspectiva.' },
      { q: '¿Qué planeta rige Sagitario?', a: 'Júpiter, asociado con crecimiento, significado, fe y amplitud.' },
    ],
  },
  capricorn: {
    sign: 'capricorn',
    title: 'Capricornio: fechas, carácter y compatibilidad',
    description: `Capricornio: fechas, personalidad, amor y compatibilidad, y qué significa en tu carta. ${edgeShort}`,
    intro: [
      'Capricornio empieza con el solsticio de diciembre: poco ruido, mucha estructura y la paciencia de construir cuando todavía hace frío.',
      'En una carta natal, Capricornio muestra dónde tomas responsabilidad, mides el tiempo y quieres que algo sea real, no solo inspirador.',
    ],
    sections: [
      {
        heading: 'Personalidad de Capricornio',
        body: [
          'Capricornio suele ser serio, estratégico y resistente. Piensa en consecuencias, honra el esfuerzo y sabe que muchas cosas importantes no se construyen rápido.',
          'Su reto es no convertir la autosuficiencia en soledad. También merece descanso, ayuda y una vida que no sea solo rendimiento.',
        ],
      },
      {
        heading: 'Capricornio en el amor',
        body: [
          'Capricornio ama con compromiso práctico. Puede tardar en abrirse, pero cuando lo hace suele pensar en el largo plazo, el cuidado real y las decisiones sostenibles.',
          'Fluye con Tauro, Virgo y Escorpio. Con Aries, Libra y Cáncer puede haber tensión entre velocidad, vínculo y vulnerabilidad.',
        ],
      },
      {
        heading: 'Capricornio en tu carta',
        body: [
          'Capricornio marca dónde madurar no es castigo sino camino. En Saturno habla de límites y maestría; en el ascendente, de presencia contenida y ambiciosa.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Capricornio?', a: `Aproximadamente del 22 de diciembre al 19 de enero. ${edgeCopy}` },
      { q: '¿Capricornio es signo de tierra?', a: 'Sí. Capricornio es tierra cardinal: estructura que inicia y sostiene.' },
      { q: '¿Qué planeta rige Capricornio?', a: 'Saturno, asociado con tiempo, límites, responsabilidad y madurez.' },
    ],
  },
  aquarius: {
    sign: 'aquarius',
    title: 'Acuario: fechas, personalidad y compatibilidad',
    description: `Acuario: fechas, personalidad, amor y compatibilidad, y qué significa Acuario en tu carta. ${edgeShort}`,
    intro: [
      'Acuario mira el sistema desde afuera. Es pensamiento independiente, futuro, comunidad, diferencia y la pregunta de si una regla todavía sirve.',
      'En una carta natal, Acuario muestra dónde necesitas aire, visión y permiso para no encajar del todo.',
    ],
    sections: [
      {
        heading: 'Personalidad de Acuario',
        body: [
          'Acuario suele ser original, observador y difícil de presionar. Puede parecer distante, pero muchas veces está pensando en el panorama completo.',
          'Su reto es bajar de la idea a la presencia. Amar a la humanidad es noble; cuidar a la persona que está enfrente también.',
        ],
      },
      {
        heading: 'Acuario en el amor',
        body: [
          'Acuario necesita amistad, libertad mental y una relación que respete su rareza. Lo asfixia sentirse poseído, pero puede ser profundamente leal cuando hay espacio.',
          'Fluye con Géminis, Libra y Sagitario. Con Tauro, Escorpio y Leo puede haber tensión fija: nadie quiere ceder primero.',
        ],
      },
      {
        heading: 'Acuario en tu carta',
        body: [
          'Acuario señala dónde innovas, cuestionas y buscas una versión más libre de la vida. En Saturno habla de estructura social; en Urano, de ruptura y cambio.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Acuario?', a: `Aproximadamente del 20 de enero al 18 de febrero. ${edgeCopy}` },
      { q: '¿Acuario es signo de agua?', a: 'No. Aunque su símbolo es el portador de agua, Acuario es signo de aire.' },
      { q: '¿Qué planeta rige Acuario?', a: 'La tradición usa Saturno; la astrología moderna también considera Urano.' },
    ],
  },
  pisces: {
    sign: 'pisces',
    title: 'Piscis: fechas, personalidad y compatibilidad',
    description: `Piscis: fechas, personalidad, amor y compatibilidad, y qué significa Piscis en tu carta. ${edgeShort}`,
    intro: [
      'Piscis cierra la rueda zodiacal. Es sensibilidad, imaginación, compasión y esa parte de la vida que no cabe del todo en palabras.',
      'En una carta natal, Piscis muestra dónde sientes los bordes más suaves: intuición, arte, sueño, fe, cansancio ajeno y deseo de conexión profunda.',
    ],
    sections: [
      {
        heading: 'Personalidad de Piscis',
        body: [
          'Piscis suele ser empático, creativo y permeable. Capta atmósferas, imagina posibilidades y muchas veces entiende antes de que alguien explique.',
          'Su reto son los límites. Sentir mucho no significa cargarlo todo; ayudar no exige desaparecer. Piscis florece cuando su compasión tiene forma.',
        ],
      },
      {
        heading: 'Piscis en el amor',
        body: [
          'Piscis ama con imaginación y entrega. Busca ternura, misterio y una relación donde el mundo invisible de ambos tenga lugar.',
          'Fluye con Cáncer, Escorpio y Capricornio. Con Géminis, Sagitario y Virgo puede haber tensión entre sueño, verdad y orden.',
        ],
      },
      {
        heading: 'Piscis en tu carta',
        body: [
          'Piscis señala dónde necesitas inspiración y descanso del exceso de dureza. En la Luna es emoción porosa; en Venus, amor idealista; en el ascendente, presencia suave y cambiante.',
        ],
      },
    ],
    faq: [
      { q: '¿Cuáles son las fechas de Piscis?', a: `Aproximadamente del 19 de febrero al 20 de marzo. ${edgeCopy}` },
      { q: '¿Piscis es signo de agua?', a: 'Sí. Piscis es agua mutable: sensibilidad, imaginación y adaptación emocional.' },
      { q: '¿Qué planeta rige Piscis?', a: 'La tradición usa Júpiter; la astrología moderna también considera Neptuno.' },
    ],
  },
};

interface GuideDepth {
  name: string;
  dateRange: string;
  elementMode: string;
  ruling: string;
  temperament: string;
  gift: string;
  challenge: string;
  loveNeeds: string;
  friendship: string;
  work: string;
  purpose: string;
  sun: string;
  moon: string;
  rising: string;
  venus: string;
  mars: string;
  house: string;
  growth: string;
  easeful: string;
  charged: string;
  bodyCare: string;
  privateTruth: string;
}

const DEPTH: Record<string, GuideDepth> = {
  aries: {
    name: 'Aries',
    dateRange: 'del 21 de marzo al 19 de abril',
    elementMode: 'fuego cardinal',
    ruling: 'Marte',
    temperament: 'rápido, frontal y difícil de convencer con excusas',
    gift: 'enciende lo que otros todavía están pensando y convierte una posibilidad en movimiento',
    challenge: 'confundir urgencia con verdad, o abandonar algo cuando deja de sentirse nuevo',
    loveNeeds: 'deseo claro, juego, honestidad y una persona que no apague su impulso',
    friendship: 'amistades vivas, planes espontáneos y gente capaz de decir sí sin pedir un comité',
    work: 'empezar proyectos, resolver emergencias, competir de frente y abrir terreno',
    purpose: 'aprender a iniciar sin quemarse, liderar sin arrasar y elegir batallas que merezcan su fuego',
    sun: 'identidad que se descubre actuando; la persona sabe quién es cuando tiene algo que empezar',
    moon: 'emoción inmediata: siente rápido, se enoja rápido y también puede volver a la vida con rapidez',
    rising: 'presencia directa, juvenil y física; entra en una sala como si ya hubiera decidido avanzar',
    venus: 'amor que se mueve primero, dice lo que quiere y prefiere una chispa honesta a un romance tibio',
    mars: 'deseo y conflicto en estado puro: acción visible, competencia abierta y poca paciencia para rodeos',
    house: 'la zona donde necesitas autonomía, decisión y permiso para probar antes de tener garantías',
    growth: 'bajar la velocidad lo suficiente para escuchar, terminar lo que importa y no tratar cada demora como una derrota',
    easeful: 'Leo, Sagitario y Géminis suelen alimentar su entusiasmo sin pedirle que se vuelva otra persona',
    charged: 'Cáncer, Capricornio y Libra pueden mostrarle el valor de la pausa, el cuidado y la negociación',
    bodyCare: 'movimiento, sudor, descanso después del esfuerzo y una salida limpia para la rabia',
    privateTruth: 'Aries no siempre quiere ganar; muchas veces solo quiere sentirse vivo y libre para intentar',
  },
  taurus: {
    name: 'Tauro',
    dateRange: 'del 20 de abril al 20 de mayo',
    elementMode: 'tierra fija',
    ruling: 'Venus',
    temperament: 'calmo, sensorial y más resistente de lo que parece a primera vista',
    gift: 'vuelve habitable la vida: cuida cuerpos, ritmos, recursos y vínculos con constancia',
    challenge: 'quedarse demasiado tiempo donde ya no hay crecimiento porque lo conocido parece más seguro',
    loveNeeds: 'lealtad, contacto, coherencia y gestos que se puedan sentir en la vida diaria',
    friendship: 'amistades confiables, planes ricos en comida, música, memoria y presencia sin prisa',
    work: 'construir valor, sostener procesos, administrar recursos y mejorar lo material con buen gusto',
    purpose: 'aprender que la estabilidad no es quietud, sino una base desde donde el deseo puede respirar',
    sun: 'identidad que necesita tiempo, cuerpo y una relación clara con lo que vale',
    moon: 'emoción que se regula con seguridad, contacto, rutina y señales repetidas de confianza',
    rising: 'presencia tranquila, firme y atractiva; el mundo lo lee como alguien difícil de mover por presión',
    venus: 'amor sensual y paciente, con una memoria fina para el placer y el cuidado práctico',
    mars: 'deseo constante: tarda en arrancar, pero una vez que decide tiene una fuerza enorme',
    house: 'la zona donde buscas calma, propiedad interior, placer simple y decisiones sostenibles',
    growth: 'soltar antes de endurecerte, distinguir lealtad de costumbre y permitir que el cambio también sea cuidado',
    easeful: 'Virgo, Capricornio y Cáncer suelen entender su necesidad de confianza y ritmo',
    charged: 'Leo, Acuario y Escorpio pueden traer orgullo, intensidad y una atracción que pide flexibilidad',
    bodyCare: 'sueño regular, buena comida, tacto, naturaleza y menos presión para responder al instante',
    privateTruth: 'Tauro no es terco por deporte; protege lo que le costó tiempo amar',
  },
  gemini: {
    name: 'Géminis',
    dateRange: 'del 21 de mayo al 20 de junio',
    elementMode: 'aire mutable',
    ruling: 'Mercurio',
    temperament: 'curioso, verbal, móvil y capaz de encontrar tres ángulos donde otros ven uno',
    gift: 'abre ventanas: conecta personas, ideas, datos y posibilidades con una rapidez contagiosa',
    challenge: 'moverse tanto que una pregunta importante no tenga tiempo de volverse sabiduría',
    loveNeeds: 'conversación, humor, libertad mental y una relación que no castigue la curiosidad',
    friendship: 'amistades inteligentes, mensajes a deshora, planes cambiantes y complicidad para pensar en voz alta',
    work: 'comunicar, traducir, enseñar, vender, investigar, escribir y detectar patrones en movimiento',
    purpose: 'convertir información en lenguaje útil sin perder el placer de preguntar',
    sun: 'identidad hecha de aprendizaje; se reconoce cuando puede nombrar, comparar y cambiar de idea',
    moon: 'emoción que necesita hablar, escribir o moverse para entender lo que siente',
    rising: 'presencia ligera, expresiva y despierta; parece enterarse de todo antes de que se diga',
    venus: 'amor que empieza en la mente y crece con juego, mensajes, referencias compartidas y risa',
    mars: 'deseo inquieto: discute, prueba, pregunta y puede cansarse si no hay estímulo',
    house: 'la zona donde necesitas variedad, lenguaje, intercambio y permiso para experimentar',
    growth: 'quedarte con una conversación difícil, cuidar la atención y no usar el ingenio para esquivar vulnerabilidad',
    easeful: 'Libra, Acuario y Aries suelen darle aire, chispa y una sensación de movimiento compartido',
    charged: 'Virgo, Piscis y Sagitario pueden tensar detalle, sueño y verdad, pero también expandir su mirada',
    bodyCare: 'menos pantallas antes de dormir, caminatas, respiración y espacios donde la mente no tenga que rendir',
    privateTruth: 'Géminis no cambia porque no sienta; cambia porque percibe demasiado para fingir una sola respuesta',
  },
  cancer: {
    name: 'Cáncer',
    dateRange: 'del 21 de junio al 22 de julio',
    elementMode: 'agua cardinal',
    ruling: 'la Luna',
    temperament: 'intuitivo, protector y más fuerte cuando puede cuidar sin esconderse',
    gift: 'crea refugio: recuerda, acompaña, nutre y lee necesidades antes de que tengan palabras',
    challenge: 'esperar que otros adivinen lo que duele o usar la coraza cuando bastaría pedir',
    loveNeeds: 'ternura confiable, memoria compartida, reciprocidad emocional y una casa simbólica a la que volver',
    friendship: 'amistades leales, conversaciones íntimas y gente que entiende el peso de los pequeños gestos',
    work: 'cuidar, conservar, diseñar hogares, sostener equipos, narrar memorias y proteger lo vulnerable',
    purpose: 'aprender que sensibilidad y claridad pueden convivir; cuidar no exige desaparecer',
    sun: 'identidad que se ordena alrededor de pertenencia, memoria y protección',
    moon: 'emoción muy fuerte porque la Luna está en casa: necesita seguridad, ritmos y permiso para sentir',
    rising: 'presencia observadora y sensible; al principio puede parecer reservada, luego profundamente cercana',
    venus: 'amor nutritivo, atento y nostálgico, con deseo de crear un mundo privado entre dos',
    mars: 'acción protectora: pelea por quienes ama, aunque a veces se mueva de lado antes de entrar de frente',
    house: 'la zona donde necesitas hogar, intimidad, cuidado y una relación honesta con tus raíces',
    growth: 'nombrar necesidades antes de resentirte, aceptar ayuda y no convertir cada distancia en abandono',
    easeful: 'Escorpio, Piscis y Tauro suelen comprender su profundidad emocional y su necesidad de confianza',
    charged: 'Aries, Libra y Capricornio pueden enseñarle independencia, negociación y estructura',
    bodyCare: 'comida simple, descanso, agua, rituales domésticos y límites claros con el drama ajeno',
    privateTruth: 'Cáncer no es frágil; es permeable, y por eso necesita elegir muy bien a quién deja entrar',
  },
  leo: {
    name: 'Leo',
    dateRange: 'del 23 de julio al 22 de agosto',
    elementMode: 'fuego fijo',
    ruling: 'el Sol',
    temperament: 'cálido, leal, teatral cuando hace falta y orgulloso de lo que ama',
    gift: 'da vida a una escena: anima, celebra, crea y recuerda a otros que también pueden brillar',
    challenge: 'depender demasiado de la mirada externa o confundir orgullo con protección',
    loveNeeds: 'ser elegido con alegría, jugar, recibir atención real y dar afecto sin sentirse usado',
    friendship: 'amistades generosas, celebraciones, proyectos creativos y lealtades visibles',
    work: 'liderar, actuar, enseñar, diseñar experiencias, dirigir equipos y sostener una visión con corazón',
    purpose: 'crear desde el centro propio, no desde la necesidad de aprobación',
    sun: 'identidad solar en su propio terreno: vitalidad, autoría y deseo de vivir con presencia',
    moon: 'emoción que necesita reconocimiento, calidez y un lugar donde el corazón no parezca demasiado',
    rising: 'presencia magnética, expresiva y memorable; suele entrar con una luz difícil de ignorar',
    venus: 'amor demostrativo, romántico y generoso, con gusto por sentirse especial y hacer especial al otro',
    mars: 'deseo dramático y leal: pelea con orgullo, defiende lo amado y necesita una causa digna',
    house: 'la zona donde quieres crear, jugar, liderar y firmar algo con tu nombre',
    growth: 'escuchar incluso cuando no eres el centro, pedir cariño sin actuar una escena y compartir el escenario',
    easeful: 'Aries, Sagitario y Libra suelen alimentar su alegría, su fuego y su gusto por el intercambio',
    charged: 'Tauro, Escorpio y Acuario pueden mostrarle paciencia, profundidad y desapego',
    bodyCare: 'sol, movimiento placentero, juego, arte y descanso de tener que estar siempre encendido',
    privateTruth: 'Leo no solo quiere atención; quiere que su amor sea recibido con la misma grandeza con que lo ofrece',
  },
  virgo: {
    name: 'Virgo',
    dateRange: 'del 23 de agosto al 22 de septiembre',
    elementMode: 'tierra mutable',
    ruling: 'Mercurio',
    temperament: 'observador, útil, preciso y más sensible de lo que su eficiencia deja ver',
    gift: 'mejora lo que toca: ordena, edita, repara y convierte una idea en algo que funciona',
    challenge: 'confundir valor con perfección o usar la crítica para no sentir incertidumbre',
    loveNeeds: 'confianza, cuidado cotidiano, palabras claras y una relación donde ayudar no sea obligación silenciosa',
    friendship: 'amistades honestas, planes prácticos y gente que respeta los detalles pequeños',
    work: 'analizar, curar, escribir, investigar, cuidar la salud, diseñar procesos y volver útil el conocimiento',
    purpose: 'aprender que lo suficientemente bueno también puede ser bello y que el descanso es parte del método',
    sun: 'identidad construida a través de servicio, oficio, observación y mejora continua',
    moon: 'emoción que se regula con orden, rutina y una sensación de ser útil sin explotarse',
    rising: 'presencia limpia, atenta y reservada; el mundo lo lee como alguien que nota lo que falta',
    venus: 'amor cuidadoso y selectivo, expresado en gestos concretos más que en discursos enormes',
    mars: 'deseo aplicado: corrige, practica, perfecciona y puede frustrarse cuando el caos gana',
    house: 'la zona donde necesitas afinar, simplificar, cuidar hábitos y aplicar discernimiento',
    growth: 'hablar con menos dureza contigo, dejar que otros ayuden y no convertir cada error en identidad',
    easeful: 'Tauro, Capricornio y Cáncer suelen valorar su cuidado práctico y su deseo de seguridad',
    charged: 'Géminis, Sagitario y Piscis pueden estirar su control hacia juego, amplitud y entrega',
    bodyCare: 'rutinas flexibles, digestión tranquila, sueño, pausas reales y menos listas imposibles',
    privateTruth: 'Virgo no busca fallas por placer; suele estar intentando que la vida duela menos',
  },
  libra: {
    name: 'Libra',
    dateRange: 'del 23 de septiembre al 22 de octubre',
    elementMode: 'aire cardinal',
    ruling: 'Venus',
    temperament: 'diplomático, perceptivo y muy consciente de la atmósfera entre las personas',
    gift: 'encuentra proporción: embellece, media, escucha ambos lados y devuelve elegancia al conflicto',
    challenge: 'esperar una opción perfecta hasta que la vida decida por él',
    loveNeeds: 'reciprocidad, conversación, belleza compartida y una relación donde la elección sea mutua',
    friendship: 'amistades sociables, gusto compartido, debate amable y planes donde todos puedan estar cómodos',
    work: 'negociar, diseñar, asesorar, escribir, defender la justicia y crear experiencias equilibradas',
    purpose: 'aprender que la paz real a veces empieza con una frase incómoda dicha a tiempo',
    sun: 'identidad que se descubre en el espejo de los demás: relación, gusto, justicia y elección consciente',
    moon: 'emoción que necesita armonía, compañía y espacios donde el conflicto no se vuelva amenaza',
    rising: 'presencia elegante y social; suele suavizar el ambiente antes de mostrar su propia intensidad',
    venus: 'amor en su terreno: encanto, cooperación, estética y deseo de un vínculo bien cuidado',
    mars: 'acción mediada por la balanza: pelea por justicia, pero puede tardar en aceptar su propio enojo',
    house: 'la zona donde buscas equilibrio, alianza, belleza y decisiones que consideren al otro',
    growth: 'decidir antes de resentirte, sostener una postura propia y no llamar armonía a tu silencio',
    easeful: 'Géminis, Acuario y Leo suelen alimentar su conversación, su aire social y su sentido del juego',
    charged: 'Cáncer, Capricornio y Aries pueden mostrarle necesidad, estructura y deseo directo',
    bodyCare: 'belleza simple, arte, relaciones descansadas y tiempo a solas para escuchar su propia voz',
    privateTruth: 'Libra no evita el conflicto porque sea superficial; muchas veces siente demasiado el costo de romper el clima',
  },
  scorpio: {
    name: 'Escorpio',
    dateRange: 'del 23 de octubre al 21 de noviembre',
    elementMode: 'agua fija',
    ruling: 'Marte en la tradición, Plutón en lecturas modernas',
    temperament: 'intenso, reservado, perceptivo y poco interesado en versiones decorativas de la verdad',
    gift: 'entra donde otros no quieren mirar y encuentra poder, deseo, duelo y transformación',
    challenge: 'protegerse tanto que la intimidad tenga que pasar pruebas imposibles',
    loveNeeds: 'lealtad profunda, deseo honesto, confianza ganada y una relación capaz de hablar de lo difícil',
    friendship: 'amistades selectas, confidencias reales y gente que no traicione lo que se dijo en voz baja',
    work: 'investigar, sanar, analizar crisis, manejar recursos compartidos y trabajar con lo oculto',
    purpose: 'aprender que el poder no es control, y que confiar también puede ser una fuerza',
    sun: 'identidad que se forja atravesando intensidad; no se conforma con vivir en la superficie',
    moon: 'emoción profunda, privada y resistente; necesita tiempo para revelar lo que de verdad ocurre',
    rising: 'presencia magnética y observadora; puede hacer que otros se sientan leídos antes de hablar',
    venus: 'amor total, fiel y exigente, con deseo de fusión y miedo legítimo a la traición',
    mars: 'deseo estratégico: espera, observa, mide y actúa con fuerza cuando la decisión ya está tomada',
    house: 'la zona donde transformas, investigas, compartes poder y aprendes a soltar lo que te controla',
    growth: 'abrir ventanas antes de que el cuarto se vuelva cerrado, pedir verdad sin castigar vulnerabilidad',
    easeful: 'Cáncer, Piscis y Virgo suelen comprender su profundidad y su necesidad de confianza',
    charged: 'Leo, Acuario y Tauro pueden traer orgullo, distancia o terquedad, pero también magnetismo',
    bodyCare: 'privacidad, terapia, agua, movimiento intenso y prácticas que permitan descargar sin destruir',
    privateTruth: 'Escorpio no busca drama; busca algo lo bastante verdadero como para no tener que vigilarlo',
  },
  sagittarius: {
    name: 'Sagitario',
    dateRange: 'del 22 de noviembre al 21 de diciembre',
    elementMode: 'fuego mutable',
    ruling: 'Júpiter',
    temperament: 'franco, amplio, inquieto y más filosófico de lo que su humor deja ver',
    gift: 'ensancha el mapa: da perspectiva, ánimo, verdad y ganas de cruzar una puerta nueva',
    challenge: 'usar la libertad como excusa para no quedarse donde algo necesita cuidado',
    loveNeeds: 'espacio, aventura, honestidad, risa y una persona con horizonte propio',
    friendship: 'amistades viajeras, debates largos, planes improvisados y gente que no tema cambiar de opinión',
    work: 'enseñar, viajar, publicar, guiar, emprender, estudiar y conectar experiencias con significado',
    purpose: 'aprender que la verdad se vuelve más fuerte cuando también tiene tacto',
    sun: 'identidad que crece al explorar y encontrar un sentido más grande que la rutina',
    moon: 'emoción que necesita movimiento, esperanza y permiso para mirar más lejos',
    rising: 'presencia abierta, honesta y a veces desbordada; parece venir de camino hacia otra cosa',
    venus: 'amor aventurero, juguetón y libre, con gusto por la risa y las promesas que abren mundo',
    mars: 'deseo orientado por visión: pelea por principios, se enciende con causas y detesta sentirse encerrado',
    house: 'la zona donde buscas viaje, estudio, fe, humor y una versión más amplia de la vida',
    growth: 'cumplir lo prometido, escuchar el detalle y no convertir cada límite en una prisión',
    easeful: 'Aries, Leo y Acuario suelen acompañar su fuego, su independencia y su deseo de aire',
    charged: 'Virgo, Piscis y Géminis pueden tensar método, sensibilidad y dispersión',
    bodyCare: 'aire libre, piernas en movimiento, aprendizaje vivo y descanso de tener que optimizarlo todo',
    privateTruth: 'Sagitario no huye de la profundidad; huye de una vida que le pide dejar de crecer',
  },
  capricorn: {
    name: 'Capricornio',
    dateRange: 'del 22 de diciembre al 19 de enero',
    elementMode: 'tierra cardinal',
    ruling: 'Saturno',
    temperament: 'sobrio, estratégico, resistente y más tierno de lo que suele mostrar al principio',
    gift: 'convierte intención en estructura: organiza, sostiene, mide el tiempo y construye con paciencia',
    challenge: 'confundir descanso con debilidad o creer que tiene que ganarse cada gesto de amor',
    loveNeeds: 'compromiso, respeto, paciencia, humor seco y demostraciones que sobrevivan al entusiasmo inicial',
    friendship: 'amistades leales, discretas y capaces de estar cuando la vida se vuelve adulta',
    work: 'dirigir, planificar, administrar, construir instituciones, cuidar la reputación y sostener metas largas',
    purpose: 'aprender que la ambición puede incluir una vida interior, no solo resultados visibles',
    sun: 'identidad que madura con tiempo, responsabilidad y una relación seria con lo que quiere lograr',
    moon: 'emoción contenida; necesita seguridad, competencia y permiso para ser vulnerable sin perder autoridad',
    rising: 'presencia reservada, competente y un poco inaccesible hasta que aparece la confianza',
    venus: 'amor cuidadoso y serio, con deseo de construir algo que tenga forma y futuro',
    mars: 'deseo disciplinado: trabaja por objetivos, calcula esfuerzos y suele ganar por constancia',
    house: 'la zona donde tomas responsabilidad, creas estructura y aprendes el poder de la paciencia',
    growth: 'pedir apoyo antes de agotarte, celebrar avances y no aplazar la alegría hasta el final de la escalera',
    easeful: 'Tauro, Virgo y Escorpio suelen respetar su ritmo, su profundidad y su deseo de lealtad',
    charged: 'Aries, Libra y Cáncer pueden enseñarle velocidad, reciprocidad y cuidado emocional',
    bodyCare: 'huesos, sueño, límites de trabajo, humor, descanso programado y permisos para no producir',
    privateTruth: 'Capricornio no es frío; muchas veces está intentando ser digno de confianza antes de pedir ternura',
  },
  aquarius: {
    name: 'Acuario',
    dateRange: 'del 20 de enero al 18 de febrero',
    elementMode: 'aire fijo',
    ruling: 'Saturno en la tradición, Urano en lecturas modernas',
    temperament: 'independiente, mental, observador y difícil de domesticar con expectativas sociales',
    gift: 've el sistema desde afuera y pregunta si una regla todavía sirve',
    challenge: 'refugiarse en la distancia cuando la vida pide presencia emocional',
    loveNeeds: 'amistad, libertad mental, rareza compartida y una relación sin posesión',
    friendship: 'amistades elegidas, comunidades, conversaciones raras y gente que respete su diferencia',
    work: 'innovar, investigar, programar, organizar grupos, diseñar sistemas y defender futuros posibles',
    purpose: 'aprender que ser diferente no exige estar solo, y que la comunidad también puede tener intimidad',
    sun: 'identidad que necesita pensar por cuenta propia y vivir de acuerdo con una visión',
    moon: 'emoción que se procesa con distancia, ideas y tiempo; sentir puede venir después de entender',
    rising: 'presencia singular, fresca y algo impredecible; otros perciben una distancia magnética',
    venus: 'amor basado en amistad, libertad y aceptación de lo extraño de cada persona',
    mars: 'deseo obstinado y cerebral: pelea por principios, sistemas y espacio propio',
    house: 'la zona donde innovas, cuestionas, te separas de la norma y buscas una red más honesta',
    growth: 'quedarte presente cuando alguien necesita calidez, no solo una teoría brillante',
    easeful: 'Géminis, Libra y Sagitario suelen darle conversación, aire social y horizonte',
    charged: 'Tauro, Escorpio y Leo pueden tensar seguridad, intensidad y orgullo personal',
    bodyCare: 'desconexión digital, circulación, amistades reales y rutinas que no se sientan como jaula',
    privateTruth: 'Acuario no quiere ser raro por pose; quiere respirar sin tener que pedir permiso para pensar distinto',
  },
  pisces: {
    name: 'Piscis',
    dateRange: 'del 19 de febrero al 20 de marzo',
    elementMode: 'agua mutable',
    ruling: 'Júpiter en la tradición, Neptuno en lecturas modernas',
    temperament: 'sensible, imaginativo, compasivo y permeable a lo que otros no dicen',
    gift: 'ablanda los bordes: imagina, perdona, sueña, crea y escucha el lenguaje de lo invisible',
    challenge: 'disolverse en necesidades ajenas o llamar destino a lo que pide límites',
    loveNeeds: 'ternura, misterio, empatía, arte y una relación donde la sensibilidad no sea motivo de burla',
    friendship: 'amistades suaves, creativas, espirituales o muy humanas, donde nadie tenga que fingir dureza',
    work: 'crear, sanar, acompañar, cuidar, interpretar símbolos, hacer música, escribir o trabajar entre mundos',
    purpose: 'aprender que compasión con límites sigue siendo compasión, y suele ser más duradera',
    sun: 'identidad que necesita inspiración, entrega y una relación viva con la imaginación',
    moon: 'emoción porosa: siente ambientes, sueños y silencios, y necesita tiempo para volver a sí',
    rising: 'presencia cambiante, suave y difícil de definir; otros proyectan mucho sobre ella',
    venus: 'amor idealista, romántico y tierno, con deseo de fusión y belleza compartida',
    mars: 'deseo indirecto, inspirado y a veces evasivo; actúa mejor cuando hay sentido emocional',
    house: 'la zona donde se ablandan los límites y aparecen sueño, fe, arte, duelo o compasión',
    growth: 'decir no antes de desaparecer, poner forma al talento y no rescatar a quien no quiere cambiar',
    easeful: 'Cáncer, Escorpio y Capricornio suelen entender su profundidad y darle contención',
    charged: 'Géminis, Sagitario y Virgo pueden tensar palabra, verdad y orden, pero también darle forma',
    bodyCare: 'sueño, agua, música, soledad amable y límites energéticos con personas demandantes',
    privateTruth: 'Piscis no está perdido; muchas veces está sintiendo una capa de la realidad que otros ignoran',
  },
};

function expandedSections(profile: GuideDepth): SpanishGuide['sections'] {
  return [
    {
      heading: `Cómo reconocer a ${profile.name}`,
      body: [
        `${profile.name} suele mostrarse ${profile.temperament}. Eso no significa que todas las personas de este signo actúen igual; significa que, cuando la carta le da fuerza, la vida se organiza alrededor de ese pulso. Su don es claro: ${profile.gift}.`,
        `El punto fino está en distinguir virtud de reflejo automático. El regalo de ${profile.name} se vuelve más claro cuando no tiene que demostrarlo todo el tiempo. Su sombra aparece al ${profile.challenge}.`,
        `Por eso conviene leer el signo como una herramienta, no como una sentencia. ${profile.name} describe una manera de responder a la vida: qué se nota primero, qué se protege, qué se desea y qué tipo de experiencia hace que una persona vuelva a sentirse en su eje.`,
      ],
    },
    {
      heading: `${profile.name} en el amor, la amistad y la confianza`,
      body: [
        `En el amor, ${profile.name} necesita ${profile.loveNeeds}. Si eso falta, el vínculo puede sentirse correcto por fuera pero pobre por dentro. Este signo no se abre de verdad solo porque haya atracción; necesita sentir que el ritmo de la relación le permite seguir siendo sí mismo.`,
        `En la amistad busca ${profile.friendship}. A veces la compatibilidad más sana no es la más intensa, sino la que deja al signo respirar sin tener que traducirse todo el día. Cuando ${profile.name} se siente aceptado, su mejor cualidad aparece sin esfuerzo.`,
        `${profile.easeful}. Esa suele ser la química más fácil. ${profile.charged}. Esos vínculos no tienen por qué ser una mala idea: simplemente piden más conciencia. En pareja, la carta completa importa mucho más que el Sol. La Luna, Venus, Marte, el ascendente y las casas muestran la historia real.`,
      ],
    },
    {
      heading: `${profile.name} en el trabajo, el dinero y el propósito`,
      body: [
        `En el trabajo, ${profile.name} destaca al ${profile.work}. No siempre se trata de una profesión literal; puede ser una forma de abordar cualquier tarea. Donde otras personas ven un pendiente más, este signo ve una manera de ordenar su energía y demostrar lo que sabe hacer.`,
        `Su propósito no tiene que sonar grandioso. Muchas veces empieza con algo simple: ${profile.purpose}. Cuando una vida honra ese movimiento, el signo deja de actuar por defensa y empieza a actuar por elección.`,
        `Con dinero y recursos, ${profile.name} necesita mirar qué le da seguridad y qué le da vitalidad. Un presupuesto, una rutina o una meta sirven si sostienen vida real. Si se vuelven una jaula, el signo pierde contacto con su mejor inteligencia.`,
      ],
    },
    {
      heading: `${profile.name} en tu carta natal`,
      risingProfile: true,
      body: [
        `Tu signo solar es solo una parte. Con el Sol en ${profile.name}, aparece una ${profile.sun}. Con la Luna en ${profile.name}, la historia se vuelve una ${profile.moon}. Con el ascendente en ${profile.name}, el mundo suele encontrarse primero con una ${profile.rising}.`,
        `Venus y Marte cambian el tono de las relaciones. Venus en ${profile.name} habla de ${profile.venus}. Marte en ${profile.name} muestra ${profile.mars}. Estas colocaciones pueden explicar por qué alguien no se identifica con la descripción típica de su signo solar.`,
        `También importa la casa donde cae ${profile.name}. Esa casa muestra ${profile.house}. Si no sabes en qué casa vive este signo en tu carta, calcula la carta natal completa con hora y lugar; ahí se ve si el tema aparece en identidad, pareja, trabajo, familia, creatividad o mundo interior.`,
        `La precisión importa sobre todo cerca de los cambios de signo. Las fechas de ${profile.name} suelen ser ${profile.dateRange}, pero el Sol no entra a la misma hora todos los años. Si naciste en el borde, la única respuesta confiable es una carta calculada con tus datos.`,
      ],
    },
    {
      heading: `Sombra y crecimiento de ${profile.name}`,
      body: [
        `La sombra de ${profile.name} no es un defecto moral. Es una estrategia que alguna vez tuvo sentido y luego se volvió demasiado automática. El crecimiento empieza cuando el signo nota que ya no necesita responder siempre desde el mismo lugar.`,
        `Para este signo, la práctica central es ${profile.growth}. Esa frase puede sonar sencilla, pero suele tocar el punto exacto donde la carta se vuelve adulta: no negar el impulso, sino darle una forma más consciente.`,
        `El cuerpo también cuenta. A ${profile.name} le ayudan estas prácticas: ${profile.bodyCare}. La astrología es más útil cuando baja a decisiones pequeñas: cómo descansas, cómo pides, cómo sales de un ciclo y qué eliges repetir.`,
      ],
    },
    {
      heading: `Lo que ${profile.name} rara vez dice en voz alta`,
      body: [
        `${profile.privateTruth}. Esa capa íntima suele explicar más que cualquier estereotipo. Detrás de la imagen pública del signo hay una necesidad humana muy concreta: ser entendido sin tener que volverse una caricatura.`,
        `Leer ${profile.name} con cuidado significa darle dignidad a sus contradicciones. Puede ser fuerte y necesitar cuidado, libre y desear pertenencia, serio y tener humor, sensible y tener límites. La carta completa permite sostener esas mezclas sin forzarlas en una etiqueta.`,
        `Por eso esta guía es un punto de partida. Para saber qué significa ${profile.name} en tu vida, mira dónde aparece en tu carta, qué planetas tienes allí y qué relaciones activa. El signo te da el idioma; la carta natal te da la frase completa.`,
      ],
    },
  ];
}

function expandedFaq(profile: GuideDepth): SpanishGuide['faq'] {
  return [
    {
      q: `¿Qué significa tener mucho ${profile.name} en la carta?`,
      a: `Significa que varios planetas o puntos importantes hablan el idioma de ${profile.name}, un signo de ${profile.elementMode}. La guía toma esta regencia como referencia: ${profile.ruling}. Se nota en la personalidad, los vínculos y las decisiones, pero la casa y los aspectos dicen dónde se expresa.`,
    },
    {
      q: `¿Qué pasa si no me identifico con ${profile.name}?`,
      a: 'Es normal. El ascendente, la Luna, los planetas dominantes y los aspectos fuertes pueden cambiar mucho la forma en que se vive el signo solar. Calcula la carta completa antes de descartar el signo.',
    },
    {
      q: `¿Cuál es la lección de ${profile.name}?`,
      a: `Su lección es ${profile.purpose}. Cuando ese aprendizaje madura, el signo conserva su fuerza sin quedarse atrapado en su defensa automática.`,
    },
  ];
}

export function spanishGuideFor(sign: Sign): SpanishGuide {
  const guide = ES_GUIDES[sign.slug];
  if (!guide) throw new Error(`Missing Spanish guide for ${sign.slug}`);
  const profile = DEPTH[sign.slug];
  if (!profile) throw new Error(`Missing Spanish guide depth for ${sign.slug}`);
  return {
    ...guide,
    sections: [...guide.sections, ...expandedSections(profile)],
    faq: [...guide.faq, ...expandedFaq(profile)],
  };
}
