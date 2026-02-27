/*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Router } from 'express';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';

import uploadConfig from '../config/upload';
import * as CatalogController from '../controller/catalogController';
import * as CommunityController from '../controller/communityController';
import ContactController from '../controller/contactController';
import * as DeviceController from '../controller/deviceController';
import * as GroupController from '../controller/groupController';
import * as LabelsController from '../controller/labelsController';
import * as MessageController from '../controller/messageController';
import * as MiscController from '../controller/miscController';
import * as NewsletterController from '../controller/newsletterController';
import * as OrderController from '../controller/orderController';
import * as ScheduleController from '../controller/scheduleController';
import * as SessionController from '../controller/sessionController';
import * as StatusController from '../controller/statusController';
import setSession from '../middleware/auth';
import * as HealthCheck from '../middleware/healthCheck';
import * as prometheusRegister from '../middleware/instrumentation';
import statusConnection from '../middleware/statusConnection';
import swaggerDocument from '../swagger.json';
import { transformMessageIds } from '../util/messageUtils';

const upload = multer(uploadConfig as any) as any;
const routes: Router = Router();

// Middleware to transform message ids in all JSON responses
routes.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function (this: any, body?: any) {
    try {
      const transformed = transformMessageIds(body);
      return oldJson.call(this, transformed);
    } catch (e) {
      return oldJson.call(this, body);
    }
  } as any;
  next();
});

// All Sessions
routes.get(
  '/api/show-all-sessions',
  SessionController.showAllSessions
);
routes.post('/api/start-all', SessionController.startAllSessions);

// Sessions
routes.get(
  '/api/:session/check-connection-session',
  setSession,
  SessionController.checkConnectionSession
);
routes.get(
  '/api/:session/get-media-by-message/:messageId',
  setSession,
  SessionController.getMediaByMessage
);
routes.get(
  '/api/:session/get-platform-from-message/:messageId',
  setSession,
  DeviceController.getPlatformFromMessage
);
routes.get(
  '/api/:session/qrcode-session',
  setSession,
  SessionController.getQrCode
);
routes.post(
  '/api/:session/start-session',
  setSession,
  SessionController.startSession
);
routes.post(
  '/api/:session/logout-session',
  setSession,
  statusConnection,
  SessionController.logOutSession
);
routes.post(
  '/api/:session/clear-session-data',
  MiscController.clearSessionData
);
routes.post(
  '/api/:session/close-session',
  setSession,
  SessionController.closeSession
);
routes.post(
  '/api/:session/subscribe-presence',
  setSession,
  SessionController.subscribePresence
);
routes.post(
  '/api/:session/set-online-presence',
  setSession,
  SessionController.setOnlinePresence
);
routes.post(
  '/api/:session/download-media',
  setSession,
  statusConnection,
  SessionController.downloadMediaByMessage
);

// Messages
routes.post(
  '/api/:session/send-message',
  setSession,
  statusConnection,
  MessageController.sendMessage
);
routes.post(
  '/api/:session/edit-message',
  setSession,
  statusConnection,
  MessageController.editMessage
);
routes.post(
  '/api/:session/send-image',
  upload.single('file'),
  setSession,
  statusConnection,
  MessageController.sendFile
);
routes.post(
  '/api/:session/send-sticker',
  upload.single('file'),
  setSession,
  statusConnection,
  MessageController.sendImageAsSticker
);
routes.post(
  '/api/:session/send-sticker-gif',
  upload.single('file'),
  setSession,
  statusConnection,
  MessageController.sendImageAsStickerGif
);
routes.post(
  '/api/:session/send-reply',
  setSession,
  statusConnection,
  MessageController.replyMessage
);
routes.post(
  '/api/:session/send-file',
  upload.single('file'),
  setSession,
  statusConnection,
  MessageController.sendFile
);
routes.post(
  '/api/:session/send-file-base64',
  setSession,
  statusConnection,
  MessageController.sendFile
);
routes.post(
  '/api/:session/send-voice',
  setSession,
  statusConnection,
  MessageController.sendVoice
);
routes.post(
  '/api/:session/send-voice-base64',
  setSession,
  statusConnection,
  MessageController.sendVoice64
);
routes.get(
  '/api/:session/status-session',
  setSession,
  SessionController.getSessionState
);
routes.post(
  '/api/:session/send-status',
  setSession,
  statusConnection,
  MessageController.sendStatusText
);
routes.post(
  '/api/:session/send-link-preview',
  setSession,
  statusConnection,
  MessageController.sendLinkPreview
);
routes.post(
  '/api/:session/send-location',
  setSession,
  statusConnection,
  MessageController.sendLocation
);
routes.post(
  '/api/:session/send-mentioned',
  setSession,
  statusConnection,
  MessageController.sendMentioned
);
routes.post(
  '/api/:session/send-buttons',
  setSession,
  statusConnection,
  MessageController.sendButtons
);
routes.post(
  '/api/:session/send-order-message',
  setSession,
  statusConnection,
  MessageController.sendOrderMessage
);
routes.post(
  '/api/:session/send-poll-message',
  setSession,
  statusConnection,
  MessageController.sendPollMessage
);
routes.post(
  '/api/:session/send-pix-key',
  setSession,
  statusConnection,
  MessageController.sendPixMessage
);

// Group
routes.get(
  '/api/:session/all-broadcast-list',
  setSession,
  statusConnection,
  GroupController.getAllBroadcastList
);
routes.get(
  '/api/:session/all-groups',
  setSession,
  statusConnection,
  GroupController.getAllGroups
);
routes.get(
  '/api/:session/group-members/:groupId',
  setSession,
  statusConnection,
  GroupController.getGroupMembers
);
routes.get(
  '/api/:session/common-groups/:wid',
  setSession,
  statusConnection,
  GroupController.getCommonGroups
);
routes.get(
  '/api/:session/group-admins/:groupId',
  setSession,
  statusConnection,
  GroupController.getGroupAdmins
);
routes.get(
  '/api/:session/group-info/:groupId',
  setSession,
  statusConnection,
  GroupController.getGroupInfo
);
routes.get(
  '/api/:session/group-invite-link/:groupId',
  setSession,
  statusConnection,
  GroupController.getGroupInviteLink
);
routes.get(
  '/api/:session/group-revoke-link/:groupId',
  setSession,
  statusConnection,
  GroupController.revokeGroupInviteLink
);
routes.get(
  '/api/:session/group-members-ids/:groupId',
  setSession,
  statusConnection,
  GroupController.getGroupMembersIds
);
routes.post(
  '/api/:session/create-group',
  setSession,
  statusConnection,
  GroupController.createGroup
);
routes.post(
  '/api/:session/leave-group',
  setSession,
  statusConnection,
  GroupController.leaveGroup
);
routes.post(
  '/api/:session/join-code',
  setSession,
  statusConnection,
  GroupController.joinGroupByCode
);
routes.post(
  '/api/:session/add-participant-group',
  setSession,
  statusConnection,
  GroupController.addParticipant
);
routes.post(
  '/api/:session/remove-participant-group',
  setSession,
  statusConnection,
  GroupController.removeParticipant
);
routes.post(
  '/api/:session/promote-participant-group',
  setSession,
  statusConnection,
  GroupController.promoteParticipant
);
routes.post(
  '/api/:session/demote-participant-group',
  setSession,
  statusConnection,
  GroupController.demoteParticipant
);
routes.post(
  '/api/:session/group-info-from-invite-link',
  setSession,
  statusConnection,
  GroupController.getGroupInfoFromInviteLink
);
routes.post(
  '/api/:session/group-description',
  setSession,
  statusConnection,
  GroupController.setGroupDescription
);
routes.post(
  '/api/:session/group-property',
  setSession,
  statusConnection,
  GroupController.setGroupProperty
);
routes.post(
  '/api/:session/group-subject',
  setSession,
  statusConnection,
  GroupController.setGroupSubject
);
routes.post(
  '/api/:session/messages-admins-only',
  setSession,
  statusConnection,
  GroupController.setMessagesAdminsOnly
);
routes.post(
  '/api/:session/group-pic',
  upload.single('file'),
  setSession,
  statusConnection,
  GroupController.setGroupProfilePic
);
routes.post(
  '/api/:session/change-privacy-group',
  setSession,
  statusConnection,
  GroupController.changePrivacyGroup
);

// Chat
routes.get(
  '/api/:session/all-chats',
  setSession,
  statusConnection,
  DeviceController.getAllChats
);
routes.post(
  '/api/:session/list-chats',
  setSession,
  statusConnection,
  DeviceController.listChats
);

routes.get(
  '/api/:session/all-chats-archived',
  setSession,
  statusConnection,
  DeviceController.getAllChatsArchiveds
);
routes.get(
  '/api/:session/all-chats-with-messages',
  setSession,
  statusConnection,
  DeviceController.getAllChatsWithMessages
);
routes.get(
  '/api/:session/all-messages-in-chat/:phone',
  setSession,
  statusConnection,
  DeviceController.getAllMessagesInChat
);
routes.get(
  '/api/:session/all-new-messages',
  setSession,
  statusConnection,
  DeviceController.getAllNewMessages
);
routes.get(
  '/api/:session/unread-messages',
  setSession,
  statusConnection,
  DeviceController.getUnreadMessages
);
routes.get(
  '/api/:session/all-unread-messages',
  setSession,
  statusConnection,
  DeviceController.getAllUnreadMessages
);
routes.get(
  '/api/:session/chat-by-id/:phone',
  setSession,
  statusConnection,
  DeviceController.getChatById
);
routes.get(
  '/api/:session/message-by-id/:messageId',
  setSession,
  statusConnection,
  DeviceController.getMessageById
);
routes.get(
  '/api/:session/chat-is-online/:phone',
  setSession,
  statusConnection,
  DeviceController.getChatIsOnline
);
routes.get(
  '/api/:session/last-seen/:phone',
  setSession,
  statusConnection,
  DeviceController.getLastSeen
);
routes.get(
  '/api/:session/list-mutes/:type',
  setSession,
  statusConnection,
  DeviceController.getListMutes
);
routes.get(
  '/api/:session/load-messages-in-chat/:phone',
  setSession,
  statusConnection,
  DeviceController.loadAndGetAllMessagesInChat
);
routes.get(
  '/api/:session/get-messages/:phone',
  setSession,
  statusConnection,
  DeviceController.getMessages
);

routes.post(
  '/api/:session/archive-chat',
  setSession,
  statusConnection,
  DeviceController.archiveChat
);
routes.post(
  '/api/:session/archive-all-chats',
  setSession,
  statusConnection,
  DeviceController.archiveAllChats
);
routes.post(
  '/api/:session/clear-chat',
  setSession,
  statusConnection,
  DeviceController.clearChat
);
routes.post(
  '/api/:session/clear-all-chats',
  setSession,
  statusConnection,
  DeviceController.clearAllChats
);
routes.post(
  '/api/:session/delete-chat',
  setSession,
  statusConnection,
  DeviceController.deleteChat
);
routes.post(
  '/api/:session/delete-all-chats',
  setSession,
  statusConnection,
  DeviceController.deleteAllChats
);
routes.post(
  '/api/:session/delete-message',
  setSession,
  statusConnection,
  DeviceController.deleteMessage
);
routes.post(
  '/api/:session/react-message',
  setSession,
  statusConnection,
  DeviceController.reactMessage
);
routes.post(
  '/api/:session/forward-messages',
  setSession,
  statusConnection,
  DeviceController.forwardMessages
);
routes.post(
  '/api/:session/mark-unseen',
  setSession,
  statusConnection,
  DeviceController.markUnseenMessage
);
routes.post(
  '/api/:session/pin-chat',
  setSession,
  statusConnection,
  DeviceController.pinChat
);
routes.post(
  '/api/:session/contact-vcard',
  setSession,
  statusConnection,
  DeviceController.sendContactVcard
);
routes.post(
  '/api/:session/send-mute',
  setSession,
  statusConnection,
  DeviceController.sendMute
);
routes.post(
  '/api/:session/send-seen',
  setSession,
  statusConnection,
  DeviceController.sendSeen
);
routes.post(
  '/api/:session/chat-state',
  setSession,
  statusConnection,
  DeviceController.setChatState
);
routes.post(
  '/api/:session/temporary-messages',
  setSession,
  statusConnection,
  DeviceController.setTemporaryMessages
);
routes.post(
  '/api/:session/typing',
  setSession,
  statusConnection,
  DeviceController.setTyping
);
routes.post(
  '/api/:session/recording',
  setSession,
  statusConnection,
  DeviceController.setRecording
);
routes.post(
  '/api/:session/star-message',
  setSession,
  statusConnection,
  DeviceController.starMessage
);
routes.get(
  '/api/:session/reactions/:id',
  setSession,
  statusConnection,
  DeviceController.getReactions
);
routes.get(
  '/api/:session/votes/:id',
  setSession,
  statusConnection,
  DeviceController.getVotes
);
routes.post(
  '/api/:session/reject-call',
  setSession,
  statusConnection,
  DeviceController.rejectCall
);

// Catalog
routes.get(
  '/api/:session/get-products',
  setSession,
  statusConnection,
  CatalogController.getProducts
);
routes.get(
  '/api/:session/get-product-by-id',
  setSession,
  statusConnection,
  CatalogController.getProductById
);
routes.post(
  '/api/:session/add-product',
  setSession,
  statusConnection,
  CatalogController.addProduct
);
routes.post(
  '/api/:session/edit-product',
  setSession,
  statusConnection,
  CatalogController.editProduct
);
routes.post(
  '/api/:session/del-products',
  setSession,
  statusConnection,
  CatalogController.delProducts
);
routes.post(
  '/api/:session/change-product-image',
  setSession,
  statusConnection,
  CatalogController.changeProductImage
);
routes.post(
  '/api/:session/add-product-image',
  setSession,
  statusConnection,
  CatalogController.addProductImage
);
routes.post(
  '/api/:session/remove-product-image',
  setSession,
  statusConnection,
  CatalogController.removeProductImage
);
routes.get(
  '/api/:session/get-collections',
  setSession,
  statusConnection,
  CatalogController.getCollections
);
routes.post(
  '/api/:session/create-collection',
  setSession,
  statusConnection,
  CatalogController.createCollection
);
routes.post(
  '/api/:session/edit-collection',
  setSession,
  statusConnection,
  CatalogController.editCollection
);
routes.post(
  '/api/:session/del-collection',
  setSession,
  statusConnection,
  CatalogController.deleteCollection
);
routes.post(
  '/api/:session/send-link-catalog',
  setSession,
  statusConnection,
  CatalogController.sendLinkCatalog
);
routes.post(
  '/api/:session/set-product-visibility',
  setSession,
  statusConnection,
  CatalogController.setProductVisibility
);
routes.post(
  '/api/:session/set-cart-enabled',
  setSession,
  statusConnection,
  CatalogController.updateCartEnabled
);

// Status
routes.post(
  '/api/:session/send-text-storie',
  setSession,
  statusConnection,
  StatusController.sendTextStorie
);
routes.post(
  '/api/:session/send-image-storie',
  upload.single('file'),
  setSession,
  statusConnection,
  StatusController.sendImageStorie
);
routes.post(
  '/api/:session/send-video-storie',
  upload.single('file'),
  setSession,
  statusConnection,
  StatusController.sendVideoStorie
);

// Labels
routes.post(
  '/api/:session/add-new-label',
  setSession,
  statusConnection,
  LabelsController.addNewLabel
);
routes.post(
  '/api/:session/add-or-remove-label',
  setSession,
  statusConnection,
  LabelsController.addOrRemoveLabels
);
routes.get(
  '/api/:session/get-all-labels',
  setSession,
  statusConnection,
  LabelsController.getAllLabels
);
routes.put(
  '/api/:session/delete-all-labels',
  setSession,
  statusConnection,
  LabelsController.deleteAllLabels
);
routes.put(
  '/api/:session/delete-label/:id',
  setSession,
  statusConnection,
  LabelsController.deleteLabel
);

// Contact
routes.get(
  '/api/:session/contacts',
  setSession,
  ContactController.listContacts
);
routes.get(
  '/api/:session/check-number-status/:phone',
  setSession,
  statusConnection,
  DeviceController.checkNumberStatus
);
routes.get(
  '/api/:session/all-contacts',
  // #swagger.tags = ["Contact"]
  setSession,
  statusConnection,
  DeviceController.getAllContacts
);
routes.get(
  '/api/:session/contact/:phone',
  setSession,
  statusConnection,
  DeviceController.getContact
);
routes.get(
  '/api/:session/contact/pn-lid/:pnLid',
  setSession,
  statusConnection,
  ContactController.getContactPnLid
);
routes.get(
  '/api/:session/profile/:phone',
  setSession,
  statusConnection,
  DeviceController.getNumberProfile
);
routes.get(
  '/api/:session/profile-pic/:phone',
  setSession,
  statusConnection,
  DeviceController.getProfilePicFromServer
);
routes.get(
  '/api/:session/profile-status/:phone',
  setSession,
  statusConnection,
  DeviceController.getStatus
);

// Blocklist
routes.get(
  '/api/:session/blocklist',
  setSession,
  statusConnection,
  DeviceController.getBlockList
);
routes.post(
  '/api/:session/block-contact',
  setSession,
  statusConnection,
  DeviceController.blockContact
);
routes.post(
  '/api/:session/unblock-contact',
  setSession,
  statusConnection,
  DeviceController.unblockContact
);

// Device
routes.get(
  '/api/:session/get-battery-level',
  setSession,
  statusConnection,
  DeviceController.getBatteryLevel
);
routes.get(
  '/api/:session/host-device',
  setSession,
  statusConnection,
  DeviceController.getHostDevice
);
routes.get(
  '/api/:session/get-phone-number',
  setSession,
  statusConnection,
  DeviceController.getPhoneNumber
);

// Profile
routes.post(
  '/api/:session/set-profile-pic',
  upload.single('file'),
  setSession,
  statusConnection,
  DeviceController.setProfilePic
);
routes.post(
  '/api/:session/profile-status',
  setSession,
  statusConnection,
  DeviceController.setProfileStatus
);
routes.post(
  '/api/:session/change-username',
  setSession,
  statusConnection,
  DeviceController.setProfileName
);

// Business
routes.post(
  '/api/:session/edit-business-profile',
  setSession,
  statusConnection,
  SessionController.editBusinessProfile
);
routes.get(
  '/api/:session/get-business-profiles-products',
  setSession,
  statusConnection,
  OrderController.getBusinessProfilesProducts
);
routes.get(
  '/api/:session/get-order-by-messageId/:messageId',
  setSession,
  statusConnection,
  OrderController.getOrderbyMsg
);
routes.get('/api/backup-sessions', MiscController.backupAllSessions);
routes.post(
  '/api/restore-sessions',
  upload.single('file'),
  MiscController.restoreAllSessions
);
routes.get(
  '/api/:session/take-screenshot',
  setSession,
  MiscController.takeScreenshot
);
routes.post('/api/:session/set-limit', MiscController.setLimit);

//Communitys
routes.post(
  '/api/:session/create-community',
  setSession,
  statusConnection,
  CommunityController.createCommunity
);
routes.post(
  '/api/:session/deactivate-community',
  setSession,
  statusConnection,
  CommunityController.deactivateCommunity
);
routes.post(
  '/api/:session/add-community-subgroup',
  setSession,
  statusConnection,
  CommunityController.addSubgroupsCommunity
);
routes.post(
  '/api/:session/remove-community-subgroup',
  setSession,
  statusConnection,
  CommunityController.removeSubgroupsCommunity
);
routes.post(
  '/api/:session/promote-community-participant',
  setSession,
  statusConnection,
  CommunityController.promoteCommunityParticipant
);
routes.post(
  '/api/:session/demote-community-participant',
  setSession,
  statusConnection,
  CommunityController.demoteCommunityParticipant
);
routes.get(
  '/api/:session/community-participants/:id',
  setSession,
  statusConnection,
  CommunityController.getCommunityParticipants
);

routes.post(
  '/api/:session/newsletter',
  setSession,
  statusConnection,
  NewsletterController.createNewsletter
);
routes.put(
  '/api/:session/newsletter/:id',
  setSession,
  statusConnection,
  NewsletterController.editNewsletter
);

routes.delete(
  '/api/:session/newsletter/:id',
  setSession,
  statusConnection,
  NewsletterController.destroyNewsletter
);
routes.post(
  '/api/:session/mute-newsletter/:id',
  setSession,
  statusConnection,
  NewsletterController.muteNewsletter
);

routes.post('/api/:session/chatwoot', DeviceController.chatWoot);

// Schedule
routes.post(
  '/api/:session/schedule',
  setSession,
  ScheduleController.createSchedule
);
routes.get(
  '/api/:session/schedule',
  setSession,
  ScheduleController.listSchedules
);
routes.get(
  '/api/:session/schedule/:id',
  setSession,
  ScheduleController.getSchedule
);
routes.put(
  '/api/:session/schedule/:id',
  setSession,
  ScheduleController.updateSchedule
);
routes.post(
  '/api/:session/schedule/:id/cancel',
  setSession,
  ScheduleController.cancelSchedule
);
routes.delete(
  '/api/:session/schedule/:id',
  setSession,
  ScheduleController.deleteSchedule
);

// Api Doc
routes.use('/api-docs', swaggerUi.serve as any);
routes.get('/api-docs', (req, res) => {
  try {
    let doc: any = JSON.parse(JSON.stringify(swaggerDocument));

    // Remove deprecated operations
    if (doc.paths && typeof doc.paths === 'object') {
      for (const p of Object.keys(doc.paths)) {
        const methods = doc.paths[p];
        for (const m of Object.keys(methods)) {
          if (methods[m] && methods[m].deprecated === true) {
            delete methods[m];
          }
          // Remove security from all operations
          if (methods[m] && methods[m].security) {
            delete methods[m].security;
          }
        }
        if (Object.keys(methods).length === 0) delete doc.paths[p];
      }
    }

    // Remove global security definitions
    delete doc.securityDefinitions;
    delete doc.security;
    if (doc.components) delete doc.components.securitySchemes;

    // Remove generate-token, secretkey and api-docs routes from swagger
    if (doc.paths) {
      for (const p of Object.keys(doc.paths)) {
        if (p.includes('{secretkey}') || p.includes('generate-token') || p === '/api-docs') {
          delete doc.paths[p];
        }
      }
    }

    // Remove Auth tag
    if (doc.tags) {
      doc.tags = doc.tags.filter((t: any) => t.name !== 'Auth');
    }

    // Replace placeholders with environment values
    const sessionEnv = process.env.SESSION_NAME || 'NERDWHATS_AMERICA';
    const phoneEnv = process.env.PHONE_TEST_NUMBER || '5521999999999';

    try {
      let docStr = JSON.stringify(doc);
      docStr = docStr.split('NERDWHATS_AMERICA').join(sessionEnv);
      docStr = docStr.split('5521999999999').join(phoneEnv);
      doc = JSON.parse(docStr);
    } catch (e) {
      // if replacement fails, keep original doc
    }

    return (swaggerUi.setup(doc) as any)(req, res);
  } catch (e) {
    return (swaggerUi.setup(swaggerDocument) as any)(req, res);
  }
});

//k8s
routes.get('/healthz', HealthCheck.healthz);
routes.get('/unhealthy', HealthCheck.unhealthy);

//Metrics Prometheus

routes.get('/metrics', prometheusRegister.metrics);

export default routes;
