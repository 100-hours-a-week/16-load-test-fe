import { useState, useCallback } from 'react';
import { Toast } from '../components/Toast';
import fileService from '../services/fileService';

export const useMessageHandling = (socketRef, currentUser, roomId, handleSessionError, messages = []) => {
 const [message, setMessage] = useState('');
 const [showEmojiPicker, setShowEmojiPicker] = useState(false);
 const [showMentionList, setShowMentionList] = useState(false);
 const [mentionFilter, setMentionFilter] = useState('');
 const [mentionIndex, setMentionIndex] = useState(0);
 const [filePreview, setFilePreview] = useState(null);
 const [uploading, setUploading] = useState(false);
 const [uploadProgress, setUploadProgress] = useState(0);
 const [uploadError, setUploadError] = useState(null);
 const [loadingMessages, setLoadingMessages] = useState(false);

 const handleMessageChange = useCallback((e) => {
   const newValue = e.target.value;
   setMessage(newValue);

   const cursorPosition = e.target.selectionStart;
   const textBeforeCursor = newValue.slice(0, cursorPosition);
   const atSymbolIndex = textBeforeCursor.lastIndexOf('@');

   if (atSymbolIndex !== -1) {
     const mentionText = textBeforeCursor.slice(atSymbolIndex + 1);
     if (!mentionText.includes(' ')) {
       setMentionFilter(mentionText.toLowerCase());
       setShowMentionList(true);
       setMentionIndex(0);
       return;
     }
   }
   
   setShowMentionList(false);
 }, []);

 const handleLoadMore = useCallback(async () => {
   if (!socketRef.current?.connected) {
     console.warn('Cannot load messages: Socket not connected');
     return;
   }

   try {
     if (loadingMessages) {
       console.log('Already loading messages, skipping...');
       return;
     }

     setLoadingMessages(true);
     const firstMessageTimestamp = messages[0]?.timestamp;

     console.log('Loading more messages:', {
       roomId: roomId,
       before: firstMessageTimestamp,
       currentMessageCount: messages.length
     });

     // Promise를 반환하도록 수정
     return new Promise((resolve, reject) => {
       const timeout = setTimeout(() => {
         setLoadingMessages(false);
         reject(new Error('Message loading timed out'));
       }, 10000);

       socketRef.current.emit('fetchPreviousMessages', {
         roomId: roomId,
         before: firstMessageTimestamp
       });

       socketRef.current.once('previousMessagesLoaded', (response) => {
         clearTimeout(timeout);
         setLoadingMessages(false);
         resolve(response);
       });

       socketRef.current.once('error', (error) => {
         clearTimeout(timeout);
         setLoadingMessages(false);
         reject(error);
       });
     });

   } catch (error) {
     console.error('Load more messages error:', error);
     Toast.error('이전 메시지를 불러오는데 실패했습니다.');
     setLoadingMessages(false);
     throw error;
   }
 }, [socketRef, roomId, loadingMessages, messages]);

 const handleMessageSubmit = useCallback(async (messageData) => {
   if (!socketRef.current?.connected || !currentUser) {
     console.error('[Chat] Cannot send message: Socket not connected');
     Toast.error('채팅 서버와 연결이 끊어졌습니다.');
     return;
   }

   if (!roomId) {
     Toast.error('채팅방 정보를 찾을 수 없습니다.');
     return;
   }

   try {
     console.log('[Chat] Sending message:', messageData);

     if (messageData.type === 'file' && messageData.fileData?.file) {
       setUploading(true);
       setUploadError(null);
       setUploadProgress(0);

       const uploadResponse = await fileService.uploadFile(
         messageData.fileData.file,
         roomId,
         (progress) => setUploadProgress(progress)
       );

       if (!uploadResponse.success || !uploadResponse.data?.fileId) {
         throw new Error(uploadResponse.message || '파일 업로드에 실패했습니다.');
       }

       const { fileId } = uploadResponse.data;
        socketRef.current.emit('fileUploadComplete', {
          fileId: fileId,
          roomId: roomId,
          content: messageData.content || '' // 파일과 함께 보낸 텍스트
        });

       const finalFile = uploadResponse.data.file; 
        socketRef.current.emit('chatMessage', {
          room: roomId,
          type: 'file',
          content: messageData.content || '',
          fileData: { // 서버에서 받은 최종 파일 정보를 포함
            _id: finalFile._id,
            filename: finalFile.filename,
            originalname: finalFile.originalname,
            mimetype: finalFile.mimetype,
            size: finalFile.size,
            url: finalFile.url // !!! 이 부분이 중요합니다.
          }
        });

       setFilePreview(null);
       setMessage('');
       setUploading(false);
       setUploadProgress(0);

     } else if (messageData.content?.trim()) {
       socketRef.current.emit('chatMessage', {
         room: roomId,
         type: 'text',
         content: messageData.content.trim()
       });

       setMessage('');
     }

     setShowEmojiPicker(false);
     setShowMentionList(false);
    //  textAreaRef.current?.focus();

   } catch (error) {
     console.error('[Chat] Message submit error:', error);

     if (error.message?.includes('세션') || 
         error.message?.includes('인증') || 
         error.message?.includes('토큰')) {
       await handleSessionError();
       return;
     }

     Toast.error(error.message || '메시지 전송 중 오류가 발생했습니다.');
     if (messageData.type === 'file') {
       setUploadError(error.message);
       setUploading(false);
     }
   }
 }, [currentUser, roomId, handleSessionError, socketRef]);

 const handleEmojiToggle = useCallback(() => {
   setShowEmojiPicker(prev => !prev);
 }, []);

 const getFilteredParticipants = useCallback((room) => {
   if (!room?.participants) return [];

   const allParticipants = [
     {
       _id: 'wayneAI',
       name: 'wayneAI',
       email: 'ai@wayne.ai',
       isAI: true
     },
     {
       _id: 'consultingAI',
       name: 'consultingAI',
       email: 'ai@consulting.ai',
       isAI: true
     },
     {
      _id: 'davinciAI',
      name: 'davinciAI',
      email: 'ai@davinciAI',
      isAI: true
     },
     ...room.participants
   ];

   return allParticipants.filter(user => 
     user.name.toLowerCase().includes(mentionFilter) ||
     user.email.toLowerCase().includes(mentionFilter)
   );
 }, [mentionFilter]);

 const insertMention = useCallback((messageInputRef, user) => {
   if (!messageInputRef?.current) return;

   const cursorPosition = messageInputRef.current.selectionStart;
   const textBeforeCursor = message.slice(0, cursorPosition);
   const atSymbolIndex = textBeforeCursor.lastIndexOf('@');

   if (atSymbolIndex !== -1) {
     const textBeforeAt = message.slice(0, atSymbolIndex);
     const newMessage = 
       textBeforeAt +
       `@${user.name} ` +
       message.slice(cursorPosition);

     setMessage(newMessage);
     setShowMentionList(false);

     setTimeout(() => {
       const newPosition = atSymbolIndex + user.name.length + 2;
       messageInputRef.current.focus();
       messageInputRef.current.setSelectionRange(newPosition, newPosition);
     }, 0);
   }
 }, [message]);

 const removeFilePreview = useCallback(() => {
   setFilePreview(null);
   setUploadError(null);
   setUploadProgress(0);
 }, []);

 return {
   message,
   showEmojiPicker,
   showMentionList,
   mentionFilter,
   mentionIndex,
   filePreview,
   uploading,
   uploadProgress,
   uploadError,
   loadingMessages,
   setMessage,
   setShowEmojiPicker,
   setShowMentionList,
   setMentionFilter,
   setMentionIndex,
   setFilePreview,
   setLoadingMessages,
   handleMessageChange,
   handleMessageSubmit,
   handleEmojiToggle,
   handleLoadMore,
   getFilteredParticipants,
   insertMention,
   removeFilePreview
 };
};

export default useMessageHandling;