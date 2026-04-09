import React from 'react';

interface AudioMessageProps {
  audioUrl?: string;
  transcription?: string;
  timestamp: string;
  isOutgoing: boolean;
  message?: string;
  response?: string;
}

const AudioMessage: React.FC<AudioMessageProps> = ({ 
  audioUrl, 
  transcription, 
  timestamp,
  //isOutgoing,
  message
  //response
}) => {
  if (!audioUrl) {
    return null;
  }

  // Determine position based on "Audio message" content
  const isMessageSide = message === 'Audio message';
  //const isResponseSide = response === 'Audio message';

  return (
    <div className={`flex ${isMessageSide ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className={`max-w-[350px] min-w-[200px] rounded-[20px] px-6 py-3 ${
        isMessageSide 
          ? 'bg-white shadow-md border border-gray-200' 
          : 'bg-[#FAE8D6]'
      }`}>
        <audio controls className="w-full mb-2">
          <source src={audioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
        
        {transcription && (
          <div className="text-sm break-words mb-2">
            {transcription}
          </div>
        )}
        
        <div className={`text-xs mt-2 ${
          isMessageSide ? 'text-gray-500' : 'text-gray-600 opacity-70'
        }`}>
          {timestamp}
        </div>
      </div>
    </div>
  );
};

export default AudioMessage;
