import { useState, FormEvent } from 'react';
import { Plus, Minus, Save } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

interface ButtonOption {
  buttonText: string;
  buttonUrl?: string;
  buttonPayload?: string;
  buttonType: 'url' | 'payload';
}

interface CarouselItem {
  image: string;
  title: string;
  subtitle: string;
  buttons: ButtonOption[];
}

interface MessageTemplate {
  title: string; // Added title property
  payload: string;
  messageType: 'text' | 'carousel';
  text?: string;
  carouselItems?: CarouselItem[];
}

interface TemplateMessageProps {
  initialData?: MessageTemplate;
}

const TemplateMessage: React.FC<TemplateMessageProps> = ({
  initialData
}) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([
    initialData || {
      title: '', // Initialize title as empty string
      payload: '',
      messageType: 'text',
      text: '',
    }
  ]);

  const addTemplate = () => {
    setTemplates([...templates, {
      title: '',
      payload: '',
      messageType: 'text',
      text: '',
    }]);
  };

  const removeTemplate = (index: number) => {
    if (templates.length > 1) {
      const newTemplates = templates.filter((_, i) => i !== index);
      setTemplates(newTemplates);
    }
  };

  const updateTemplate = (index: number, field: keyof MessageTemplate, value: any) => {
    const newTemplates = [...templates];
    newTemplates[index] = { ...newTemplates[index], [field]: value };
    
    // If changing message type to text, initialize text field if it doesn't exist
    if (field === 'messageType' && value === 'text' && !newTemplates[index].text) {
      newTemplates[index].text = '';
    }
    
    // If changing message type to carousel, initialize carousel items if they don't exist
    if (field === 'messageType' && value === 'carousel' && !newTemplates[index].carouselItems) {
      newTemplates[index].carouselItems = [{
        image: '',
        title: '',
        subtitle: '',
        buttons: [{
          buttonText: '',
          buttonType: 'url',
          buttonUrl: ''
        }]
      }];
    }
    
    setTemplates(newTemplates);
  };

  const addCarouselItem = (templateIndex: number) => {
    const newTemplates = [...templates];
    if (!newTemplates[templateIndex].carouselItems) {
      newTemplates[templateIndex].carouselItems = [];
    }
    
    newTemplates[templateIndex].carouselItems?.push({
      image: '',
      title: '',
      subtitle: '',
      buttons: [{
        buttonText: '',
        buttonType: 'url',
        buttonUrl: ''
      }]
    });
    
    setTemplates(newTemplates);
  };

  const removeCarouselItem = (templateIndex: number, itemIndex: number) => {
    const newTemplates = [...templates];
    if (newTemplates[templateIndex].carouselItems && newTemplates[templateIndex].carouselItems!.length > 1) {
      newTemplates[templateIndex].carouselItems = newTemplates[templateIndex].carouselItems!.filter((_, i) => i !== itemIndex);
      setTemplates(newTemplates);
    }
  };

  const updateCarouselItem = (templateIndex: number, itemIndex: number, field: keyof CarouselItem, value: any) => {
    const newTemplates = [...templates];
    if (newTemplates[templateIndex].carouselItems) {
      newTemplates[templateIndex].carouselItems![itemIndex] = { 
        ...newTemplates[templateIndex].carouselItems![itemIndex], 
        [field]: value 
      };
      setTemplates(newTemplates);
    }
  };

  const addButton = (templateIndex: number, itemIndex: number) => {
    const newTemplates = [...templates];
    if (newTemplates[templateIndex].carouselItems) {
      newTemplates[templateIndex].carouselItems![itemIndex].buttons.push({
        buttonText: '',
        buttonType: 'url',
        buttonUrl: ''
      });
      setTemplates(newTemplates);
    }
  };

  const removeButton = (templateIndex: number, itemIndex: number, buttonIndex: number) => {
    const newTemplates = [...templates];
    if (newTemplates[templateIndex].carouselItems && 
        newTemplates[templateIndex].carouselItems![itemIndex].buttons.length > 1) {
      newTemplates[templateIndex].carouselItems![itemIndex].buttons = 
        newTemplates[templateIndex].carouselItems![itemIndex].buttons.filter((_, i) => i !== buttonIndex);
      setTemplates(newTemplates);
    }
  };

  const updateButton = (templateIndex: number, itemIndex: number, buttonIndex: number, field: keyof ButtonOption, value: any) => {
    const newTemplates = [...templates];
    if (newTemplates[templateIndex].carouselItems) {
      newTemplates[templateIndex].carouselItems![itemIndex].buttons[buttonIndex] = { 
        ...newTemplates[templateIndex].carouselItems![itemIndex].buttons[buttonIndex], 
        [field]: value 
      };
      
      // If changing button type, initialize the correct field
      if (field === 'buttonType') {
        if (value === 'url') {
          newTemplates[templateIndex].carouselItems![itemIndex].buttons[buttonIndex].buttonUrl = '';
          delete newTemplates[templateIndex].carouselItems![itemIndex].buttons[buttonIndex].buttonPayload;
        } else {
          newTemplates[templateIndex].carouselItems![itemIndex].buttons[buttonIndex].buttonPayload = '';
          delete newTemplates[templateIndex].carouselItems![itemIndex].buttons[buttonIndex].buttonUrl;
        }
      }
      
      setTemplates(newTemplates);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate fields
    const isValid = templates.every(template => {
      // Check that title and payload are not empty
      if (!template.title || template.title.trim() === '' || !template.payload || template.payload.trim() === '') {
        return false;
      }
      
      if (template.messageType === 'text') {
        return template.text && template.text.trim() !== '';
      } else if (template.messageType === 'carousel') {
        return template.carouselItems && template.carouselItems.every(item => 
          item.image && item.title && item.subtitle && item.buttons.every(button => {
            if (button.buttonType === 'url') {
              return button.buttonText && button.buttonUrl;
            } else {
              return button.buttonText && button.buttonPayload;
            }
          })
        );
      }
      return false;
    });

    if (!isValid) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please fill in all required fields.",
      });
      return;
    }

    try {
      const tenentId = localStorage.getItem('tenentid');
      const response = await axios.post(
        'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/templatemessageroute/message-templates',
        {
          tenentId,
          templates
        }
      );

      if (response.data) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Message templates saved successfully!",
        });
        
        // Reset form
        setTemplates([{
          title: '',
          payload: '',
          messageType: 'text',
          text: '',
        }]);
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: "Failed to save message templates. Please try again.",
      });
    }
  };

  const handleUpdate = async () => {
    // Similar validation as handleSubmit
    const isValid = templates.every(template => {
      // Check that title and payload are not empty
      if (!template.title || template.title.trim() === '' || !template.payload || template.payload.trim() === '') {
        return false;
      }
      
      if (template.messageType === 'text') {
        return template.text && template.text.trim() !== '';
      } else if (template.messageType === 'carousel') {
        return template.carouselItems && template.carouselItems.every(item => 
          item.image && item.title && item.subtitle && item.buttons.every(button => {
            if (button.buttonType === 'url') {
              return button.buttonText && button.buttonUrl;
            } else {
              return button.buttonText && button.buttonPayload;
            }
          })
        );
      }
      return false;
    });

    if (!isValid) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please fill in all required fields.",
      });
      return;
    }

    try {
      const tenentId = localStorage.getItem('tenentid');
      const response = await axios.post(
        'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/templatemessageroute/message-templates/update',
        {
          tenentId,
          templates
        }
      );

      if (response.data) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Message templates updated successfully!",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: "Failed to update message templates. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 w-full">
      
      <div className="w-full max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-orange-100">
            <div className="flex justify-between items-center border-b border-orange-100 pb-4 mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Message Templates</h2>
              <button
                type="button"
                onClick={addTemplate}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-md text-base shadow-md hover:bg-orange-700 transition-all duration-300"
              >
                <Plus size={16} />
                Add Template
              </button>
            </div>

            {templates.map((template, templateIndex) => (
              <div key={templateIndex} className="space-y-5 p-5 bg-white border border-orange-100 rounded-lg shadow-sm mb-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-800">Template {templateIndex + 1}</h3>
                  {templates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTemplate(templateIndex)}
                      className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-50"
                    >
                      <Minus size={20} />
                    </button>
                  )}
                </div>
                
                {/* Added Title Input Field */}
                <div className="mb-4">
                  <label className="block text-gray-700 text-base font-medium mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={template.title}
                    onChange={(e) => updateTemplate(templateIndex, 'title', e.target.value)}
                    placeholder="Enter template title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                  />
                </div>
                
                {/* Payload Input Field */}
                <div className="mb-4">
                  <label className="block text-gray-700 text-base font-medium mb-2">Payload</label>
                  <input
                    type="text"
                    required
                    value={template.payload}
                    onChange={(e) => updateTemplate(templateIndex, 'payload', e.target.value)}
                    placeholder="Enter message payload"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-base font-medium mb-2">Message Type</label>
                  <select
                    value={template.messageType}
                    onChange={(e) => updateTemplate(templateIndex, 'messageType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                  >
                    <option value="text">Text</option>
                    <option value="carousel">Carousel</option>
                  </select>
                </div>

                {template.messageType === 'text' && (
                  <div>
                    <label className="block text-gray-700 text-base font-medium mb-2">Message Text</label>
                    <textarea
                      value={template.text}
                      onChange={(e) => updateTemplate(templateIndex, 'text', e.target.value)}
                      rows={4}
                      placeholder="Enter your message text here..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    />
                  </div>
                )}

                {template.messageType === 'carousel' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-lg font-medium text-gray-700">Carousel Items</h4>
                      <button
                        type="button"
                        onClick={() => addCarouselItem(templateIndex)}
                        className="text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
                      >
                        <Plus size={16} />
                        Add Item
                      </button>
                    </div>

                    {template.carouselItems?.map((item, itemIndex) => (
                      <div key={itemIndex} className="p-4 border border-orange-100 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-md font-medium text-gray-700">Item {itemIndex + 1}</h5>
                          {template.carouselItems!.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCarouselItem(templateIndex, itemIndex)}
                              className="text-gray-400 hover:text-orange-600 transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Image URL</label>
                            <input
                              type="text"
                              value={item.image}
                              onChange={(e) => updateCarouselItem(templateIndex, itemIndex, 'image', e.target.value)}
                              placeholder="Enter image URL"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-700 text-sm font-medium mb-1">Title</label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => updateCarouselItem(templateIndex, itemIndex, 'title', e.target.value)}
                              placeholder="Enter title"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-medium mb-1">Subtitle</label>
                          <input
                            type="text"
                            value={item.subtitle}
                            onChange={(e) => updateCarouselItem(templateIndex, itemIndex, 'subtitle', e.target.value)}
                            placeholder="Enter subtitle"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-gray-700 text-sm font-medium">Buttons</label>
                            <button
                              type="button"
                              onClick={() => addButton(templateIndex, itemIndex)}
                              className="text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
                            >
                              <Plus size={14} />
                              Add Button
                            </button>
                          </div>

                          {item.buttons.map((button, buttonIndex) => (
                            <div key={buttonIndex} className="p-3 border border-gray-200 rounded-md">
                              <div className="flex justify-between items-center mb-2">
                                <h6 className="text-sm font-medium text-gray-700">Button {buttonIndex + 1}</h6>
                                {item.buttons.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeButton(templateIndex, itemIndex, buttonIndex)}
                                    className="text-gray-400 hover:text-orange-600 transition-colors"
                                  >
                                    <Minus size={14} />
                                  </button>
                                )}
                              </div>

                              <div className="mb-2">
                                <label className="block text-gray-700 text-xs font-medium mb-1">Button Text</label>
                                <input
                                  type="text"
                                  value={button.buttonText}
                                  onChange={(e) => updateButton(templateIndex, itemIndex, buttonIndex, 'buttonText', e.target.value)}
                                  placeholder="Enter button text"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="block text-gray-700 text-xs font-medium mb-1">Button Type</label>
                                <select
                                  value={button.buttonType}
                                  onChange={(e) => updateButton(templateIndex, itemIndex, buttonIndex, 'buttonType', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                                >
                                  <option value="url">URL</option>
                                  <option value="payload">Payload</option>
                                </select>
                              </div>

                              {button.buttonType === 'url' ? (
                                <div>
                                  <label className="block text-gray-700 text-xs font-medium mb-1">Button URL</label>
                                  <input
                                    type="text"
                                    value={button.buttonUrl || ''}
                                    onChange={(e) => updateButton(templateIndex, itemIndex, buttonIndex, 'buttonUrl', e.target.value)}
                                    placeholder="Enter URL"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-gray-700 text-xs font-medium mb-1">Button Payload</label>
                                  <input
                                    type="text"
                                    value={button.buttonPayload || ''}
                                    onChange={(e) => updateButton(templateIndex, itemIndex, buttonIndex, 'buttonPayload', e.target.value)}
                                    placeholder="Enter payload"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-orange-100">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                <Save size={16} />
                Save Message Templates
              </button>

              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                <Save size={16} />
                Update Message Templates
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateMessage;


