// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const CODEX_CTRL_L_ACTION_ID = 'codex.ctrlLAction'

export const CODEX_CTRL_K_ACTION_ID = 'codex.ctrlKAction'

export const CODEX_ACCEPT_DIFF_ACTION_ID = 'codex.acceptDiff'

export const CODEX_REJECT_DIFF_ACTION_ID = 'codex.rejectDiff'

export const CODEX_GOTO_NEXT_DIFF_ACTION_ID = 'codex.goToNextDiff'

export const CODEX_GOTO_PREV_DIFF_ACTION_ID = 'codex.goToPrevDiff'

export const CODEX_GOTO_NEXT_URI_ACTION_ID = 'codex.goToNextUri'

export const CODEX_GOTO_PREV_URI_ACTION_ID = 'codex.goToPrevUri'

export const CODEX_ACCEPT_FILE_ACTION_ID = 'codex.acceptFile'

export const CODEX_REJECT_FILE_ACTION_ID = 'codex.rejectFile'

export const CODEX_ACCEPT_ALL_DIFFS_ACTION_ID = 'codex.acceptAllDiffs'

export const CODEX_REJECT_ALL_DIFFS_ACTION_ID = 'codex.rejectAllDiffs'
