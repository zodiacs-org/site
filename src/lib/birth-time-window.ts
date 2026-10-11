import type {BirthWindow,WindowChange} from '@zodiacs/engine/window';
type SummaryInput={flags:BirthWindow['flags'];cells:readonly {features:Pick<BirthWindow['cells'][number]['features'],'ascendant'>}[]};
export const birthWindowSignName=(sign:string)=>sign.charAt(0).toUpperCase()+sign.slice(1);
export function birthWindowSummary(window:SummaryInput):string{
 if(window.flags.includes('bound-exceeded'))return 'This sampled check could not establish coverage of the whole window.';
 const signs=[...new Set(window.cells.map(cell=>cell.features.ascendant))].map(birthWindowSignName);
 if(signs.length===0)return 'No rising-sign result is available for this window.';
 if(signs.length===1)return 'Rising sign stays in '+signs[0]+' across this window.';
 return 'Rising sign depends on the birth time: '+signs.join(' or ')+'.';
}
export function birthWindowChange(change:WindowChange):string{
 const value=(v:string|number|null)=>v===null?'unresolved':String(v);
 switch(change.feature){
  case 'sign':return change.body+' sign: '+(change.from===null?'unresolved':birthWindowSignName(change.from))+' → '+(change.to===null?'unresolved':birthWindowSignName(change.to));
  case 'ascendant':return 'Rising sign: '+birthWindowSignName(change.from)+' → '+birthWindowSignName(change.to);
  case 'midheaven':return 'Midheaven: '+birthWindowSignName(change.from)+' → '+birthWindowSignName(change.to);
  case 'house':return change.body+' house: '+value(change.from)+' → '+value(change.to);
  case 'aspect':return change.a+' / '+change.b+': '+(change.from??'outside orb')+' → '+(change.to??'outside orb');
  case 'house-system':return 'House system: '+change.from+' → '+change.to;
 }
}
export function birthWindowShare(share:number):string{
 if(!Number.isFinite(share)||share<0||share>1)throw new RangeError('Invalid window time share');
 return share>0&&share<0.001?'<0.1%':(share*100).toFixed(1)+'%';
}

export const BIRTH_WINDOW_MINUTES=[1,5,10,15,30,60,120] as const;
const referenceStart=Date.parse('1800-01-01T00:00:00Z');
const referenceEnd=Date.parse('2200-01-01T00:00:00Z');
/** Both endpoints must belong to the engine's half-open UTC reference span. */
export function birthWindowAvailableMinutes(utc:Date):readonly number[]{
 const at=utc.getTime();
 if(!Number.isFinite(at)||at<referenceStart||at>=referenceEnd)return [];
 return BIRTH_WINDOW_MINUTES.filter(minutes=>at-minutes*60000>=referenceStart&&at+minutes*60000<referenceEnd);
}
