import { describe, expect, it } from 'vitest';
import { dateInZone, getHoroscope, program } from './reading';
const now = new Date('2026-10-07T01:00:00Z');
describe('dated horoscope preview', () => {
  it('opens a picker without inferring a sign and defaults to New York', () => {
    const result = getHoroscope({}, now);
    expect(result).toMatchObject({ok:true,status:'choose-sign',request:{zone:'America/New_York',date:'2026-10-06'}});
    expect(result.ok && 'signs' in result && result.signs).toHaveLength(12);
  });
  it.each(program.signs.map(item => item.sign))('returns exact published %s copy and all source facts', sign => {
    const result = getHoroscope({sign},now);
    expect(result).toMatchObject({ok:true,status:'available',reading:{sign,period:{from:'2026-10-06',through:'2026-10-06',utcBasis:true}}});
    if (!result.ok || result.status !== 'available') throw new Error('missing result');
    expect(result.reading.text).toBe(program.signs.find(item => item.sign===sign)!.readings.today.text);
    for(const item of result.evidence) if(item.sourceFactId) expect(result.evidence.some(source => source.id===item.sourceFactId)).toBe(true);
  });
  it('resolves a different calendar day in Bangkok without relabeling the original edition', () => {
    const result=getHoroscope({sign:'aries',zone:'Asia/Bangkok'},now);
    expect(result).toMatchObject({status:'available',request:{date:'2026-10-07'},editionDate:'2026-10-06',reading:{surface:'tomorrow'}});
    expect(result.ok && 'sourceNote' in result && result.sourceNote).toContain('Relative words');
  });
  it('supports the covered week on its last day but refuses the following week', () => {
    expect(getHoroscope({sign:'pisces',period:'week',date:'2026-10-11'},now)).toMatchObject({status:'available',reading:{period:{from:'2026-10-05',through:'2026-10-11'}}});
    expect(getHoroscope({sign:'pisces',period:'week',date:'2026-10-12'},now)).toMatchObject({status:'unavailable'});
  });
  it('does not reuse daily focus copy for uncovered dates or fabricate a weekly focus', () => {
    expect(getHoroscope({sign:'libra',focus:'love',date:'2026-10-06'},now)).toMatchObject({status:'available',reading:{surface:'love'}});
    expect(getHoroscope({sign:'libra',focus:'career',date:'2026-10-07'},now)).toMatchObject({status:'unavailable'});
    expect(getHoroscope({sign:'libra',period:'week',focus:'love'},now)).toMatchObject({status:'unavailable'});
  });
  it('refuses old and future daily coverage rather than substituting today', () => {
    for(const date of ['2026-10-05','2026-10-08','2027-10-06']) expect(getHoroscope({sign:'aries',date},now)).toMatchObject({status:'unavailable'});
  });
  it.each([{sign:'unknown'},{sign:'aries',birthDate:'private-canary'},{date:'2026-02-30'},{date:'0000-00-00'},{zone:'Mars/Olympus'}])('rejects invalid and out-of-scope input %j', input => { expect(getHoroscope(input,now).ok).toBe(false); });
  it('uses IANA rules around the New York daylight-saving change', () => {
    expect(dateInZone(new Date('2026-03-08T04:59:00Z'),'America/New_York')).toBe('2026-03-07');
    expect(dateInZone(new Date('2026-03-08T05:00:00Z'),'America/New_York')).toBe('2026-03-08');
    expect(dateInZone(new Date('2026-11-01T05:30:00Z'),'America/New_York')).toBe('2026-11-01');
    expect(dateInZone(new Date('2026-11-01T06:30:00Z'),'America/New_York')).toBe('2026-11-01');
  });
  it('withholds a reading when a referenced fact is missing', () => {
    const edition=structuredClone(program);
    const id=edition.signs[0].readings.today.passages[0].evidenceRefs[0];
    edition.evidence=edition.evidence.filter(item=>item.id!==id);
    expect(getHoroscope({sign:'aries'},now,edition)).toMatchObject({ok:false,error:{code:'missing-evidence'}});
  });
});
