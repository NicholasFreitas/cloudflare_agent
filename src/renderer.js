const form = document.querySelector('#analysis-form');
const text = document.querySelector('#article-text');
const count = document.querySelector('#character-count');
const button = document.querySelector('#analyze-button');
const buttonLabel = document.querySelector('#button-label');
const spinner = document.querySelector('#button-spinner');
const cancelButton = document.querySelector('#cancel-button');
const emptyState = document.querySelector('#empty-state');
const resultContent = document.querySelector('#result-content');
const errorState = document.querySelector('#error-state');
const resultState = document.querySelector('#result-state');
let activeRequestId = null;

text.addEventListener('input', () => {
  count.textContent = `${text.value.length.toLocaleString()} chars`;
});

function setLoading(loading) {
  button.disabled = loading;
  buttonLabel.textContent = loading ? 'Analyzing article' : 'Analyze threat';
  spinner.hidden = !loading;
  cancelButton.hidden = !loading;
  resultState.textContent = loading ? 'Processing' : 'Awaiting input';
}

function showError(message) {
  emptyState.hidden = true;
  resultContent.hidden = true;
  errorState.hidden = false;
  errorState.textContent = message;
  resultState.textContent = 'Needs attention';
}

function showResult(result) {
  const level = ['low', 'medium', 'high', 'critical'].includes(result.threatLevel) ? result.threatLevel : 'unknown';
  document.querySelector('#threat-level').textContent = level.toUpperCase();
  document.querySelector('#threat-level').dataset.level = level;
  document.querySelector('#breach-type').textContent = result.breachType || 'Not identified';
  document.querySelector('#responsible-party').textContent = result.reportedResponsibleParty || 'Not identified';
  document.querySelector('#article-authorship').textContent = result.articleAuthorship || 'Unknown';
  document.querySelector('#summary').textContent = result.summary || 'No summary returned.';
  document.querySelector('#reasoning').textContent = result.reasoning || 'No reasoning returned.';
  document.querySelector('#confidence').textContent = `Confidence: ${typeof result.confidence === 'number' ? `${Math.round(result.confidence * 100)}%` : 'Not provided'}`;
  const uncertainties = document.querySelector('#uncertainties');
  uncertainties.replaceChildren(...(Array.isArray(result.uncertainties) ? result.uncertainties : []).map((uncertainty) => {
    const item = document.createElement('li');
    item.textContent = uncertainty;
    return item;
  }));
  const signals = document.querySelector('#signals');
  signals.replaceChildren(...(Array.isArray(result.signals) ? result.signals : []).map((signal) => {
    const item = document.createElement('li');
    item.textContent = signal;
    return item;
  }));
  document.querySelector('.threat-banner').dataset.level = level;
  emptyState.hidden = true;
  errorState.hidden = true;
  resultContent.hidden = false;
  resultState.textContent = 'Complete';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!text.value.trim()) {
    showError('Paste article text before analyzing.');
    return;
  }
  setLoading(true);
  errorState.hidden = true;
  activeRequestId = crypto.randomUUID();
  try {
    const result = await window.threatDesk.summarize({
      text: text.value,
      requestId: activeRequestId
    });
    showResult(result);
  } catch (error) {
    if (error.message === 'Analysis canceled.') {
      resultState.textContent = 'Canceled';
    } else {
      showError(error.message || 'The analysis could not be completed.');
    }
  } finally {
    activeRequestId = null;
    setLoading(false);
  }
});

cancelButton.addEventListener('click', async () => {
  if (activeRequestId) {
    await window.threatDesk.cancelSummary(activeRequestId);
  }
});
