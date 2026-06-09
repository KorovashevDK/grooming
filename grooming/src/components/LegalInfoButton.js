import { useState } from 'react';
import { LegalInformation } from './LegalInformation';

export const LegalInfoButton = () => {
  const [showLegalInfo, setShowLegalInfo] = useState(false);

  return (
    <div className="legal-info-anchor">
      <button
        type="button"
        className="legal-info-trigger"
        aria-label="Правовая информация"
        title="Правовая информация"
        onClick={() => setShowLegalInfo((prev) => !prev)}
      >
        i
      </button>

      {showLegalInfo ? (
        <div className="legal-info-popover" role="dialog" aria-label="Правовая информация">
          <div className="legal-info-popover-head">
            <span>Правовая информация</span>
            <button
              type="button"
              className="legal-info-close"
              aria-label="Закрыть правовую информацию"
              onClick={() => setShowLegalInfo(false)}
            >
              ×
            </button>
          </div>
          <LegalInformation />
        </div>
      ) : null}
    </div>
  );
};
