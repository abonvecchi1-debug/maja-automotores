// ── Resolución de conflictos del PUSH (compartida por la ruta y los tests) ──
//
// Regla: gana el `rev` más alto. El `rev` lo asigna EL SERVIDOR en cada push
// aceptado (rev_actual + 1), así es una versión monótona que NO depende del reloj
// de ningún dispositivo. El `updated_at` (reloj del que escribió) solo se usa para
// dos cosas: (a) detectar que realmente hubo un cambio nuevo (y no re-aplicar un eco
// idéntico), y (b) desempatar cuando el `rev` entrante es igual al actual.
//
// Por qué arregla el bug del reloj: una edición basada en una versión vieja (rev más
// bajo que el actual) se RECHAZA aunque su `updated_at` sea mayor (reloj adelantado).
// El cliente rechazado vuelve a bajar la versión ganadora en el próximo pull y converge
// (nunca más queda pisado en forma permanente).
//
// Retrocompatibilidad: si el registro entrante no trae `rev` (cliente viejo) se cae al
// comportamiento anterior (LWW por `updated_at`), para no romper durante el rollout.

/**
 * Aplica un lote de registros de una tabla con resolución por `rev`.
 * @returns {number} cantidad de registros efectivamente insertados/actualizados.
 */
export function applyPushRecords(db, table, columns, records, serverNow) {
  const hasServerCol = columns.includes('server_updated_at');
  const hasRev = columns.includes('rev');
  // Columnas que sella el servidor (no vienen del cliente).
  const dataCols = columns.filter((c) => c !== 'server_updated_at' && c !== 'rev');

  const getExisting = db.prepare(`SELECT updated_at, rev FROM ${table} WHERE id = ?`);

  const insertCols = [...dataCols, ...(hasRev ? ['rev'] : []), ...(hasServerCol ? ['server_updated_at'] : [])];
  const insertStmt = db.prepare(
    `INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${insertCols.map((c) => '@' + c).join(', ')})`
  );
  const updSetCols = [...dataCols.filter((c) => c !== 'id'), ...(hasRev ? ['rev'] : []), ...(hasServerCol ? ['server_updated_at'] : [])];
  const updateStmt = db.prepare(
    `UPDATE ${table} SET ${updSetCols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`
  );

  let count = 0;
  for (const record of records) {
    const safe = {};
    for (const col of dataCols) safe[col] = record[col] ?? null;
    if (hasServerCol) safe.server_updated_at = serverNow;

    const incomingRev = hasRev && record.rev != null ? Number(record.rev) : null; // null = cliente viejo
    const existing = getExisting.get(record.id);

    if (!existing) {
      // Registro nuevo → arranca en rev 1 (o el que traiga el cliente si es mayor).
      if (hasRev) safe.rev = incomingRev && incomingRev > 0 ? incomingRev : 1;
      insertStmt.run(safe);
      count++;
      continue;
    }

    const existingRev = existing.rev ?? 0;
    const incomingUa = record.updated_at || '';
    const existingUa = existing.updated_at || '';
    // Anti-eco: si el timestamp es idéntico es la MISMA versión reenviada → no re-aplicar
    // (evita ping-pong). Ojo: se compara por IGUALDAD, no por "más nuevo", porque una PC
    // con el reloj atrasado genera un updated_at menor y aun así su cambio es válido.
    const notEcho = incomingUa !== existingUa;
    // Conflicto: se decide por `rev` (versión del servidor), NO por reloj. Una edición
    // basada en una versión vieja (rev menor al actual) se rechaza aunque su reloj esté
    // adelantado. Cliente viejo (sin rev) → LWW por updated_at, como antes.
    const accept = incomingRev == null
      ? incomingUa > existingUa
      : (incomingRev >= existingRev && notEcho);

    if (accept) {
      if (hasRev) safe.rev = existingRev + 1; // el servidor incrementa la versión
      updateStmt.run(safe);
      count++;
    }
    // si no: conflicto/stale/eco → se rechaza. El cliente lo re-baja en el próximo pull.
  }
  return count;
}
