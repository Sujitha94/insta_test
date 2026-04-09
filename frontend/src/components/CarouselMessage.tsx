import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselButton {
  type: string;
  title: string;
  url?: string;
  payload?: string;
}

interface CarouselProduct {
  title: string;
  subtitle: string;
  imageUrl: string;
  buttons: CarouselButton[];
}

interface CarouselMessageProps {
  message: {
    _id: string;
    senderId: string;
    recipientId: string;
    messageType: 'carousel';
    message?: string;
    response?: string;
    carouselData: {
      totalProducts: number;
      products: CarouselProduct[];
    };
    Timestamp: string;
  };
  isOutgoing: boolean;
  onButtonClick?: (payload: string) => void;
}

const CarouselMessage: React.FC<CarouselMessageProps> = ({ 
  message,  
  onButtonClick 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!message.carouselData?.products || message.carouselData.products.length === 0) {
    console.error('Missing carousel data');
    return null;
  }

  const products = message.carouselData.products;
  
  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === products.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? products.length - 1 : prevIndex - 1
    );
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return !isNaN(date.getTime())
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  };

  const renderButton = (button: CarouselButton, index: number) => {
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
        onClick={() => onButtonClick?.(button.payload || '')}
        className={buttonClasses}
      >
        {button.title}
      </button>
    );
  };

  const currentProduct = products[currentIndex];
  const isResponseSide = message.response === 'Carousel Message' || !message.message || message.message === 'Carousel Message';

  return (
    <div className="flex flex-col gap-2">
      {message.message && message.message !== 'Carousel Message' && (
        <div className="flex justify-start">
          <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-white shadow-sm border border-gray-100">
            <p className="text-gray-800 break-words leading-relaxed">{message.message}</p>
            <div className="text-xs mt-1.5 text-gray-500">
              {formatMessageTime(message.Timestamp)}
            </div>
          </div>
        </div>
      )}
      
      <div className={`flex ${isResponseSide ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[340px] rounded-2xl p-4 ${isResponseSide ? 'bg-gradient-to-br from-[#FAE8D6] to-[#F5DCC8] border border-orange-100' : 'bg-white border border-gray-100'} shadow-sm`}>
          <div className="relative">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="relative">
                <img 
                  src={currentProduct.imageUrl}
                  alt={currentProduct.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                
                {products.length > 1 && (
                  <>
                    <button 
                      onClick={prevSlide} 
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/95 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200 hover:scale-110"
                      aria-label="Previous product"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-800" />
                    </button>
                    
                    <button 
                      onClick={nextSlide}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/95 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200 hover:scale-110"
                      aria-label="Next product"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-800" />
                    </button>
                  </>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 flex-1">{currentProduct.title}</h3>
                  {products.length > 1 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                      {currentIndex + 1}/{products.length}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-4 line-clamp-3">{currentProduct.subtitle}</p>
                <div className="flex flex-col gap-2">
                  {currentProduct.buttons.map((button, buttonIndex) => renderButton(button, buttonIndex))}
                </div>
              </div>
              
              {products.length > 1 && (
                <div className="flex justify-center pb-3 gap-1.5">
                  {products.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === currentIndex 
                          ? 'w-6 bg-orange-500' 
                          : 'w-2 bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to product ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className={`text-xs mt-3 text-right ${isResponseSide ? 'text-gray-600' : 'text-gray-500'}`}>
            {formatMessageTime(message.Timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarouselMessage;
