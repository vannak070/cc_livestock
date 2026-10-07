import Image from 'next/image';
import { photoUrl } from '@/lib/photo-url';

/**
 * A snapshot photo, or a soft placeholder when there is none. Photos go
 * through the Next image resizer (next.config.ts images.localPatterns), so a
 * phone gets a copy sized for its screen; `sizes` says how wide it shows and
 * `priority` loads it first (for the first photo a visitor sees).
 */
export function Photo({ id, alt, height, size = 'large', label, priority = false, sizes = '(max-width: 760px) calc(100vw - 48px), 600px' }: {
  id?: string | null; alt: string; height: number; size?: 'small' | 'large'; label?: string; priority?: boolean; sizes?: string;
}) {
  return (
    <div className="photo" style={{ height, position: 'relative' }}>
      {id
        ? <Image src={photoUrl(id, size)} alt={alt} fill sizes={size === 'small' ? '200px' : sizes} preload={priority} loading={priority ? 'eager' : 'lazy'} style={{ objectFit: 'cover' }} />
        : <Image src="/logo.png" alt="" aria-hidden="true" width={88} height={88} style={{ objectFit: 'contain', opacity: 0.22 }} title={label} />}
    </div>
  );
}
