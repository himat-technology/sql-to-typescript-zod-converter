import { memo } from 'react';
import type { HighlightToken } from '../utils/highlight';

/** Renders highlighted tokens as spans. Memoized so unchanged code isn't re-rendered. */
export const CodeTokens = memo(function CodeTokens({ tokens }: { tokens: HighlightToken[] }) {
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} className={`tok-${token.cls}`}>
          {token.text}
        </span>
      ))}
    </>
  );
});
