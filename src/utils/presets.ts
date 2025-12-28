import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ProjectConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.nod-cli');
const PRESETS_FILE = path.join(CONFIG_DIR, 'presets.json');

export interface CustomPreset {
  name: string;
  description?: string;
  config: Partial<ProjectConfig>;
  createdAt: string;
  updatedAt: string;
}

export interface PresetsConfig {
  defaultPreset?: string;
  presets: Record<string, CustomPreset>;
}

// Built-in presets that cannot be overwritten
const BUILTIN_PRESETS = ['minimal', 'api', 'full', 'ai', 'custom'];

async function ensureConfigDir(): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
}

export async function loadPresetsConfig(): Promise<PresetsConfig> {
  await ensureConfigDir();
  
  if (await fs.pathExists(PRESETS_FILE)) {
    try {
      return await fs.readJson(PRESETS_FILE);
    } catch {
      return { presets: {} };
    }
  }
  
  return { presets: {} };
}

export async function savePresetsConfig(config: PresetsConfig): Promise<void> {
  await ensureConfigDir();
  await fs.writeJson(PRESETS_FILE, config, { spaces: 2 });
}

export async function savePreset(name: string, config: Partial<ProjectConfig>, description?: string): Promise<void> {
  if (BUILTIN_PRESETS.includes(name.toLowerCase())) {
    throw new Error(`Cannot overwrite built-in preset: ${name}`);
  }
  
  const presetsConfig = await loadPresetsConfig();
  const now = new Date().toISOString();
  
  presetsConfig.presets[name] = {
    name,
    description,
    config,
    createdAt: presetsConfig.presets[name]?.createdAt || now,
    updatedAt: now,
  };
  
  await savePresetsConfig(presetsConfig);
}

export async function deletePreset(name: string): Promise<boolean> {
  if (BUILTIN_PRESETS.includes(name.toLowerCase())) {
    throw new Error(`Cannot delete built-in preset: ${name}`);
  }
  
  const presetsConfig = await loadPresetsConfig();
  
  if (!presetsConfig.presets[name]) {
    return false;
  }
  
  delete presetsConfig.presets[name];
  
  // Clear default if it was this preset
  if (presetsConfig.defaultPreset === name) {
    delete presetsConfig.defaultPreset;
  }
  
  await savePresetsConfig(presetsConfig);
  return true;
}

export async function getPreset(name: string): Promise<CustomPreset | null> {
  const presetsConfig = await loadPresetsConfig();
  return presetsConfig.presets[name] || null;
}

export async function listPresets(): Promise<CustomPreset[]> {
  const presetsConfig = await loadPresetsConfig();
  return Object.values(presetsConfig.presets);
}

export async function setDefaultPreset(name: string | null): Promise<void> {
  const presetsConfig = await loadPresetsConfig();
  
  if (name === null) {
    delete presetsConfig.defaultPreset;
  } else {
    // Verify preset exists (either built-in or custom)
    const isBuiltin = BUILTIN_PRESETS.includes(name.toLowerCase()) || name === '1';
    const isCustom = !!presetsConfig.presets[name];
    
    if (!isBuiltin && !isCustom) {
      throw new Error(`Preset not found: ${name}`);
    }
    
    presetsConfig.defaultPreset = name;
  }
  
  await savePresetsConfig(presetsConfig);
}

export async function getDefaultPreset(): Promise<string | null> {
  const presetsConfig = await loadPresetsConfig();
  return presetsConfig.defaultPreset || null;
}

export function isBuiltinPreset(name: string): boolean {
  return BUILTIN_PRESETS.includes(name.toLowerCase()) || name === '1';
}

export function getBuiltinPresets(): string[] {
  return [...BUILTIN_PRESETS, '1'];
}
