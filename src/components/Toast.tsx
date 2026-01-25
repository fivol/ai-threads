/**
 * Toast notification component for errors
 */

import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import { IconClose } from './Icons';

export const Toast = observer(function Toast() {
  const { threadsStore, settingsStore } = useStores();
  
  const error = threadsStore.error || settingsStore.error;
  
  if (!error) return null;
  
  const handleClose = () => {
    threadsStore.clearError();
    settingsStore.clearError();
  };
  
  return (
    <div className="toast">
      <span>{error}</span>
      <button className="toast-close" onClick={handleClose}>
        <IconClose />
      </button>
    </div>
  );
});
