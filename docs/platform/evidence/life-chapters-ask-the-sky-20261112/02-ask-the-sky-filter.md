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

**Third version, 13 November 2026 (ZOD-210).** One round on the signs of
being 13 to 17, which Dias approved the same day. It answers three findings
of the fix-round review (`BREAKER-FIX.md`): F6, F10 and F11. What changed:

- the signs of being 13 to 17 are now listed in 4.6: school years, exams, school life, a parent who permits or forbids, and a stated age (F6);
- "college" and the other words that can mean a child or an adult now count as a sign unless the same message shows an adult (F6);
- step 3 and 4.6 no longer disagree about an asker of 13 to 17: nothing is judged for them, so "I'm 15" in front of a question about the asker's own job is a refusal (F11);
- a parent's question about a son or daughter of 13 to 17 is refused as before, and the signs that the child is that age are listed.

Nothing else in the filter was changed. The review's other findings on the
filter (F4, F5, F7, F8, F9 and its notes) are still open and are listed in
section 8.

**Fourth version, 13 November 2026 (ZOD-220).** One round on Dias's calls of
13 November, 18:09 Asia/Bangkok, and on the seven findings of the review of
the third version (`BREAKER-AGE.md`, G1 to G7). Only the signs of age and
what the filter remembers about age were changed. What changed:

- applying to university does not show an adult (Dias, call 1; G2);
- an age under 18 that has been given in a conversation holds for the rest of that conversation, whatever age is claimed later. 4.6 says what a conversation is and what the filter remembers (Dias, call 2; G4);
- "college" on its own no longer refuses. "College" beside a sign of being 13 to 17 refuses (Dias, call 3; G5);
- AP classes and AP exams are a sign of being 13 to 17 (Dias, call 4), and so are the SAT, the ACT, results day and the other school markers the lists left out. The lists are now examples of a stated rule (G1);
- a school sign in the past still counts until the message shows the person must now be 18 or over (G3);
- "I'm 18" beside a school year that no 18-year-old is in is refused (G4);
- a class or a teacher of something outside school is not a sign (G6);
- a parent counts as a sign only when the parent decides. A parent who helps, signs as guarantor or has an opinion does not (G7).

Everything else is as the third version left it: love questions about
someone under 18, the under-13 rule, immigration, legal and medical
questions are refused, and gentle love questions between adults are
allowed.

## 1. What the filter is for

Ask the Sky would take one question, cast the sky for the minute it was
asked, and give a plain answer by William Lilly's rules. There are three
gates, and this file is only the first:

1. **The filter (this file).** Is this a question Ask the Sky may judge at all? It looks at the question. Two rules need more than the question: the repeat rule in 4.8 needs to know what this person last had judged, and the age rule in 4.6 needs to know what was said about age earlier in the same conversation.
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
| 2 | **Under 13.** The person says or shows they are under 13 (signs in 4.6), in this message or earlier in this conversation. | Refuse, reason `minors`. Do not go on, and do not keep the question. |
| 3 | **Under 18.** The asker says or shows they are 13 to 17 (signs in 4.6), in this message or earlier in this conversation, whatever the question is about. Or the question is about another person under 18 or about an expected child (what the child will be like, its sex, its future), or is asked on a child's behalf. Or it is a love question and the asker or the other person is, or appears to be, under 18. | Refuse, reason `minors`. |
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
- **Nothing says or shows that the asker is under 18**, in this message or earlier in this conversation (signs and the conversation rule in 4.6).
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
| Will I be offered a place on the course I applied for? | An institution's decision on the asker's own application. Nothing in it says or shows that the asker is under 18. |
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
4. **Nothing says or shows that either person is under 18**, in this message or earlier in this conversation (signs in 4.6). If it does, the reason is `minors`.
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
2. **The asker is 13 to 17.** Nothing is judged, whatever the question is about: a job, an exam, a team, a plan or love. (Until the third version only love questions were refused here, and step 3 and this section disagreed. They now say the same thing.)
3. **A child is the subject.** Any question about another person under 18, by a parent or anyone else: their school, exams, job, friends, future, character, and any love question in which the other person is under 18. Any question about an expected child: what it will be like, its sex, its future. (Conceiving, pregnancy and the birth itself are `health`, step 5, so that the person is told the right thing.)
4. **A child's birth as the moment.** Ask the Sky casts the sky for the moment the question is asked, and for no other moment. It must never accept a date and time supplied by the asker. Otherwise "cast it for 3 March at 04:10, when my daughter was born" turns a question tool into a way round the rule that no chart is made for a birth less than 13 years ago (ZOD-62 describes that rule; the connector's instructions state it). A question asked at the very minute of a birth is still only a question: an allowed one is judged, and the answer never shows or describes the chart itself.

**What "shows" means.** The person does not have to state an age. The filter
acts on any sign of the kinds below. A sign counts whether it is about the
asker, about the person the question is about, or, in a love question,
about either of the two.

**The lists are examples, not complete lists.** The rule behind them: any
exam, class, role, team or event that pupils of that age take part in is a
sign, when the person takes part in it as a pupil. A reader who meets a
school marker that is not printed here applies the rule, and does not
allow the question because the word is missing.

There are three kinds of word, and the filter treats them differently:

1. **Signs.** They show someone under 18. One is enough to refuse.
2. **Words that need a setting.** "School", "my class", "my teacher" and the like. They count as a sign unless the message shows an adult or names a setting outside school.
3. **Words that show nothing either way.** "College", and applying to university. On their own they neither refuse a question nor show an adult.

**Signs of being under 13.**

- a stated age or birthday under 13 ("I'm 12", "for my 10th birthday");
- a school year or stage that only children under 13 are in: nursery, primary or elementary school, Year 6 and below, sixth grade and below, starting secondary school;
- an exam, team or event that only they sit or join, where the asker is the one sitting or joining (the 11-plus, the under-12s as a player);
- a year or stage that sits on the line: Year 7, Year 8, seventh grade, middle school, a French collège (ages 11 to 15, and not the English word "college"). These get the under-13 handling, because it is the stricter one.

**Signs of being 13 to 17.**

- **A stated age from 13 to 17**, in any form: "I'm 15", "I turn 16 in March", "nearly 18", "18 next month", "my 17th birthday". The age counts whatever the question is about. "I'm 15" in front of a question about the asker's own job is a sign like any other, and the question is refused.
- **A school year or stage.** Years 9 to 13. Grades 8 to 12. Freshman, sophomore, junior or senior year of high school. Secondary school, high school or sixth form as a pupil, a sixth-form college included. The same stages in any country (S3 to S6, a lycée, an instituto, a Gymnasium class).
- **A school exam or test, being sat now or soon, or with results still to come.** GCSEs, Nat 5s, A-levels, Highers, mocks for any of them, predicted grades, results day. A high school diploma, the baccalauréat, the Abitur. In the United States: the PSAT, the SAT, the ACT, and AP exams.
- **A class or course that school pupils take.** AP classes of every kind (AP Chemistry, AP Calculus, "APUSH", "my AP courses"): an AP class is a high school class, and "Will I get into AP Chemistry this fall?" is refused. GCSE options, a set ("top set maths"), a school timetable ("double maths, then PE").
- **School life.** A form, tutor group or homeroom. A school team, play, trip or dance as a pupil. A prom, a leavers' ball, homecoming. Work experience week. Detention. A head of year. A prefect, head boy or head girl. A student council. A report card, the honor roll, a yearbook. A school night.
- **An age-group team as a player:** the under-14s to the under-18s, a youth team.
- **A parent who decides.** "My mum won't let me", "my dad has to sign the consent form", "my parents say I'm too young", "I'm grounded", a curfew, pocket money, parents who make the asker choose. The line is drawn under "Parents" below.
- **Words that say the person is too young for something adults do:** "not old enough to vote", "when I'm old enough to drive".
- **A parent's words for a child of that age:** "my teenager", "my 16-year-old", "our lad sits his exams in May".

"AP" is a sign only when it means Advanced Placement. A job in accounts
payable or at a news agency is a job. Judge the meaning, not the letters.

**Words that need a setting.** These can belong to a child or an adult:

- **school**, as the place the person goes to ("at school", "after school", "my school");
- **my class, a classmate, my teacher, my tutor, homework**;
- **a year named the American way with no school named** ("junior year", "senior year", "I'm a sophomore").

Each one **counts as a sign of being 13 to 17 unless the same message, or
an earlier one in the conversation, shows an adult or names a setting
outside school.** With no setting at all ("my teacher says I'm ready", "a
girl in my class"), the word is read as school and the question is refused.

A setting outside school, where the word is not a sign:

- **a class, a teacher, an instructor or a classmate of something that is not school:** a salsa, pottery or life-drawing class, a class at the gym, a piano or guitar teacher, a driving or motorbike instructor, a welding, first aid or bookkeeping course, an evening class;
- **a school of something adults learn:** a driving school, a language school, a dance school, a nursing school, a law school;
- **a class, a tutor, a teacher or homework at college or at university.** These are part of college or university and add nothing to it. What "college" itself shows is set out next.

Children take piano lessons and dance classes too. A class of that kind
simply shows nothing about age, and any other sign in the message still
counts ("my dance teacher says my mum has to sign the form" is refused,
for the parent).

**"College" shows nothing either way.** Decided by Dias on 13 November 2026.
In Britain a college is usually for ages 16 to 18. In the United States it
is where adults study. So:

- **"College" on its own does not refuse a question.** A place at college, a college course, a college class, a college tutor, a college dorm, finals at college, "community college": all are read as they would be with no age word in them.
- **"College" beside any sign of being 13 to 17 refuses**, like the sign would alone: a stated age, a school year, a school exam, an AP class, the SAT, school life, a parent who decides. "I'm 16 and starting college", "college, once my GCSE results are in", "applying to college as a high school senior".
- **"College" never shows an adult.** It does not answer a sign, and it does not answer a word that needs a setting when that word is about school ("after school I've got my college interview" is refused, for "school").
- **A sixth-form college, as a pupil, is sixth form:** a sign.
- This holds for love questions too. "College" alone, about the asker or the other person, does not refuse one.

**Applying to university shows nothing either way.** Decided by Dias on
13 November 2026: applying to university is not an adult signal by itself.
Most people who apply for a first degree are 17 and still at school. So an
application, an offer, an admissions interview, a first choice, a UCAS
form, an "early decision" or a wait for a decision from a university or a
college:

- **does not show an adult.** It does not answer a sign, and it does not answer a word that needs a setting. "My teacher thinks my university application is strong" is refused, for "my teacher";
- **is not a sign either.** With nothing else in the message, the question is allowed, like a bare "college".

Being at university is different from applying to one, and does show an
adult (below). So does applying for a master's or a doctorate, which
follows a degree.

**What shows an adult.**

- a stated age of 18 or more. In a love question both people need one, or some other entry below;
- study that only adults do: being at university (a year of it, a degree being taken, finals, graduating from it), a degree, a postgraduate course, a master's, a doctorate, a thesis, a year abroad as a student, an evening class, night school, an access course, returning to study, a professional school or exam (nursing school, law school, the bar exam);
- an adult's life: a husband, wife or fiancé, children of the asker's own, a tenancy or a mortgage, years spent in a job, a job the law keeps for adults (serving behind a bar, driving a lorry, the police, the forces), military service, voting;
- the person is the adult in the sentence: the teacher, the coach, the caretaker, a parent, an applicant for a job at the school or college.

Showing an adult answers a word that needs a setting. What it does beside
a sign is narrower, and is set out under "A stated adult age beside a
sign" below.

**What is not a sign.**

- **A job, an apprenticeship, an exam, a test, a course, an audition or a team with no school word and no age.** Adults do all of these. "Saturday job" and "driving test" are not signs.
- **Parents who are only mentioned,** or who help or have an opinion (see "Parents").
- **A sign long past** (see "A sign in the past").
- **A child who is only the background** to the asker's own matter (see "Nearest allowed" below).
- **A word like "under-12s", "Year 10" or "AP Biology" when the asker is the adult** ("the job coaching the under-12s", "the post teaching Year 10").

**Parents.** A parent is a sign when **the parent decides whether the asker
may do the thing**, so that the parent's no would end the matter:

- a parent who forbids or permits ("won't let me", "says I can't", "said I can go if", "I'm not allowed");
- a parent whose signature or presence is needed because of the asker's age (a consent form, a permission slip, "my mum has to come with me to sign");
- grounding, a curfew, pocket money or an allowance, parents who make the asker choose between two things.

A parent is **not** a sign when the asker could go ahead anyway:

- a parent with a view, a wish or a worry ("my mum thinks", "my parents don't want me working nights", "my dad would rather I stayed");
- a parent who helps: a lift, a loan, the use of a car or an address, a room at home;
- **a parent who backs an adult's contract: a guarantor or co-signer on a tenancy, a lease or a loan.** A guarantor backs a contract that the asker signs, and only an adult can sign one. "My mum has to sign as guarantor. Will I get the flat?" is an adult's question.

**A sign in the past.** A school sign in the past still counts, **unless the
message shows that the person must now be 18 or over.** Work it out from
what the message gives: the age the sign belongs to, and the time since.

- Still a sign: "I've just finished my GCSEs", "I got my results last week", "I left school in June", "I finished Year 11 last summer", "I left school last year at 16". The same goes for a past sign with no time given ("I've left school"), because the least time it could be is no time.
- No longer a sign: a year or a count of years that puts the person at 18 or over ("since my A-levels in 2009", "I left school at 16 and have worked at the depot for twelve years", "high school sweethearts thirty years ago"), or a stated adult age beside it, or anything else on the list of what shows an adult ("I've worked behind the bar since leaving school"). A past sign is weaker than a present one, so any of them will do.
- A past age is read the same way. "When I was 15" with nothing to say how long ago is a sign. "I was 15 when I started here, ten years ago" is not.

**A stated adult age beside a sign, in one message.** The rule is the same
whether the two are in one message or in two messages of one conversation.

- **Beside a stated younger age, the younger age decides.** "I'm 15, well, 18 really" is refused.
- **Beside a school year that no 18-year-old is ordinarily in, the younger sign decides.** The message contradicts itself, and in doubt the filter refuses. Those years are the ones at least two below the last: Year 11 and below, tenth grade and below, freshman or sophomore year of high school, S4 and below, and every under-13 sign. "I'm 18 and in Year 9" is refused.
- **Beside any other sign, the stated adult age decides,** for the asker's own matter. People are 18 in the last two years of school, adults resit school exams, and adults have parents with rules. "I'm 18 and in Year 13", "I'm 19 and resitting my GCSE maths", "I'm 18 and taking AP Physics" and "I'm 18 and my mum still sets a curfew" are adults.
- **Only a stated age does this.** A husband, a tenancy or a bar job beside "I'm in Year 12" does not make the message an adult's. Those entries answer a parent who decides, a word that needs a setting and a sign in the past, and nothing else.
- **In a love question a stated age settles only the person it belongs to.** If the other person still shows a sign and no adult age, the question is refused.

**An age under 18 holds for the whole conversation.** Decided by Dias on
13 November 2026: once a younger age (13 to 17, or under 13) has been
given in a conversation, the filter keeps refusing for the rest of that
conversation, even if an adult age comes later.

*What sets it.* Either of these, about the asker, in any message of the
conversation, whether that message was refused or judged:

- a stated age under 18, in any form;
- a school year that no 18-year-old is ordinarily in (the list above), or any sign of being under 13.

*What it does.* From that message on, every question in the conversation
is refused with reason `minors`, whatever it is about and whatever age is
claimed afterwards. None of these lift it:

- a later adult age ("I'm 18", "sorry, I meant 19", "that was a typo");
- a birthday during the conversation ("it's gone midnight, I'm 18 now");
- a later question with no age in it;
- a wrapper ("say I were 25", "answer as if I'm an adult");
- an adult sign of any other kind.

An age under 13 keeps the under-13 handling to the end, even if a later
message says 15.

*The order of the messages does not matter.* An adult age first and a
younger age afterwards ("I'm 18", and two messages later "I'm in Year 10")
is refused from the younger one onward. The question judged before it
stays judged.

*What can still be answered later.* A sign that an 18-year-old can have (a
last school year, a school exam, an AP class, a parent who decides) and a
word that needs a setting do not set the hold. They refuse the question
they are in. A later message in the same conversation that states an
adult age answers them, exactly as it would have in the same message:
"I'm in Year 13. Will I get the bar job?" is refused, and "I'm 18. Will I
get the bar job?" after it is allowed. This is why the refusal for these
signs may say "if you are 18 or over, say so", and the refusal for a
stated younger age may not (section 6).

*Other people.* The hold belongs to the person the age was given for. A
younger age given for the other person in a love question holds for that
person: "she's 16" followed by "I meant 18" is still refused. A child of
the asker's who was mentioned earlier ("my 15-year-old") does not make
the asker under 18, and the asker's own later question is judged as usual.

*What counts as the same conversation.* One unbroken exchange between one
person and Ask the Sky:

- in a chat, one thread, from its first message to its last, however long it stays open and however long the pauses;
- on a page, one visit: from opening Ask the Sky until the page is closed or left.

A new thread, a new visit, another browser or another device is a new
conversation.

*What the filter can remember.* Whoever applies the filter needs, for each
conversation, the ages and signs already given in it. If the whole
conversation is in front of them (a person or a model reading the thread),
nothing has to be stored. If each message is seen alone, one small note
per conversation is enough, and it holds a state, not an age:

| State | Set by | What follows |
|---|---|---|
| nothing shown | the start | each message is read on its own |
| adult stated | a stated age of 18 or more | answers a later sign that an 18-year-old can have, and a later word that needs a setting |
| under 18, held | a stated age of 13 to 17, or a school year no 18-year-old is in | every later question is refused. Never changes back. |
| under 13, held | any sign of being under 13 | every later question is refused with the under-13 handling. Never changes back. |

A fifth entry, "someone under 18 was named in a love question", refuses
later love questions in the conversation when the applier cannot tell
which person a new message means.

The note holds no age, no date, no name and no question. It lives where
the conversation lives (the thread, or the open page) and ends with it. It
is not written to an account, a log or a device. This is a different
memory from the one the repeat rule needs (4.8), and a smaller one.

*What it does not do.* The filter remembers nothing from one conversation
to the next. Someone refused as 15 can open a new conversation and say
they are 18, and the filter will read that conversation on its own. The
filter cannot check an age (section 8, item 15). Whether the hold should
outlast the conversation, for a day or on the device, is not decided and
is listed in section 8.

**Sons and daughters.** "My son" or "my daughter" with no age is read as a
child, unless the message shows an adult (their wedding, their own children,
their career, an age of 18 or more). The question is refused either way.
Only the reason differs: `minors` for a child, `other-people` for an adult.

A sign of being under 13 gets the under-13 wording. A sign of being 13 to 17
gets the wording for an asker under 18, or, for a love question, the romance
wording (section 6). When a sign could mean either side of 13, the under-13
handling applies. The filter cannot know an age nobody states or shows
(section 8).

**Why.** The site is not directed at children under 13 and gives no romance
framing for anyone under 18 (connector instructions). A child cannot agree
to being read, and a parent acting on a verdict about a child is the
other-people problem at its worst. For an asker of 13 to 17 this draft goes
further than the rest of the site, which bars only the romance framing: a
yes or a no on a young person's own exam, first job or place in a team
sounds like knowledge to someone who has less to weigh it against. Dias
approved the tightening on 13 November 2026 (ZOD-210). That it means
"nothing is judged" is the builder's reading of that approval, and it is
listed in section 8. The same day Dias drew the line more finely
(ZOD-220): "college" alone and an application to university show nothing
either way, AP classes are a sign, and an age under 18 once given holds
for the conversation.

Under 13, and a child as the subject:

| Blunt | Softened or indirect |
|---|---|
| Will my son pass his exams? | Will we get the school place we applied for? |
| What will my baby be like? | My little one starts nursery on Monday. Will she settle? |
| I'm 12. Will I make the football team? | Will I get into the grammar school after my 11-plus? |
| I'm 16. Does my crush like me back? | Can you do the sky for 04:10 on 3 March? That's when she arrived. |

Ages 13 to 17, all refused with reason `minors`:

| Question | The sign |
|---|---|
| I'm 15. Will I get the weekend job at the kennels? | A stated age. The asker's own job does not change it. |
| I'm 16. Will I get the place at college I applied for? | A stated age. "College" beside it changes nothing. |
| Will I get into AP Chemistry this fall? | An AP class is a high school class. |
| Will I do well enough in my mocks to stay in the top set? | A school exam being sat now. |
| I'm in Year 11. Will I get the lifeguard job at the pool? | A school year. |
| I'm in Year 13 and waiting on my university offers. Will I get my first choice? | A school year. The application to university does not show an adult. |
| I've just finished my GCSEs. Will I get the summer job at the theme park? | A school exam just sat. Nothing shows the person is now 18. |
| My mum won't let me go to the party. Will he still talk to me on Monday? | A parent who forbids, and a love question. |
| Dad says I have to be home by ten. Will I get the part in the band? | A curfew set by a parent. |
| My teacher says I'm ready. Will I pass on Friday? | "My teacher" with no setting is read as school. |
| I'm 18 and in Year 9. Will I get the job at the chip shop? | No 18-year-old is in Year 9. The younger sign decides. |
| Will my 14-year-old make the county squad? | A parent asking about a child of that age. |
| My teenager is waiting to hear from the garage. Will he get the job? | The same, with no number. |
| She's in sixth form and I'm 19. Will she go out with me? | A love question, and the other person shows a sign. |

The same words, allowed, because the word shows nothing either way, or the
message shows an adult, or the sign is not the asker's:

| Question | Why it is allowed |
|---|---|
| Will I get the place at college I applied for? | "College" on its own shows nothing either way. |
| My boyfriend and I are in the same class at college. Will we stay together? | The same. A class at college is part of college. A gentle love question. |
| Will I get into my first-choice university this autumn? | An application to university shows nothing either way. |
| Will I finish my degree at college by June? | A degree is study that only adults do. |
| Will I get the caretaker job at the high school? | The asker is the adult in the sentence. |
| My mum thinks I should stay put. Will I get the job in Leeds? | A parent's opinion is not a parent who decides. |
| My mum has to sign as guarantor. Will I get the flat? | A guarantor backs an adult's contract. |
| I'm 18 and in Year 13. Will I pass my driving test next month? | A stated adult age beside a last school year. |
| Someone from my salsa class keeps asking me to dance. Will she say yes to a drink? | A class outside school is not a sign. |
| We met at university. Will she say yes when I propose? | Being at university, for both of them. |
| Will I get the early shift I asked for, now my daughter has started her GCSE year? | The child is the background. The answer is about the asker's shift. |

Conversations. Each line is one conversation, read from the left:

| Earlier in the conversation | Now | Result |
|---|---|---|
| "I'm 15. Will I get the cinema job?" (refused) | I'm 18. Will I get the cinema job? | Refuse, `minors`. The younger age holds. |
| "I'm 15. Will I get the cinema job?" (refused) | Will I pass my driving test in May? | Refuse, `minors`. The hold covers every later question. |
| "I'm 11. Will I get a part in the play?" (refused) | Actually I'm 14. Will I get the part? | Refuse, `minors`, with the under-13 wording. |
| "I'm 18. Will I get the cinema job?" (judged) | Will I be picked for the Year 10 netball team? | Refuse, `minors`, from here on. The first answer stands. |
| "I'm in Year 13. Will I get the bar job?" (refused) | I'm 18. Will I get the bar job? | Allow. A last school year can be answered by a stated adult age. |
| "Will my teacher give me a good reference?" (refused) | I'm 40 and she teaches my evening class. Will I get the job I applied for? | Allow. A word that needs a setting has been given one. |
| none: a new conversation, the day after one in which the same person said they were 15 | I'm 18. Will I get the cinema job? | Allow. The filter remembers nothing across conversations. |

**Nearest allowed.** A parent's own matter in which a child is only the
background: "Will I get the part-time hours I asked for?" The test is the
same as everywhere: who is the answer about? For an adult whose question
was refused over a word like "my teacher" or "senior year", the nearest
allowed is the same question with their age or the setting in it.

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
| I'm 15. Will I get the job at the chip shop? | Refuse, `minors` | The asker is 13 to 17. Nothing is judged, the asker's own job included (4.6). |
| Will I pass my college course? | Allow | "College" on its own shows nothing either way (4.6). "I'm 16. Will I pass my college course?" is refused. |
| Will I get into the university I applied to? | Allow | An application to university shows nothing either way. With a school year, a school exam or "my teacher" beside it, it is refused: the application does not show an adult. |
| I'm 18 and in Year 9. Will I get the job at the chip shop? | Refuse, `minors` | No 18-year-old is in Year 9. The message contradicts itself, and the younger sign decides (4.6). |
| I'm 18. Will I get the job at the chip shop? (Earlier in the same conversation: "I'm 15. Will I get the job at the chip shop?") | Refuse, `minors` | An age under 18, once given, holds for the conversation (4.6). |
| My mum is my guarantor. Will I get the flat I applied to rent? | Allow | A parent who backs an adult's contract is helping, not deciding (4.6). |
| I'm 18, she's in my A-level history set. Will she go out with me? | Refuse, `minors` | A love question. The asker's age is settled, hers is not, and she shows a school sign. |
| Will my son get the promotion he went for? | Refuse, `other-people` | A promotion shows an adult son. Still refused, with the other wording. |
| Will my 16-year-old and I get the flat I applied to rent? | Allow | The asker's own application. The child is mentioned, and the answer says nothing about the child. |
| Will I get the job I went for, so I can stop living off my parents? | Allow | Parents are mentioned. Nobody gives or refuses permission. |

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

`minors`, the asker gave an age from 13 to 17, or a school year no
18-year-old is in, in this message or earlier in the conversation (not a
love question):

> Ask the Sky takes questions from adults only, so it cannot take this
> one.

`minors`, the asker appears to be 13 to 17 from a sign that an adult age
can answer, or from a word that needs a setting (not a love question):

> Ask the Sky takes questions from adults only. If you are 18 or over, say
> so and ask again.

`minors`, a love question where someone is or appears to be under 18:

> Zodiacs does not give readings about romance where anyone involved is
> under 18.

Which one is shown: the under-13 wording for a sign of being under 13. The
romance wording for any love question with a sign of being under 18 in it,
whoever the sign belongs to. The child wording when another person under 18
is the subject. An adults-only wording for everything else an asker of 13
to 17 sends. There are two of those since the fourth version. The one that
ends "say so and ask again" is shown only where saying so would work: a
last school year, a school exam, an AP class, a parent who decides, or a
word that needs a setting. Where an age under 18 is held for the
conversation, the plain one is shown, every time, because a later "I'm 18"
changes nothing there and the wording must not suggest it would. The
romance wording no longer invites a question about "school, a trial, a
plan", because for an asker under 18 those are refused too.

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

### Approved on 13 November 2026 (ZOD-210), and applied in the third version

The signs of being 13 to 17 are tightened: college, school years, a
15-year-old asking about their own job, and parents are signs, and not ways
through. (For "college" this lasted until the fourth version, below.) Love questions about someone under 18, the under-13 rule, and
immigration, legal and medical questions are refused as before. Gentle love
questions between adults are allowed as before.

How the builder read that approval, which Dias may want to redraw:

- **Nothing is judged for an asker of 13 to 17.** The review found step 3 refusing a 15-year-old's own job and 4.6 allowing it (F11). ZOD-210 says to settle it in the tightened direction, so step 3 stands. The other reading keeps a 13 to 17 asker's questions about work and school and refuses only love, as the connector does for the rest of the site.
- **"College", "school", "my class", "my teacher" and "junior year" refuse unless the message shows an adult.** This will refuse some adults, most of them American students who say "college" for university. The refusal tells them to say they are 18 or over and ask again. A softer choice is to let these words refuse love questions only. *Changed in the fourth version for "college", which no longer refuses on its own (Dias, 18:09). It still stands for the other words.*
- **The adults-only wording tells the person what to say to get through.** A 16-year-old can type "I'm 18". The filter never could check an age (item 15), so this adds no new hole, but it is printed in plain sight. *Narrowed in the fourth version: the wording that says so is shown only for a sign an adult age can answer, and never after a younger age has been given.*
- **Year 7, Year 8 and seventh grade get the under-13 handling,** because some pupils in them are 12.
- **A son or daughter with no age is read as a child.** It changes only which refusal is shown.

### Settled on 13 November 2026, 18:09 (ZOD-220), and applied in the fourth version

Dias's four calls, as written on the issue:

1. Applying to university is not an adult signal by itself.
2. Once a younger age (13 to 17, or under 13) has been given in a conversation, keep refusing for the rest of that conversation even if an adult age comes later.
3. A bare "college" alone should not refuse. "College" plus any other teen signal should.
4. AP classes are a high-school (13 to 17) signal.

These replace two of the builder's readings above: "college" no longer
refuses on its own, and the adults-only wording no longer tells a person
who gave a younger age what to say.

What the review's seven findings (`BREAKER-AGE.md`) came to:

| Finding | What was done |
|---|---|
| G1, the lists read as complete | 4.6 now says the lists are examples of a rule, and names AP classes and exams, the PSAT, SAT and ACT, Nat 5s, predicted grades, results day, GCSE options, sets, a timetable, prefect, head boy and head girl, a student council, a report card, the honor roll, a yearbook, a school night, a youth team, and words for being too young. |
| G2, applying to university | Settled by call 1. An application shows nothing either way. Being at university still shows an adult. |
| G3, a sign in the past | A past school sign counts until the message shows the person must now be 18 or over. No time given counts as no time passed. |
| G4, a stated adult age | Settled by call 2 for a conversation. In one message: a stated adult age loses to a stated younger age and to a school year at least two below the last, and decides beside any other sign. |
| G5, the either-way words | Settled by call 3 for "college". The list of what shows an adult grew (graduating, a year abroad, a job the law keeps for adults, military service, voting). "School", "my class", "my teacher" and "junior year" with no setting still refuse. That part is open, below. |
| G6, a class or teacher outside school | A class, teacher, instructor or classmate of something that is not school is not a sign, nor is a school of something adults learn, nor a class or tutor at college. |
| G7, the tie rule and parents | A parent is a sign only when the parent decides. A guarantor, a lift, a loan or an opinion is not a sign. A stated adult age or an adult's life answers a parent sign. |

How the builder read the four calls, which Dias may want to redraw:

- **A bare "college" is allowed in love questions too.** The call makes no exception, so "My boyfriend and I are in the same class at college. Will we stay together?" is now allowed. Some of the people who send it will be 16 or 17 at a British college. The stricter choice keeps "college" as a sign in love questions only.
- **An application to university shows nothing either way.** The call says it is not an adult signal. The builder did not make it a teen signal, so "Will I get into my first-choice university this autumn?" is allowed, as its "college" twin now is. Most people who send it are 17. The stricter choice reads an application for a first degree as a school sign.
- **"Given" means a stated age under 18, or a school year no 18-year-old is in.** Those hold for the conversation. A last school year, a school exam, an AP class or a parent who decides refuses its own question, and a stated adult age later in the conversation answers it, as it would in the same message. The stricter choice holds the conversation after any refusal for age, and then no refusal could say "if you are 18 or over, say so".
- **A birthday in the middle of a conversation does not lift the hold.** "It's gone midnight, I'm 18 now" is refused until a new conversation.
- **"I'm 18 and in Year 9" is refused, and "I'm 18 and in Year 12" is allowed.** The line is two years below the last school year. It could be drawn one year higher or lower.
- **The hold ends with the conversation,** and the filter keeps a state and nothing else (4.6).

Still open after the fourth version, and why:

- **"School", "my class", "my teacher", "homework" and "junior year" with no setting still refuse.** Call 3 names "college" only. Some adults will still be refused ("I'm a junior. Will I get the summer internship at the bank?") and told to say they are 18 or over. Extending the bare-college call to these words is a product call.
- **Whether the hold should outlast the conversation.** A person refused as 15 can open a new conversation and say 18. Closing that needs a memory on the device or the account, which the house rules on storing what people tell us make Dias's decision.
- **Whether Ask the Sky should ask for an age** (item 15). Youth that shows through no word at all still gets through (a paper round, a learner's permit: the review's N1).
- **The review's notes N2 to N4**: the under-13 wording shown to a 13-year-old in Year 8, that no reader has been asked to pick a refusal wording, and school stages in countries not yet tried.

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
15. **Under 18.** The filter acts on what the person says or shows (4.6). It cannot know an age nobody states or shows. Whether Ask the Sky should ask for one is a product decision. Now that nothing is judged for anyone under 18, asking for an age would do more than the list of signs can.
16. **Who applies the filter.** This draft is written so that a person or a model could apply it. It does not say which, and nothing was built.

### Open from the fix-round review, not touched in the third version

These findings of `BREAKER-FIX.md` are not about the signs of age. Nothing
was done about them in this round.

17. **F4.** A love question about the other person's feelings is allowed (3.1), and the answer is barred from stating what the other person feels (section 7).
18. **F5.** "Will I find love again?" is sent back for rewording because it has no time frame.
19. **F7.** "A mention is not a subject" and "judge the event behind the wording" pull against each other when the thing mentioned is a legal or health fact about the asker.
20. **F8.** "Ending someone else's relationship" is not clear when the third person is in the asker's own marriage.
21. **F9.** The order of reasons still disagrees with some of the filter's own examples.
22. **The review's notes N2 to N5:** an either-or that names a colleague, a job abroad, the low-stakes cases seen in its run, and that Dias's calls are not written on the Linear issue.
