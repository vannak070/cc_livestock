import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn() }));
const photos = vi.hoisted(() => ({ bytes: vi.fn() }));
const publisher = vi.hoisted(() => ({ publishSoon: vi.fn() }));
vi.mock('../../repositories/website', () => ({ websiteSiteImageRepository: repo, websitePhotoRepository: photos }));
vi.mock('./snapshot-publisher.service', () => ({ snapshotPublisherService: publisher }));

import { WebsiteSiteImageService } from './site-image.service';
import type { Actor } from '../../lib/authz';

const admin = { id: 'A', name: 'Ann', role: 'Admin', permissions: [] } as unknown as Actor;
const owner = { id: 'O', name: 'Owen', role: 'Farm Owner', permissions: [] } as unknown as Actor;
const service = new WebsiteSiteImageService();

describe('WebsiteSiteImageService', () => {
  beforeEach(() => { vi.clearAllMocks(); photos.bytes.mockResolvedValue({ mime: 'image/webp', data: Buffer.from('x') }); });

  it('puts an uploaded photo in a slot and publishes', async () => {
    await service.set(admin, 'team-group', 'PHOTO-1');
    expect(repo.set).toHaveBeenCalledWith('team-group', 'PHOTO-1', 'Ann');
    expect(publisher.publishSoon).toHaveBeenCalled();
  });

  it('goes back to the original', async () => {
    await service.set(admin, 'leader-1', null);
    expect(repo.clear).toHaveBeenCalledWith('leader-1');
  });

  it('refuses unknown slots, missing photos and non-admins', async () => {
    await expect(service.set(admin, 'logo', 'PHOTO-1')).rejects.toThrow(/not one the website has/);
    photos.bytes.mockResolvedValue(null);
    await expect(service.set(admin, 'farm-shed', 'PHOTO-X')).rejects.toThrow(/no longer there/);
    await expect(service.set(owner, 'farm-shed', null)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.set).not.toHaveBeenCalled();
    expect(repo.clear).not.toHaveBeenCalled();
  });
});
