/* =============================================================================
   Audit trail. Every write that a person could later dispute gets a row here:
   who, what, when, from where. Money and patient records especially.
   ========================================================================== */

import { run, all } from '../db.js';
import { clientIp } from './http.js';

export function log(req, action, entity = null, entityId = null, detail = null) {
  try {
    run(
      `INSERT INTO activity_log (user_id, action, entity, entity_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      req.user?.id ?? null, action, entity, entityId,
      detail == null ? null : JSON.stringify(detail), clientIp(req)
    );
  } catch {
    /* An audit failure must never take down the operation being audited. */
  }
}

export const recent = (limit = 100) => all(
  `SELECT a.*, u.name AS user_name
     FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?`,
  Math.min(Number(limit) || 100, 500)
);
