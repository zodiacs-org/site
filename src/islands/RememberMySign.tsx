/**
 * "Make Leo my sign": remembers the visitor's Sun sign on this device only
 * (src/lib/my-sign.ts). The homepage then highlights that sign and Guide uses
 * its name. The server renders an empty line of fixed height, so nothing
 * moves when the words appear, and the words are not part of the page's
 * published text (sitemap dates, the dated-edition checks).
 */
import { useEffect, useState } from 'preact/hooks';
import { MY_SIGN_EVENT, readMySign, rememberMySign, type SignSlug } from '../lib/my-sign';

export default function RememberMySign({ sign, name }: { sign: SignSlug; name: string }) {
  const [ready, setReady] = useState(false);
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const sync = () => setMine(readMySign() === sign);
    try {
      localStorage.getItem('zodiacs.my-sign.v1');
    } catch {
      return; // Storage blocked: the line stays empty.
    }
    sync();
    setReady(true);
    window.addEventListener(MY_SIGN_EVENT, sync);
    return () => window.removeEventListener(MY_SIGN_EVENT, sync);
  }, [sign]);

  return (
    <p class="mysign">
      {ready && (mine ? (
        <span>
          {`${name} is your sign. `}
          <button type="button" onClick={() => rememberMySign(null) && setMine(false)}>Forget</button>
        </span>
      ) : (
        <button type="button" onClick={() => rememberMySign(sign) && setMine(true)}>{`Make ${name} my sign`}</button>
      ))}
    </p>
  );
}
