import React from 'react';
import styles from './EditToolbar.module.css';
import { useAppStore } from '../../store/appStore';

const EditToolbar: React.FC = () => {
  const { isEditMode, toggleEditMode, toggleModulePicker } = useAppStore();

  if (!isEditMode) return null;

  return (
    <div className={styles.toolbar}>
      <span className={styles.label}>Edit Mode</span>
      <button className={styles.btn} onClick={toggleModulePicker}>
        + Add Module
      </button>
      <button className={`${styles.btn} ${styles.activeBtn}`} onClick={toggleEditMode}>
        Done
      </button>
    </div>
  );
};

export default EditToolbar;
