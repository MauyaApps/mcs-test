/**
 * MCS - Chat Folder Routes
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getFolders, createFolder, updateFolder, deleteFolder,
  getFolderChats, addChatToFolder, removeChatFromFolder,
} = require('../controllers/folderController');

router.get('/',                          verifyToken, getFolders);
router.post('/',                         verifyToken, createFolder);
router.put('/:id',                       verifyToken, updateFolder);
router.delete('/:id',                    verifyToken, deleteFolder);
router.get('/:id/chats',                 verifyToken, getFolderChats);
router.post('/:id/chats',                verifyToken, addChatToFolder);
router.delete('/:id/chats/:chatId',      verifyToken, removeChatFromFolder);

module.exports = router;
