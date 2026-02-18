import { useState, useEffect } from 'react';
import { getLayout, saveLayout } from './api/configApi';
import ModuleGrid from './components/ModuleGrid';
import type { LayoutData, LayoutProfile } from './types';
import type { Layout } from 'react-grid-layout';
import styles from './App.module.css';

export default function App() {
  const [layoutData, setLayoutData] = useState<LayoutData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLayout()
      .then(setLayoutData)
      .catch((err) => setError(`Failed to load layout: ${err.message}`));
  }, []);

  const activeProfile: LayoutProfile | null = layoutData
    ? (layoutData.layouts[layoutData.activeProfile] ?? null)
    : null;

  const handleLayoutChange = async (layout: Layout[]) => {
    if (!layoutData || !activeProfile) return;

    const updatedProfile: LayoutProfile = {
      ...activeProfile,
      grid: layout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      })),
    };

    const updatedData: LayoutData = {
      ...layoutData,
      layouts: {
        ...layoutData.layouts,
        [layoutData.activeProfile]: updatedProfile,
      },
    };

    setLayoutData(updatedData);
    try {
      await saveLayout(updatedData);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!layoutData || !activeProfile) {
    return <div className={styles.loadingState}>Loading OzMirror...</div>;
  }

  return (
    <div className={`${styles.app} ${editMode ? styles.editModeApp : ''}`}>
      <header className={`${styles.header} ${editMode ? styles.headerVisible : ''}`}>
        <span className={styles.appName}>OzMirror</span>
        <button
          className={`${styles.editBtn} ${editMode ? styles.editBtnActive : ''}`}
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? 'Done' : 'Edit Layout'}
        </button>
      </header>

      <main className={styles.main}>
        <ModuleGrid
          profile={activeProfile}
          editMode={editMode}
          onLayoutChange={handleLayoutChange}
        />
      </main>
    </div>
  );
}
