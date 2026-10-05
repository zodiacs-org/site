import type { Sign } from '../lib/signs';

export interface FrenchGuide {
  sign: string;
  title: string;
  description: string;
  intro: string[];
  sections: { heading: string; body: string[]; risingProfile?: boolean }[];
  faq: { q: string; a: string }[];
}

interface Profile {
  name: string;
  dates: string;
  elementMode: string;
  ruler: string;
  core: string;
  strength: string;
  shadow: string;
  love: string;
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
  ease: string;
  tension: string;
  care: string;
  privateTruth: string;
}

const EDGE_COPY = 'Si tu es né·e près d’un changement de signe, calcule ton thème astral : le Soleil ne change pas de signe à la même heure chaque année.';

const PROFILES: Record<string, Profile> = {
  aries: {
    name: 'Bélier', dates: 'du 21 mars au 19 avril', elementMode: 'feu cardinal', ruler: 'Mars',
    core: 'un tempérament rapide, franc et peu sensible aux excuses',
    strength: 'mettre en mouvement ce que les autres sont encore en train d’envisager et transformer une possibilité en action',
    shadow: 'confondre urgence et vérité, ou abandonner dès que l’élan du début retombe',
    love: 'du désir clair, du jeu, de l’honnêteté et une personne qui ne cherche pas à éteindre son impulsion',
    friendship: 'des liens vivants, des projets spontanés et des personnes capables de dire oui sans former un comité',
    work: 'lancer des projets, résoudre des urgences, entrer franchement en concurrence et ouvrir la voie',
    purpose: 'apprendre à commencer sans s’épuiser, à diriger sans écraser et à choisir les combats qui valent son feu',
    sun: 'une identité qui se découvre dans l’action et se reconnaît lorsqu’elle a quelque chose à commencer', moon: 'des émotions immédiates qui montent vite et peuvent retrouver tout aussi vite leur élan',
    rising: 'une présence directe, jeune et physique, qui donne l’impression d’avoir déjà décidé d’avancer', venus: 'un amour qui fait le premier pas, dit ce qu’il veut et préfère une étincelle honnête à un lien tiède',
    mars: 'le désir et le conflit à l’état pur, avec une action visible, une compétition ouverte et peu de patience pour les détours', house: 'le domaine où tu recherches autonomie, décision et droit d’essayer avant d’avoir des garanties',
    growth: 'ralentir suffisamment pour écouter, terminer ce qui compte et ne pas traiter chaque retard comme une défaite',
    ease: 'Le Lion, le Sagittaire et les Gémeaux nourrissent souvent son enthousiasme sans lui demander de devenir quelqu’un d’autre', tension: 'Le Cancer, le Capricorne et la Balance peuvent lui montrer la valeur de la pause, de l’attention et de la négociation',
    care: 'bouger, transpirer, se reposer après l’effort et trouver une sortie saine à la colère',
    privateTruth: 'Le Bélier ne veut pas toujours gagner ; il veut souvent se sentir vivant et libre d’essayer',
  },
  taurus: {
    name: 'Taureau', dates: 'du 20 avril au 20 mai', elementMode: 'terre fixe', ruler: 'Vénus',
    core: 'un tempérament calme, sensoriel et plus résistant qu’il n’y paraît au premier abord',
    strength: 'rendre la vie habitable en prenant soin des corps, des rythmes, des ressources et des liens avec constance',
    shadow: 'rester trop longtemps là où rien ne pousse plus parce que le connu semble plus sûr',
    love: 'de la loyauté, du contact, de la cohérence et des gestes perceptibles dans la vie quotidienne',
    friendship: 'des liens fiables, de bons repas, de la musique, des souvenirs et une présence sans hâte',
    work: 'créer de la valeur, soutenir les processus, gérer les ressources et améliorer le concret avec goût',
    purpose: 'comprendre que la stabilité n’est pas l’immobilité, mais une base depuis laquelle le désir peut respirer',
    sun: 'une identité qui a besoin de temps, de corps et d’un rapport clair à ce qui a de la valeur', moon: 'des émotions qui s’apaisent grâce à la sécurité, au contact, à la routine et à des signes répétés de confiance',
    rising: 'une présence tranquille, solide et attirante, difficile à faire bouger sous la pression', venus: 'un amour sensuel et patient, doté d’une mémoire fine du plaisir et des soins concrets',
    mars: 'un désir constant, lent à démarrer mais doté d’une grande force une fois la décision prise', house: 'le domaine où tu recherches calme, sécurité intérieure, plaisirs simples et décisions durables',
    growth: 'lâcher prise avant de te raidir, distinguer la loyauté de l’habitude et accepter que le changement puisse aussi être une forme de soin',
    ease: 'La Vierge, le Capricorne et le Cancer comprennent souvent son besoin de confiance', tension: 'Le Lion, le Verseau et le Scorpion apportent intensité, fierté et besoin de souplesse',
    care: 'dormir régulièrement, bien manger, toucher, marcher dans la nature et répondre sans précipitation',
    privateTruth: 'Le Taureau ne s’accroche pas par principe ; il protège souvent ce qu’il lui a fallu du temps pour aimer',
  },
  gemini: {
    name: 'Gémeaux', dates: 'du 21 mai au 20 juin', elementMode: 'air mutable', ruler: 'Mercure',
    core: 'un tempérament curieux, verbal, mobile et capable de voir trois angles là où les autres n’en voient qu’un',
    strength: 'ouvrir des fenêtres en reliant personnes, idées, données et possibilités avec une rapidité communicative',
    shadow: 'bouger si vite qu’une question importante n’a jamais le temps de devenir une connaissance profonde',
    love: 'de la conversation, de l’humour, de la liberté mentale et un lien qui ne punit pas la curiosité',
    friendship: 'des liens stimulants, des messages tardifs, des projets changeants et une complicité qui permet de penser à voix haute',
    work: 'communiquer, traduire, enseigner, vendre, enquêter, écrire et repérer les schémas qui se dessinent',
    purpose: 'transformer l’information en langage utile sans perdre le plaisir de poser des questions',
    sun: 'une identité faite d’apprentissage, qui se reconnaît lorsqu’elle peut nommer, comparer et changer d’avis', moon: 'des émotions qui ont besoin de parler, d’écrire ou de bouger pour comprendre ce qu’elles ressentent',
    rising: 'une présence légère, expressive et éveillée, qui semble tout apprendre avant même que les choses soient dites', venus: 'un amour qui commence dans l’esprit et grandit par le jeu, les messages, les références partagées et le rire',
    mars: 'un désir inquiet qui débat, teste, questionne et peut se lasser s’il manque de stimulation', house: 'le domaine où tu as besoin de variété, de langage, d’échanges et du droit d’expérimenter',
    growth: 'rester dans une conversation difficile, prendre soin de ton attention et ne pas utiliser ton esprit pour esquiver la vulnérabilité',
    ease: 'La Balance, le Verseau et le Bélier leur offrent souvent de l’air, de l’élan et une sensation de mouvement partagé', tension: 'La Vierge, les Poissons et le Sagittaire peuvent mettre en tension le détail, le rêve et la vérité, mais aussi élargir leur regard',
    care: 'réduire les écrans le soir, marcher, respirer et offrir à l’esprit des moments sans performance',
    privateTruth: 'Les Gémeaux ne changent pas d’avis parce qu’ils ne ressentent rien, mais parce qu’ils perçoivent trop pour feindre une réponse unique',
  },
  cancer: {
    name: 'Cancer', dates: 'du 21 juin au 22 juillet', elementMode: 'eau cardinal', ruler: 'la Lune',
    core: 'un tempérament intuitif, protecteur et d’autant plus fort qu’il peut prendre soin sans se cacher',
    strength: 'créer un refuge, se souvenir, accompagner, nourrir et reconnaître les besoins avant qu’ils aient des mots',
    shadow: 'attendre que les autres devinent ce qui fait mal ou se réfugier sous une carapace lorsqu’il suffirait de demander',
    love: 'de la tendresse fiable, une mémoire partagée, de la réciprocité émotionnelle et un foyer symbolique auquel revenir',
    friendship: 'des liens loyaux, des conversations intimes et des personnes sensibles aux petits gestes',
    work: 'prendre soin, conserver, concevoir des foyers, soutenir les équipes, raconter la mémoire et protéger ce qui est vulnérable',
    purpose: 'apprendre que sensibilité et clarté peuvent coexister et que prendre soin n’exige pas de disparaître',
    sun: 'une identité organisée autour de l’appartenance, de la mémoire et de la protection', moon: 'des émotions très puissantes, car la Lune est ici chez elle, qui ont besoin de sécurité, de rythmes et du droit d’être ressenties',
    rising: 'une présence sensible et observatrice, qui peut d’abord sembler réservée avant de devenir profondément proche', venus: 'un amour nourricier, attentif et nostalgique, désireux de créer un monde privé à deux',
    mars: 'une action protectrice qui se bat pour les personnes aimées, même si elle préfère parfois contourner avant d’affronter', house: 'le domaine où tu cherches un foyer, de l’intimité, du soin et un lien honnête avec tes racines',
    growth: 'nommer tes besoins avant que le ressentiment s’installe, accepter l’aide et ne pas voir chaque distance comme un abandon',
    ease: 'Le Scorpion, les Poissons et le Taureau comprennent souvent sa profondeur émotionnelle et son besoin de confiance', tension: 'Le Bélier, la Balance et le Capricorne peuvent lui enseigner l’indépendance, la négociation et la structure',
    care: 'manger simplement, se reposer, retrouver l’eau, instaurer des rituels domestiques et poser des limites claires au tumulte des autres',
    privateTruth: 'Le Cancer n’est pas fragile ; il est perméable, et doit donc choisir avec soin qui peut entrer',
  },
  leo: {
    name: 'Lion', dates: 'du 23 juillet au 22 août', elementMode: 'feu fixe', ruler: 'le Soleil',
    core: 'un tempérament chaleureux, loyal, théâtral quand il le faut et fier de ce qu’il aime',
    strength: 'donner vie à une scène, encourager, célébrer, créer et rappeler aux autres qu’ils peuvent aussi rayonner',
    shadow: 'dépendre excessivement du regard extérieur ou confondre fierté et protection',
    love: 'être choisi avec joie, jouer, recevoir une attention réelle et donner de l’affection sans être utilisé',
    friendship: 'des liens généreux, des célébrations, des projets créatifs et des loyautés visibles',
    work: 'diriger, jouer, enseigner, concevoir des expériences, conduire des équipes et porter une vision avec cœur',
    purpose: 'créer depuis son propre centre plutôt que depuis un besoin d’approbation',
    sun: 'une identité solaire sur son propre terrain, faite de vitalité, d’autorité créative et du désir de vivre avec présence', moon: 'des émotions qui demandent reconnaissance, chaleur et un lieu où le cœur ne semble pas excessif',
    rising: 'une présence magnétique, expressive et mémorable, dotée d’une lumière difficile à ignorer', venus: 'un amour démonstratif, romantique et généreux, qui aime se sentir spécial et rendre l’autre spécial',
    mars: 'un désir théâtral et loyal, qui se bat avec fierté, défend ce qu’il aime et a besoin d’une cause digne de lui', house: 'le domaine où tu veux créer, jouer, diriger et signer quelque chose de ton nom',
    growth: 'écouter même quand tu n’es pas au centre, demander de l’affection sans faire de scène et partager la lumière',
    ease: 'Le Bélier, le Sagittaire et la Balance nourrissent souvent sa joie, son feu et son goût de l’échange', tension: 'Le Taureau, le Scorpion et le Verseau peuvent lui montrer la patience, la profondeur et le détachement',
    care: 'profiter du soleil, bouger avec plaisir, jouer, créer et se reposer de l’obligation de toujours rayonner',
    privateTruth: 'Le Lion ne veut pas seulement attirer l’attention ; il veut que son amour soit reçu avec la même grandeur que celle avec laquelle il l’offre',
  },
  virgo: {
    name: 'Vierge', dates: 'du 23 août au 22 septembre', elementMode: 'terre mutable', ruler: 'Mercure',
    core: 'un tempérament observateur, utile, précis et plus sensible que son efficacité ne le laisse voir',
    strength: 'améliorer ce qu’elle touche, mettre de l’ordre, réviser, réparer et transformer une idée en quelque chose qui fonctionne',
    shadow: 'confondre valeur et perfection ou utiliser la critique pour ne pas ressentir l’incertitude',
    love: 'de la confiance, des soins quotidiens, des mots clairs et une relation dans laquelle aider n’est pas une obligation silencieuse',
    friendship: 'des liens honnêtes, des projets concrets et des personnes qui respectent les petits détails',
    work: 'analyser, soigner, écrire, enquêter, prendre soin de la santé, concevoir des processus et rendre le savoir utile',
    purpose: 'apprendre que ce qui est suffisamment bon peut aussi être beau et que le repos fait partie de la méthode',
    sun: 'une identité qui se construit par le service, le savoir-faire, l’observation et l’amélioration continue', moon: 'des émotions qui s’apaisent grâce à l’ordre, à la routine et au sentiment d’être utile sans s’épuiser',
    rising: 'une présence soignée, attentive et réservée, que les autres perçoivent comme quelqu’un qui remarque ce qui manque', venus: 'un amour attentif et sélectif, exprimé par des gestes concrets plus que par de grands discours',
    mars: 'un désir appliqué qui corrige, s’exerce, perfectionne et peut se frustrer lorsque le chaos l’emporte', house: 'le domaine où tu as besoin d’affiner, de simplifier, de prendre soin de tes habitudes et de faire preuve de discernement',
    growth: 'te parler avec moins de dureté, laisser les autres t’aider et ne pas faire de chaque erreur une identité',
    ease: 'Le Taureau, le Capricorne et le Cancer apprécient souvent ses soins concrets et son besoin de sécurité', tension: 'Les Gémeaux, le Sagittaire et les Poissons peuvent assouplir son besoin de contrôle par le jeu, l’ouverture et le lâcher-prise',
    care: 'instaurer des routines souples, prendre soin de sa digestion, dormir, faire de vraies pauses et alléger les listes impossibles',
    privateTruth: 'La Vierge ne cherche pas les erreurs par plaisir ; elle essaie souvent de rendre la vie moins douloureuse',
  },
  libra: {
    name: 'Balance', dates: 'du 23 septembre au 22 octobre', elementMode: 'air cardinal', ruler: 'Vénus',
    core: 'un tempérament diplomate, perspicace et très attentif à l’atmosphère entre les personnes',
    strength: 'trouver la juste proportion, embellir, servir de médiatrice, écouter les deux côtés et rendre le conflit plus élégant',
    shadow: 'attendre une option parfaite jusqu’à ce que la vie décide à sa place',
    love: 'de la réciprocité, de la conversation, une beauté partagée et une relation dans laquelle le choix est mutuel',
    friendship: 'des liens sociables, des goûts partagés, des débats cordiaux et des projets où tout le monde peut se sentir à l’aise',
    work: 'négocier, concevoir, conseiller, écrire, défendre la justice et créer des expériences équilibrées',
    purpose: 'apprendre que la paix véritable commence parfois par une phrase inconfortable prononcée à temps',
    sun: 'une identité qui se découvre dans le miroir des autres, par la relation, le goût, la justice et le choix conscient', moon: 'des émotions qui ont besoin d’harmonie, de compagnie et de lieux où le conflit ne devient pas une menace',
    rising: 'une présence élégante et sociable, qui adoucit souvent l’atmosphère avant de montrer sa propre intensité', venus: 'un amour sur son propre terrain, fait de charme, de coopération, d’esthétique et du désir de prendre soin du lien',
    mars: 'une action guidée par la balance, qui se bat pour la justice mais peut tarder à reconnaître sa propre colère', house: 'le domaine où tu recherches équilibre, alliance, beauté et décisions qui tiennent compte de l’autre',
    growth: 'décider avant que le ressentiment s’installe, défendre ta propre position et ne pas appeler ton silence de l’harmonie',
    ease: 'Les Gémeaux, le Verseau et le Lion nourrissent souvent sa conversation, sa sociabilité et son sens du jeu', tension: 'Le Cancer, le Capricorne et le Bélier peuvent lui montrer le besoin, la structure et le désir direct',
    care: 'chercher une beauté simple, s’entourer d’art, cultiver des relations reposantes et passer du temps seul pour entendre sa propre voix',
    privateTruth: 'La Balance n’évite pas le conflit par superficialité ; elle ressent souvent trop vivement ce qu’il en coûte de rompre l’harmonie',
  },
  scorpio: {
    name: 'Scorpion', dates: 'du 23 octobre au 21 novembre', elementMode: 'eau fixe', ruler: 'Mars dans la tradition et Pluton dans l’astrologie moderne',
    core: 'un tempérament intense, réservé, perspicace et peu intéressé par les versions décoratives de la vérité',
    strength: 'aller là où les autres ne veulent pas regarder et y trouver du pouvoir, du désir, du deuil et de la transformation',
    shadow: 'se protéger au point de soumettre l’intimité à des épreuves impossibles',
    love: 'une loyauté profonde, un désir honnête, une confiance gagnée et une relation capable de parler de ce qui est difficile',
    friendship: 'des liens choisis, de vraies confidences et des personnes qui ne trahissent pas ce qui s’est dit à voix basse',
    work: 'enquêter, soigner, analyser les crises, gérer les ressources partagées et travailler avec ce qui est caché',
    purpose: 'apprendre que le pouvoir n’est pas le contrôle et que faire confiance peut aussi être une force',
    sun: 'une identité qui se forge en traversant l’intensité et refuse de vivre à la surface', moon: 'des émotions profondes, secrètes et résistantes, qui ont besoin de temps pour révéler ce qui se passe vraiment',
    rising: 'une présence magnétique et observatrice, qui peut donner aux autres l’impression d’être compris avant même de parler', venus: 'un amour entier, fidèle et exigeant, avec un désir de fusion et une crainte légitime de la trahison',
    mars: 'un désir stratégique qui attend, observe, mesure et agit avec force une fois la décision prise', house: 'le domaine où tu te transformes, enquêtes, partages le pouvoir et apprends à lâcher ce qui te contrôle',
    growth: 'ouvrir les fenêtres avant que la pièce ne se referme, demander la vérité sans punir la vulnérabilité',
    ease: 'Le Cancer, les Poissons et la Vierge comprennent souvent sa profondeur et son besoin de confiance', tension: 'Le Lion, le Verseau et le Taureau peuvent apporter fierté, distance ou entêtement, mais aussi beaucoup de magnétisme',
    care: 'protéger son intimité, suivre une thérapie, retrouver l’eau, bouger intensément et relâcher la pression sans détruire',
    privateTruth: 'Le Scorpion ne cherche pas le drame ; il cherche quelque chose d’assez vrai pour ne plus avoir à le surveiller',
  },
  sagittarius: {
    name: 'Sagittaire', dates: 'du 22 novembre au 21 décembre', elementMode: 'feu mutable', ruler: 'Jupiter',
    core: 'un tempérament franc, ouvert, remuant et plus philosophique que son humour ne le laisse croire',
    strength: 'élargir la carte en apportant de la perspective, de l’élan, de la vérité et l’envie de franchir une nouvelle porte',
    shadow: 'utiliser la liberté comme prétexte pour ne pas rester là où quelque chose demande de l’attention',
    love: 'de l’espace, de l’aventure, de l’honnêteté, du rire et une personne qui possède son propre horizon',
    friendship: 'des liens voyageurs, de longs débats, des projets improvisés et des personnes qui n’ont pas peur de changer d’avis',
    work: 'enseigner, voyager, publier, guider, entreprendre, étudier et relier les expériences à leur sens',
    purpose: 'apprendre que la vérité devient plus forte lorsqu’elle s’accompagne aussi de tact',
    sun: 'une identité qui grandit en explorant et en trouvant un sens plus vaste que la routine', moon: 'des émotions qui ont besoin de mouvement, d’espoir et du droit de regarder plus loin',
    rising: 'une présence ouverte, honnête et parfois débordante, qui semble toujours se diriger vers autre chose', venus: 'un amour aventureux, joueur et libre, qui aime rire et faire des promesses capables d’ouvrir le monde',
    mars: 'un désir guidé par une vision, qui se bat pour des principes, s’enflamme pour des causes et déteste se sentir enfermé', house: 'le domaine où tu cherches voyage, étude, foi, humour et une version plus vaste de la vie',
    growth: 'tenir tes promesses, écouter les détails et ne pas transformer chaque limite en prison',
    ease: 'Le Bélier, le Lion et le Verseau accompagnent souvent son feu, son indépendance et son besoin d’air', tension: 'La Vierge, les Poissons et les Gémeaux peuvent mettre en tension la méthode, la sensibilité et la dispersion',
    care: 'prendre l’air, faire marcher ses jambes, apprendre par l’expérience et se reposer de l’obligation de tout optimiser',
    privateTruth: 'Le Sagittaire ne fuit pas la profondeur ; il fuit une vie qui lui demanderait de cesser de grandir',
  },
  capricorn: {
    name: 'Capricorne', dates: 'du 22 décembre au 19 janvier', elementMode: 'terre cardinal', ruler: 'Saturne',
    core: 'un tempérament sobre, stratégique, résistant et plus tendre qu’il ne le montre au premier abord',
    strength: 'transformer l’intention en structure, organiser, soutenir, mesurer le temps et construire avec patience',
    shadow: 'confondre repos et faiblesse ou croire qu’il faut mériter chaque geste d’affection',
    love: 'de l’engagement, du respect, de la patience, un humour sec et des preuves qui survivent à l’enthousiasme du début',
    friendship: 'des liens loyaux, discrets et capables de rester présents lorsque la vie devient adulte',
    work: 'diriger, planifier, gérer, construire des institutions, prendre soin de sa réputation et soutenir des objectifs à long terme',
    purpose: 'apprendre que l’ambition peut inclure une vie intérieure et pas seulement des résultats visibles',
    sun: 'une identité qui mûrit avec le temps, la responsabilité et un rapport sérieux à ce qu’elle veut accomplir', moon: 'des émotions contenues qui ont besoin de sécurité, de compétence et du droit d’être vulnérables sans perdre leur autorité',
    rising: 'une présence réservée, compétente et un peu inaccessible tant que la confiance n’est pas installée', venus: 'un amour attentif et sérieux, qui veut construire quelque chose doté d’une forme et d’un avenir',
    mars: 'un désir discipliné qui travaille en fonction d’objectifs, calcule ses efforts et l’emporte souvent par sa constance', house: 'le domaine où tu assumes des responsabilités, crées une structure et découvres le pouvoir de la patience',
    growth: 'demander du soutien avant de t’épuiser, célébrer tes avancées et ne pas reporter la joie jusqu’au sommet de l’escalier',
    ease: 'Le Taureau, la Vierge et le Scorpion respectent souvent son rythme, sa profondeur et son besoin de loyauté', tension: 'Le Bélier, la Balance et le Cancer peuvent lui enseigner la vitesse, la réciprocité et le soin émotionnel',
    care: 'prendre soin de ses os, dormir, limiter le travail, cultiver l’humour, programmer du repos et s’autoriser à ne rien produire',
    privateTruth: 'Le Capricorne n’est pas froid ; il essaie souvent de se montrer digne de confiance avant de demander de la tendresse',
  },
  aquarius: {
    name: 'Verseau', dates: 'du 20 janvier au 18 février', elementMode: 'air fixe', ruler: 'Saturne dans la tradition et Uranus dans l’astrologie moderne',
    core: 'un tempérament indépendant, intellectuel, observateur et difficile à domestiquer par les attentes sociales',
    strength: 'voir le système de l’extérieur et demander si une règle sert encore à quelque chose',
    shadow: 'se réfugier dans la distance lorsque la vie demande une présence émotionnelle',
    love: 'de l’amitié, de la liberté mentale, une étrangeté partagée et une relation sans possession',
    friendship: 'des liens choisis, des communautés, des conversations atypiques et des personnes qui respectent sa différence',
    work: 'innover, enquêter, programmer, organiser des groupes, concevoir des systèmes et défendre des avenirs possibles',
    purpose: 'apprendre qu’être différent n’exige pas d’être seul et que la communauté peut aussi offrir de l’intimité',
    sun: 'une identité qui a besoin de penser par elle-même et de vivre en accord avec une vision', moon: 'des émotions qui se traitent par la distance, les idées et le temps, si bien que ressentir peut venir après comprendre',
    rising: 'une présence singulière, vive, un peu imprévisible et marquée par une distance magnétique', venus: 'un amour fondé sur l’amitié, la liberté et l’acceptation de ce que chacun a d’étrange',
    mars: 'un désir obstiné et cérébral, qui se bat pour des principes, des systèmes et son propre espace', house: 'le domaine où tu innoves, remets en cause, t’écartes de la norme et cherches un réseau plus honnête',
    growth: 'rester présent quand quelqu’un a besoin de chaleur, et pas seulement d’une théorie brillante',
    ease: 'Les Gémeaux, la Balance et le Sagittaire lui offrent souvent de la conversation, une vie sociale et un horizon', tension: 'Le Taureau, le Scorpion et le Lion peuvent mettre en tension la sécurité, l’intensité et la fierté personnelle',
    care: 'se déconnecter des écrans, favoriser la circulation, nourrir de vraies amitiés et instaurer des routines qui ne ressemblent pas à une cage',
    privateTruth: 'Le Verseau ne veut pas être atypique pour se donner un genre ; il veut respirer sans devoir demander la permission de penser autrement',
  },
  pisces: {
    name: 'Poissons', dates: 'du 19 février au 20 mars', elementMode: 'eau mutable', ruler: 'Jupiter dans la tradition et Neptune dans l’astrologie moderne',
    core: 'un tempérament sensible, imaginatif, compatissant et perméable aux non-dits',
    strength: 'adoucir les frontières, imaginer, pardonner, rêver, créer et écouter le langage de l’invisible',
    shadow: 'se dissoudre dans les besoins des autres ou prendre pour le destin ce qui demande surtout des limites',
    love: 'de la tendresse, du mystère, de l’empathie, de l’art et une relation où la sensibilité n’est pas tournée en ridicule',
    friendship: 'des liens doux, créatifs, spirituels ou profondément humains où personne ne doit feindre la dureté',
    work: 'créer, soigner, accompagner, prendre soin, interpréter les symboles, faire de la musique, écrire ou travailler entre plusieurs mondes',
    purpose: 'apprendre qu’une compassion assortie de limites reste de la compassion et dure souvent plus longtemps',
    sun: 'une identité qui a besoin d’inspiration, de don de soi et d’un rapport vivant à l’imagination', moon: 'des émotions poreuses qui captent les atmosphères, les rêves et les silences, puis ont besoin de temps pour revenir à elles-mêmes',
    rising: 'une présence changeante, douce et difficile à définir, sur laquelle les autres projettent beaucoup', venus: 'un amour idéaliste, romantique et tendre, avec un désir de fusion et de beauté partagée',
    mars: 'un désir indirect, inspiré et parfois fuyant, qui agit mieux lorsqu’il trouve un sens émotionnel', house: 'le domaine où les frontières s’adoucissent et où apparaissent le rêve, la foi, l’art, le deuil ou la compassion',
    growth: 'dire non avant de disparaître, donner une forme à ton talent et ne pas chercher à sauver quelqu’un qui ne veut pas changer',
    ease: 'Le Cancer, le Scorpion et le Capricorne comprennent souvent leur profondeur et leur offrent un cadre', tension: 'Les Gémeaux, le Sagittaire et la Vierge peuvent mettre en tension la parole, la vérité et l’ordre, mais aussi leur donner une forme',
    care: 'dormir, retrouver l’eau et la musique, s’offrir une solitude douce et poser des limites claires face aux personnes exigeantes',
    privateTruth: 'Les Poissons ne sont pas perdus ; ils perçoivent souvent une dimension de la réalité que les autres ignorent',
  },
};

function buildGuide(slug: string, p: Profile): FrenchGuide {
  const article = ({ virgo: 'la', libra: 'la', gemini: 'les', pisces: 'les' } as Record<string, string>)[slug] ?? 'le';
  const plural = article === 'les';
  const possessive = plural ? 'leur' : 'son';
  const subject = `${article} ${p.name}`;
  const subjectCap = `${article[0].toUpperCase()}${article.slice(1)} ${p.name}`;
  const deName = article === 'le' ? `du ${p.name}` : article === 'la' ? `de la ${p.name}` : `des ${p.name}`;
  const elementPhrase = /^[aeiouyàâäéèêëîïôöùûü]/iu.test(p.elementMode) ? `d’${p.elementMode}` : `de ${p.elementMode}`;
  const intro = [
    `${subjectCap} ${plural ? 'apportent' : 'apporte'} ${p.core}. Ce signe ${elementPhrase}, gouverné par ${p.ruler}, montre comment un élan particulier prend forme dans la vie quotidienne.`,
    `Dans un thème astral, ${subject} ${plural ? 'indiquent' : 'indique'} un domaine où tu peux ${p.strength}. Cette qualité devient plus juste lorsqu’elle reste un choix plutôt qu’un automatisme.`,
  ];
  const sections: FrenchGuide['sections'] = [
    {
      heading: `Personnalité ${deName}`,
      body: [
        `${subjectCap} ${plural ? 'se reconnaissent' : 'se reconnaît'} souvent à ${p.core}. Cela ne veut pas dire que toutes les personnes de ce signe se ressemblent, mais que ce rythme devient visible lorsque le thème lui donne de la place.`,
        `Sa grande force consiste à ${p.strength}. Son défi apparaît lorsque ce signe commence à ${p.shadow}. La maturité ne demande pas d’effacer le signe, mais d’en choisir la meilleure expression.`,
      ],
    },
    {
      heading: `${subjectCap} en amour`,
      body: [
        `En amour, ${subject} ${plural ? 'recherchent' : 'recherche'} ${p.love}. L’attirance ne suffit pas : le lien doit aussi respecter ${possessive} rythme et ${plural ? 'leur' : 'sa'} manière de faire confiance.`,
        `En amitié, ce signe apprécie ${p.friendship}. La compatibilité la plus saine n’est pas toujours la plus spectaculaire ; c’est souvent celle qui laisse chacun respirer sans avoir à s’expliquer toute la journée.`,
      ],
    },
    {
      heading: `${subjectCap} dans ton thème`,
      body: [`Tout le monde a ${subject} quelque part dans son thème. Son emplacement indique ${p.house}. Les planètes placées dans ce signe précisent la façon dont ce sujet s’exprime.`],
    },
    {
      heading: `Comment reconnaître ${subject}`,
      body: [
        `On remarque d’abord ${p.core}. Le signe peut être discret ou extraverti selon le reste du thème, mais son attention revient souvent au même besoin fondamental.`,
        `Son don consiste à ${p.strength}. Lorsqu’il n’a rien à prouver, cette qualité devient plus généreuse, plus précise et plus facile à recevoir.`,
        `Sa difficulté est de ${p.shadow}. Lire le signe comme un outil plutôt que comme une étiquette aide à distinguer une qualité vivante d’un vieux réflexe de protection.`,
      ],
    },
    {
      heading: `${subjectCap}, liens et confiance`,
      body: [
        `Pour se sentir proche, ${subject} ${plural ? 'recherchent' : 'recherche'} ${p.love}. Lorsque cela manque, une relation peut sembler correcte de l’extérieur tout en restant vide à l’intérieur.`,
        `${p.ease}. C’est souvent l’accord le plus fluide. ${p.tension}. Ces liens ne sont pas condamnés : ils demandent simplement plus de conscience et de dialogue.`,
        `Le signe solaire n’est qu’un début. La Lune, Vénus, Mars, l’ascendant, les maisons et les aspects racontent la relation réelle entre deux thèmes.`,
      ],
    },
    {
      heading: `${subjectCap}, travail et direction`,
      body: [
        `Dans le travail, ${subject} ${plural ? 'excellent' : 'excelle'} lorsque ce signe peut ${p.work}. Il ne s’agit pas forcément d’un métier précis, mais d’une façon d’aborder n’importe quelle tâche.`,
        `Sa direction profonde consiste à ${p.purpose}. Elle peut commencer par une décision très simple, répétée assez longtemps pour devenir une manière de vivre.`,
        `Les ressources sont utiles lorsqu’elles soutiennent la vie réelle. Une routine, un budget ou un objectif doit donner un cadre au signe, pas l’enfermer dans une caricature de lui-même.`,
      ],
    },
    {
      heading: `${subjectCap} dans les placements du thème`,
      risingProfile: true,
      body: [
        `Avec le Soleil en ${p.name}, on trouve ${p.sun}. Avec la Lune en ${p.name}, on rencontre ${p.moon}. Avec l’ascendant en ${p.name}, le monde perçoit d’abord ${p.rising}.`,
        `Vénus en ${p.name} évoque ${p.venus}. Mars en ${p.name} décrit ${p.mars}. Ces placements expliquent parfois pourquoi une personne ne se reconnaît pas dans la description habituelle de son signe solaire.`,
        `L’emplacement ${deName} dans ton thème indique ${p.house}. Calcule ton thème complet avec l’heure et le lieu de naissance pour voir si ce sujet apparaît dans l’identité, les relations, le travail, la famille ou la vie intérieure.`,
        `Les dates ${deName} vont généralement ${p.dates}, mais le Soleil n’entre pas dans un signe à la même heure chaque année. Près d’une limite, seul un thème calculé avec tes données donne une réponse fiable.`,
      ],
    },
    {
      heading: `Ombre et évolution ${deName}`,
      body: [
        `L’ombre ${deName} n’est pas un défaut moral. C’est souvent une stratégie autrefois utile qui s’est mise à fonctionner toute seule : ${p.shadow}.`,
        `Son apprentissage consiste à ${p.growth}. Le but n’est pas de nier l’impulsion du signe, mais de lui donner une forme plus consciente et plus durable.`,
        `Le corps compte aussi. ${subjectCap} ${plural ? 'gagnent' : 'gagne'} à ${p.care}. L’astrologie devient utile lorsqu’elle rejoint de petites décisions concrètes.`,
      ],
    },
    {
      heading: `Ce que ${subject} ${plural ? 'disent' : 'dit'} rarement à voix haute`,
      body: [
        `${p.privateTruth}. Cette vérité intime en dit souvent plus que les stéréotypes associés au signe.`,
        `${subjectCap} ${plural ? 'peuvent' : 'peut'} réunir des contraires : force et besoin de soin, liberté et appartenance, calme apparent et vie intérieure intense. Le thème complet permet à ces nuances de coexister.`,
        `Ce guide est donc un point de départ. Pour comprendre ${subject} dans ta vie, regarde où ce signe apparaît dans ton thème, quelles planètes s’y trouvent et quels aspects elles forment. Le signe donne le vocabulaire ; le thème astral compose la phrase.`,
      ],
    },
  ];
  const faq: FrenchGuide['faq'] = [
    { q: `Quelles sont les dates ${deName} ?`, a: `En général ${p.dates}. ${EDGE_COPY}` },
    { q: `Quel est l’élément ${deName} ?`, a: `${subjectCap} ${plural ? 'sont' : 'est'} un signe ${elementPhrase}. Astre maître : ${p.ruler}.` },
    { q: `Quels signes sont compatibles avec ${subject} ?`, a: `${p.ease}. Pour une lecture vraiment utile, compare les deux thèmes complets.` },
    { q: `Que signifie une forte présence ${deName} dans le thème ?`, a: `Plusieurs planètes ou points importants parlent alors le langage de ce signe ${elementPhrase}. Les maisons et les aspects indiquent où et comment cette présence s’exprime.` },
    { q: `Et si je ne me reconnais pas dans ce portrait ${deName} ?`, a: 'C’est courant. L’ascendant, la Lune, les planètes dominantes et les aspects forts modifient beaucoup la façon dont le signe solaire se vit. Calcule le thème complet avant de l’écarter.' },
    { q: `Quel est l’apprentissage ${deName} ?`, a: `Il consiste à ${p.purpose}. Le signe conserve ainsi sa force sans rester prisonnier d’un réflexe de défense.` },
  ];
  return {
    sign: slug,
    // Sagittaire and Capricorne would run past 60 characters with the ' | Zodiacs.org' suffix.
    title: `${p.name} : dates, ${p.name.length > 9 ? 'caractère' : 'personnalité'}, compatibilité`,
    description: `Guide ${deName} : dates, personnalité, amour et compatibilité dans ton thème astral. Né·e à la limite d’un signe ? Calcule ton thème pour savoir.`,
    intro,
    sections,
    faq,
  };
}

export const FR_GUIDES: Record<string, FrenchGuide> = Object.fromEntries(
  Object.entries(PROFILES).map(([slug, profile]) => [slug, buildGuide(slug, profile)]),
);

export function frenchGuideFor(sign: Sign): FrenchGuide {
  const guide = FR_GUIDES[sign.slug];
  if (!guide) throw new Error(`Missing French guide for ${sign.slug}`);
  return guide;
}
