/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register quick edit (Ctrl+K)
import './quickEditActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './codexSettingsPane.js'

// register css
// import './media/codex.css'

// update (frontend part, also see platform/)
import './codexUpdateActions.js'

import './convertToLLMMessageWorkbenchContrib.js'


// tools
import './terminalToolService.js'
import './toolsService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './codexSelectionHelperWidget.js'

// register tooltip service
import './tooltipService.js'


// register misc service
import './miscWokrbenchContrib.js'


// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './codexSCMService.js'

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// codexSettings
import '../common/codexSettingsService.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/codexUpdateService.js'

// model service
import '../common/codexModelService.js'
