# Owner decisions of 2026-10-05: delegated

On 2026-10-05 the owner answered the list of open decisions in checkpoint 19
with "Make the best decision for me". The decisions below are the
programme's, made under that delegation, each with its reason. Where one
needs an action the programme cannot take, or does not take on its own (a
security setting, a message to people only the owner can reach), it says so.

## 1. F-78: the compute API's Firewall rules come down to 6 and 30

- **Decision.** The events rule, `zodiacs-compute-events`, from 10 to 6
  requests a minute per address; the general rule, `zodiacs-compute-api`,
  from 40 to 30.
- **Why.** DECISIONS-2026-09-30 §7 already says the rules come down if a
  later engine's figures put one address over 10 CPU-seconds a minute. Engine
  rc.16's do: 10.7, 12.8 and 13.2 in three runs (F-78). Of the pairs
  measured, 6 and 30 is the only one under 10 in all three (7.5, 9.0, 9.3).
  Thirty requests a minute is still one every two seconds from each address.
- **Action.** The owner's. The Vercel connector the programme uses cannot read
  or change the project's Firewall (it answers not found), and a Firewall rule
  is a security setting. Once the owner publishes the two numbers, the next
  site pull request makes the compute page, the OpenAPI descriptions and the
  llms files say 30 and 6, and F-78 closes.

## 2. The external-builder trial: once the remote MCP server is live

- **Decision.** Send it when the remote MCP server (P3.6) is live, with the
  packet refreshed against it.
- **Why.** The conditions of DECISIONS-2026-09-28 §12 are met, but the packet
  was measured on the adapter 0.1.0-rc.9 and must be measured again before it
  is sent in any case. With a remote server a builder tries the tools by
  adding a URL rather than installing an archive, and the quickstarts the
  owner put next will be there. A builder's time is asked for once.
- **Action.** The recipients are people only the owner can reach; the packet
  names none and invents none. When the remote server is live the programme
  refreshes the packet and gives it to the owner to send.

## 3. The sky-fact benchmark: CC0 1.0, and its name

- **Decision.** The benchmark's files (the items, the key, the tool's replies
  and the scorer) are dedicated to the public domain under CC0 1.0, as the
  engine's conformance suite is (`conformance/LICENSE`). The name stays "sky-fact
  benchmark".
- **Why.** The benchmark is test data meant to be copied into other people's
  evaluations, and CC0 lets it be copied without attribution requirements.
  A web search on 2026-10-05 found no benchmark of that name; the nearest are
  Astro-QA and the AstroMLab astronomy benchmarks.
- **Action.** Done in the pull request that brings this record: the files'
  page, its Dataset markup, `llms-full.txt` and the benchmark's records say
  CC0 1.0. The files themselves are unchanged; version 0 is frozen.

## 4. F-71, B4.a's "raw answers" and A6: not ratified under the delegation

- **Decision.** None is accepted on the programme's own reading. Each would
  count the programme's own work as accepted on a reading the programme
  proposed after seeing the results: F-71's two readings of the end-to-end
  house comparisons, B4.a's "raw answers" as the tool's replies, and A6's
  "API" as the hosted compute API alone. The programme's rules give that
  judgement to the owner so that the party whose work is measured does not
  make it, and a general delegation does not change who should.
- **Effect.** Koch (0.2) and the co-ascendants (0.25) stay validated, B4.a (3)
  stays validated and A6 (0.5) partial. The owner can ratify any of them at
  any time.
- **A6** will be met without a reading: the static sky API's responses get
  the `cite` the compute API's carry.

## 5. F-77: no retake rule; the fix is in the page

- **Decision.** No retake rule for the Lighthouse gate. The fix is to start
  the chart form's scripts after the first paint.
- **Why.** A retake rule would let a run pass that the gate as written fails,
  and the cause is known and lies in the page.
- **Action.** The page belongs to the frontend session. Until its fix lands,
  a run that fails this way gets the one re-run CI's rules allow.

## 6. Eclipses and the sidereal zodiac in the MCP tools

- **Decision.** The sidereal zodiac goes into the MCP tools once engine
  rc.17 is adopted. Eclipses wait.
- **Why.** rc.17 computes the sidereal zodiac in calc, the clause P3.2
  misses. The eclipse entry's comparisons with Swiss Ephemeris fail as
  written, and fixing them is precision work, which the owner put behind the
  core 1.0, the documentation and quickstarts, the clients and the remote
  MCP.

## 7. npm

- **Decision.** No separate npm release of rc.17. The next publication is the
  1.0 candidate, which the programme brings to the owner for the one approval
  it needs.
- **Why.** P3.2's acceptance needs the site to serve the candidate, not npm,
  and one publication asks the owner once rather than twice.

## 8. The core 1.0

- **Decision.** As proposed at checkpoint 19: freeze the public API, and
  write the changelog and the deprecation policy. Nothing goes to npm
  without the owner's approval.

## 9. Pull request events

Attaching zodiacs-org/site to the programme's session, so that pull request
events can reach it, was refused by the session's permission check as an
access grant. It stays the owner's to do; the session's timed check-ins cover
for it.
