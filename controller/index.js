import gSheetController from './gsheet.controller'
import viewController from './view.controller'
import clientController from './client.controller'
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
    clientController
}