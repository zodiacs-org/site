import { describe, it, expect } from 'vitest';
import { organizationIdentityErrors, PUBLISHED_IDENTITY_URLS } from './organization-identity.mjs';
import { SOCIAL_PROFILES } from '../src/strings/seo.en.mjs';
const node=()=>({'@type':'Organization','@id':'https://zodiacs.org/#org',name:'Zodiacs.org',url:'https://zodiacs.org/',sameAs:[...PUBLISHED_IDENTITY_URLS]});
describe('Consumer Organization published identities',()=>{
 it('source profile URLs match independently stated released entries',()=>expect(SOCIAL_PROFILES).toEqual(PUBLISHED_IDENTITY_URLS));
 it('accepts the one canonical entity regardless of profile ordering',()=>{
   expect(organizationIdentityErrors([node()],{required:true})).toEqual([]);
   const n=node();n.sameAs.reverse();expect(organizationIdentityErrors([n],{required:true})).toEqual([]);
 });
 it.each(PUBLISHED_IDENTITY_URLS)('rejects missing published identity %s',url=>{
   const n=node();n.sameAs=n.sameAs.filter(value=>value!==url);
   expect(organizationIdentityErrors([n],{required:true}).length).toBeGreaterThan(0);
 });
 it.each([
   n=>{n.name='Other name';}, n=>{n.url='https://zodiacs.org/other/';},
   n=>{n['@type']='Thing';},n=>{n.sameAs.push(n.sameAs[0]);},
   n=>{n.sameAs=['https://github.com/zodiacs-org/sdk'];},
   n=>{n.sameAs.push('https://registry.modelcontextprotocol.io/nonexistent');},
 ])('rejects an altered consumer entity',mutate=>{
   const n=node();mutate(n);expect(organizationIdentityErrors([n],{required:true}).length).toBeGreaterThan(0);
 });
 it('requires one identity on consumer entry points and rejects duplicate identities',()=>{
   expect(organizationIdentityErrors([],{required:true}).length).toBeGreaterThan(0);
   expect(organizationIdentityErrors([node(),node()],{required:true}).length).toBeGreaterThan(0);
 });
 it('does not rewrite separate product or Registry nodes',()=>{
   const other={'@type':'Organization','@id':'https://zodiacs.org/registry/#publisher',name:'Separate product'};
   expect(organizationIdentityErrors([other])).toEqual([]);
   expect(other.name).toBe('Separate product');
 });
 it('permits canonical nested references without duplicating the full entity',()=>{
  expect(organizationIdentityErrors([node(),{'@type':'Article',author:{'@id':'https://zodiacs.org/#org'},publisher:{'@type':'Organization','@id':'https://zodiacs.org/#org',name:'Zodiacs.org'}}],{required:true})).toEqual([]);
 });
 it('rejects contradictory names on nested author and publisher references',()=>{
  const article={'@type':'Article',author:{'@type':'Organization','@id':'https://zodiacs.org/#org',name:'Zodiacs'},publisher:{'@id':'https://zodiacs.org/#org',url:'https://example.invalid/'}};
  expect(organizationIdentityErrors([node(),article],{required:true})).toContain('Consumer Organization reference name must be Zodiacs.org');
  expect(organizationIdentityErrors([node(),article],{required:true})).toContain('Consumer Organization reference URL must be canonical');
 });
});
