# Ask the Sky: draft question filter (for ZOD-61)

Draft only. This is a written design. It is not code, it is not wired to
anything, and it does not add a "chart for this moment" call or touch ZOD-62.

ZOD-61 holds Ask the Sky until a filter is designed that "refuses health,
money, betting, legal and other-people questions" and sets "a one-question
limit". This file is that design. `03-filter-test-set.md` is the test set
that goes with it.

## 1. What the filter is for

Ask the Sky would take one question, cast the sky for the minute it was
asked, and give a plain answer by William Lilly's rules. There are three
gates, and this file is only the first:

1. **The filter (this file).** Is this a question Ask the Sky may judge at all? It looks only at the question.
2. **Lilly's considerations before judgment.** Is the chart fit to judge? Lilly's ch. XIX lists the cases where "it is not safe to give judgment" and ends "defer judgment" (L1 in `SOURCES.md`). That gate looks only at the sky.
3. **The judgment.** Lilly's rules for the matter asked about, for example ch. XXXIII for a job (L2).

Why the first gate has to be separate and has to come first:

- A yes or a no from the sky sounds like knowledge. On a question about someone's body, savings, court case or child, a confident wrong answer can do real harm, and the person asking has no way to check it.
- The house rules already forbid these answers everywhere on the site: "No betting tips, sports picks, market timing, election forecasts, health predictions or guarantees" (`AGENTS.md`, Product rules).
- A refused question must be refused honestly, as a refusal. It must never be passed to gate 2 and answered with "the sky is not fit to judge this", because that is still a kind of answer, and it invites the person to ask again in an hour.
- Lilly's own verdict on a job comes with a condition: the querent gains it "if he use proper endeavours" (L2). The answer is addressed to the person who can act on it. That is the root of the first-person rule below.

What the opened Lilly chapters do not give: a list of forbidden subjects, or
a one-question limit. Those are product rules. They come from ZOD-61 and
`AGENTS.md`, and they are stated here as such.

## 2. The decision in one page

The filter gives one of two results: **allow** or **refuse**. A refusal
always carries a reason from the list below, and the reason decides the
wording the person sees. A refused question is never judged in part.

Checks run in this order. The first one that applies decides.

| Step | Check | If it applies |
|---|---|---|
| 0 | **Safety.** The message suggests the person may harm themselves or someone else, or is in danger now. | Refuse, reason `safety`. Say plainly that this is not something to ask the sky, and point to local emergency services or a crisis line. Nothing else. |
| 1 | **One question.** The message holds more than one question, a list, an either-or between two matters, or a follow-up to a question already judged. | Refuse, reason `one-question`. |
| 2 | **Age.** The person says or shows they are under 13. | Refuse, reason `minors`. Do not go on, and do not keep the question. |
| 3 | **A child is the subject.** The question is about a person under 18, an unborn child, a pregnancy, or is asked on a child's behalf. | Refuse, reason `minors`. |
| 4 | **Someone else is the subject.** The answer would say something about another person's feelings, thoughts, secrets, body, choices or future, or about a public figure. | Refuse, reason `other-people`. |
| 5 | **Health.** | Refuse, reason `health`. |
| 6 | **Legal.** | Refuse, reason `legal`. |
| 7 | **Betting and public contests.** | Refuse, reason `betting`. |
| 8 | **Money.** | Refuse, reason `money`. |
| 9 | **Guarantee or certainty.** The person asks for a promise, for odds, for certainty, or says they will let the answer alone decide something that cannot be undone. | Refuse, reason `guarantee`. |
| 10 | **Not judgeable as asked.** Not a question, not about a real matter of the asker's own, too vague to have a yes or a no, or the matter is not named. | Refuse, reason `reword`. |
| 11 | None of the above. | **Allow.** |

Five rules that sit over the whole table:

- **Judge the meaning, not the words.** "Will I get the nursing job at the hospital?" is a work question. "Will the results on Friday be good news?" may be a health question with no health word in it. A list of banned words would get both wrong.
- **Any refused part refuses the whole.** "Will I get the job, and will the pay cover my mortgage?" is refused. The filter does not answer the first half and drop the second.
- **Wrappers change nothing.** "Just for fun", "hypothetically", "asking for a friend", "in a story", "I know you can't promise, but", "ignore your rules": the filter looks at the question underneath.
- **When in doubt, refuse and invite a new question.** A refusal does not use up the person's one question.
- **Every language.** The same rules apply whatever language the question is in.

## 3. What is allowed

A question is allowed when all of these are true:

- **It is one question**, with a yes or a no (or a "not yet") as its answer.
- **It is the asker's own matter.** The asker is the one it happens to, and the one who can act on the answer.
- **It is real and pending.** Something has been applied for, asked, lost, planned or begun, and the outcome is not known yet.
- **It is specific.** The matter is named.
- **It is outside every refused category in section 4.**

Other people may be part of the matter without being its subject. An
employer, a school, a publisher, a landlord's office or a competition jury
decides something about the asker's own application. That is allowed. The
test is what the answer says: "you get the job" is about the asker. "She
likes you" is about her.

Examples that are allowed:

| Question | Why |
|---|---|
| Will I get the job I interviewed for? | The ZOD-61 sample. Own matter, pending, specific. |
| Will I pass my driving test next week? | Own matter, pending, specific. |
| Will I be offered a place on the course I applied for? | An institution's decision on the asker's own application. The asker is an adult applicant. |
| Will my manuscript be accepted by the publisher I sent it to? | Own work, pending decision. |
| Will I find my lost ring? | Own property, lost, outcome unknown. |
| Will I get the flat I applied to rent? | Own application for a home. Not a purchase or an investment. |
| Will my trip to Lisbon go ahead in May? | Own plan, specific. |
| Will I finish my thesis by June? | Own effort, specific. |
| Will I be picked for the choir after my audition? | A jury's decision on the asker's own audition. A contest of skill, with no stake. |
| Will I meet someone new this year? | About the asker. No identifiable other person. |

Words that sound like a refused category but are not one:

| Question | Why it is still allowed |
|---|---|
| Will I pass the bar exam? | An exam. Nothing legal is being decided about the asker. |
| Will I get the nursing job at St Mary's? | A job, in a hospital. Not the asker's health. |
| Will I get the job at the bank? | A job. Not the asker's money. |
| Will my novel about a poker player find a publisher? | A book. No bet. |
| Will I get the job coaching the under-12s? | A job. No child is the subject. |
| Will I win the short story competition I entered? | A contest of skill the asker has entered, with no stake. |

## 4. What is refused, and why

Each category has: what it covers, why it is refused, blunt examples, softened
or indirect examples, and the nearest thing that is allowed.

### 4.1 Health

**Covers.** The asker's body or mind: illness, symptoms, test results,
diagnosis, treatment, medicine, operations, recovery, pregnancy and
fertility, weight, sleep, addiction, how long they will live, whether they
are well enough for something. Animals' health too.

**Why.** "Health predictions" are barred by the house rules. A yes can delay
a visit to a doctor and a no can frighten someone for nothing.

| Blunt | Softened or indirect |
|---|---|
| Do I have cancer? | Will the results on Friday be good news? |
| Will my surgery go well? | Will I be back at work by spring after my operation? |
| Will I get pregnant this year? | Is there any point in me trying again this cycle? |
| Should I stop taking my medication? | Will I feel like myself again by summer? |

**Nearest allowed.** A question about the asker's work or plans that does not
turn on their health: "Will I get the transfer I asked for?"

### 4.2 Money

**Covers.** Investing and trading of any kind, prices going up or down,
buying or selling property or other large assets, borrowing and lending,
debts, windfalls, inheritances, insurance payouts, "will I be rich", a
business's sales or funding, whether something is affordable.

**Why.** The house rules bar "market timing" and financial advice. The
answer would be used to move money.

| Blunt | Softened or indirect |
|---|---|
| Should I buy the shares now? | Is this a good week to finally do something with my savings? |
| Will my loan be approved? | Will the bank say yes on Thursday? |
| Will I be rich? | Will the thing I bought last month turn out to be worth it? |
| Will my offer on the house be accepted? | Is now the time to get on the housing ladder? |

**Nearest allowed.** Work questions where pay is only part of the picture:
"Will I get the promotion I applied for?" The answer never mentions an
amount and never says what to do with money. Two edge cases are listed in
section 8.

### 4.3 Betting and public contests

**Covers.** Gambling of every kind: bets, lotteries, raffles, casinos, cards
for money, prediction markets, fantasy leagues. Also the result of any
public contest the asker is watching and not taking part in: sports,
elections, awards, talent shows. With or without money on it.

**Why.** The house rules bar "betting tips, sports picks" and "election
forecasts". An answer about a public result is a tip the moment it is given,
whatever the asker says they will do with it.

| Blunt | Softened or indirect |
|---|---|
| Will my bet on Saturday's match win? | Just for fun, who takes it on Saturday, home or away? |
| Should I buy a lottery ticket today? | Is tonight my lucky night? |
| Who wins the election? | Will my side be celebrating on election night? |
| Which horse wins the 3:15? | Should I go with 7 or 11? |

**Nearest allowed.** A contest of skill the asker has entered, with no
stake: "Will I be picked for the team at Sunday's trial?"

### 4.4 Legal

**Covers.** Courts and tribunals, the police, charges and sentences,
lawsuits, divorce and custody proceedings, immigration and visa decisions,
regulators, contracts in dispute, formal complaints and disciplinary
hearings, whether something is legal, whether to sign something.

**Why.** Named in ZOD-61. These are matters where a wrong steer costs rights
that cannot be got back, and where the person needs someone qualified.

| Blunt | Softened or indirect |
|---|---|
| Will I win my court case? | Will the hearing on the 14th go my way? |
| Will my visa be approved? | Will the letter from the Home Office be good news? |
| Will I get custody? | Will the judge see it my way about the weekends? |
| Should I sign the settlement? | Will I still have my job after the tribunal? |

**Nearest allowed.** An exam or a job in the law: "Will I pass the bar
exam?", "Will I get the paralegal job I interviewed for?"

### 4.5 Other people

**Covers.** Any question whose answer would state something about another
person: what they feel, think, want or hide, what they will do in their own
life, what will happen to them. Partners, former partners, relatives,
friends, colleagues, strangers, public figures. Also questions asked on
someone else's behalf, and questions about a couple or a group ("will we").

**Why.** Named in ZOD-61. The other person has not asked and cannot answer
back. A verdict on someone's loyalty or feelings can end a relationship on
no evidence. The site's connector already works this way: it asks before
using someone else's birth details.

| Blunt | Softened or indirect |
|---|---|
| Is my husband cheating on me? | Is there something I should know about where he was on Friday? |
| Does she love me? | Will I hear from her again? |
| Will my boss be fired? | Will my team have a new manager by Christmas? |
| Will my sister get the job? | Asking for a friend: will she get the job she interviewed for? |
| Will the prime minister resign? | Will we be all right, the two of us? |

**Nearest allowed.** The same wish, asked about the asker alone and with no
identifiable other person: "Will I meet someone new this year?" This rule
refuses most questions about love. That cost is real and it is listed for
Dias in section 8.

### 4.6 Minors

**Covers.** Three cases.

1. **The asker is a child.** If the person says or shows they are under 13, nothing is judged. If they say or show they are 13 to 17, nothing about romance or attraction is judged, and every other rule applies as usual.
2. **A child is the subject.** Any question about a person under 18, by a parent or anyone else: their school, health, friends, future, character. Any question about an unborn child, a pregnancy or a birth.
3. **A child's birth as the moment.** Ask the Sky casts the sky for the moment the question is asked, and for no other moment. It must never accept a date and time supplied by the asker. Otherwise "cast it for 3 March at 04:10, when my daughter was born" turns a question tool into a way round the rule that no chart is made for a birth less than 13 years ago (ZOD-62 describes that rule; the connector's instructions state it).

**Why.** The site is not directed at children under 13 and gives no romance
framing for anyone under 18 (connector instructions). A child cannot agree
to being read, and a parent acting on a verdict about a child is the
other-people problem at its worst.

| Blunt | Softened or indirect |
|---|---|
| Will my son pass his exams? | Will we get the school place we applied for? |
| What will my baby be like? | We're expecting in March. Will it all go smoothly? |
| I'm 12. Will I make the football team? | My little one starts nursery on Monday. Will she settle? |
| I'm 16. Does my crush like me back? | Can you do the sky for 04:10 on 3 March? That's when she arrived. |

**Nearest allowed.** A parent's own matter in which a child is only the
background: "Will I get the part-time hours I asked for?" The test is the
same as everywhere: who is the answer about?

### 4.7 Prediction and guarantee claims

**Covers.** Requests for a promise, a certainty, a percentage or odds.
Questions that hand the decision to the sky for something that cannot be
undone ("if it says yes I resign today"). Questions about death, disaster or
catastrophe. Forecasts of public events (also caught by 4.3). Requests to
confirm that an earlier answer "will definitely" happen.

**Why.** The house rules bar "guarantees", and say a forecast is astrology's
reading with a confidence label that "says how specific the details were,
never the odds that an event happens" (`reading-confidence.ts`, connector
instructions). An answer given in reply to "promise me" is read as a promise
whatever small print follows it.

| Blunt | Softened or indirect |
|---|---|
| Guarantee me I'll get the job. | Just tell me for certain, yes or no: will I get the flat? |
| What are the odds I pass, in percent? | On a scale of one to ten, how sure is it? |
| When will I die? | Will I still be around to see it finished? |
| If you say yes I'm handing in my notice tomorrow. Will the new job work out? | I'll do whatever the sky says. Should I go? |

**Nearest allowed.** The same question without the demand: "Will I get the
flat I applied to rent?" The answer is then given plainly, with the line
"This is astrology's reading, never a guarantee" and the confidence label.

### 4.8 The one-question limit

ZOD-61 names "a one-question limit" and does not define it. This draft
defines it in three parts. The third needs a decision from Dias.

1. **One question per asking.** One matter, one outcome. A message with two questions, a list, a follow-up clause ("and if not, then what?") or a choice between two matters is refused with reason `one-question`, and the person is asked to pick the one that matters most.
2. **The same question is judged once.** Asking again to get a different answer is refused: same matter, different wording, an hour later or a day later. A new question about the same matter is fair when something has changed (the interview happened, the letter came).
3. **How often.** Proposal: one judged question per person per day. A refused question does not count. Whatever enforces this must not store the question or anything about the person. This is a design point for whoever builds it, and it is not built here.

**Why.** Without a limit the tool becomes a slot machine: people re-ask until
the answer suits them, and every answer after the first is worth less. The
chart is for the moment of a sincere question. Lilly's test of whether a
chart is "radical" (L1) is a test of exactly that, at gate 2.

| Blunt | Softened or indirect |
|---|---|
| Will I get the job? And will I like it? And should I move for it? | Will I get the job, and if not, is it worth applying again? |
| 1. Will I pass? 2. Will I find a flat? 3. Will I travel? | Should I take the Leeds offer or wait for the Bristol one? |
| Ask again: will I get the job? | Same as this morning, just checking nothing has changed: will I get the job? |

### 4.9 Not judgeable as asked (reason `reword`)

Not a refused subject, but nothing to judge yet. The person is told what a
good question looks like and may ask again.

| Example | What is missing |
|---|---|
| Will I be happy? | No specific matter and no outcome that is a yes or a no. |
| What does the sky think of me? | Not a question with an outcome. |
| Will it go well on Friday? | The matter is not named. Named, it may turn out to be allowed or refused. |
| What would happen if I had taken the other job? | Not real and pending. |
| Will the sun rise tomorrow? | A test, not a question the asker needs answered. |
| Tell me about my future. | Not one question. |

## 5. Mixed and borderline cases

| Case | Result | Rule that decides |
|---|---|---|
| Will I get the job, and will the pay cover my mortgage? | Refuse, `one-question` | Two questions. The second is also money. |
| Will my sick leave be extended? | Refuse, `health` | The matter turns on the asker's health, though it is asked as a work question. |
| Will HR's investigation clear me? | Refuse, `legal` | A formal proceeding. |
| Will my landlord return my deposit? | Refuse, `money` | A money outcome, and a dispute. |
| Will I get the promotion, and the raise with it? | Refuse, `one-question` | Two outcomes. Asked as "Will I get the promotion I applied for?" it is allowed. |
| Will my lost cat come home? | Allow | The asker's own matter, lost and pending, like a lost ring. Not a question about the animal's health. |
| Will my cat recover? | Refuse, `health` | Health, of an animal. |
| Will it rain on my wedding day? | Allow | The asker's own event, low stakes. The answer is still astrology's reading and says so. |
| Will I be well enough to travel in March? | Refuse, `health` | The answer is about the asker's health. |
| Will I have a baby? | Refuse, `health` | Fertility, and an unborn child. |
| Will my mother forgive me? | Refuse, `other-people` | The answer is about her feelings. |
| Will I be invited back for a second interview? | Allow | An organisation's decision on the asker's application. |
| Will my friend and I get the flat we applied for? | Allow | A joint application. The answer is about an application the asker made, and says nothing about the friend. |
| Will I get away with it? | Refuse, `legal` | Whatever "it" is, the question is about consequences for wrongdoing. |

## 6. What the person sees: draft refusal wording

House voice: say what Ask the Sky does not do, in one or two sentences, and
say what it can take. No lecture. The wording names the refused subject
plainly, as the connector's own instructions already do.

`health`:

> Ask the Sky does not judge questions about health, yours or anyone's. For
> that you need someone who can examine you. You can ask about something
> else: a job, an exam, a plan, something lost.

`money`:

> Ask the Sky does not judge questions about money: no investing, borrowing,
> buying or selling. You can ask about your work or your plans instead.

`betting`:

> Ask the Sky does not call bets, matches, draws or elections, for fun or
> otherwise. You can ask about something of your own that is still undecided.

`legal`:

> Ask the Sky does not judge legal matters: courts, visas, contracts or
> disputes. Those need someone qualified who knows your case. You can ask
> about something else.

`other-people`:

> Ask the Sky answers for the person asking. It does not judge what someone
> else feels, hides or will do, and it does not take questions on someone
> else's behalf. Ask about your own side of it: something you have applied
> for, planned or lost.

`minors`, a child is the subject:

> Ask the Sky does not judge questions about children, born or expected. You
> can ask about a matter of your own.

`minors`, the asker is under 13:

> Ask the Sky is not for anyone under 13, so we cannot take this question.

`minors`, the asker is 13 to 17 and the question is about romance:

> Zodiacs does not give readings about romance for anyone under 18. You can
> ask about something else: school, a trial, a plan.

`guarantee`:

> Ask the Sky gives astrology's reading, plainly, and never a promise or a
> percentage. Ask the question on its own and it will answer it.

`one-question`, more than one:

> One question at a time. Pick the one that matters most and ask only that.

`one-question`, asked again:

> The sky has already answered this one. Asking again does not make a second
> answer truer than the first. Come back when something has changed.

`reword`:

> Ask the Sky needs one real question with a yes or a no in it, about
> something of yours that is still undecided. For example: "Will I get the
> job I interviewed for?"

`safety`:

> This is not something to ask the sky. If you are in danger or thinking
> about harming yourself, please contact your local emergency number or a
> crisis line now, or tell someone near you.

## 7. What every allowed answer must still carry

The filter lets a question through. It does not relax the house rules for
the answer:

- the answer is stated plainly, as astrology's reading, with the line "This is astrology's reading, never a guarantee" (the ZOD-61 sample already ends this way);
- it carries a "Reading confidence NN%" label under the house rule;
- it gives no amounts, no dates for health or legal events, no advice to spend, sign, bet or stop treatment, even if the allowed question brushes against one of them;
- it says nothing about any person other than the asker;
- it keeps Lilly's condition where his rule has one: the outcome comes to the person who makes "proper endeavours" (L2).

## 8. For Dias

1. **Love questions.** The other-people rule refuses "Does she love me?", "Will my ex come back?" and "Will I hear from her again?". These are among the most common things people ask a tool like this. The draft keeps the strict rule, because any looser line ("will we" but not "does she") is easy to talk round. Dias decides whether that cost is acceptable.
2. **Pay as part of work.** "Will I get the raise I asked for?" The draft's test set expects **refuse** (`money`): it is a pay outcome. "Will I get the promotion I applied for?" is allowed. A case can be made the other way.
3. **Awards of money for study.** "Will I get the scholarship I applied for?" The draft's test set expects **allow**: it is an institution's decision on the asker's own application, like a course place. "Will my loan be approved?" is refused. The line between them is thin and Dias may prefer to refuse both.
4. **How often.** One judged question per person per day is a proposal. ZOD-61 says only "a one-question limit".
5. **Lost pets and the weather.** Allowed in section 5 as harmless. Dias may prefer to keep version one to work, study, plans and lost things.
6. **Confidence label.** `reading-confidence.ts` scores readings by how much birth detail was given. Ask the Sky uses no birth detail, so the present rule has no case for it. Not changed here.
7. **Under 18.** The filter can only act on what the person says or shows. It cannot know an age nobody states. Whether Ask the Sky should ask for one is a product decision.
8. **Who applies the filter.** This draft is written so that a person or a model could apply it. It does not say which, and nothing was built.
