import { Fragment } from 'react';
import { kmPieces, markKmWords } from '@/lib/khmer-words';

/**
 * Shows a heading so Khmer wraps only between whole words (src/lib/khmer-words.ts):
 * each word is kept together and lines may break between words or at spaces.
 * Text without Khmer is shown exactly as it is. In client components, pass text
 * already marked on the server (markKmWords) so both sides render the same.
 */
export function KmWords({ text }: { text: string }) {
  const marked = markKmWords(text);
  if (!marked.includes('​')) return <>{text}</>;
  return (
    <>
      {kmPieces(marked).map((piece, i) => (
        /^\s+$/.test(piece)
          ? <Fragment key={i}>{piece}</Fragment>
          : <Fragment key={i}>{i > 0 && <wbr />}<span style={{ whiteSpace: 'nowrap' }}>{piece}</span></Fragment>
      ))}
    </>
  );
}
