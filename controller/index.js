import gSheetController from './gsheet.controller'
import viewController from './view.controller'
import pm2Controller from './pm2.controller'
import {
    getReceivers,
    sendReceivers,
    sendImage,
    sendAudio,
    getStatus,
    processContacts,
} from './wabot.controller'


export {
    getReceivers,
    sendReceivers,
    sendImage,
    sendAudio,
    getStatus,
    processContacts,
    gSheetController,
    viewController,
    pm2Controller
}