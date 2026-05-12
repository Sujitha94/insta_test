import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ImageModel from '@/components/ImageModel';
interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  tenentId: string;
  messageType: 'text' | 'template' | 'audio' | 'image' | 'video' | 'ig_reel' | 'ig_stroy' | 'carousel';
  message: string;
  response?: string;
  Timestamp: string;
  audioUrl?: string;
  transcription?: string;
  imageUrl?: string;
}

interface Contact {
  _id: string;
  username: string;
  senderId: string;
  createdAt: string;
  name: string;
  profile_pic?: string;
  chatMode: 'chat' | 'human';
  lastMessage?: {
    message: string;
    response: string;
    Timestamp: string;
  };
}

interface ImageMessageProps {
  message: Message;
  selectedContact: Contact | null;
  formatMessageTime: (timestamp: string) => string;
}


const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-32">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300" />
  </div>
);

const ErrorMessage = () => (
  <div className="text-red-500 text-sm text-center py-4">
    Unable to load image
  </div>
);

interface TimeStampProps {
  time: string;
  isOutgoing: boolean;
}

const TimeStamp: React.FC<TimeStampProps> = ({ time, isOutgoing }) => (
  <div className={`text-xs mt-2 ${!isOutgoing ? 'text-gray-500' : 'text-white opacity-70'
    }`}>
    {time}
  </div>
);

const ImageMessage: React.FC<ImageMessageProps> = ({
  message,
  selectedContact,
  formatMessageTime
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageData, setImageData] = useState<string | null>(null);
  const [responseImageData, setResponseImageData] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchImage = async () => {
      const sourceImageUrl = message.imageUrl || message.message;
      const responseImageUrl = message.response;

      if (!sourceImageUrl && !responseImageUrl) {
        setImageError(true);
        setIsLoading(false);
        return;
      }

      try {
        const baseUrl = process.env.REACT_APP_API_URL || 'https://snaking-outhouse-oppose.ngrok-free.dev';
        const proxyUrl = `${baseUrl}/api/imageproxyroutes/proxy-image`;

        if (sourceImageUrl) {
          const response = await axios.get(proxyUrl, {
            params: { url: sourceImageUrl },
            responseType: 'blob',
            headers: { 'Accept': 'image/*' }
          });

          const imageBlob = new Blob([response.data], {
            type: response.headers['content-type'] || 'image/jpeg'
          });
          const blobUrl = URL.createObjectURL(imageBlob);
          setImageData(blobUrl);
        }

        if (responseImageUrl) {
          const responseImgResponse = await axios.get(proxyUrl, {
            params: { url: responseImageUrl },
            responseType: 'blob',
            headers: { 'Accept': 'image/*' }
          });

          const responseImageBlob = new Blob([responseImgResponse.data], {
            type: responseImgResponse.headers['content-type'] || 'image/jpeg'
          });
          const responseBlobUrl = URL.createObjectURL(responseImageBlob);
          setResponseImageData(responseBlobUrl);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchImage:', error);
        setImageError(true);
        setIsLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (imageData) URL.revokeObjectURL(imageData);
      if (responseImageData) URL.revokeObjectURL(responseImageData);
    };
  }, [message]);
  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
  };
  return (
    <>
      {(imageData || isLoading) && (
        <div className={`flex ${message.senderId === selectedContact?.senderId
            ? 'justify-start'
            : 'justify-end'
          } mb-3`}>
          <div className={`max-w-[350px] min-w-[200px] rounded-[20px] px-6 py-3 ${message.senderId === selectedContact?.senderId
              ? 'bg-white shadow-md border border-gray-200'
              : 'bg-blue-500 text-white'
            }`}>
            {isLoading && <LoadingSpinner />}
            {imageError ? (
              <ErrorMessage />
            ) : imageData && (
              <img
                src={imageData}
                alt="Chat message"
                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                style={{ display: isLoading ? 'none' : 'block' }}
                onError={() => setImageError(true)}
                onLoad={() => setIsLoading(false)}
                onClick={() => handleImageClick(imageData)}
              />
            )}
            <TimeStamp
              time={formatMessageTime(message.Timestamp)}
              isOutgoing={message.senderId !== selectedContact?.senderId}
            />
          </div>
        </div>
      )}

      {responseImageData && (
        <div className="flex justify-end mb-3">
          <div className="max-w-[350px] min-w-[200px] bg-blue-500 text-white rounded-[20px] px-6 py-3 shadow-md">
            <img
              src={responseImageData}
              alt="Response"
              className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onError={() => setImageError(true)}
              onClick={() => handleImageClick(responseImageData)}
            />
            <div className="text-xs opacity-75 mt-2">
              {formatMessageTime(message.Timestamp)}
            </div>
          </div>
        </div>
      )}

      <ImageModel
        imageUrl={modalImage || ''}
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
      />
    </>
  );
};

export default ImageMessage;
