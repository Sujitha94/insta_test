import { useState, FormEvent } from 'react';
import {  Save, Tag } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

interface ProductType {
  title: string;
  payload: string;
}

const ProductTypeTemplate = () => {
  const [productTypes, setProductTypes] = useState<ProductType[]>([
    { title: '', payload: '' }
  ]);

  const addProductType = () => {
    if (productTypes.length < 3) {
      setProductTypes([...productTypes, { title: '', payload: '' }]);
    }
  };

  const removeProductType = (index: number) => {
    if (productTypes.length > 1) {
      const newTypes = productTypes.filter((_, i) => i !== index);
      setProductTypes(newTypes);
    }
  };

  const updateProductType = (index: number, field: keyof ProductType, value: string) => {
    const newTypes = [...productTypes];
    newTypes[index] = { ...newTypes[index], [field]: value };
    if (field === 'title') {
      newTypes[index].payload = `${value.toUpperCase().replace(/\s+/g, '_')}_CATEGORY`;
    }
    setProductTypes(newTypes);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (productTypes.some(type => !type.title.trim())) {
      Swal.fire({ icon: "error", title: "Empty Fields", text: "Please fill in all required fields before saving." });
      return;
    }

    try {
      const tenentId = localStorage.getItem('tenentid');
      const response = await axios.post(
        `https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/templatesroute/product-type`,
        { tenentId, productTypes }
      );
      if (response.data) {
        Swal.fire({ icon: "success", title: "Success", text: "Product types saved successfully!" });
        setProductTypes([{ title: '', payload: '' }]);
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "Save Failed", text: "Failed to save product types. Please try again." });
    }
  };

  return (
    <div className="bg-[#F8F9FB] min-h-screen w-full pb-36">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex-1 text-center sm:text-right sm:pr-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center justify-center sm:justify-end gap-2">
              <Tag className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              Product Types
            </h1>
            <p className="text-slate-500 font-normal mt-1 text-xs sm:text-sm">
              Configure your product type categories and payloads
            </p>
          </div>
        </div>

        {/* Main Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-3 sm:p-6 space-y-4 sm:space-y-6">

            {productTypes.map((type, index) => (
              <div key={index} className="bg-slate-50 rounded-xl border border-slate-100 p-3 sm:p-5">

                <div className="flex justify-between items-center mb-3 sm:mb-4 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900">Product Type {index + 1}</h2>
                  </div>
                  {productTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProductType(index)}
                      className="text-orange-600 hover:text-orange-700 text-xs sm:text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">1.</span> Title
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      required
                      value={type.title}
                      onChange={(e) => updateProductType(index, 'title', e.target.value)}
                      placeholder="e.g. Electronics"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">2.</span> Payload
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      required
                      value={type.payload}
                      onChange={(e) => updateProductType(index, 'payload', e.target.value)}
                      placeholder="e.g. ELECTRONICS_CATEGORY"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                    <p className="text-[10px] text-slate-400 ml-1">Auto-generated from title, or enter manually</p>
                  </div>
                </div>

              </div>
            ))}

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:justify-between pt-3 sm:pt-4 border-t border-slate-100 gap-3 sm:gap-0">
              {productTypes.length < 3 && (
                <button
                  type="button"
                  onClick={addProductType}
                  className="px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-100 text-xs font-medium transition-all"
                >
                  + Add Another Type
                </button>
              )}
              {productTypes.length >= 3 && <div />}

              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-200 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Save size={14} />
                Save Product Types
              </button>
            </div>

          </div>
        </form>

      </div>
    </div>
  );
};

export default ProductTypeTemplate;
