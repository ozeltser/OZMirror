/**
 * SettingsPanel — slide-in right-side drawer for global settings.
 * Sections: Display (theme, font scale, kiosk), Layout (profiles), System (status).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useConfig } from '../../hooks/useConfig';
import { useLayout } from '../../hooks/useLayout';
import { fetchProfiles, createProfile, deleteProfile } from '../../api/config';
import { applyTheme } from '../../utils/theme';
import styles from './SettingsPanel.module.css';

const THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'amoled', label: 'AMOLED' },
];

type TabId = 'display' | 'layout' | 'system';

const SettingsPanel: React.FC = () => {
  const { isSettingsPanelOpen, closeSettingsPanel, wsConnected } = useAppStore();
  const { settings, updateSettings } = useConfig();
  const { layout, switchProfile } = useLayout();

  const [activeTab, setActiveTab] = useState<TabId>('display');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [creating, setCreating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load profiles when layout tab is opened
  useEffect(() => {
    if (!isSettingsPanelOpen || activeTab !== 'layout') return;
    setProfilesLoading(true);
    fetchProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, [isSettingsPanelOpen, activeTab]);

  // Close on Escape key
  useEffect(() => {
    if (!isSettingsPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettingsPanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSettingsPanelOpen, closeSettingsPanel]);

  if (!isSettingsPanelOpen) return null;

  const handleThemeChange = async (theme: string) => {
    if (!settings) return;
    applyTheme(theme);
    await updateSettings({ ...settings, theme });
  };

  const handleFontScaleChange = async (fontScale: number) => {
    if (!settings) return;
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
    await updateSettings({ ...settings, fontScale });
  };

  const handleKioskToggle = async () => {
    if (!settings) return;
    await updateSettings({ ...settings, kiosk: !settings.kiosk });
  };

  const handleSwitchProfile = async (name: string) => {
    await switchProfile(name);
  };

  const handleCreateProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createProfile(name, layout?.activeProfile ?? 'default');
      const updated = await fetchProfiles();
      setProfiles(updated);
      setNewProfileName('');
    } catch {
      // ignore — profile may already exist
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    try {
      await deleteProfile(name);
      setProfiles((prev) => prev.filter((p) => p !== name));
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={closeSettingsPanel} />
      <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Settings">
        <div className={styles.header}>
          <span>Settings</span>
          <button className={styles.closeBtn} onClick={closeSettingsPanel} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          {(['display', 'layout', 'system'] as TabId[]).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {/* --- Display Tab --- */}
          {activeTab === 'display' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Theme</div>
              <div className={styles.themeGroup}>
                {THEMES.map((t) => (
                  <label key={t.id} className={styles.themeOption}>
                    <input
                      type="radio"
                      name="theme"
                      value={t.id}
                      checked={settings?.theme === t.id}
                      onChange={() => handleThemeChange(t.id)}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>

              <div className={styles.sectionTitle} style={{ marginTop: 20 }}>Font Scale</div>
              <div className={styles.row}>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={settings?.fontScale ?? 1}
                  onChange={(e) => handleFontScaleChange(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{((settings?.fontScale ?? 1) * 100).toFixed(0)}%</span>
              </div>

              <div className={styles.sectionTitle} style={{ marginTop: 20 }}>Kiosk Mode</div>
              <label className={styles.toggleRow}>
                <span className={styles.toggleLabel}>Hide cursor after 3 s inactivity</span>
                <input
                  type="checkbox"
                  checked={settings?.kiosk ?? false}
                  onChange={handleKioskToggle}
                  className={styles.checkbox}
                />
              </label>
            </div>
          )}

          {/* --- Layout Tab --- */}
          {activeTab === 'layout' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Active Profile</div>
              {profilesLoading ? (
                <div className={styles.statusText}>Loading profiles…</div>
              ) : (
                <div className={styles.profileList}>
                  {profiles.map((name) => (
                    <div
                      key={name}
                      className={`${styles.profileRow} ${layout?.activeProfile === name ? styles.activeProfile : ''}`}
                    >
                      <button
                        className={styles.profileBtn}
                        onClick={() => handleSwitchProfile(name)}
                        disabled={layout?.activeProfile === name}
                      >
                        {layout?.activeProfile === name ? '✓ ' : ''}{name}
                      </button>
                      {name !== 'default' && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteProfile(name)}
                          title={`Delete profile "${name}"`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.sectionTitle} style={{ marginTop: 20 }}>New Profile</div>
              <div className={styles.row}>
                <input
                  type="text"
                  className={styles.textInput}
                  placeholder="Profile name…"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProfile(); }}
                  maxLength={40}
                />
                <button
                  className={styles.createBtn}
                  onClick={handleCreateProfile}
                  disabled={creating || !newProfileName.trim()}
                >
                  {creating ? '…' : 'Create'}
                </button>
              </div>
              <div className={styles.hint}>
                New profiles start as a copy of the current profile.
              </div>
            </div>
          )}

          {/* --- System Tab --- */}
          {activeTab === 'system' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Status</div>
              <div className={styles.statusRow}>
                <span>WebSocket</span>
                <span
                  className={styles.badge}
                  data-online={wsConnected ? 'true' : 'false'}
                >
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className={styles.sectionTitle} style={{ marginTop: 20 }}>Shortcuts</div>
              <div className={styles.shortcutList}>
                <div className={styles.shortcutRow}><kbd>E</kbd> Toggle edit mode</div>
                <div className={styles.shortcutRow}><kbd>F</kbd> Toggle fullscreen</div>
                <div className={styles.shortcutRow}><kbd>Esc</kbd> Exit edit mode</div>
                <div className={styles.shortcutRow}><kbd>Ctrl+S</kbd> Force save layout</div>
                <div className={styles.shortcutRow}><kbd>Ctrl+,</kbd> Open settings</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
