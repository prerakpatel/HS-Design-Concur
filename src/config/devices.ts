/**
 * Phone frames used by the asset preview. Labels and logical sizes follow Figma's frame presets.
 * A reminder goes to Designers and Core Admins every 1 November to refresh this list
 * (see PRD §9.5). Update the four entries, commit, deploy — nothing else references model names.
 */
export interface DevicePreset { id: string; label: string; platform: "ios" | "android"; width: number; height: number; statusBar: number; }

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "iphone-pro", label: "iPhone 16 Pro", platform: "ios", width: 402, height: 874, statusBar: 62 },
  { id: "iphone-pro-max", label: "iPhone 16 Pro Max", platform: "ios", width: 440, height: 956, statusBar: 62 },
  { id: "android-compact", label: "Android Compact", platform: "android", width: 412, height: 917, statusBar: 48 },
  { id: "android-medium", label: "Android Medium", platform: "android", width: 700, height: 840, statusBar: 48 },
];

export const DEVICE_REFRESH_DAY = { month: 11, day: 1 };
