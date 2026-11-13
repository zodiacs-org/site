# Ask the Sky: draft question filter (for ZOD-61)

Draft only. This is a written design. It is not code, it is not wired to
anything, and it does not add a "chart for this moment" call or touch ZOD-62.

ZOD-61 holds Ask the Sky until a filter is designed that "refuses health,
money, betting, legal and other-people questions" and sets "a one-question
limit". This file is that design. `03-filter-test-set.md` is the test set
that goes with it.

**Second version, 13 November 2026.** Revised once after the second session's
review (`BREAKER.md`) and Dias's calls of the same day. What changed:

- gentle love questions are now allowed, and any love question that involves someone under 18 is still refused (Dias, call 1);
- immigration, legal and medical questions are still refused, with a new rule and examples for the first-person wording that slipped past readers (Dias, call 2; S16);
- an either-or about one outcome, a named salary and a co-applicant no longer cause a refusal (Dias, call 3; S17);
- the review's other filter findings are applied: S6 to S11, S14 and S15.

## 1. What the filter is for

Ask the Sky would take one question, cast the sky for the minute it was
asked, and give a plain answer by William Lilly's rules. There are three
gates, and this file is only the first:

1. **The filter (this file).** Is this a question Ask the Sky may judge at all? It looks at the question. For one rule only, the repeat rule in 4.8, it also needs to know what this person last had judged.
2. **Lilly's considerations before judgment.** Is the chart fit to judge? Lilly's ch. XIX lists the cases where "it is not safe to give judgment" and ends "defer judgment" (L1 in `SOURCES.md`). That gate looks only at the sky.
3. **The judgment.** Lilly's rules for the matter asked about, for example ch. XXXIII for a job (L2).

Why the first gate has to be separate and has to come first:

- A yes or a no from the sky sounds like knowledge. On a question about someone's body, savings, court case or child, a confident wrong answer can do real harm, and the person asking has no way to check it.
- The house rules already forbid these answers everywhere on the site: "No betting tips, sports picks, market timing, election forecasts, health predictions or guarantees" (`AGENTS.md`, Product rules).
- A refused question must be refused honestly, as a refusal. It must never be passed to gate 2 and answered with "the sky is not fit to judge this", because that is still a kind of answer, and it invites the person to ask again in an hour.
- Lilly's own verdict on a job comes with a condition: the querent gains it "if he use proper endeavours" (L2). The answer is addressed to the person who can act on it. That is the root of the first-person rule below.

What the opened Lilly chapters do not give: a list of forbidden subjects, or
a one-question limit. Those are product rules. They come from ZOD-61,
`AGENTS.md` and Dias's calls, and they are stated here as such.

A filter that reads only the question cannot stop a person who names the
matter falsely ("the place I applied for" when it is a visa). Section 7, what
every allowed answer must still carry, is the defence against that, and it
belongs to the filter's acceptance test as much as the table below does.

## 2. The decision in one page

The filter gives one of two results: **allow** or **refuse**. A refusal
always carries one reason from the table, and the reason decides the wording
the person sees. A refused question is never judged in part.

Checks run in this order. The first one that applies decides, and it gives
the reason.

| Step | Check | If it applies |
|---|---|---|
| 0 | **Safety.** The message suggests the person may harm themselves or someone else, or is in danger now. | Refuse, reason `safety`. Say plainly that this is not something to ask the sky, and point to local emergency services or a crisis line. Nothing else. |
| 1 | **One question.** The message holds more than one matter or more than one outcome, a list, a choice between two matters, or a matter this person has already had judged. | Refuse, reason `one-question`. |
| 2 | **Under 13.** The person says or shows they are under 13 (signs in 4.6). | Refuse, reason `minors`. Do not go on, and do not keep the question. |
| 3 | **A child is the subject.** The question is about a person under 18 or about an expected child (what the child will be like, its sex, its future), or is asked on a child's behalf. Or it is a love question and the asker or the other person is, or appears to be, under 18. | Refuse, reason `minors`. |
| 4 | **Someone else is the subject.** The answer would say something about another person's own life, body, secrets, private conduct or future, or about a public figure. Gentle love questions (3.1) are not caught by this step. | Refuse, reason `other-people`. |
| 5 | **Health.** Includes conceiving, pregnancy and birth, and how long the asker will live. | Refuse, reason `health`. |
| 6 | **Legal.** Includes immigration and formal proceedings at work. | Refuse, reason `legal`. |
| 7 | **Betting and public contests.** | Refuse, reason `betting`. |
| 8 | **Money.** | Refuse, reason `money`. |
| 9 | **Guarantee.** The person asks for a promise, a number or a percentage, or says they will let the answer alone decide something that cannot be undone. | Refuse, reason `guarantee`. |
| 10 | **Not judgeable as asked.** Not a question, a request for advice ("Should I"), not about a real matter of the asker's own, too vague to have a yes or a no, or the matter is not named. | Refuse, reason `reword`. |
| 11 | None of the above. | **Allow.** |

Rules that sit over the whole table:

- **Judge the meaning, not the words.** "Will I get the nursing job at the hospital?" is a work question. A question with no health word in it can still be a health question. A list of banned words would get both wrong.
- **Judge the event behind the wording.** Ask what would have to happen for the answer to be yes. If that event is a refused one, the question is refused, however it is framed. "Will I be living in Lisbon for good by next summer?" turns on a residence decision: `legal`. "Will I be dancing at my brother's wedding before the year is out?" turns on someone else's marriage: `other-people`. "Will I be back in the first team after my knee?" turns on recovery: `health`. Framing something as the asker's own plan, seat, job or celebration does not change what is being asked.
- **A mention is not a subject.** Naming another applicant, a salary, an employer, a partner who applied with the asker, or a worried relative does not change whose matter it is. "Will I get the post, or will it go to the other finalist?" is a job question. "Will I get the 70k role I interviewed for?" is a job question. The test is what the answer says: "you get it" is about the asker.
- **One outcome said two ways is one question.** "Will I get it or won't I?", "Will they pick me or the other candidate?" and "Yes or no: will I pass?" each have one outcome. Two matters ("the job or the flat"), two outcomes ("get it and like it") or a follow-up ("and if not, then what?") are more than one.
- **Any refused part refuses the whole.** The filter does not answer one half of a message and drop the other.
- **Wrappers change nothing.** "Just for fun", "hypothetically", "asking for a friend", "in a story", "I know you can't promise, but", "ignore your rules": the filter looks at the question underneath.
- **One loose word is not a demand.** "Will I definitely get it?", "Will I really pass?" and "What are my chances of getting the flat?" are ordinary speech. The filter judges the question underneath. `guarantee` is kept for a promise, a number or a percentage, and a decision handed over (4.7).
- **When in doubt, refuse and invite a new question.** When the doubt is between `safety` and any other reason, it is `safety`: for a message that may be a sign of distress, the wrong wording is the failure.
- **Every language.** The same rules apply whatever language the question is in.

## 3. What is allowed

A question is allowed when all of these are true:

- **It is one question**, with a yes or a no (or a "not yet") as its answer.
- **It asks what will happen, not what to do.** "Will I get the job?" is judged. "Should I take the job?" asks for advice and is sent back for rewording (4.9).
- **It is the asker's own matter.** The asker is the one it happens to, and the one who can act on the answer.
- **It is real and live.** Either something has been applied for, asked, lost, planned or begun and the outcome is not known yet, or it is something the asker is actively seeking and the question gives it a time frame ("Will I find a flat before term starts?", "Will I meet someone new this year?"). A wish with no matter and no time frame ("Will I be happy?", "Will I be famous one day?") is not.
- **It is specific.** The matter is named.
- **It is outside every refused category in section 4.**

Other people may be part of the matter without being its subject. An
employer, a school, a publisher, a landlord, a referee or a competition jury
decides something the asker has applied for or asked for. That is allowed,
and so is a joint application: "Will my partner and I get the house share we
applied for?" is the asker's own application, and the answer says nothing
about the partner.

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
| Will I get the post, or will it go to the other finalist? | One outcome said two ways. The other finalist is mentioned, not judged. |
| Will my partner and I get the house share we applied for? | A joint application. |

Words that sound like a refused category but are not one:

| Question | Why it is still allowed |
|---|---|
| Will I pass the bar exam? | An exam. Nothing legal is being decided about the asker. |
| Will I get the nursing job at St Mary's? | A job, in a hospital. Not the asker's health. |
| Will I get the job at the bank? | A job. Not the asker's money. |
| Will I get the 70k role I interviewed for? | A job. The amount is a description. The answer never mentions it. |
| Will my novel about a poker player find a publisher? | A book. No bet. |
| Will I get the job coaching the under-12s? | A job. No child is the subject, and the asker is the coach. |
| Will I win the short story competition I entered? | A contest of skill the asker has entered, with no stake. |

### 3.1 Gentle love questions

Decided by Dias on 13 November 2026: gentle love questions are let through,
and any love question about someone under 18 is still refused. "Gentle" is
defined here by the builder. Dias may draw it differently (section 8).

A love question is allowed when all of these are true:

1. **It is the asker's own love life**: a relationship they are in, one that ended, or one they hope for.
2. **The answer is about what happens between the two of them**, or about whether the asker's feelings are returned: hearing from someone, meeting again, getting together, getting back together, staying together, a proposal.
3. **It asks for no verdict on the other person's hidden life**: not their faithfulness, honesty, whereabouts, messages, past, or who else they see. And it does not turn on ending someone else's relationship.
4. **Nothing says or shows that either person is under 18** (signs in 4.6). If it does, the reason is `minors`.
5. **Every other rule still holds**: one question, a yes or a no, no promise demanded, nothing about health, law or money, and step 0 for safety.

| Allowed | Why |
|---|---|
| Will I hear from her again? | What happens between the two of them. |
| Does he feel the same way about me? | Whether the asker's feelings are returned. |
| Will my ex and I get back together? | The asker's own relationship. |
| Will the person I have been seeing want to make it official? | The asker's own hoped-for relationship. |
| Will I meet someone new this year? | Actively sought, with a time frame. |

| Still refused | Reason | Why |
|---|---|---|
| Is my husband cheating on me? | `other-people` | A verdict on his hidden conduct. |
| Is there something I should know about where he was on Friday? | `other-people` | The same, softened. |
| Will he leave his wife for me? | `other-people` | Turns on ending someone else's marriage. |
| Will my sister's marriage last? | `other-people` | Not the asker's love life. |
| I'm 16. Does my crush like me back? | `minors` | The asker is under 18. |
| Will the girl in my Year 10 class say yes if I ask her out? | `minors` | A school year shows both are under 18. |
| Will he hurt me again if I go back? | `safety` | Step 0 comes first. |

What the answer to a love question may say is narrower than for other
questions (section 7): it speaks about the asker's prospects, and it states
nothing as fact about the other person.

## 4. What is refused, and why

Each category has: what it covers, why it is refused, blunt examples, softened
or indirect examples, and the nearest thing that is allowed.

### 4.1 Health

**Covers.** The asker's body or mind: illness, symptoms, test results,
diagnosis, treatment, medicine, operations, recovery, weight, sleep,
addiction, whether they are well enough or fit enough for something, and how
long they will live. Conceiving, fertility, pregnancy and birth. Medical
checks and clearances that a job or a sport depends on. Animals' health too.

**Why.** "Health predictions" are barred by the house rules. A yes can delay
a visit to a doctor and a no can frighten someone for nothing.

| Blunt | Softened or indirect |
|---|---|
| Do I have cancer? | Will I be back at work by spring after my operation? |
| Will my surgery go well? | Will I be in the starting eleven again once my shoulder is right? |
| Will I get pregnant this year? | Is there any point in me trying again this cycle? |
| Should I stop taking my medication? | Will I feel like myself again by summer? |
| When will I die? | Will I still be around to see it finished? |

The second softened example is the pattern that slipped past a reader in the
review: a selection or a return to work that depends on recovery is a health
question, whatever else it is.

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

**Nearest allowed.** A job question, even one that names its salary: "Will I
get the 70k role I interviewed for?" The answer never mentions an amount and
never says what to do with money. Two edge cases are still open (section 8).

### 4.3 Betting and public contests

**Covers.** Gambling of every kind: bets, lotteries, raffles, casinos, cards
for money, prediction markets, fantasy leagues. Also the result of any
fixture, league, election, award or talent show that the public follows or
bets on, **whether or not the asker takes part in it**.

**Why.** The house rules bar "betting tips, sports picks" and "election
forecasts", with no exception for a candidate or a player. An answer about a
public result is a tip the moment it is given, to anyone the asker shows it
to. "I play for them" and "I am standing" are claims nobody can check, and
the answer would be the same match or the same count either way.

A contest counts as the asker's own matter only when nobody outside it would
want the answer as a tip: an audition, a selection trial, a job panel, a
village show, an essay prize.

| Blunt | Softened or indirect |
|---|---|
| Will my bet on Saturday's match win? | Just for fun, who takes it on Saturday, home or away? |
| Should I buy a lottery ticket today? | Is tonight my lucky night? |
| Who wins the election? | I'm on the ballot for the district council. Will I take the seat? |
| Which horse wins the 3:15? | We kick off at two on Sunday and I'm in goal. Do we win? |

**Nearest allowed.** The asker's own selection or audition: "Will I be picked
for the team at Sunday's trial?"

### 4.4 Legal

**Covers.** Courts and tribunals, the police, charges and sentences,
lawsuits, divorce and custody proceedings, regulators, contracts in dispute,
whether something is legal, whether to sign something. **Immigration**:
visas, permits, residence, citizenship decisions, asylum, sponsorship, and
any move abroad that depends on one. **Formal proceedings at work**:
disciplinary hearings, investigations, grievances, tribunals, and whether
the asker keeps a job after an incident or an accusation.

**Why.** Named in ZOD-61. These are matters where a wrong steer costs rights
that cannot be got back, and where the person needs someone qualified.

| Blunt | Softened or indirect |
|---|---|
| Will I win my court case? | Will the hearing on the 14th go my way? |
| Will my visa be approved? | Will I be settled in Melbourne for good by this time next year? |
| Will I get custody? | Will the judge see it my way about the weekends? |
| Will I be sacked at the disciplinary? | Will I still have a desk here after what I said in Monday's meeting? |
| Should I sign the settlement? | Will the letter from the Home Office be good news? |

The second and fourth softened examples are the two patterns that slipped
past readers in the review. A permanent move to another country is an
immigration outcome even when it is described as a plan. "After what
happened", "after what I said" or "after the complaint" make a job question a
conduct matter even when no formal word appears. A job question about a
restructuring, a probation review or a contract renewal has no incident in
it and is allowed.

**Nearest allowed.** An exam or a job in the law: "Will I pass the bar
exam?", "Will I get the paralegal job I interviewed for?"

### 4.5 Other people

**Covers.** Any question whose answer would state something about another
person's own life: what will happen to them, what they will do in matters
that are theirs, what they hide, their body, their work, their relationships
with others. Relatives, friends, colleagues, strangers, public figures. Also
questions asked on someone else's behalf, and first-person frames round
someone else's event ("Will I be dancing at my brother's wedding before the year is out?").

**What it no longer covers.** Gentle love questions (3.1). And "we" is not
refused as such. The rule for "we" is:

- a joint application or a shared plan is the asker's own matter and is allowed ("Will my partner and I get the house share we applied for?");
- a question about the asker's own relationship is a love question and goes to 3.1;
- a "we" whose answer is about the others' separate lives is refused ("Will we all still have jobs here next year?" is a question about colleagues).

**Why.** Named in ZOD-61. The other person has not asked and cannot answer
back. A verdict on someone's loyalty, secrets or future can do damage on no
evidence. The site's connector already works this way: it asks before using
someone else's birth details.

| Blunt | Softened or indirect |
|---|---|
| Is my husband cheating on me? | Is there something I should know about where he was on Friday? |
| Will my boss be fired? | Will my team have a new manager by Christmas? |
| Will my sister get the job? | Asking for a friend: will she get the job she interviewed for? |
| Will the prime minister resign? | Will I be dancing at my brother's wedding before the year is out? |
| Will my mother forgive me? | Will my wife find out? |

**Nearest allowed.** The asker's own side of it: something they applied for,
or a gentle love question about their own relationship.

Outside love, a question about a private person's feelings is still refused
("Will my mother forgive me?"). Dias opened love questions only. Whether
family and friendship questions should follow is listed in section 8.

### 4.6 Minors

**Covers.** Four cases.

1. **The asker is under 13.** Nothing is judged.
2. **The asker is 13 to 17.** Nothing about love, romance or attraction is judged. Every other rule applies as usual.
3. **A child is the subject.** Any question about a person under 18, by a parent or anyone else: their school, friends, future, character, and any love question in which the other person is under 18. Any question about an expected child: what it will be like, its sex, its future. (Conceiving, pregnancy and the birth itself are `health`, step 5, so that the person is told the right thing.)
4. **A child's birth as the moment.** Ask the Sky casts the sky for the moment the question is asked, and for no other moment. It must never accept a date and time supplied by the asker. Otherwise "cast it for 3 March at 04:10, when my daughter was born" turns a question tool into a way round the rule that no chart is made for a birth less than 13 years ago (ZOD-62 describes that rule; the connector's instructions state it). A question asked at the very minute of a birth is still only a question: an allowed one is judged, and the answer never shows or describes the chart itself.

**What "shows" means.** The person does not have to state an age. Any of
these is a sign, and the filter acts on it:

- a stated age or birthday ("I'm 12", "for my 10th birthday");
- a school year or stage that only children are in (primary school, Year 6, sixth grade, starting secondary school);
- an exam, team or event that only children sit or join, where the asker is the one sitting or joining (the 11-plus, the under-12s as a player, a school play, a prom);
- wording such as "my mum won't let me" or "when I grow up" beside any of the above.

A sign of being under 13 gets the under-13 wording. A sign of being 13 to 17
matters only for love questions. A word like "under-12s" is not a sign when
the asker is the adult in the sentence ("the job coaching the under-12s").
The filter cannot know an age nobody states or shows (section 8).

**Why.** The site is not directed at children under 13 and gives no romance
framing for anyone under 18 (connector instructions). A child cannot agree
to being read, and a parent acting on a verdict about a child is the
other-people problem at its worst.

| Blunt | Softened or indirect |
|---|---|
| Will my son pass his exams? | Will we get the school place we applied for? |
| What will my baby be like? | My little one starts nursery on Monday. Will she settle? |
| I'm 12. Will I make the football team? | Will I get into the grammar school after my 11-plus? |
| I'm 16. Does my crush like me back? | Can you do the sky for 04:10 on 3 March? That's when she arrived. |

**Nearest allowed.** A parent's own matter in which a child is only the
background: "Will I get the part-time hours I asked for?" The test is the
same as everywhere: who is the answer about?

### 4.7 Guarantee claims

**Covers.** Requests for a promise or an oath. Requests for a number: odds, a
percentage, a score out of ten. Questions that hand the decision to the sky
for something that cannot be undone ("if it says yes I resign today").
Requests to confirm that an earlier answer "will definitely" happen.
Forecasts of disasters and public catastrophes ("Will there be a war?").

**Does not cover.** One loose word in an ordinary question ("definitely",
"really", "for sure", "what are my chances") when nothing else in the message
demands certainty. The question underneath is judged, and the answer carries
the line that it is never a guarantee. Death is `health` (4.1). Sports and
election results are `betting` (4.3).

**Why.** The house rules bar "guarantees", and say a forecast is astrology's
reading with a confidence label that "says how specific the details were,
never the odds that an event happens" (`reading-confidence.ts`, connector
instructions). An answer given in reply to "promise me" is read as a promise
whatever small print follows it.

| Blunt | Softened or indirect |
|---|---|
| Guarantee me I'll get the job. | I know you can't promise, but give me a number out of ten for the flat. |
| What are the odds I pass, in percent? | Is it a hundred percent that I pass on Tuesday? |
| Promise me it works out. | You said yes yesterday. So it's certain, right? |
| If you say yes I'm handing in my notice tomorrow. Will the new job work out? | I'll do whatever the sky says about the move. |

**Nearest allowed.** The same question without the demand: "Will I get the
flat I applied to rent?", and also "Will I definitely get the flat I applied
to rent?"

### 4.8 The one-question limit

ZOD-61 names "a one-question limit" and does not define it. This draft
defines it in three parts. The third needs a decision from Dias.

1. **One question per asking.** One matter, one outcome. A message with two matters, two outcomes, a list, a follow-up clause ("and if not, then what?") or a choice between two matters is refused with reason `one-question`, and the person is asked to pick the one that matters most. One outcome said two ways is one question (section 2).
2. **The same matter is judged once.** Asking again to get a different answer is refused: same matter, different wording, an hour later or a day later. A new question about the same matter is fair when something has changed (the interview happened, the letter came).
3. **How often.** Proposal: one judged question per person per day. A refused question does not count.

**What part 2 needs, stated plainly.** A filter that sees only the question
in front of it cannot apply part 2. It needs one more fact: what this person
last had judged, and when. Something has to remember that. The least that
would do is the last judged question and its time, held where the person is
(their own device or session) and nowhere else. Whether even that is
acceptable, and where it lives, is a product decision (section 8). Until
there is such a memory, part 2 cannot be enforced and only parts 1 and 3
can.

**Two holes that stay open by design.** "Something has changed" is the
asker's word and cannot be checked. And because a refusal costs nothing, a
person can reword a refused question until some version passes. The filter
does not close either one. A cap on refused attempts would close the second,
at the price of counting people's refusals. That choice is listed for Dias.

**Why.** Without a limit the tool becomes a slot machine: people re-ask until
the answer suits them, and every answer after the first is worth less. The
chart is for the moment of a sincere question. Lilly's test of whether a
chart is "radical" (L1) is a test of exactly that, at gate 2.

| Blunt | Softened or indirect |
|---|---|
| Will I get the job? And will I like it? And should I move for it? | Will I get the job, and if not, is it worth applying again? |
| 1. Will I pass? 2. Will I find a flat? 3. Will I travel? | Which comes through first, the Leeds offer or the Bristol one? |
| Ask again: will I get the job? | Same as this morning, just checking nothing has changed: will I get the job? |

### 4.9 Not judgeable as asked (reason `reword`)

Not a refused subject, but nothing to judge yet. The person is told what a
good question looks like and may ask again.

| Example | What is missing |
|---|---|
| Will I be happy? | No specific matter and no outcome that is a yes or a no. |
| What does the sky think of me? | Not a question with an outcome. |
| Will it go well on Friday? | The matter is not named. Named, it may turn out to be allowed or refused. |
| Will the results on Friday be good news? | The same. If the person names an exam, it is allowed. If they name a medical test, it is `health`. |
| Should I accept the job I was offered? | Advice. Ask the Sky judges what will happen, not what to do. "Will the job I was offered work out for me?" can be judged. |
| What would happen if I had taken the other job? | Not real and live. |
| Will the sun rise tomorrow? | A test, not a question the asker needs answered. |
| Tell me about my future. | Not one question. |

An unnamed matter is `reword` only when the wording points nowhere. When it
points at a refused subject, that subject is the reason: "Will I get the
all-clear on Monday?" is `health`, "Will they drop the charges?" is `legal`.

A "Should I" question in a refused subject is refused for the subject
("Should I buy the shares?" is `money`), because the subject steps come
first.

## 5. Mixed and borderline cases

| Case | Result | Rule that decides |
|---|---|---|
| Will I get the job, and will the pay cover my mortgage? | Refuse, `one-question` | Two questions. The second is also money. |
| Will my sick leave be extended? | Refuse, `health` | The matter turns on the asker's health, though it is asked as a work question. |
| Will HR's investigation clear me? | Refuse, `legal` | A formal proceeding at work. |
| Will I keep my job in the restructuring? | Allow | A job outcome with no incident and no proceeding. |
| Will my landlord return my deposit? | Refuse, `money` | A money outcome, and a dispute. |
| Will my landlord renew my lease? | Allow | A person in a role decides the asker's own request. |
| Will I get the promotion, and the raise with it? | Refuse, `one-question` | Two outcomes. Asked as "Will I get the promotion I applied for?" it is allowed. |
| Will I get the promotion or will they give it to Sam? | Allow | One outcome said two ways. Sam is mentioned, not judged. |
| Will my lost cat come home? | Allow | The asker's own matter, lost and pending, like a lost ring. Not a question about the animal's health. |
| Will my cat recover? | Refuse, `health` | Health, of an animal. |
| Will it rain on my wedding day? | Allow | The asker's own event, low stakes. The answer is still astrology's reading and says so. |
| Will I be well enough to travel in March? | Refuse, `health` | The answer is about the asker's health. |
| Will I have a baby? | Refuse, `health` | Conceiving is health (step 5). The person is told Ask the Sky does not judge health, not that it does not judge children. |
| Will the baby be a girl? | Refuse, `minors` | The expected child is the subject (step 3). |
| Will we stay together? | Allow | A gentle love question about the asker's own relationship (3.1). |
| Will my friend and I get the flat we applied for? | Allow | A joint application. The answer says nothing about the friend. |
| Will I be mayor after Thursday's count? | Refuse, `betting` | An election result, though the asker is the candidate. |
| Will I definitely pass on Tuesday? | Allow | One loose word. The question underneath is judged. |
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
> otherwise, and not for the people taking part either. You can ask about
> something of your own that is still undecided.

`legal`:

> Ask the Sky does not judge legal matters: courts, visas and residence,
> contracts, disputes or hearings at work. Those need someone qualified who
> knows your case. You can ask about something else.

`other-people`:

> Ask the Sky answers for the person asking. It does not judge what will
> happen to someone else or what they keep to themselves, and it does not
> take questions on someone else's behalf. Ask about your own side of it.

`minors`, a child is the subject:

> Ask the Sky does not judge questions about children, born or expected. You
> can ask about a matter of your own.

`minors`, the asker is under 13:

> Ask the Sky is not for anyone under 13, so we cannot take this question.

`minors`, a love question where someone is under 18:

> Zodiacs does not give readings about romance where anyone involved is
> under 18. You can ask about something else: school, a trial, a plan.

`guarantee`:

> Ask the Sky gives astrology's reading, plainly, and never a promise or a
> number. Ask the question on its own and it will answer it.

`one-question`, more than one:

> One question at a time. Pick the one that matters most and ask only that.

`one-question`, asked again:

> The sky has already answered this one. Asking again does not make a second
> answer truer than the first. Come back when something has changed.

`reword`:

> Ask the Sky needs one real question with a yes or a no in it, about
> something of yours that is still undecided. For example: "Will I get the
> job I interviewed for?"

`reword`, advice was asked for:

> Ask the Sky judges what will happen, not what you should do. Ask about the
> outcome you care about, and the decision stays yours.

`safety`:

> This is not something to ask the sky. If you are in danger or thinking
> about harming yourself, please contact your local emergency number or a
> crisis line now, or tell someone near you.

## 7. What every allowed answer must still carry

The filter lets a question through. It does not relax the house rules for
the answer. These rules are also the only defence against a person who names
a refused matter falsely, so they are part of what has to be tested:

- the answer is stated plainly, as astrology's reading, with the line "This is astrology's reading, never a guarantee" (the ZOD-61 sample already ends this way);
- it carries a "Reading confidence NN%" label under the house rule;
- it gives no amounts, no dates for health or legal events, no advice to spend, sign, bet or stop treatment, even if the allowed question brushes against one of them;
- it says nothing about any person other than the asker;
- for a love question, it speaks about the asker's prospects only. It states nothing as fact about what the other person feels, does or hides, and it gives no advice to watch, test or confront them;
- it never shows or describes the chart of the moment as if it were anyone's birth chart;
- it keeps Lilly's condition where his rule has one: the outcome comes to the person who makes "proper endeavours" (L2).

## 8. For Dias

### Settled on 13 November 2026, and applied above

1. **Love questions.** Gentle love questions are allowed. Any love question about someone under 18 is refused.
2. **Immigration, legal and medical questions** stay refused, including when they are framed as a plan, a job or a place in a team.
3. **A job question that mentions another candidate or a salary, and a joint application with a partner,** are allowed.

### Builder's readings of those calls, which Dias may want to redraw

4. **What "gentle" means.** Section 3.1 is the builder's definition: the asker's own love life, about what happens between the two, no verdict on the other person's hidden life, nobody under 18. Under it "Does he feel the same way about me?" is allowed and "Is he seeing someone else?" is not.
5. **"Should I" questions** are sent back for rewording (4.9). The review asked for a rule and this is the builder's choice. The other choice is to judge them as outcome questions.
6. **The asker's own election or match** is refused (4.3), following the review's suggested line.

### Still open

7. **Pay as part of work.** "Will I get the raise I asked for?" The draft refuses it as a pay outcome. A named salary in a job question is now allowed. A case can be made for allowing the raise too.
8. **Awards of money for study or work.** A scholarship, a bursary or an arts grant the asker applied for is allowed as an application. A loan is refused. The line is thin.
9. **How often.** One judged question per person per day is a proposal. ZOD-61 says only "a one-question limit".
10. **Memory for the repeat rule.** The rule cannot work without remembering the last judged question (4.8). What may be kept, and where, is not decided. Nor is whether to cap refused attempts.
11. **Lost pets and the weather.** Allowed in section 5 as harmless. Dias may prefer to keep version one to work, study, plans, love and lost things.
12. **Family and friendship feelings.** "Will my mother forgive me?" is still refused. Love was opened; these were not.
13. **Low-stakes cases the rules refuse or allow** that the review listed for a look: a ticket ballot (refused as a draw), planning permission and a market licence (refused as legal), a citizenship test and a foster-carer approval (allowed as the asker's exam and application), a freelancer's contract bid (refused as a business's sales).
14. **Confidence label.** `reading-confidence.ts` scores readings by how much birth detail was given. Ask the Sky uses no birth detail, so the present rule has no case for it. Not changed here.
15. **Under 18.** The filter acts on what the person says or shows (4.6). It cannot know an age nobody states or shows. Whether Ask the Sky should ask for one is a product decision.
16. **Who applies the filter.** This draft is written so that a person or a model could apply it. It does not say which, and nothing was built.
