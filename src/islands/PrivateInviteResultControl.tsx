import { useEffect, useState } from 'preact/hooks';
import { localizePath, type CatalogLocale } from '../lib/i18n';
import { sharingText as s } from '../lib/sharing/copy';
import { privateInviteToken } from '../lib/sharing/private-invite';
import type { PositionsShareInput } from '../lib/share-positions';
import { CopyLinkButton, type CopyLinkState } from './CopyLinkButton';

export default function PrivateInviteResultControl({ person, locale }: {
  person: { positions: PositionsShareInput; utc?: Date | string; untimedDate?: string }; locale: CatalogLocale;
}) {
  const [token, setToken] = useState('');
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<CopyLinkState>('idle');
  useEffect(() => {
    let current = true;
    setToken(''); setFailed(false); setState('idle');
    const basis = person.utc !== undefined ? { utc: person.utc } : person.untimedDate ? { birthDate: person.untimedDate } : null;
    if (basis) void privateInviteToken(person.positions, basis).then((value) => { if (current) setToken(value); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [person]);
  if (!token) return failed ? <a href={localizePath(locale, '/compatibility/invite/')}>{s(locale, 'inviteTitle')} →</a> : null;
  return <div class="calc__share" data-private-result-invite>
    <CopyLinkButton url={`${window.location.origin}${localizePath(locale, '/compatibility/')}#p=${token}`} state={state} onStateChange={setState}
      idleLabel={s(locale, 'inviteShare')} copiedLabel={s(locale, 'inviteCopied')} ariaLabel={s(locale, 'linkLabel')} buttonClass="btn btn--ghost" dataHook="invite">
      <p class="calc__share-note">{s(locale, 'inviteNote')}</p>
    </CopyLinkButton>
  </div>;
}
