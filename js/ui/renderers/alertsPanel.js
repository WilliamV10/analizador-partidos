/**
 * Lista de alertas automáticas del partido.
 */
import { TEXTS } from '../../texts.js';
import { h } from '../dom.js';

const ICONS = { warning: '⚠️', info: 'ℹ️' };

export function renderAlerts(alerts) {
  if (!alerts.length) return null;
  return h(
    'ul',
    { class: 'alerts', 'aria-label': 'Alertas' },
    alerts.map((alert) =>
      h(
        'li',
        { class: `alert alert--${alert.level}` },
        h('span', { class: 'alert__icon', 'aria-hidden': 'true' }, ICONS[alert.level] ?? ''),
        TEXTS.alerts[alert.code]?.(alert.params) ?? alert.code,
      ),
    ),
  );
}
