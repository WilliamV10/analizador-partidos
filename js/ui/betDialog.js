/**
 * Diálogo "Registrar apuesta": cuota tomada y monto. Recuerda el último monto usado.
 */
import { TEXTS } from '../texts.js';
import { h, replaceContent } from './dom.js';
import { readPreference, writePreference } from './preferences.js';

const LAST_STAKE_KEY = 'analizador.lastStake';
const MIN_ODDS = 1.01;

/**
 * @param {HTMLDialogElement} dialog
 * @param {{ defaultStake: number }} options
 */
export function bindBetDialog(dialog, { defaultStake }) {
  const pickBox = dialog.querySelector('[data-bet-pick]');
  const oddsInput = dialog.querySelector('[data-bet-odds]');
  const stakeInput = dialog.querySelector('[data-bet-stake]');
  const removeButton = dialog.querySelector('[data-bet-remove]');
  let handlers = null;

  dialog.querySelector('[data-bet-save]').addEventListener('click', () => {
    const odds = Number(oddsInput.value);
    const stake = Number(stakeInput.value);
    if (!(odds >= MIN_ODDS) || !(stake > 0)) {
      (odds >= MIN_ODDS ? stakeInput : oddsInput).reportValidity();
      return;
    }
    writePreference(LAST_STAKE_KEY, String(stake));
    handlers?.onSave({ odds, stake });
    dialog.close();
  });

  removeButton.addEventListener('click', () => {
    handlers?.onRemove();
    dialog.close();
  });

  return {
    /**
     * @param {{ matchTitle: string, market: string, selection: string, odds: number, bet: { odds: number, stake: number }|null }} pick
     * @param {{ onSave: (bet: { odds: number, stake: number }) => void, onRemove: () => void }} callbacks
     */
    open(pick, callbacks) {
      handlers = callbacks;
      replaceContent(
        pickBox,
        h('span', { class: 'note' }, `${pick.matchTitle} · ${pick.market}`),
        h('strong', {}, pick.selection),
      );
      oddsInput.value = (pick.bet?.odds ?? pick.odds).toFixed(2);
      stakeInput.value = String(pick.bet?.stake ?? readPreference(LAST_STAKE_KEY, String(defaultStake)));
      removeButton.hidden = !pick.bet;
      dialog.querySelector('#bet-title').textContent = pick.bet ? TEXTS.bets.editTitle : TEXTS.bets.newTitle;
      dialog.showModal();
    },
  };
}
