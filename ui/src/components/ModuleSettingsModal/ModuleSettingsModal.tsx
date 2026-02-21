/**
 * Per-module settings modal.
 *
 * Auto-generates a form from the module's JSON-Schema `configSchema` when
 * available, falling back to a raw JSON textarea editor otherwise.
 *
 * Rendered as a React portal so it sits above the grid layout.
 */

import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import styles from './ModuleSettingsModal.module.css';
import { useAppStore } from '../../store/appStore';
import { fetchInstanceConfig, updateInstanceConfig } from '../../api/config';

// ---------------------------------------------------------------------------
// Types local to this component
// ---------------------------------------------------------------------------

interface SchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
}

interface Props {
  instanceId: string;
  moduleId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ModuleSettingsModal: React.FC<Props> = ({ instanceId, moduleId, onClose }) => {
  const modules = useAppStore((s) => s.modules);
  const layout = useAppStore((s) => s.layout);
  const setLayout = useAppStore((s) => s.setLayout);

  // Locate the module manifest & its configSchema
  const registeredModule = modules.find((m) => m.id === moduleId);
  const configSchema = registeredModule?.manifest?.configSchema as
    | { properties?: Record<string, SchemaProperty> }
    | undefined;
  const schemaProperties = configSchema?.properties;
  const hasSchema = schemaProperties && Object.keys(schemaProperties).length > 0;

  // ---- state ----
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [jsonText, setJsonText] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Load current config on mount ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchInstanceConfig(moduleId, instanceId)
      .then((data) => {
        if (cancelled) return;
        setFormValues(data);
        setJsonText(JSON.stringify(data, null, 2));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load config');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId, instanceId]);

  // ---- Handlers ----

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      setFormValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON');
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      let configToSave: Record<string, unknown>;

      if (hasSchema) {
        configToSave = { ...formValues };
      } else {
        try {
          configToSave = JSON.parse(jsonText) as Record<string, unknown>;
        } catch {
          setError('Cannot save — the JSON is invalid.');
          setSaving(false);
          return;
        }
      }

      // Persist to remote
      await updateInstanceConfig(moduleId, instanceId, configToSave);

      // Update local layout store so the widget reflects changes immediately
      if (layout) {
        const profile = layout.layouts[layout.activeProfile];
        if (profile) {
          const updatedModuleConfigs = { ...profile.moduleConfigs };
          const existing = updatedModuleConfigs[instanceId];
          if (existing) {
            updatedModuleConfigs[instanceId] = {
              ...existing,
              config: configToSave,
            };
          }
          setLayout({
            ...layout,
            layouts: {
              ...layout.layouts,
              [layout.activeProfile]: {
                ...profile,
                moduleConfigs: updatedModuleConfigs,
              },
            },
          });
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  }, [hasSchema, formValues, jsonText, moduleId, instanceId, layout, setLayout, onClose]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close when clicking backdrop
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // ---- Render helpers ----

  const renderSchemaForm = () => {
    if (!schemaProperties) return null;

    return Object.entries(schemaProperties).map(([key, prop]) => {
      const value = formValues[key] ?? prop.default ?? '';
      const label = prop.description || key;

      if (prop.type === 'boolean') {
        return (
          <div className={styles.field} key={key}>
            <div className={styles.checkboxRow}>
              <input
                id={`field-${key}`}
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(value)}
                onChange={(e) => handleFieldChange(key, e.target.checked)}
              />
              <label htmlFor={`field-${key}`} className={styles.checkboxLabel}>
                {label}
              </label>
            </div>
          </div>
        );
      }

      if (prop.type === 'number') {
        return (
          <div className={styles.field} key={key}>
            <label htmlFor={`field-${key}`} className={styles.label}>
              {label}
            </label>
            <input
              id={`field-${key}`}
              type="number"
              className={styles.input}
              value={value as number}
              placeholder={prop.default !== undefined ? String(prop.default) : undefined}
              onChange={(e) => handleFieldChange(key, e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        );
      }

      // Default: string
      return (
        <div className={styles.field} key={key}>
          <label htmlFor={`field-${key}`} className={styles.label}>
            {label}
          </label>
          <input
            id={`field-${key}`}
            type="text"
            className={styles.input}
            value={value as string}
            placeholder={prop.default !== undefined ? String(prop.default) : undefined}
            onChange={(e) => handleFieldChange(key, e.target.value)}
          />
        </div>
      );
    });
  };

  const renderJsonFallback = () => (
    <div className={styles.field}>
      <label className={styles.label}>Configuration (JSON)</label>
      <textarea
        className={styles.textarea}
        value={jsonText}
        onChange={handleJsonChange}
      />
      {jsonError && <div className={styles.jsonError}>{jsonError}</div>}
    </div>
  );

  // ---- Portal render ----

  const moduleName = registeredModule?.manifest?.name || moduleId;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{moduleName} Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <div className={styles.loading}>Loading configuration...</div>
          ) : hasSchema ? (
            renderSchemaForm()
          ) : (
            renderJsonFallback()
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className={styles.footer}>
            <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>
              Cancel
            </button>
            <button
              className={`${styles.btn} ${styles.btnSave}`}
              onClick={handleSave}
              disabled={saving || (!!jsonError && !hasSchema)}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ModuleSettingsModal;
