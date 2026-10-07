import Image from 'next/image';
import { photoUrl } from '@/lib/photo-url';

/** A snapshot photo, or a soft placeholder when there is none. */
export function Photo({ id, alt, height, size = 'large', label }: { id?: string | null; alt: string; height: number; size?: 'small' | 'large'; label?: string }) {
  return (
    <div className="photo" style={{ height }}>
      {id
        // eslint-disable-next-line @next/next/no-img-element -- snapshot photos are already sized and compressed by CC Livestock
        ? <img src={photoUrl(id, size)} alt={alt} loading="lazy" />
        : <Image src="/logo.png" alt="" aria-hidden="true" width={88} height={88} style={{ objectFit: 'contain', opacity: 0.22 }} title={label} />}
    </div>
  );
}
