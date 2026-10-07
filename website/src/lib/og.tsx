import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import { ImageResponse } from 'next/og';

/**
 * Share-preview images (Facebook, Telegram, messages): white and mint with
 * the logo, in the site's colours. Latin text only: the built-in image font
 * has no Khmer letters.
 */
export const OG_SIZE = { width: 1200, height: 630 };

let logo: string | null = null;
async function logoData(): Promise<string> {
  logo ??= `data:image/png;base64,${(await readFile(path.join(process.cwd(), 'public', 'logo.png'))).toString('base64')}`;
  return logo;
}

export async function shareImage(title: string, line: string): Promise<ImageResponse> {
  const src = await logoData();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff', padding: 64, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG, not shown in a page */}
          <img src={src} width={120} height={120} alt="" style={{ borderRadius: 60 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: '#12241a' }}>CamCow</div>
            <div style={{ fontSize: 26, color: '#0e6b34' }}>Cattle fattening network in Cambodia</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: '#12241a', lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 32, color: '#3b4a41' }}>{line}</div>
        </div>
        <div style={{ display: 'flex', height: 18, borderRadius: 9, background: '#eaf6ef' }}>
          <div style={{ width: 260, height: 18, borderRadius: 9, background: '#b32c33' }} />
        </div>
      </div>
    ),
    OG_SIZE
  );
}
