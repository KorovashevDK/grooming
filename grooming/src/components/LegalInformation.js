import PropTypes from 'prop-types';
import { LEGAL_DOCUMENTS, SALON_LEGAL_INFO } from '../legalDocuments';

export const LegalInformation = ({ compact = false }) => (
  <div className={`legal-info${compact ? ' legal-info-compact' : ''}`}>
    <div className="legal-info-head">
      <div className="legal-info-kicker">Правовая информация</div>
      <div className="legal-info-title">{SALON_LEGAL_INFO.name}</div>
      <div className="legal-info-text">
        Документы для работы сервиса с персональными данными, клиентскими записями и правилами оказания груминг-услуг.
      </div>
    </div>

    <div className="legal-info-list">
      {LEGAL_DOCUMENTS.map((document) => (
        <details key={document.id} className="legal-doc">
          <summary className="legal-doc-summary">
            <span className="legal-doc-title">{document.title}</span>
            <span className="legal-doc-arrow" aria-hidden="true" />
            <small>{document.basis}</small>
          </summary>
          <div className="legal-doc-body">
            <p>{document.summary}</p>
            <ul>
              {document.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  </div>
);

LegalInformation.propTypes = {
  compact: PropTypes.bool,
};
