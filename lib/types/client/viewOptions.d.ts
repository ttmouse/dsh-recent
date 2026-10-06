/**
 * Persistence for the section's view options.
 *
 * A view option is a setting, not a look: unlike the section's folds — which
 * reset every time the column re-shows, because "expanded" is a state of the
 * moment — the choice to name each row's project survives reloads and browser
 * restarts. The sidebar column is browser-local chrome, so the browser's own
 * store is the right registry; the shell's account-level settings would carry
 * the choice across machines that never shared the list's look anyway.
 */
/**
 * Interpret one stored raw value. Only the exact string `'1'` counts as on:
 * anything else — absent, empty, corrupted — means the default, so a bad
 * stored value degrades to the quiet single-line list rather than getting
 * stuck showing a line the operator turned off.
 * @param raw - the raw stored value (null when the key is absent).
 * @returns whether the project line shows.
 */
export declare function parseStoredFlag(raw: string | null): boolean;
/**
 * Read the stored project-line choice.
 * @param store - the storage to read (the browser's local store, or a test double).
 * @returns whether the project line shows.
 */
export declare function loadShowWorkspace(store?: Pick<Storage, 'getItem'>): boolean;
/**
 * Store the project-line choice. A failed write (private mode, quota) is not
 * an error the section can act on — the choice still holds for this visit.
 * @param value - whether the project line should show.
 * @param store - the storage to write (the browser's local store, or a test double).
 */
export declare function saveShowWorkspace(value: boolean, store?: Pick<Storage, 'setItem'>): void;
//# sourceMappingURL=viewOptions.d.ts.map