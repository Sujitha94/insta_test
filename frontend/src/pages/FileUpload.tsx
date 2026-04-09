import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    // Set initial value
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      Swal.fire({
        icon: 'error',
        title: 'No File Selected',
        text: 'Please select a file to upload.',
      });
      return;
    }
    const tenentId = localStorage.getItem('tenentid');
    if (!tenentId) {
      throw new Error('Required identifiers not found in local storage');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append("tenentId", tenentId);

    setUploading(true);
    try {
      
      const response = await axios.post(
        'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/fileuploadroute/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      Swal.fire({
        icon: 'success',
        title: 'Upload Successful',
        text: response.data.message,
      });
      
      // Reset the file state after successful upload
      setFile(null);
      // Reset the file input element
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: 'Failed to upload file. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  // Function to truncate filename for mobile display
  const getDisplayFileName = () => {
    if (!file) return 'No file chosen';
    
    if (isMobileView && file.name.length > 15) {
      const extension = file.name.split('.').pop();
      const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
      return `${baseName.substring(0, 10)}...${extension}`;
    }
    
    return file.name;
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 w-full">
      
      <div className="w-full max-w-[410px] mx-auto">
        <div className="bg-white shadow-lg px-4 sm:px-6 py-4 sm:py-5 text-center rounded-xl">
          <h1 className="text-xl sm:text-2xl font-bold text-black">Upload File</h1>
        </div>
        <div className="bg-white shadow-lg px-3 sm:px-6 py-4 sm:py-6 mt-4 sm:mt-5 text-center rounded-xl">
          <div className={`text-center px-2 sm:px-4 py-4 sm:py-[22px] mt-1 bg-orange-400 rounded-lg ${isMobileView ? 'flex flex-col items-center' : ''}`}>
            <label
              htmlFor="file-input"
              className={`px-3 py-2 sm:py-3 border-4 border-white text-black bg-white rounded-lg hover:bg-gray-100 text-base sm:text-lg font-semibold disabled:bg-gray-300 transition-all duration-300 ${isMobileView ? 'mb-2' : '-ms-10'}`}
            >
              Choose File
            </label>
            <span
              className={`text-white text-sm sm:text-lg font-medium ${isMobileView ? 'mt-1 break-all max-w-full' : 'ml-7'}`}
            >
              {getDisplayFileName()}
            </span>
            <input
              type="file"
              id="file-input"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-6 sm:px-8 py-2.5 sm:py-3 mt-4 sm:mt-6 w-full border-2 text-center border-orange-400 text-orange-700 rounded-lg text-base sm:text-lg font-semibold hover:bg-orange-300 hover:border-orange-500 transition-colors duration-200"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        </div>
      </div>
    </div>
  );
}


