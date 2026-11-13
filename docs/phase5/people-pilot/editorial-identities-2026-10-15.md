# Principal identity review — 15 October 2026

Audit A20 (`editorial-identities-2026-09-05.md`) corrected three People labels that led with a secondary occupation. This review applies the same correction to all 104 directory-indexable people and changes the editorial selection for 59 of them. Every selected string already occurs in that person's cached occupation evidence (Wikidata P106), and no more than two are selected; `tools/principal-identities.mjs` enforces both. No Wikidata claim, birth input, country or life-date suffix, coordinate, calculation, portrait, frozen reading or indexing decision is rewritten.

A label was changed when it led with an occupation other than the one the cached Wikidata description leads with; when it paired the right lead with an occupation the description does not name and the person is not chiefly known for (association football player for Camus, botanist for Dickens, film actor for Pavarotti, autobiographer, university teacher); or when it was less specific than the noun the description leads with ("writer" where the description says "novelist"). The new selection takes the cached labels that match the description's lead noun or nouns, in the description's order. Where a noun has no exact label, the nearest cached one is used: author → writer; actress or actor → film actor; filmmaker → film director; musician → singer-songwriter; artist → visual artist (Warhol) or painter (Basquiat, who has no general artist label); Prime Minister or nationalist leader → politician; Emperor → monarch; independence activist → freedom fighter; anti-apartheid activist → political activist; civil rights activist → civil rights advocate; operatic tenor or soprano → opera singer. Where the existing lead is a more specific, accurate form of the description's noun it is kept: Formula One driver for Senna's "racing driver", novelist for Kafka's "writer", physicist for Faraday's "scientist". Diego Maradona's description also names "manager"; association football coach was not added, to match Johan Cruyff's unchanged single label for the same description.

| Person | Previous label | Reviewed label | Cached Wikidata description |
| --- | --- | --- | --- |
| Alan Turing | Computer scientist and university teacher | Computer scientist | “English computer scientist (1912–1954)”, retrieved 2026-07-26 |
| Albert Camus | Writer and association football player | Philosopher and writer | “French philosopher, author, and journalist (1913–1960)”, retrieved 2026-07-26 |
| Alexander Graham Bell | Physicist | Scientist and inventor | “Canadian-American scientist inventor of telephone (1847–1922)”, retrieved 2026-07-26 |
| Alfred Hitchcock | Film director and writer | Film director | “British filmmaker (1899–1980)”, retrieved 2026-07-26 |
| Andy Warhol | Film director and painter | Visual artist and film director | “American artist, film director, and producer (1928–1987)”, retrieved 2026-07-26 |
| Audrey Hepburn | Stage actor and philanthropist | Film actor | “British actress (1929–1993)”, retrieved 2026-07-26 |
| Ayrton Senna | Formula One driver and philanthropist | Formula One driver | “Brazilian racing driver (1960-1994)”, retrieved 2026-07-26 |
| Bertrand Russell | Mathematician and essayist | Analytic philosopher and logician | “British philosopher and logician (1872–1970)”, retrieved 2026-07-26 |
| Bette Davis | Autobiographer and stage actor | Film actor | “American actress (1908–1989)”, retrieved 2026-07-26 |
| Billie Holiday | Actor and songwriter | Jazz singer | “American jazz singer (1915–1959)”, retrieved 2026-07-26 |
| Bruce Lee | Film director and writer | Martial artist and film actor | “Hong Kong–American martial artist and actor (1940–1973)”, retrieved 2026-07-26 |
| Charles Darwin | Geologist and explorer | Naturalist and biologist | “English naturalist and biologist (1809–1882)”, retrieved 2026-07-26 |
| Charles Dickens | Writer and botanist | Novelist and social critic | “English novelist and social critic (1812–1870)”, retrieved 2026-07-26 |
| Charlie Chaplin | Film director and composer | Film actor and film director | “English actor and filmmaker (1889–1977)”, retrieved 2026-07-26 |
| Charlotte Brontë | Poet and teacher | Novelist and poet | “British novelist and poet (1816-1855)”, retrieved 2026-07-26 |
| David Bowie | Painter and singer-songwriter | Singer-songwriter and film actor | “English musician and actor (1947–2016)”, retrieved 2026-07-26 |
| Diego Maradona | Association football player and actor | Association football player | “Argentine football player and manager (1960–2020)”, retrieved 2026-07-26 |
| Ella Fitzgerald | Jazz musician and singer-songwriter | Jazz singer | “American jazz singer (1917–1996)”, retrieved 2026-07-25 |
| Elvis Presley | Film actor and singer | Singer and film actor | “American singer and actor (1935–1977)”, retrieved 2026-07-26 |
| Franz Kafka | Novelist and lawyer | Novelist | “Bohemian writer from Prague (1883–1924)”, retrieved 2026-07-26 |
| Freddie Mercury | Singer-songwriter and painter | Singer-songwriter | “British singer, songwriter and musician, frontman of the rock band Queen (1946–1991)”, retrieved 2026-07-26 |
| Friedrich Nietzsche | Philosopher and composer | Philosopher | “German philosopher (1844-1900)”, retrieved 2026-07-26 |
| Grace Kelly | Film actor and musician | Film actor | “American actress and Princess consort of Monaco (1929–1982)”, retrieved 2026-07-26 |
| Haile Selassie | Politician | Monarch | “Emperor of Ethiopia from 1930 to 1974”, retrieved 2026-07-26 |
| Immanuel Kant | Philosopher and anthropologist | Philosopher | “German philosopher (1724-1804)”, retrieved 2026-07-26 |
| Indira Gandhi | Politician and writer | Politician | “Prime Minister of India (1966-1977; 1980-1984)”, retrieved 2026-07-26 |
| Ingrid Bergman | Autobiographer and stage actor | Film actor | “Swedish actress (1915–1982)”, retrieved 2026-07-26 |
| Jane Austen | Writer | Novelist | “English novelist (1775–1817)”, retrieved 2026-07-26 |
| Jawaharlal Nehru | Writer and politician | Politician | “Prime Minister of India from 1947 to 1964”, retrieved 2026-07-26 |
| Jean-Michel Basquiat | Painter and composer | Painter | “American artist (1960–1988)”, retrieved 2026-07-26 |
| John Lennon | Writer and actor | Singer-songwriter | “British musician (1940–1980)”, retrieved 2026-07-26 |
| Judy Garland | Television actor and singer | Film actor and singer | “American actress, singer, dancer and vaudevillian (1922–1969)”, retrieved 2026-07-26 |
| Karl Marx | Economist and journalist | Philosopher | “German-born philosopher (1818–1883)”, retrieved 2026-07-26 |
| Katharine Hepburn | Film actor and autobiographer | Film actor | “American actress (1907–2003)”, retrieved 2026-07-26 |
| Lata Mangeshkar | Singer and film actor | Singer | “Indian singer (1929–2022)”, retrieved 2026-07-26 |
| Louis Armstrong | Actor and trumpeter | Jazz musician and trumpeter | “American jazz musician, trumpeter and singer (1901–1971)”, retrieved 2026-07-26 |
| Luciano Pavarotti | Opera singer and film actor | Opera singer | “Italian operatic tenor (1935–2007)”, retrieved 2026-07-26 |
| Mohandas K. Gandhi | Barrister and political writer | Freedom fighter | “Indian independence activist (1869–1948)”, retrieved 2026-07-25 |
| Maria Callas | Opera singer and actor | Opera singer | “American-Greek operatic soprano (1923–1977)”, retrieved 2026-07-26 |
| Marie Curie | Physicist and university teacher | Physicist and chemist | “Polish-French physicist and chemist (1867–1934)”, retrieved 2026-07-26 |
| Mark Twain | Journalist and teacher | Writer and humorist | “American author and humorist (1835–1910)”, retrieved 2026-07-26 |
| Michael Faraday | Physicist and writer | Physicist | “British scientist (1791–1867)”, retrieved 2026-07-26 |
| Muhammad Ali Jinnah | Lawyer | Politician | “politician and the founder of Pakistan (1876–1948)”, retrieved 2026-07-26 |
| Nelson Mandela | Politician and autobiographer | Politician and political activist | “President of South Africa and anti-apartheid activist (1918–2013)”, retrieved 2026-07-26 |
| Pablo Picasso | Painter and costume designer | Painter and sculptor | “Spanish painter and sculptor (1881–1973)”, retrieved 2026-07-26 |
| Paul Newman | Television actor and racing automobile driver | Film actor | “American actor (1925–2008)”, retrieved 2026-07-26 |
| Prince | Film actor and singer | Singer-songwriter | “American musician (1958–2016)”, retrieved 2026-07-26 |
| Raj Kapoor | Film producer and screenwriter | Film actor and film producer | “Indian film actor, producer and director”, retrieved 2026-07-26 |
| Rosa Parks | Autobiographer and human rights defender | Civil rights advocate | “civil rights activist”, retrieved 2026-07-26 |
| Sally Ride | Physicist and astronaut | Astronaut and physicist | “American astronaut and physicist (1951–2012)”, retrieved 2026-07-26 |
| Selena | Singer and actor | Singer | “American singer (1971–1995)”, retrieved 2026-07-26 |
| Stephen Hawking | Theoretical physicist and pedagogue | Theoretical physicist and cosmologist | “British theoretical physicist, cosmologist and author (1942–2018)”, retrieved 2026-07-26 |
| Subhas Chandra Bose | Politician and writer | Politician | “Indian nationalist leader (1897-1945)”, retrieved 2026-07-26 |
| Swami Vivekananda | Philosopher and teacher | Monk and philosopher | “Indian Hindu monk and philosopher (1863–1902)”, retrieved 2026-07-26 |
| Sylvia Plath | Poet and draftsperson | Poet and writer | “American poet and writer (1932–1963)”, retrieved 2026-07-26 |
| Tina Turner | Singer and autobiographer | Singer and songwriter | “American-born Swiss singer and songwriter (1939–2023)”, retrieved 2026-07-26 |
| Toni Morrison | Writer and university teacher | Novelist and essayist | “African American novelist, essayist, and academic (1931–2019)”, retrieved 2026-07-26 |
| Victor Hugo | Politician and playwright | Novelist and poet | “French novelist, poet, dramatist and politician (1802–1885)”, retrieved 2026-07-26 |
| Wilt Chamberlain | Basketball player and screenwriter | Basketball player | “American basketball player (1936–1999)”, retrieved 2026-07-26 |

This review relies on the cached Wikidata descriptions and occupation claims in `evidence/`, retrieved on 25 and 26 July 2026 (dates per row), not on separate primary biographies as the September review did. A Wikidata description is a short, community-edited summary. Each is quoted exactly as cached; none was re-fetched or checked against a second source for this review. No biography prose or achievement is inferred from an astrological placement.

## Considered and left unchanged

The other 42 indexable labels were left as they are. These 26 already match what the description leads with, or are a more specific, accurate form of it: Ada Lovelace, Albert Einstein, Amy Winehouse, Arthur Miller, Babe Ruth, Bob Marley (singer-songwriter for "reggae musician"; no musician label is cached), Coco Chanel, Emily Brontë, Frida Kahlo, Gabriel García Márquez (novelist for "writer"), George Best, George Orwell, Janis Joplin, Johan Cruyff, Karen Carpenter, Katherine Johnson, Madhubala, Marlene Dietrich, Mary Shelley, Niki Lauda, Sridevi, Sun Yat-sen, Thomas Sankara, Virginia Woolf (novelist and essayist for "modernist writer"), Walt Whitman and Wolfgang Amadeus Mozart.

The remaining 16 were judgment calls. Each label names real, recognised work rather than a stray claim, so it was kept; each could follow its description more closely in a later review:

- Aretha Franklin — Singer and activist; "singer, songwriter, and pianist". Singer and songwriter would follow it.
- Eleanor Roosevelt — Diplomat and writer; "diplomat and activist". No plain activist label is cached, only women's rights activist, peace activist and human rights defender.
- Martin Luther King Jr. — Civil rights advocate and writer; "Baptist minister and civil rights leader". Pastor is cached.
- Florence Nightingale — Nurse and writer; "social reformer, statistician, and founder of modern nursing". Statistician is cached.
- Marilyn Monroe — Film actor and singer; "actress and model". Fashion model is cached.
- Rabindranath Tagore — Poet and composer; "poet, philosopher and polymath".
- Jim Morrison — Singer-songwriter and lyricist; "singer and poet".
- Sigmund Freud — Psychoanalyst and essayist; "psychiatrist and founder of psychoanalysis".
- Akira Kurosawa — Film director and screenwriter; "filmmaker".
- Antoni Gaudí — Architect and designer; "architect".
- Vincent van Gogh — Painter and draftsperson; "painter".
- W. E. B. Du Bois — Historian and sociologist; "sociologist and activist". The order differs.
- Eva Perón — Politician and stage actor; "actress and politician". The description runs in date order; the political lead is kept.
- Yuri Gagarin — Astronaut; "pilot and cosmonaut".
- Simón Bolívar — Politician; "statesman and military officer".
- Edgar Allan Poe — Poet; "writer and literary critic". Poet is a narrower form of writer, but it leaves out the prose and criticism the description names.

## Found, outside these rules

These are described here and not changed:

- Several birthplace labels name something smaller than a settlement. Profiles print the label in "Positions at 12:00 civil time in …", and the AI people index uses it as the birthplace. Audrey Hepburn's is a street, "Rue Keyenveld - Keienveldstraat". Others are hospitals or buildings: Ayrton Senna ("maternity hospital of São Paulo"), Bruce Lee ("San Francisco Chinese Hospital"), John Lennon ("Liverpool Maternity Hospital"), Karen Carpenter ("Yale – New Haven Hospital"), Amy Winehouse ("Chase Farm Hospital"), Emily Brontë ("The Brontë Birthplace") and Swami Vivekananda ("Swami Vivekananda's Ancestral House & Cultural Centre"). Ingrid Bergman's is a parish ("Hedvig Eleonora parish") and Marlene Dietrich's a district ("Rote Insel"). Mark Twain's is "Florida", the Missouri village, which reads as the state.
- The country in the suffix is the birthplace's present-day country, not the person's nationality: Sigmund Freud and Franz Kafka read "Czech Republic", Raj Kapoor "Pakistan", George Orwell "India", Albert Camus "Algeria", Freddie Mercury "Tanzania", Florence Nightingale "Italy" and Yuri Gagarin "Russia". Immanuel Kant's suffix is the historical "Prussia", so the convention is not applied uniformly.
- `selected-expansion.json` keeps the original automated selections. It is the historical output of the retired selection tool and, as in A20, is not edited; `candidates.json` owns the selections.
- The migration keeps each record's `reviewedAtUtc`, so the sitemap `lastmod` of these profiles does not advance, as in A20.
- `source-review-og-receipt.json` is the 7 September CI receipt for the seven source-fact cards. Its recorded source hashes already predated the current `src/data/people.json` and `scripts/build-og-void.mjs`; it is a dated record and is not regenerated.

## Process

`candidates.json` owns the editorial selections. `tools/principal-identities.mjs` holds the closed list of 62 reviewed identities, A20's three first, and validates each selection against the cached evidence. The sequence is unchanged: `node docs/phase5/people-pilot/tools/compose-copy.mjs --migrate-identities`, then `node docs/phase5/people-pilot/tools/build-manifest.mjs`, then `node scripts/build-people-pilot.mjs`, then `node scripts/build-ai-people.mjs` for the AI people index. The copy migration changed only `identity` in 59 copy files. The manifest and `src/data/people.json` differ only in `shortDescription` and `disciplines` for those 59 records, plus the manifest hash. Readings, the depth report, evidence, computed charts and the index policy are byte-identical. `compose-copy.mjs --check`, `build-people-pilot.mjs --check`, `build-ai-people.mjs --check`, `build-people-index-demand.mjs --check`, `build-people-portraits.mjs --check` and the Phase 5C validator pass.

The closed category map in `src/lib/people.ts` gains eleven labels in existing groups, as A20 added aircraft pilot and test pilot: scientist, cosmologist and logician (Science); analytic philosopher, social critic and humorist (Writing); jazz singer (Music); monarch, freedom fighter and monk (Public life); martial artist (Sport). Directory filters follow the new selections, so Albert Camus no longer appears under Sport and Charles Dickens no longer under Science.

The share cards for the 59 people were re-rendered with `build-og-void.mjs --only-people`. That mode renders all 501 cards, but its output is not byte-stable across Chromium and libvips builds: in this container every card changed with no data change (Chromium 141 writes 8-bit palettes of about 32 KB; most committed cards are 4-bit palettes of about 15 KB). Only the 59 cards whose identity changed were kept; the other 442 are byte-identical to the previous commit. The review renderer (`--review-people-identities`) now covers every reviewed identity rather than the three A20 slugs, and the CI Explorer drive expects that count. It passed locally with fonts loaded, no overflow and production files unchanged. As with A20, its CI artifacts can be inspected before release.
