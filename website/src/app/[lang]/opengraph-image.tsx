import { OG_SIZE, shareImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'CamCow: every animal recorded, every farmer stronger';

export default async function Image() {
  return shareImage('Every animal recorded. Every farmer stronger.', 'Member farms, cattle available, and how to join.');
}
