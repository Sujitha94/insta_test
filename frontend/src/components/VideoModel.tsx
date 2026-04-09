import React from 'react';

interface VideoModelProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

const VideoModel: React.FC<VideoModelProps> = ({ videoUrl, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <video
          src={videoUrl}
          className="max-w-full max-h-[90vh] object-contain"
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
        >
          Your browser does not support the video tag.
        </video>
        <button
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
          onClick={onClose}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VideoModel;
