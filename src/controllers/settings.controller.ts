import { Response } from 'express';
import { settingsService } from '../services/settings.service';
import { AuthedRequest } from '../middleware/auth.middleware';

// Both routes sit behind requireAuth, so req.actor is always set. Any signed-in
// user may read settings (the mobile app needs the farm list); what each one
// may change is decided section by section in settingsService.updateSettings.
export class SettingsController {
  async get(req: AuthedRequest, res: Response): Promise<void> {
    const settings = await settingsService.getSettingsFor(req.actor!);
    res.status(200).json({
      success: true,
      message: 'Settings retrieved successfully',
      data: settings
    });
  }

  async update(req: AuthedRequest, res: Response): Promise<void> {
    const updated = await settingsService.updateSettings(req.body, req.actor!);
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updated
    });
  }
}

export const settingsController = new SettingsController();
