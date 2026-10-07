'use client';

import { useState } from 'react';
import { Photo } from '@/components/shared/Photo';
import Image from 'next/image';
import { photoUrl } from '@/lib/photo-url';

/** The farm's photos: one large picture and a row of small ones to choose from. */
export function ProfileGallery({ ids, alt, label }: { ids: string[]; alt: string; label: string }) {
  const [i, setI] = useState(0);
  if (ids.length === 0) return <Photo id={null} alt={alt} height={380} />;
  return (
    <div className="gal">
      <div className="gal-main">
        <Image key={ids[i]} src={photoUrl(ids[i], 'large')} alt={alt} fill sizes="(max-width: 900px) calc(100vw - 48px), 480px" preload={i === 0} />
      </div>
      {ids.length > 1 && (
        <div className="gal-thumbs">
          {ids.map((id, k) => (
            <button key={id} type="button" className={k === i ? 'on' : ''} aria-label={`${label} ${k + 1}`} aria-current={k === i} onClick={() => setI(k)}>
              <Image src={photoUrl(id, 'small')} alt="" width={84} height={64} sizes="84px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
