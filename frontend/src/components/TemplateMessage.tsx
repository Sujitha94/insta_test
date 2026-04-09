import React from 'react';

interface Button {
  type: string;
  title: string;
  payload?: string;
  url?: string;
}

interface ProductElement {
  title: string;
  image_url: string;
  subtitle: string;
  default_action: {
    type: string;
    url: string;
  };
  buttons: Button[];
}

export interface TemplateMessageProps {
  message: {
    _id: string;
    senderId: string;
    recipientId: string;
    messageType: 'template';
    audioUrl?: string | null;
    transcription?: string | null;
    message: string | null;
    response: {
      attachment: {
        type: 'template';
        payload: {
          template_type: string;
          text?: string;
          buttons?: Button[];
          elements?: ProductElement[];
        };
      };
    };
    Timestamp: string;
  };
  isOutgoing: boolean;
  onButtonClick: (payload: string) => void;
}

const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return !isNaN(date.getTime())
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
};

const TemplateMessage: React.FC<TemplateMessageProps> = ({ message, onButtonClick }) => {
  if (!message.response?.attachment?.payload) {
    console.error('Missing template payload data');
    return null;
  }

  const templateData = message.response.attachment.payload;

  const renderButton = (button: Button, index: number) => {
    const buttonClasses = "w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-center font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md";
    
    if (button.type === 'web_url' && button.url) {
      return (
        <a
          key={index}
          href={button.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses}
        >
          {button.title}
        </a>
      );
    }
    
    return (
      <button
        key={index}
        onClick={() => onButtonClick(button.payload || '')}
        className={buttonClasses}
      >
        {button.title}
      </button>
    );
  };

  const renderButtonTemplate = () => (
    <div className="space-y-3">
      {templateData.text && (
        <p className="text-gray-800 leading-relaxed">{templateData.text}</p>
      )}
      {templateData.buttons && templateData.buttons.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          {templateData.buttons.map((button, index) => renderButton(button, index))}
        </div>
      )}
    </div>
  );

  const renderGenericTemplate = () => {
    if (!templateData.elements || templateData.elements.length === 0) {
      console.error('No elements in generic template');
      return null;
    }

    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {templateData.elements.map((element, index) => (
          <div key={index} className="min-w-[280px] max-w-[280px] bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
            <div className="relative">
              <img 
                src={element.image_url}
                alt={element.title}
                className="w-full h-44 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-lg mb-1.5 text-gray-900 line-clamp-2">{element.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-4 line-clamp-3">{element.subtitle}</p>
              <div className="space-y-2">
                {element.buttons.map((button, buttonIndex) => renderButton(button, buttonIndex))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTemplate = () => {
    try {
      switch (templateData.template_type) {
        case 'generic':
          return renderGenericTemplate();
        default:
          return renderButtonTemplate();
      }
    } catch (error) {
      console.error('Error rendering template:', error);
      return null;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {message.message && (
        <div className="flex justify-start">
          <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-white shadow-sm border border-gray-100">
            <p className="text-gray-800 break-words leading-relaxed">{message.message}</p>
            <div className="text-xs mt-1.5 text-gray-500">
              {formatMessageTime(message.Timestamp)}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl p-4 bg-gradient-to-br from-[#FAE8D6] to-[#F5DCC8] shadow-sm border border-orange-100">
          {renderTemplate()}
          <div className="text-xs mt-3 text-gray-600 text-right">
            {formatMessageTime(message.Timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateMessage;
