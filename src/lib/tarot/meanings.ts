/**
 * Zodiacs' own tarot meanings: written for the site, not copied from any book or site.
 * Tarot is a separate practice from astrology. Each card is read as the tradition reads it, work, money, wellbeing and
 * agreements included, with no price or investment calls, diagnoses, death predictions or legal verdicts.
 */
export interface TarotMeaning {
  /** Three or four lower-case keywords. */
  keywords: readonly string[];
  /** Upright: two or three sentences, 35 to 60 words. */
  upright: string;
  /** Reversed: two or three sentences, 35 to 60 words. */
  reversed: string;
  /** One open question to think about, ending in a question mark, under 20 words. */
  question: string;
}
export const TAROT_MEANINGS: Readonly<Record<string, TarotMeaning>> = {
  'the-fool': {
    keywords: ['first step', 'openness', 'trust', 'risk'],
    upright: 'Picture someone setting out with a light bag and no fixed plan, curious about what the road holds. The Fool asks you to notice where you are ready to start before you feel fully prepared. Some things are learned only by beginning, and a little not-knowing can keep you alert and open.',
    reversed: 'Reversed, the leap can tip into carelessness, or freeze into a hesitation that never leaves the doorway. Consider whether you are skipping the basic checks a sensible traveller makes, or waiting for a certainty that no first step ever offers. Either way, the useful move is a smaller, more deliberate step.',
    question: 'What would you begin today if you did not need to know how it ends?',
  },
  'the-magician': {
    keywords: ['skill', 'focus', 'resourcefulness', 'intent'],
    upright: 'Everything you need is already on the table: tools, know-how, a clear enough aim. The Magician points to the moment when scattered abilities line up behind one purpose. Look at what you can do with what is in reach right now, rather than waiting for a better kit to arrive.',
    reversed: 'Turned around, this card can describe talent spent on appearances, or plans that stay clever on paper and never get put to use. It may also point to someone, possibly you, talking a bigger game than the work supports. Ask where your skill is being used for show instead of substance.',
    question: 'Which of your skills are you underusing right now?',
  },
  'the-high-priestess': {
    keywords: ['intuition', 'quiet', 'patience', 'inner knowing'],
    upright: 'Some answers do not come from asking louder. The High Priestess sits with what is unspoken: the hunch you keep brushing aside, the detail you noticed but did not mention. She suggests listening before acting, and trusting that quiet observation is a form of knowledge too.',
    reversed: 'Reversed, the quiet can turn into secrecy, or into ignoring your own judgement because someone else sounds more certain. You might be gathering information endlessly to avoid deciding. Consider whether you are keeping something hidden from others, or from yourself, and what it would take to say it plainly.',
    question: 'What do you already know that you have not yet admitted?',
  },
  'the-empress': {
    keywords: ['nurture', 'growth', 'comfort', 'creativity'],
    upright: 'Think of a well-tended garden in late summer, crowded with things that grew because someone kept showing up. The Empress is about care that produces something: meals, friendships, creative work, a home people want to be in. Notice what is flourishing because of your attention, and the pleasure you take in it.',
    reversed: 'In reverse, care can become smothering, or it can drain away from you entirely while you look after everyone else. Creative work may feel stalled because you have stopped feeding it. Ask whether you are giving yourself the same patience and comfort you offer the people around you.',
    question: 'What in your life is growing, and what does it need from you next?',
  },
  'the-emperor': {
    keywords: ['structure', 'authority', 'responsibility', 'order'],
    upright: 'The Emperor is the person who draws up the rota, sets the rules and keeps them. He stands for structure that lets other things happen: clear roles, firm boundaries, decisions made and owned. Consider where a little more order, or a willingness to take charge, would steady things.',
    reversed: 'Reversed, structure can harden into control, with rules kept for their own sake and no room for anyone to question them. Or the opposite: nobody is steering, and the gap causes friction. Look at whether authority in your situation, including your own, is serving people or just keeping them in line.',
    question: 'Where would a clear rule or boundary make things easier for everyone?',
  },
  'the-hierophant': {
    keywords: ['tradition', 'learning', 'shared values', 'guidance'],
    upright: 'Here is the card of teachers, institutions and the habits a community passes down. It suggests that tried methods and shared customs have something to offer, especially while you are learning. Think about who has walked this path before you, and what you might gain by asking them how they did it.',
    reversed: 'Reversed, the Hierophant questions inherited rules. Perhaps a tradition no longer fits, or you are following a script because it is expected rather than because you believe in it. The point is not rebellion for its own sake, but checking which customs you would still choose if nobody were watching.',
    question: 'Which of the rules you follow would you still choose for yourself?',
  },
  'the-lovers': {
    keywords: ['choice', 'values', 'partnership', 'alignment'],
    upright: 'The Lovers is less about romance than about choosing with your whole self. It shows two paths, or two people, and asks what you value enough to commit to. Close partnership of any kind, a friendship, a collaboration, a family bond, works best when both sides know what they stand for.',
    reversed: 'Reversed, the choice may be stalled, or made for reasons that do not match what you actually care about. There can be a gap between what you say matters and how you fill your days. Consider where you are avoiding a decision, or keeping two options open to avoid disappointing anyone.',
    question: 'What choice would you make if it only had to answer to your values?',
  },
  'the-chariot': {
    keywords: ['determination', 'direction', 'self-control', 'momentum'],
    upright: 'A driver holds two horses pulling in different directions and keeps the cart moving anyway. The Chariot is about willpower that gives a goal its direction. It asks you to notice competing urges in yourself, and to steer them toward one destination instead of letting either one run off.',
    reversed: 'Reversed, momentum can turn into forcing: pushing ahead without checking whether the road still leads where you want. Or the reins slip and you feel pulled about by other people\'s demands. Ask whether you need firmer direction, or simply a pause to look at the map again.',
    question: 'Where are you trying to go, and who is holding the reins?',
  },
  'strength': {
    keywords: ['patience', 'courage', 'gentleness', 'composure'],
    upright: 'The traditional image shows a calm figure closing a lion\'s jaws with bare hands, with no struggle and no shouting. Strength is the steadiness to meet a difficult feeling or person with patience rather than force. Notice where gentleness might get further than pressure, both with others and with your own temper.',
    reversed: 'In reverse, this card can point to courage that has gone quiet: self-doubt, or a temper that slips out in short bursts. It may also describe someone forcing calm on the surface while resentment builds underneath. Consider what you are trying to hold down, and whether it simply needs acknowledging.',
    question: 'What would it look like to meet this situation with patient courage?',
  },
  'the-hermit': {
    keywords: ['solitude', 'reflection', 'searching', 'counsel'],
    upright: 'An older figure walks alone at night with a lantern, lighting only the next few steps. The Hermit suggests stepping back from the noise to think something through on your own terms. Time alone, a long walk, a notebook, a conversation with one wise friend: these are the lantern.',
    reversed: 'Reversed, solitude can tip into isolation, where pulling away stops being useful and starts feeling like hiding. Or it may show the opposite, a reluctance to take any quiet time at all. Ask whether you are withdrawing to understand something, or withdrawing because people feel hard right now.',
    question: 'What would you hear if you gave yourself an hour of real quiet?',
  },
  'wheel-of-fortune': {
    keywords: ['cycles', 'luck', 'timing', 'change'],
    upright: 'A turning wheel carries some figures up and others down, and none of them stays put. This card is about cycles and luck: lean seasons and plentiful ones, being in the right place at the right time. The tradition reads it as a turn for the better in work or circumstances. Notice which way the wheel is moving.',
    reversed: 'Reversed, the turn can feel like a setback, or like being stuck at the bottom of the same loop. Consider whether you keep repeating a pattern that a different choice could break. Some circumstances are outside your hands, but your response to them, and what you learn, are not.',
    question: 'What pattern in your life keeps coming around, and what is it showing you?',
  },
  'justice': {
    keywords: ['fairness', 'accountability', 'agreements', 'balance'],
    upright: 'Justice holds a pair of scales and a sword: weigh carefully, then act clearly. The tradition reads it for fair dealings, contracts and official paperwork, and as a good time to sign agreements that are clear and even-handed. Look at your own part honestly, and let the evidence lead.',
    reversed: 'Reversed, the scales tip: an agreement that is not quite fair, paperwork rushed or avoided, or responsibility quietly dodged. It can also describe frustration when nobody owns up. Read the small print, ask plainly for what is fair, and consider what fairness would require from you here.',
    question: 'If you weighed this situation honestly, what would you have to own?',
  },
  'the-hanged-man': {
    keywords: ['pause', 'surrender', 'new perspective', 'waiting'],
    upright: 'A figure hangs upside down by one foot, calm, as if the strange position were chosen. The Hanged Man is about pausing deliberately and seeing things from an unfamiliar angle. Sometimes stopping, letting go of the usual fix, or giving something up is what makes the next move clear.',
    reversed: 'Reversed, the pause may have gone on too long, turning into stalling or a sense of waiting for a permission that is not coming. Or you might be refusing to pause at all, filling every gap with busyness. Consider whether you are suspended by choice, or because deciding feels too uncomfortable.',
    question: 'What looks different when you turn it upside down?',
  },
  'death': {
    keywords: ['endings', 'transition', 'clearing', 'renewal'],
    upright: 'Despite its reputation, this card speaks of endings in the everyday sense: a job, a habit, a chapter that has run its course. It asks you to notice what is finishing and to let it close cleanly. Clearing the shelf is often what makes room for whatever belongs there next.',
    reversed: 'Reversed, the ending is being resisted. You might be holding onto a role, a routine or an old version of yourself long after it stopped fitting. Consider what you are keeping going out of habit or fear of the gap, and what a gentle, deliberate closing could look like.',
    question: 'What chapter in your life is ready to close?',
  },
  'temperance': {
    keywords: ['balance', 'moderation', 'blending', 'patience'],
    upright: 'A winged figure pours water between two cups, slowly, without spilling a drop. Temperance is the middle way: balance between work and rest, food and sleep, spending and saving. The tradition reads it as wellbeing restored through moderation. Notice where small, steady adjustments would do more than a dramatic change.',
    reversed: 'Reversed, the mix is off: late nights, overdoing it, all work and then none, or swinging between extremes with money or habits. Ask where you have lost your sense of proportion, and what a steadier daily measure might look like, in rest as much as in effort.',
    question: 'Where in your life would a little less and a little slower help?',
  },
  'the-devil': {
    keywords: ['attachment', 'habit', 'temptation', 'restriction'],
    upright: 'Two figures stand chained to a pedestal, yet the chains are loose enough to lift off. The Devil is about patterns that hold us more by habit than by force: a compulsion, a relationship you have outgrown, a story about what you cannot do. Notice what keeps pulling you back, and why.',
    reversed: 'Reversed, the chains start to slip, and you may be recognising a pattern for what it is and finding the first ways out. It can also mean looking honestly at a side of yourself you prefer to ignore. Consider which small change would loosen the hold, and who could support you in making it.',
    question: 'What are you holding onto that might be holding onto you?',
  },
  'the-tower': {
    keywords: ['upheaval', 'revelation', 'disruption', 'truth'],
    upright: 'A tall tower is struck by lightning and its top breaks away. The Tower describes a sudden shake-up: a plan that collapses, an illusion that cannot survive a new fact. Uncomfortable as it is, the card asks what was built on shaky ground, and what honest foundation could replace it.',
    reversed: 'Reversed, the shake-up may be happening slowly, or being held off by sheer effort. You might sense a structure is unsound and keep patching it rather than looking closely. Consider whether avoiding a hard conversation or decision is making the eventual change bigger than it needs to be.',
    question: 'What would you rebuild differently if you could start from the ground up?',
  },
  'the-star': {
    keywords: ['hope', 'renewal', 'recovery', 'calm'],
    upright: 'After the upheaval of the card before it, a figure kneels by water under a clear night sky, pouring freely. The Star is about quiet hope and recovery after a hard stretch, and the tradition reads it as wellbeing returning. Notice what restores you, rest, fresh air, good company, and give it room.',
    reversed: 'Reversed, hope can feel thin, or you may be giving so much to others that nothing is left for yourself. Discouragement can make the small good things hard to see. Ask what single, modest thing would remind you that improvement is possible, and whether you can allow yourself it.',
    question: 'What gives you hope when you stop to look for it?',
  },
  'the-moon': {
    keywords: ['uncertainty', 'imagination', 'unease', 'dreams'],
    upright: 'A path winds between two towers under moonlight, past a dog, a wolf and something crawling from a pool. The Moon describes times when things are not what they seem and the way ahead is unclear. Notice what your imagination is filling in, and which fears rest on facts rather than shadows.',
    reversed: 'Reversed, the fog may be starting to lift, with a confusing situation becoming clearer. Or anxiety might be turned inward, quietly running your choices without ever being named. Consider what you would find if you looked directly at the thing you have been half avoiding, in plain daylight.',
    question: 'Which of your worries would survive a close, calm look?',
  },
  'the-sun': {
    keywords: ['joy', 'clarity', 'warmth', 'confidence'],
    upright: 'A child rides out under a bright sun, sunflowers nodding over a garden wall. The Sun is plain, uncomplicated good: success, clarity, warmth, good spirits, the pleasure of being seen as you are. The tradition counts it among the best cards for work and for wellbeing. Enjoy what is going well, without waiting for the catch.',
    reversed: 'Reversed, the light is still there but partly clouded. You might be downplaying a success, or finding it hard to feel the joy that is on offer, or confidence may be tipping into showing off. Ask what would let you enjoy the good things without shrinking or inflating them.',
    question: 'What is going well that you have not let yourself enjoy?',
  },
  'judgement': {
    keywords: ['reckoning', 'awakening', 'calling', 'self-assessment'],
    upright: 'A trumpet sounds and figures rise to answer it. Judgement is the moment of looking back honestly at your choices and hearing what you are being called toward next. It suggests a clear-eyed review, followed by a decision to act on what you have learned rather than repeat it.',
    reversed: 'Reversed, the review turns harsh, with self-criticism that keeps you stuck instead of moving you forward. Or you may be avoiding the call entirely, keeping too busy to reflect. Consider what an honest but kind assessment of the last year would say, and what it asks of you.',
    question: 'What is asking for your answer right now?',
  },
  'the-world': {
    keywords: ['completion', 'wholeness', 'arrival', 'integration'],
    upright: 'A figure dances inside a wreath, every corner of the card filled in. The World marks something complete: a long project finished, a cycle closed, a sense of being fully yourself in your own setting. Notice what you have achieved and let it count before rushing toward the next thing.',
    reversed: 'Reversed, completion is close but not quite reached. There may be loose ends you keep leaving, or a reluctance to declare something finished in case it is not perfect. Ask what the last small step is, and whether you are ready to take it and call this chapter closed.',
    question: 'What would it take to call this finished?',
  },

  'ace-of-wands': {
    keywords: ['spark', 'initiative', 'enthusiasm', 'potential'],
    upright: 'A hand offers a budding branch out of a cloud. The Ace of Wands is the first spark of a project: the idea you cannot stop thinking about, the urge to make or start something. Notice what is giving you that pull right now, and consider acting on it while the interest is fresh.',
    reversed: 'Reversed, the spark sputters. You may have plenty of ideas but no will to begin, or you started with a burst and lost interest within days. Consider whether the idea needs a clearer first step, or whether it simply is not the right one and something else deserves your drive.',
    question: 'What idea keeps coming back to you, asking to be started?',
  },
  'two-of-wands': {
    keywords: ['planning', 'vision', 'decision', 'ambition'],
    upright: 'A figure stands on a castle wall holding a globe, looking out to sea. This is the planning stage: you have something going, and you are weighing how far to take it. Think bigger than your current walls for a moment, and sketch out the route you would take.',
    reversed: 'Reversed, planning can become a comfortable place to stay. You might keep studying the map rather than leaving the harbour, or worry that a larger ambition means losing what you already have. Ask what is keeping you on the wall, and what a modest first trip would look like.',
    question: 'How far would you take this plan if nothing held you back?',
  },
  'three-of-wands': {
    keywords: ['expansion', 'foresight', 'progress', 'patience'],
    upright: 'Now the figure watches ships already sailing out. The Three of Wands shows early efforts beginning to move on their own, and the view widening. Notice the progress you have made, and think about the next horizon, including the people or places your work could reach beyond where it started.',
    reversed: 'Reversed, the ships are slow to come back. Delays or small obstacles may make you doubt the whole plan, or you may be thinking only a week ahead. Consider whether this is a reason to adjust course, or just a reminder that worthwhile things often take longer than hoped.',
    question: 'What would you plan for if you trusted this to keep growing?',
  },
  'four-of-wands': {
    keywords: ['celebration', 'homecoming', 'milestone', 'community'],
    upright: 'Four poles are hung with garlands, and people gather beneath them to celebrate. This is the card of a milestone marked together: a housewarming, a finished stage, a reunion. Stop and recognise how far you have come, and share that moment with the people who helped you get there.',
    reversed: 'Reversed, the celebration may feel muted, or there is tension under the bunting. You might be skipping the moment of recognition because there is always more to do. Ask whether you are letting yourself mark achievements at all, and whether everyone who contributed feels included in them.',
    question: 'Who would you want beside you to mark what you have built?',
  },
  'five-of-wands': {
    keywords: ['competition', 'friction', 'debate', 'scrappiness'],
    upright: 'Five people wave sticks at one another, more scramble than battle. The Five of Wands describes a crowded, competitive moment: everyone with an opinion, nobody quite listening. Notice whether the friction is sharpening ideas, as good debate can, or simply making noise that tires everyone out.',
    reversed: 'Reversed, conflict may be avoided until it festers, or it may finally settle as people agree on a direction. Consider whether you are dodging a disagreement that needs having, or holding onto one long after the point is made. Sometimes letting someone else win the argument is the useful move.',
    question: 'Is this disagreement improving the idea, or only wearing everyone out?',
  },
  'six-of-wands': {
    keywords: ['recognition', 'success', 'confidence', 'praise'],
    upright: 'A rider wearing a laurel wreath moves through a cheering crowd. The Six of Wands is the card of public recognition: a promotion, a project that lands, credit where it is due. The tradition reads it as a strong card for career and reputation. Accept the praise graciously, and note what kind of effort brought you here.',
    reversed: 'Reversed, recognition may be slow or go to someone else, or you might be relying on outside approval to feel your work matters. It can also describe pride that makes working with others harder. Ask what success would mean to you if nobody else were clapping.',
    question: 'How would you measure this success if nobody else saw it?',
  },
  'seven-of-wands': {
    keywords: ['conviction', 'standing firm', 'challenge', 'resolve'],
    upright: 'A figure on higher ground holds off six staves pushing up from below. The Seven of Wands is about standing by your position when others challenge it. Notice what you believe is worth defending, and see whether you can hold your ground calmly rather than defensively.',
    reversed: 'Reversed, the effort of defending may be wearing you down, or you might be guarding a position that no longer deserves it. Consider whether you are fighting out of conviction or out of habit, and whether yielding on a minor point would let you protect what truly matters.',
    question: 'Which of your positions is worth defending, and which could you let go?',
  },
  'eight-of-wands': {
    keywords: ['speed', 'movement', 'messages', 'momentum'],
    upright: 'Eight staves fly through open sky, all heading the same way. The Eight of Wands describes things moving quickly: messages crossing, plans gathering pace, obstacles clearing. It favours keeping up, answering promptly, and making good use of a stretch when effort meets little resistance.',
    reversed: 'Reversed, pace can turn frantic, with too many things in motion and little chance to aim any of them. Or momentum stalls and replies seem to take forever. Ask whether you need to slow down and aim, or be patient while the things you sent out take their time.',
    question: 'Which of the things in motion deserves your fullest attention?',
  },
  'nine-of-wands': {
    keywords: ['resilience', 'persistence', 'caution', 'last push'],
    upright: 'A tired figure leans on a staff and keeps watch, with eight more staves planted behind. The Nine of Wands is the stamina of someone near the end of a long effort. Notice how much you have already got through, and gather yourself for the final stretch.',
    reversed: 'Reversed, persistence may have turned into wariness of everyone, or a weariness that makes the last push feel impossible. Consider whether you need to ask for help rather than guard everything alone, and whether some of the battles you are bracing for are ones you can step away from.',
    question: 'What do you need to carry this through to the end?',
  },
  'ten-of-wands': {
    keywords: ['burden', 'responsibility', 'overcommitment', 'effort'],
    upright: 'Someone carries ten heavy staves in a bundle, bent over, unable to see the road ahead. The Ten of Wands is about taking on so much at work and at home that the load blocks the view, and the tradition reads it as a warning of overwork. Ask whether every piece of it truly belongs to you.',
    reversed: 'Reversed, the load may finally be coming down, or you might be refusing to put any of it down at all. Consider which tasks could be handed on, dropped or done less thoroughly without real loss, and what keeps you insisting on carrying everything yourself.',
    question: 'Which part of your load could you set down this week?',
  },
  'page-of-wands': {
    keywords: ['curiosity', 'eagerness', 'exploration', 'fresh ideas'],
    upright: 'A young figure studies a staff with open interest, as if wondering what it could become. The Page of Wands is the enthusiastic beginner: full of questions, quick to try things. Approach a project with that same curiosity, without worrying yet about being good at it.',
    reversed: 'Reversed, enthusiasm flares and fades, with many things started and few followed through. It can also be a lack of direction that leaves you restless. Ask which of your interests deserves a little more patience, and what it would take to see one through past the exciting start.',
    question: 'What are you curious enough about to try badly at first?',
  },
  'knight-of-wands': {
    keywords: ['boldness', 'adventure', 'impulse', 'charisma'],
    upright: 'A rider charges ahead on a rearing horse, eager to get going. The Knight of Wands is passion in motion: bold, restless, ready for adventure. It encourages you to act on your enthusiasm and take a risk you have been circling, while staying aware of where the horse is heading.',
    reversed: 'Reversed, boldness turns reckless: starting fights, quitting halfway, moving on before anything lands. Or the drive is there but scattered in too many directions. Consider whether your impatience is working against you, and what would happen if you finished one thing before charging after the next.',
    question: 'Where is your impatience helping you, and where is it working against you?',
  },
  'queen-of-wands': {
    keywords: ['confidence', 'warmth', 'independence', 'determination'],
    upright: 'The Queen of Wands sits with a sunflower in hand and a black cat at her feet, at ease and self-assured. She is the person who runs things with warmth and conviction, and draws others in without trying. Notice where you can lead with your own confidence and generosity.',
    reversed: 'Reversed, confidence can wobble into self-doubt, or harden into jealousy and a need to be the centre of attention. You may be overextended, keeping up appearances while running on empty. Ask what would let you feel secure without having to prove it, and who could share the load.',
    question: 'What would you do differently if you trusted yourself completely?',
  },
  'king-of-wands': {
    keywords: ['leadership', 'vision', 'boldness', 'initiative'],
    upright: 'The King of Wands has turned enthusiasm into direction. He is the founder, the organiser, the person whose long view gets others moving. Take charge of a vision, set a course, and trust your experience to make bold choices with care for the people following you.',
    reversed: 'Reversed, leadership can become impatience or domineering, expecting others to match your pace without explaining the plan. Or a big vision may lack the follow-through that makes it real. Consider whether you are inspiring people or simply pushing them, and what your plan needs beyond conviction.',
    question: 'Which vision are you ready to take responsibility for?',
  },

  'ace-of-cups': {
    keywords: ['openness', 'feeling', 'affection', 'compassion'],
    upright: 'A cup overflows in an outstretched hand, water spilling in five streams. The Ace of Cups is the beginning of a feeling: a new friendship, a rush of tenderness, a renewed capacity for compassion. Notice where your heart is open, and let that feeling be received.',
    reversed: 'Reversed, feelings may be bottled up, or poured out so freely that you have little left for yourself. You might be holding back affection for fear of how it lands. Ask what you are keeping in the cup, and whether it is time to let someone see it.',
    question: 'Where is your heart open right now, and who is it open to?',
  },
  'two-of-cups': {
    keywords: ['connection', 'mutual respect', 'partnership', 'harmony'],
    upright: 'Two people raise their cups to each other as equals. The Two of Cups is about connection built on mutual respect: a friendship, a working partnership, a reconciliation. Notice where giving and receiving are balanced, and value the people who meet you halfway.',
    reversed: 'Reversed, the balance slips: one person giving more, a misunderstanding left too long, or a bond strained by unspoken expectations. Consider what conversation would restore the sense of equal footing, and whether you have been clear about what you need from this relationship.',
    question: 'Which relationship in your life feels like a meeting of equals?',
  },
  'three-of-cups': {
    keywords: ['friendship', 'celebration', 'community', 'joy'],
    upright: 'Three friends raise their cups together in a circle, surrounded by the harvest. The Three of Cups is about shared joy: a dinner with old friends, a group that cheers one another on. Notice who celebrates with you, and make time for them while the moment is here.',
    reversed: 'Reversed, the circle may feel strained: gossip, a friend left out, or plenty of socialising with little real connection. It can also mean pulling away from people who care about you. Ask which friendships nourish you and which wear you down, and what you would like to change.',
    question: 'Who would you call first to share good news?',
  },
  'four-of-cups': {
    keywords: ['apathy', 'contemplation', 'withdrawal', 'overlooked offers'],
    upright: 'A figure sits under a tree, arms folded, ignoring a cup offered from a cloud. The Four of Cups describes a flat, inward mood where nothing on offer seems to matter. Notice whether you are resting and reflecting, or overlooking something worth accepting.',
    reversed: 'Reversed, the figure begins to look up. Restlessness may be giving way to renewed interest, or you are finally ready to say yes to something you dismissed. Consider which offers you turned down out of boredom, and whether some of them deserve a second look.',
    question: 'What is being offered to you that you have not really looked at?',
  },
  'five-of-cups': {
    keywords: ['grief', 'regret', 'loss', 'what remains'],
    upright: 'A cloaked figure stares at three spilled cups, not yet noticing the two still standing behind. The Five of Cups is about disappointment and regret, and how they narrow your view. Let yourself feel the loss fully, and then turn around to see what remains.',
    reversed: 'Reversed, you may be starting to move through a loss, ready to pick up the cups still standing. Or grief has been pushed down so firmly that it shows up as irritability. Consider whether you need to make peace with what happened, or give it more room first.',
    question: 'What is still standing that you have not turned to see?',
  },
  'six-of-cups': {
    keywords: ['nostalgia', 'memories', 'kindness', 'innocence'],
    upright: 'A child offers another a cup filled with flowers in a sunny courtyard. The Six of Cups is about memory and simple kindness: old friends, childhood places, the generosity of small gestures. Notice what the past can still teach you, and offer someone an easy kindness today.',
    reversed: 'Reversed, nostalgia can become a way of avoiding the present by idealising how things used to be. It might also stir up a memory that needs a fresh look. Ask whether looking back is giving you comfort and wisdom, or keeping you from living fully where you are now.',
    question: 'Which memory still shapes how you treat people today?',
  },
  'seven-of-cups': {
    keywords: ['options', 'daydreams', 'illusion', 'choice'],
    upright: 'Seven cups float in a cloud, each holding something different: a jewel, a wreath, a dragon, a castle. The Seven of Cups describes too many options and the daydreams that come with them. Notice which possibilities are real, and which are only pleasant to imagine.',
    reversed: 'Reversed, the fog clears and the choices sharpen. You may be ready to commit to one path, or to admit that a favourite fantasy was never going to fit. Consider what you would choose if you had to decide today, and what the other cups were really offering.',
    question: 'Which of your options would still appeal if you had to start on it tomorrow?',
  },
  'eight-of-cups': {
    keywords: ['walking away', 'searching', 'disappointment', 'deeper meaning'],
    upright: 'A figure walks away from eight stacked cups toward distant mountains under a waning moon. The Eight of Cups is about leaving something that no longer satisfies, even when it looks fine from the outside. Notice what you have outgrown, and what you are really looking for.',
    reversed: 'Reversed, you may be torn between leaving and staying, or walking away too quickly whenever things get hard. Consider whether this situation can still give you what you need with some changes, or whether it is time to set out. Either decision deserves honesty about your reasons.',
    question: 'What are you looking for that this situation no longer gives you?',
  },
  'nine-of-cups': {
    keywords: ['contentment', 'satisfaction', 'gratitude', 'wishes'],
    upright: 'A man sits with folded arms in front of nine cups lined up behind him, looking pleased. The Nine of Cups is satisfaction: something you hoped for has come about, or you feel content with what you have. Enjoy it, and notice what truly made you happy.',
    reversed: 'Reversed, satisfaction may feel hollow, or you have what you wanted and still feel restless. It can also point to indulgence, using comfort to cover something else. Ask whether your wishes still reflect what you value, and what a deeper contentment might look like.',
    question: 'What do you already have that you once wished for?',
  },
  'ten-of-cups': {
    keywords: ['harmony', 'family', 'belonging', 'shared happiness'],
    upright: 'A family stands under a rainbow of cups, children playing, a home in the distance. The Ten of Cups is about emotional fulfilment that is shared: belonging, steady affection, a household or chosen family where people feel at ease. Notice that sense of home, and tend it.',
    reversed: 'Reversed, the picture may look better from outside than it feels inside: tension at home, or an ideal of family life that real people cannot meet. Consider where expectations are getting in the way of connection, and what a more honest version of harmony might be.',
    question: 'Where do you feel most at home, and with whom?',
  },
  'page-of-cups': {
    keywords: ['sensitivity', 'creativity', 'surprise', 'tenderness'],
    upright: 'A young figure looks at a fish peering out of a cup, amused rather than alarmed. The Page of Cups is gentle curiosity about feelings: an unexpected message, a creative impulse, a soft surprise. Stay open to what moves you, even when it seems odd.',
    reversed: 'Reversed, sensitivity may tip into moodiness, or creative ideas are kept private out of embarrassment. You might be ignoring a feeling because it seems childish. Ask what you would explore if you were less worried about seeming foolish, and who could hear it kindly.',
    question: 'What feeling or idea surprised you recently?',
  },
  'knight-of-cups': {
    keywords: ['idealism', 'invitation', 'charm', 'sincerity'],
    upright: 'A rider moves slowly forward holding out a cup, like someone bringing an invitation. The Knight of Cups follows feeling and imagination, offering kindness, creative proposals or a heartfelt gesture. Act on what moves you, and approach others with sincerity and grace.',
    reversed: 'Reversed, the knight may be all charm and no follow-through, or so caught up in an ideal that real people disappoint. Moodiness can make it hard to act. Consider whether you are offering something you can actually deliver, and whether your expectations leave room for ordinary life.',
    question: 'What gesture would show someone how you really feel?',
  },
  'queen-of-cups': {
    keywords: ['empathy', 'compassion', 'intuition', 'emotional calm'],
    upright: 'The Queen of Cups holds an ornate closed cup, seated at the water\'s edge. She is the friend who listens well, notices what is unsaid, and stays calm in the face of strong feelings. Notice where your empathy can help someone, and where it would help to listen to yourself.',
    reversed: 'Reversed, empathy can turn into absorbing other people\'s moods until your own feelings get lost. Or feelings are kept locked away. Consider whether you have clear boundaries between caring for others and carrying them, and what you need to refill your own cup.',
    question: 'Whose feelings are you carrying that are not yours to hold?',
  },
  'king-of-cups': {
    keywords: ['emotional balance', 'diplomacy', 'composure', 'kindness'],
    upright: 'The King of Cups sits on a throne floating on a rough sea, calm while the waves move. He is the steady presence who feels deeply but stays balanced: the mentor, the diplomat, the parent who does not take the bait. Meet strong feelings, yours and others, with composure.',
    reversed: 'Reversed, calm can become suppression, or a mood that leaks out as coldness or sudden outbursts. It may also point to someone using emotional insight to steer others. Ask whether your composure is honest steadiness, or a way of avoiding feelings that need expressing.',
    question: 'How do you keep your balance when feelings run high?',
  },

  'ace-of-swords': {
    keywords: ['clarity', 'truth', 'breakthrough', 'decision'],
    upright: 'A hand grips an upright sword crowned with a wreath. The Ace of Swords is the moment an idea becomes clear: a breakthrough in thinking, an honest word, a decision you can state plainly. Cut through the confusion around you and say what you mean.',
    reversed: 'Reversed, clarity is clouded: muddled thinking, or a sharp truth used carelessly. You might be overanalysing, or speaking before you understand. Consider whether you need more information before deciding, or more care in how you say what you already know.',
    question: 'What would you say if you had to put it in one clear sentence?',
  },
  'two-of-swords': {
    keywords: ['stalemate', 'indecision', 'avoidance', 'difficult choice'],
    upright: 'A blindfolded figure sits with two crossed swords, the sea behind her. The Two of Swords is the stalemate of a decision you would rather not make, or a conflict you are keeping at arm\'s length. Notice what you are refusing to look at, and why.',
    reversed: 'Reversed, the blindfold may be slipping: new information arrives, or pressure builds until a choice becomes unavoidable. You might feel overwhelmed by too many considerations at once. Ask what you know now that you did not know before, and whether waiting longer serves anyone.',
    question: 'What would you decide if you took off the blindfold?',
  },
  'three-of-swords': {
    keywords: ['heartbreak', 'sorrow', 'hurtful truth', 'grief'],
    upright: 'A heart shape is crossed by three swords under grey rain. The Three of Swords names sorrow plainly: hurtful words, a disappointment, a painful truth. Acknowledge the hurt rather than rushing past it, because naming pain clearly is often the first step through it.',
    reversed: 'Reversed, the hurt may be easing, or held in so tightly it cannot move. You might be replaying an old wound in your head. Consider what would help you release it: a conversation, forgiveness, or simply letting yourself feel it with less judgement.',
    question: 'What hurt are you ready to name honestly?',
  },
  'four-of-swords': {
    keywords: ['rest', 'recovery', 'retreat', 'stillness'],
    upright: 'A figure lies quietly in a chapel, hands folded, as if napping after a long week. The Four of Swords is the card of rest and recovery: time off, proper sleep, letting your mind settle after strain. The tradition reads it as a call to take rest seriously before the next push.',
    reversed: 'Reversed, rest may be resisted: you keep going because stopping feels unsafe. Or you have rested so long that inaction has set in and starting again feels hard. Consider whether you need permission to pause, or a gentle push to start moving again.',
    question: 'What would real rest look like for you this week?',
  },
  'five-of-swords': {
    keywords: ['conflict', 'hollow victory', 'self-interest', 'tension'],
    upright: 'One figure gathers swords while two others walk away, looking defeated. The Five of Swords describes winning an argument at too high a price, or watching others do it. Notice whether a victory is worth the damage to trust, and what you have really gained.',
    reversed: 'Reversed, there may be a chance to make amends after a bruising conflict, or resentment continues to simmer. Consider whether you need to apologise, let something go, or step away from a situation where winning matters more than fairness.',
    question: 'Is being right here worth what it does to the relationship?',
  },
  'six-of-swords': {
    keywords: ['transition', 'moving on', 'calmer waters', 'passage'],
    upright: 'A ferryman poles a boat carrying a cloaked passenger and a child toward a calmer shore. The Six of Swords is a quiet transition: leaving a hard situation, moving on gradually. Notice the progress you are making, even if it feels slow from where you sit.',
    reversed: 'Reversed, the move may be stalled, or you carry the old trouble with you into the new place. Consider what unfinished business needs settling before you can truly move on, and whether you are resisting a change you already know is necessary.',
    question: 'What are you carrying with you that could stay on the old shore?',
  },
  'seven-of-swords': {
    keywords: ['strategy', 'evasion', 'secrecy', 'cunning'],
    upright: 'A figure tiptoes away from a camp, carrying five swords and glancing back. The Seven of Swords is about strategy and stealth: getting around a problem, sometimes by cutting corners. Notice where cleverness serves you, and where it slides into avoiding honesty.',
    reversed: 'Reversed, a hidden plan may come to light, or you feel the weight of something you have not owned up to. It can also describe self-deception. Consider what would happen if you were completely open about your intentions, and who would benefit from that honesty.',
    question: 'Where are you taking a shortcut that you would not want to explain?',
  },
  'eight-of-swords': {
    keywords: ['restriction', 'self-limiting beliefs', 'feeling trapped', 'perspective'],
    upright: 'A blindfolded figure stands loosely bound, surrounded by swords, yet the path out is open. The Eight of Swords describes feeling trapped by circumstances that are partly held in place by your own thinking. Notice which limits are real, and which you have simply assumed.',
    reversed: 'Reversed, you may be starting to see a way out, loosening a belief that kept you stuck. Or fear tightens its grip just as an exit appears. Ask what small step would prove to yourself that you have more room to move than you thought.',
    question: 'Which of the walls around you would move if you pushed on it?',
  },
  'nine-of-swords': {
    keywords: ['anxiety', 'worry', 'rumination', 'night thoughts'],
    upright: 'Someone sits up in bed, head in hands, nine swords on the wall behind them. The Nine of Swords is the small-hours spiral, when worries keep you from sleep and feel bigger in the dark. Notice how much of the fear lives in your head, and share it with someone who can help you think it through.',
    reversed: 'Reversed, worry may be easing as you talk it through, or hardening into a habit of expecting the worst. Consider what you could write down, ask about, or test, so that a looping thought becomes something you can actually respond to.',
    question: 'Which of your worries would look smaller in daylight?',
  },
  'ten-of-swords': {
    keywords: ['rock bottom', 'painful ending', 'closure', 'release'],
    upright: 'The Ten of Swords is the card of hitting bottom: a situation that has gone as badly as it can, a betrayal, a plan that has fully collapsed. Its odd comfort is that there is nowhere lower to go. Let the worst be over, and look for the first light on the horizon.',
    reversed: 'Reversed, you may be climbing out slowly, or reliving the low point long after it has passed. Consider whether you are ready to stop telling the story of what went wrong, and start shaping the story of what comes next.',
    question: 'If the worst is behind you, what is the first thing you would rebuild?',
  },
  'page-of-swords': {
    keywords: ['curiosity', 'questions', 'alertness', 'new ideas'],
    upright: 'A young figure holds a sword upright, hair blown by the wind, watching everything. The Page of Swords is the eager student and the sharp observer: full of questions, quick to notice. Learn, ask, and test ideas, while staying open to answers you did not expect.',
    reversed: 'Reversed, curiosity can turn into nosiness, gossip, or talking about things before understanding them. Or scattered thinking makes it hard to land anywhere. Consider whether you are asking questions to learn, or only to win an argument.',
    question: 'What question would you ask if you were sure nobody would laugh?',
  },
  'knight-of-swords': {
    keywords: ['ambition', 'haste', 'assertiveness', 'drive'],
    upright: 'A rider charges into the wind, sword raised, horse at full gallop. The Knight of Swords acts fast on ideas and convictions, cutting straight to the point. Move decisively on something you have thought through, and speak up for what you believe.',
    reversed: 'Reversed, speed becomes recklessness: rushing in, saying something harsh, or abandoning a plan halfway. Consider whether you are acting from clarity or from impatience, and who might be caught in the slipstream of your hurry.',
    question: 'Is your urgency coming from clarity, or from not wanting to wait?',
  },
  'queen-of-swords': {
    keywords: ['clear judgement', 'independence', 'directness', 'honesty'],
    upright: 'The Queen of Swords sits upright, one hand extended, sword held steady. She is the person who tells you the truth kindly but without softening it, and who has learned from her own experience. Think clearly, set your boundaries, and speak honestly.',
    reversed: 'Reversed, directness can turn cold or cutting, or clear thinking gives way to bitterness about the past. Consider whether your honesty still has kindness in it, and whether an old hurt is shaping how you judge people now.',
    question: 'What honest thing needs saying, and how can you say it kindly?',
  },
  'king-of-swords': {
    keywords: ['intellect', 'authority', 'fairness', 'clear thinking'],
    upright: 'The King of Swords sits facing forward, sword upright, the picture of considered authority. He is the person whose decisions rest on reason and principle: the fair-minded editor, the steady chair of a meeting. Weigh the facts carefully, and decide with integrity.',
    reversed: 'Reversed, reason can turn rigid or manipulative, with logic used to win rather than to understand. Consider whether you are hiding behind facts to avoid feelings, or using your judgement to control others, and what would change if you let both count.',
    question: 'What would you decide if you looked only at the facts and your principles?',
  },

  'ace-of-pentacles': {
    keywords: ['opportunity', 'new income', 'practical start', 'potential'],
    upright: 'A hand offers a single disc above a garden gate. The Ace of Pentacles is a practical opening: a new job, a pay rise, a business idea, a skill that can earn its keep. The tradition reads it as a good start for money and work, built one steady step at a time.',
    reversed: 'Reversed, a promising offer may slip away through poor planning, or money and effort leak out faster than they come in. Consider what groundwork is missing, whether a simple budget would help, and whether you are passing over something solid because it looks ordinary.',
    question: 'What practical first step could you take today?',
  },
  'two-of-pentacles': {
    keywords: ['juggling', 'adaptability', 'budgeting', 'balance'],
    upright: 'A figure juggles two discs linked by a figure-eight loop, ships riding the waves behind. The Two of Pentacles is about keeping several commitments moving at once: two jobs, bills and plans, work and home. The tradition reads it as a time to stay flexible with your hours and your money.',
    reversed: 'Reversed, the juggling gets messy: too many commitments, payments or deadlines at once, and something dropped. Consider what to put down or postpone, where your money and hours are really going, and whether you keep saying yes to things that leave no room for what matters.',
    question: 'Which of the things you are juggling could you put down for a while?',
  },
  'three-of-pentacles': {
    keywords: ['teamwork', 'craft', 'career', 'skill'],
    upright: 'A stonemason works on a cathedral arch while two people holding plans look on. The Three of Pentacles is skilled work that gets noticed: a good team, a client who values the craft, a step up in your career. The tradition reads it as favourable for collaboration, apprenticeships and work done well.',
    reversed: 'Reversed, teamwork may be strained: unclear roles, nobody listening, or doing everything yourself because you do not trust others. Consider whether you need to ask for input, share the credit, or clarify who is responsible for what.',
    question: 'Whose skills would make your work better if you invited them in?',
  },
  'four-of-pentacles': {
    keywords: ['saving', 'security', 'control', 'holding on'],
    upright: 'A seated figure holds one disc tightly to his chest, with others under his feet and on his head. The Four of Pentacles is about saving and holding on: money put by, a secure position, control of what you have built. The tradition reads it as security, and warns when caution turns into a tight fist.',
    reversed: 'Reversed, the grip loosens: you may be ready to spend or share more freely, or worried that money is slipping away. It can also point to holding on so hard that nothing new comes in. Consider what you are guarding, and what a sensible balance of saving and spending would be.',
    question: 'What are you holding so tightly that nothing new can reach you?',
  },
  'five-of-pentacles': {
    keywords: ['hardship', 'lean times', 'exclusion', 'seeking support'],
    upright: 'Two figures walk through snow past a lit church window. The Five of Pentacles is the card of a lean stretch: money tight, work uncertain, feeling left out in the cold. The tradition reads it as hardship that help can ease, so look for the lit window: support, advice, people who would gladly help.',
    reversed: 'Reversed, a difficult season may be easing, with money or work starting to recover, or you are finally accepting help that was always on offer. Consider who you could reach out to, and whether pride or shame has been keeping you outside the door.',
    question: 'Where is help available that you have not yet asked for?',
  },
  'six-of-pentacles': {
    keywords: ['generosity', 'giving and receiving', 'sharing', 'fairness'],
    upright: 'A merchant holding a pair of scales hands out money to two people kneeling nearby. The Six of Pentacles is about giving and receiving: a fair wage, a loan repaid, help offered or accepted. The tradition reads it as resources flowing where they are needed. Notice where you can give, and where you can receive gracefully.',
    reversed: 'Reversed, generosity may come with strings attached, or money and favours run only one way. You might be lending what you cannot spare, or accepting help that leaves you uneasy. Consider whether the exchange feels fair to both sides, and whether something owed needs settling.',
    question: 'Where is the balance of giving and receiving uneven in your life?',
  },
  'seven-of-pentacles': {
    keywords: ['patience', 'assessment', 'long-term effort', 'perseverance'],
    upright: 'A gardener leans on a hoe, looking at a bush where seven discs are ripening. The Seven of Pentacles is long-term effort: savings that grow slowly, a career that takes years, work that pays off over time. The tradition reads it as a moment to take stock of what your effort is earning, and adjust.',
    reversed: 'Reversed, impatience may tempt you to abandon something just before it pays off, or you keep putting in time and money without checking what comes back. Consider whether you need more patience, or a clearer look at what your work is actually producing.',
    question: 'Is the work you are putting in growing what you actually want?',
  },
  'eight-of-pentacles': {
    keywords: ['diligence', 'practice', 'mastery', 'attention to detail'],
    upright: 'An artisan sits at a workbench, carving one disc after another, the finished ones hung on display. The Eight of Pentacles is skilled, steady work: training, a craft, a job you get better at by doing. The tradition reads it as good for study, apprenticeships and earning through a skill. Focus on the work itself.',
    reversed: 'Reversed, practice can turn into perfectionism, or the work becomes rote and you lose interest. Consider whether you are improving or just repeating, and whether a new challenge or a short break would bring back the care.',
    question: 'Which skill would you practise until it becomes second nature?',
  },
  'nine-of-pentacles': {
    keywords: ['self-reliance', 'refinement', 'independence', 'enjoyment'],
    upright: 'A woman stands in a flourishing vineyard, a falcon on her gloved hand, at ease in a place she has tended. The Nine of Pentacles is comfort earned by your own effort: money of your own, a pleasant home, independence. The tradition reads it as a good time to enjoy what your work has paid for.',
    reversed: 'Reversed, independence may become isolation, or you find it hard to enjoy what you have built because there is always more to do. Consider whether you are allowing yourself to rest in your achievements, and whether you need others more than you admit.',
    question: 'What have you built that you can stop and enjoy today?',
  },
  'ten-of-pentacles': {
    keywords: ['legacy', 'family', 'security', 'lasting foundations'],
    upright: 'Several generations gather in an archway, with dogs at their feet and a house behind. The Ten of Pentacles is about what lasts: family, home, savings and traditions built over years. The tradition reads it as long-term security, an inheritance of skill or property, and thought for what you would like to leave others.',
    reversed: 'Reversed, family expectations may feel heavy, or money and property cause friction at home. Old traditions might clash with how you want to live. Consider which inherited habits support you and which hold you back, and how to talk about shared resources openly.',
    question: 'What would you like to pass on to the people who come after you?',
  },
  'page-of-pentacles': {
    keywords: ['study', 'diligence', 'new skill', 'application'],
    upright: 'A young figure holds a disc up to the light, studying it closely. The Page of Pentacles is the careful learner: a new course, an apprenticeship, a first job, a practical goal such as saving for something. Commit to learning slowly and well, with patience for the clumsy early stages.',
    reversed: 'Reversed, the learner may lose focus, or plan endlessly without ever picking up the tools. Consider whether you need a concrete next step, a teacher, or simply to begin, accepting that first attempts are usually rough.',
    question: 'What are you ready to learn slowly and well?',
  },
  'knight-of-pentacles': {
    keywords: ['reliability', 'routine', 'patience', 'persistence'],
    upright: 'A knight sits on a still horse, looking at a disc, in no hurry at all. The Knight of Pentacles is steady, reliable effort: showing up for work every day, keeping to a budget, finishing what you start. The tradition reads it as slow, dependable progress with work and money. Value consistency.',
    reversed: 'Reversed, steadiness can turn into stubbornness or boredom, where routine becomes a rut. Or you might be neglecting the everyday tasks you usually do well. Consider whether your routine still serves you, or whether a small change would bring fresh focus.',
    question: 'Which routine, kept up faithfully, would make the biggest difference?',
  },
  'queen-of-pentacles': {
    keywords: ['nurturing', 'practicality', 'homemaking', 'care'],
    upright: 'The Queen of Pentacles sits in a garden with a rabbit at her feet, holding a disc in her lap. She runs a household well, manages money sensibly, and still finds time for others. Notice how practical care, a cooked meal, a tidy budget, a good night\'s sleep, supports everyone around you, you included.',
    reversed: 'Reversed, caring for everyone else may leave your own needs unmet, or the home becomes a source of stress rather than comfort. Consider whether you are trying to do everything yourself, and what would help you feel looked after too.',
    question: 'What small act of practical care would make your home feel better?',
  },
  'king-of-pentacles': {
    keywords: ['stability', 'business', 'dependability', 'stewardship'],
    upright: 'The King of Pentacles sits among vines and flowers, relaxed and secure on his throne. He is the person who has built practical and financial stability through years of work: the business owner, the steady provider. The tradition reads him as success in business and money, used well and shared.',
    reversed: 'Reversed, stability may turn into stubbornness, or success into a focus on status and possessions. It can also point to careless spending, or a business decision made for show. Consider whether you are measuring yourself by what you own rather than who you are.',
    question: 'How can your experience help someone else build their own steadiness?',
  },
};
