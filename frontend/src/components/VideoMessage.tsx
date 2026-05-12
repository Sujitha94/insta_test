import React, { useState, useEffect } from 'react';
import axios from 'axios';
import VideoModel from '@/components/VideoModel';

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  tenentId: string;
  messageType: 'text' | 'template' | 'audio' | 'image' | 'video' | 'ig_reel' | 'ig_stroy' | 'carousel';
  message: string;
  response?: string;
  Timestamp: string;
  messageid?: string;
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

interface VideoMessageProps {
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
    Unable to load video
  </div>
);

interface TimeStampProps {
  time: string;
  isOutgoing: boolean;
}

const TimeStamp: React.FC<TimeStampProps> = ({ time, isOutgoing }) => (
  <div className={`text-xs mt-2 ${!isOutgoing ? 'text-gray-500' : 'text-gray-600 opacity-70'
    }`}>
    {time}
  </div>
);

const VideoMessage: React.FC<VideoMessageProps> = ({
  message,
  selectedContact,
  formatMessageTime
}) => {
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoData, setVideoData] = useState<string | null>(null);
  const [responseVideoData, setResponseVideoData] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      const sourceVideoUrl = message.message;
      const responseVideoUrl = message.response;

      if (!sourceVideoUrl && !responseVideoUrl) {
        setVideoError(true);
        setIsLoading(false);
        return;
      }

      try {
        const baseUrl = process.env.REACT_APP_API_URL || 'https://snaking-outhouse-oppose.ngrok-free.dev';
        const proxyUrl = `${baseUrl}/api/imageproxyroutes/proxy-video`;

        if (sourceVideoUrl) {
          const response = await axios.get(proxyUrl, {
            params: { url: sourceVideoUrl },
            responseType: 'blob',
            headers: { 'Accept': 'video/*' }
          });

          const videoBlob = new Blob([response.data], {
            type: response.headers['content-type'] || 'video/mp4'
          });
          const blobUrl = URL.createObjectURL(videoBlob);
          setVideoData(blobUrl);
        }

        if (responseVideoUrl) {
          const responseVideoResponse = await axios.get(proxyUrl, {
            params: { url: responseVideoUrl },
            responseType: 'blob',
            headers: { 'Accept': 'video/*' }
          });

          const responseVideoBlob = new Blob([responseVideoResponse.data], {
            type: responseVideoResponse.headers['content-type'] || 'video/mp4'
          });
          const responseBlobUrl = URL.createObjectURL(responseVideoBlob);
          setResponseVideoData(responseBlobUrl);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchVideo:', error);
        setVideoError(true);
        setIsLoading(false);
      }
    };

    fetchVideo();

    return () => {
      if (videoData) URL.revokeObjectURL(videoData);
      if (responseVideoData) URL.revokeObjectURL(responseVideoData);
    };
  }, [message]);

  const handleVideoClick = (videoUrl: string) => {
    setModalVideo(videoUrl);
  };

  return (
    <>
      {(videoData || isLoading) && (
        <div className={`flex ${message.senderId === selectedContact?.senderId
            ? 'justify-start'
            : 'justify-end'
          } mb-3`}>
          <div className={`max-w-[350px] min-w-[200px] rounded-[20px] px-6 py-3 ${message.senderId === selectedContact?.senderId
              ? 'bg-white shadow-md border border-gray-200'
              : 'bg-[#FAE8D6]'
            }`}>
            {isLoading && <LoadingSpinner />}
            {videoError ? (
              <ErrorMessage />
            ) : videoData && (
              <div className="cursor-pointer" onClick={() => handleVideoClick(videoData)}>
                <video
                  controls
                  className="rounded-lg max-w-full w-full hover:opacity-90 transition-opacity"
                  style={{ display: isLoading ? 'none' : 'block' }}
                  onError={() => setVideoError(true)}
                  onLoadedData={() => setIsLoading(false)}
                >
                  <source src={videoData} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
            <TimeStamp
              time={formatMessageTime(message.Timestamp)}
              isOutgoing={message.senderId !== selectedContact?.senderId}
            />
          </div>
        </div>
      )}

      {responseVideoData && (
        <div className="flex justify-end mb-3">
          <div className="max-w-[350px] min-w-[200px] bg-[#FAE8D6] text-gray-900 rounded-[20px] px-6 py-3 shadow-md">
            <div className="cursor-pointer" onClick={() => handleVideoClick(responseVideoData)}>
              <video
                controls
                className="rounded-lg max-w-full w-full hover:opacity-90 transition-opacity"
                onError={() => setVideoError(true)}
              >
                <source src={responseVideoData} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="text-xs text-gray-600 opacity-75 mt-2">
              {formatMessageTime(message.Timestamp)}
            </div>
          </div>
        </div>
      )}

      <VideoModel
        videoUrl={modalVideo || ''}
        isOpen={!!modalVideo}
        onClose={() => setModalVideo(null)}
      />
    </>
  );
};

export default VideoMessage;
