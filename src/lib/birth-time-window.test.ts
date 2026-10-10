import {describe,expect,it} from 'vitest';
import type {BirthWindow} from '@zodiacs/engine/window';
import {birthWindowSummary,birthWindowChange,birthWindowShare} from './birth-time-window';
const fixture=(signs:BirthWindow['cells'][number]['features']['ascendant'][],flags:BirthWindow['flags']=[])=>({flags,cells:signs.map(ascendant=>({features:{ascendant}}))});
describe('sampled birth-window presentation',()=>{
 it('distinguishes one rising sign, repeated cells and changing signs',()=>{
  expect(birthWindowSummary(fixture(['leo','leo']))).toBe('Rising sign stays in Leo across this window.');
  expect(birthWindowSummary(fixture(['leo','leo','virgo']))).toBe('Rising sign depends on the birth time: Leo or Virgo.');
 });
 it('never calls incomplete coverage stable even when its observed cells agree',()=>{
  expect(birthWindowSummary(fixture(['leo'],['bound-exceeded']))).toBe('This sampled check could not establish coverage of the whole window.');
  expect(birthWindowSummary(fixture([]))).toBe('No rising-sign result is available for this window.');
 });
 it('distinguishes unresolved nodes from aspects leaving the configured orb',()=>{
  expect(birthWindowChange({feature:'sign',body:'North Node',from:'aries',to:null})).toBe('North Node sign: Aries → unresolved');
  expect(birthWindowChange({feature:'aspect',a:'Sun',b:'Moon',from:'square',to:null})).toBe('Sun / Moon: square → outside orb');
  expect(birthWindowChange({feature:'house',body:'South Node',from:null,to:3})).toBe('South Node house: unresolved → 3');
 });
 it('does not render a positive tiny time share as zero or accept invalid shares',()=>{
  expect(birthWindowShare(0.00001)).toBe('<0.1%');
  expect(birthWindowShare(0)).toBe('0.0%');
  expect(birthWindowShare(0.5)).toBe('50.0%');
  expect(birthWindowShare(1)).toBe('100.0%');
  for(const value of [NaN,Infinity,-0.01,1.01])expect(()=>birthWindowShare(value)).toThrow(RangeError);
 });
});
