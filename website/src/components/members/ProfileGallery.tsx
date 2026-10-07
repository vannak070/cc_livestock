'use client';

import { useState } from 'react';
import { Photo } from '@/components/shared/Photo';
import { photoUrl } from '@/lib/photo-url';

/** The farm's photos: one large picture and a row of small ones to choose from. */
export function ProfileGallery({ ids, alt, label }: { ids: string[]; alt: string; label: string }) {
  const [i, setI] = useState(0);
  if (ids.length === 0) return <Photo id={null} alt={alt} height={380} />;
  return (
    <div className="gal">
      <div className="gal-main">
        {/* eslint-disable-next-line @next/next/no-img-element -- snapshot photos are already sized and compressed by CC Livestock */}
        <img key={ids[i]} src={photoUrl(ids[i], 'large')} alt={alt} />
      </div>
      {ids.length > 1 && (
        <div className="gal-thumbs">
          {ids.map((id, k) => (
            <button key={id} type="button" className={k === i ? 'on' : ''} aria-label={`${label} ${k + 1}`} aria-current={k === i} onClick={() => setI(k)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
              <img src={photoUrl(id, 'small')} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
