
import { useState, FormEvent, useEffect } from 'react';
import { Plus, Minus, Save, Link as LinkIcon, Image, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

interface ProductType {
  title: string;
  payload: string;
}

interface ProductUnit {
  unit: string;
  price: string;
  weight?: string; // Added weight field
  imageUrl?: string;
}

interface ProductColor {
  color: string;
  price: string;
  imageUrl?: string;
}

interface ProductDetailsTemplateProps {
  productName?: string;
  initialData?: ProductDetail;
}

interface ProductDetail {
  productName: string;
  productType: string;
  productDescription: string;
  units: ProductUnit[];
  colors: ProductColor[];
  websiteLink: string;
  sku?: string;
  productPhoto: File | null;
  productPhotoUrl?: string;
  productPhotoPreview: string;
  isExternalImage?: boolean;
}

const ProductDetailsTemplate: React.FC<ProductDetailsTemplateProps> = ({
  initialData
}) => {
  const [products, setProducts] = useState<ProductDetail[]>([
    initialData || {
      productName: '',
      productType: '',
      productDescription: '',
      sku: '',
      units: [{ unit: '', price: '', weight: '', imageUrl: '' }], // Added weight
      colors: [{ color: '', price: '', imageUrl: '' }],
      websiteLink: '',
      productPhoto: null,
      productPhotoPreview: '',
      productPhotoUrl: '',
      isExternalImage: false
    }
  ]);

  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typesFetchError, setTypesFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchProductTypes = async () => {
    setLoadingTypes(true);
    setTypesFetchError(null);
    try {
      const tenentId = localStorage.getItem('tenentid');
      if (!tenentId) {
        throw new Error('Tenant ID not found in localStorage');
      }
      const response = await axios.post('https://snaking-outhouse-oppose.ngrok-free.dev/api/templatesroute/Product-type-list', {
        tenentId
      });
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setProductTypes(response.data.data);
        setTypesFetchError(null);
      } else {
        setProductTypes([]);
        setTypesFetchError('No product types found or invalid response format');
      }
    } catch (error: any) {
      console.error("Failed to fetch product types:", error);
      setTypesFetchError(error.message || 'Unknown error occurred');
      if (error.response?.status === 404) {
        setProductTypes([]);
      }
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    fetchProductTypes();
  }, []);

  const handleProductTypeClick = () => {
    if (productTypes.length === 0 || typesFetchError) {
      fetchProductTypes();
    }
  };

  const addProduct = () => {
    setProducts([...products, {
      productName: '',
      productType: '',
      productDescription: '',
      sku: '',
      units: [{ unit: '', price: '', weight: '', imageUrl: '' }], // Added weight
      colors: [{ color: '', price: '', imageUrl: '' }],
      websiteLink: '',
      productPhoto: null,
      productPhotoPreview: '',
      productPhotoUrl: '',
      isExternalImage: false
    }]);
  };

  const removeProduct = (productIndex: number) => {
    if (products.length > 1) {
      const newProducts = products.filter((_, i) => i !== productIndex);
      setProducts(newProducts);
    }
  };

  const addUnit = (productIndex: number) => {
    const newProducts = [...products];
    newProducts[productIndex].units.push({ unit: '', price: '', weight: '', imageUrl: '' }); // Added weight
    setProducts(newProducts);
  };

  const removeUnit = (productIndex: number, unitIndex: number) => {
    if (products[productIndex].units.length > 1) {
      const newProducts = [...products];
      newProducts[productIndex].units = newProducts[productIndex].units.filter((_, i) => i !== unitIndex);
      setProducts(newProducts);
    }
  };

  const addColor = (productIndex: number) => {
    const newProducts = [...products];
    newProducts[productIndex].colors.push({ color: '', price: '', imageUrl: '' });
    setProducts(newProducts);
  };

  const removeColor = (productIndex: number, colorIndex: number) => {
    if (products[productIndex].colors.length > 1) {
      const newProducts = [...products];
      newProducts[productIndex].colors = newProducts[productIndex].colors.filter((_, i) => i !== colorIndex);
      setProducts(newProducts);
    }
  };

  const updateColor = (productIndex: number, colorIndex: number, field: keyof ProductColor, value: string) => {
    const newProducts = [...products];
    newProducts[productIndex].colors[colorIndex] = {
      ...newProducts[productIndex].colors[colorIndex],
      [field]: value
    };
    setProducts(newProducts);
  };

  const handlePhotoChange = (productIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: "error",
          title: "File Too Large",
          text: "Please select an image smaller than 5MB.",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: "error",
          title: "Invalid File Type",
          text: "Please select a valid image file.",
        });
        return;
      }

      const newProducts = [...products];
      newProducts[productIndex].productPhoto = file;
      newProducts[productIndex].productPhotoUrl = undefined;
      newProducts[productIndex].isExternalImage = false;
      newProducts[productIndex].productPhotoPreview = URL.createObjectURL(file);
      setProducts(newProducts);
    }
  };

  const handleImageUrlInput = (productIndex: number, url: string) => {
    const newProducts = [...products];
    newProducts[productIndex].productPhoto = null;
    newProducts[productIndex].productPhotoUrl = url;
    newProducts[productIndex].isExternalImage = true;
    newProducts[productIndex].productPhotoPreview = url;
    setProducts(newProducts);
  };

  const updateProduct = (productIndex: number, field: keyof ProductDetail, value: any) => {
    const newProducts = [...products];
    newProducts[productIndex] = { ...newProducts[productIndex], [field]: value };
    setProducts(newProducts);
  };

  const updateUnit = (productIndex: number, unitIndex: number, field: keyof ProductUnit, value: string) => {
    const newProducts = [...products];
    newProducts[productIndex].units[unitIndex] = {
      ...newProducts[productIndex].units[unitIndex],
      [field]: value
    };
    setProducts(newProducts);
  };

  const prepareFormData = () => {
    const formData = new FormData();
    const tenentId = localStorage.getItem('tenentid');

    if (!tenentId) {
      throw new Error('Tenant ID not found in localStorage');
    }

    formData.append('tenentId', tenentId);

    const productsData = products.map(product => ({
      productName: product.productName.trim(),
      productType: product.productType,
      productDescription: product.productDescription.trim(),
      ...(product.sku && product.sku.trim() && { sku: product.sku.trim() }),
      websiteLink: product.websiteLink ? product.websiteLink.trim() : '',
      units: product.units.map(unit => ({
        unit: unit.unit.trim(),
        price: unit.price.trim(),
        weight: unit.weight?.trim() || '', // Added weight
        imageUrl: unit.imageUrl?.trim() || ''
      })),
      colors: product.colors
        .filter(color => color.color.trim() || color.price.trim() || color.imageUrl?.trim())
        .map(color => ({
          color: color.color.trim(),
          price: color.price.trim(),
          imageUrl: color.imageUrl?.trim() || ''
        })),
      productPhotoUrl: product.isExternalImage ? product.productPhotoUrl : undefined
    }));

    formData.append('products', JSON.stringify(productsData));

    products.forEach((product, index) => {
      if (!product.isExternalImage && product.productPhoto) {
        formData.append(`products[${index}][productPhoto]`, product.productPhoto);
      }
    });

    return formData;
  };

  const validateProducts = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (products.length === 0) {
      errors.push('At least one product is required');
      return { isValid: false, errors };
    }

    products.forEach((product, index) => {
      const productNum = index + 1;

      if (!product.productName.trim()) {
        errors.push(`Product ${productNum}: Product name is required`);
      }

      if (!product.productType.trim()) {
        errors.push(`Product ${productNum}: Product type is required`);
      }

      if (product.websiteLink.trim()) {
        try {
          new URL(product.websiteLink);
        } catch {
          errors.push(`Product ${productNum}: Please enter a valid URL`);
        }
      }

      if (!product.productPhoto && !product.productPhotoUrl) {
        errors.push(`Product ${productNum}: Main product photo is required`);
      }

      if (product.units.length === 0) {
        errors.push(`Product ${productNum}: At least one unit is required`);
      } else {
        product.units.forEach((unit, unitIndex) => {
          if (!unit.unit.trim()) {
            errors.push(`Product ${productNum}, Unit ${unitIndex + 1}: Unit name is required`);
          }
          if (!unit.price.trim()) {
            errors.push(`Product ${productNum}, Unit ${unitIndex + 1}: Price is required`);
          }
          if (unit.imageUrl && unit.imageUrl.trim()) {
            try {
              new URL(unit.imageUrl);
            } catch {
              errors.push(`Product ${productNum}, Unit ${unitIndex + 1}: Invalid image URL`);
            }
          }
        });
      }

      if (product.colors && product.colors.length > 0) {
        product.colors.forEach((color, colorIndex) => {
          const hasColorName = color.color && color.color.trim();
          const hasColorPrice = color.price && color.price.trim();
          const hasImageUrl = color.imageUrl && color.imageUrl.trim();

          if (hasColorName || hasColorPrice || hasImageUrl) {
            if (!hasColorName) {
              errors.push(`Product ${productNum}, Color ${colorIndex + 1}: Color name is required if color details are provided.`);
            }
            if (!hasColorPrice) {
              errors.push(`Product ${productNum}, Color ${colorIndex + 1}: Price is required if color details are provided.`);
            }
          }

          if (hasImageUrl) {
            try {
              new URL(color.imageUrl!);
            } catch {
              errors.push(`Product ${productNum}, Color ${colorIndex + 1}: Invalid image URL`);
            }
          }
        });
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  const resetForm = () => {
    setProducts([{
      productName: '',
      productType: '',
      productDescription: '',
      sku: '',
      units: [{ unit: '', price: '', weight: '', imageUrl: '' }], // Added weight
      colors: [{ color: '', price: '', imageUrl: '' }],
      websiteLink: '',
      productPhoto: null,
      productPhotoPreview: '',
      productPhotoUrl: '',
      isExternalImage: false
    }]);
  };

  const showValidationErrors = (errors: string[]) => {
    const errorList = errors.map(error => `• ${error}`).join('\n');
    Swal.fire({
      icon: "error",
      title: "Validation Errors",
      text: errorList,
      confirmButtonColor: '#dc2626'
    });
  };

  const handleUpdate = async () => {
    const validation = validateProducts();
    if (!validation.isValid) {
      showValidationErrors(validation.errors);
      return;
    }

    setIsUpdating(true);
    try {
      const formData = prepareFormData();
      const response = await axios.post(
        'https://snaking-outhouse-oppose.ngrok-free.dev/api/templatesroute/product-details/update',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      if (response.data) {
        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Product details updated successfully in both collections!",
          confirmButtonColor: '#059669'
        });
        resetForm();
      }
    } catch (error: any) {
      console.error('❌ UPDATE ERROR:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: `Failed to update product details: ${errorMessage}`,
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validation = validateProducts();
    if (!validation.isValid) {
      showValidationErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = prepareFormData();
      const response = await axios.post(
        'https://snaking-outhouse-oppose.ngrok-free.dev/api/templatesroute/product-details',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      if (response.data) {
        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Product details saved successfully to both ProductDetail and ProductList collections!",
          confirmButtonColor: '#059669'
        });
        resetForm();
      }
    } catch (error: any) {
      console.error('❌ SAVE ERROR:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: `Failed to save product details: ${errorMessage}`,
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 pb-36 w-full">


      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 border border-orange-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-orange-100 pb-4 mb-4 gap-3">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Product Details</h2>
              </div>
              <button
                type="button"
                onClick={addProduct}
                disabled={isSubmitting || isUpdating}
                className="flex items-center justify-center gap-1 md:gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-md text-sm md:text-base shadow-md hover:bg-orange-700 transition-all duration-300 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>

            {products.map((product, productIndex) => (
              <div key={productIndex} className="space-y-4 p-3 md:p-5 bg-white border border-orange-100 rounded-lg shadow-sm mb-4 md:mb-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg md:text-xl font-semibold text-gray-800">Product {productIndex + 1}</h3>
                  {products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProduct(productIndex)}
                      disabled={isSubmitting || isUpdating}
                      className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm md:text-base font-medium mb-1 md:mb-2">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      value={product.productName}
                      onChange={(e) => updateProduct(productIndex, 'productName', e.target.value)}
                      placeholder="e.g. Face Cream"
                      disabled={isSubmitting || isUpdating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm md:text-base font-medium mb-1 md:mb-2">
                      Product Type <span className="text-red-500">*</span>
                      {loadingTypes && (
                        <span className="ml-2 inline-block animate-spin text-orange-500">
                          <RefreshCw size={14} />
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={product.productType}
                        onChange={(e) => updateProduct(productIndex, 'productType', e.target.value)}
                        onClick={handleProductTypeClick}
                        disabled={isSubmitting || isUpdating || loadingTypes}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Select a product type</option>
                        {productTypes.length > 0 ? (
                          productTypes.map((type, i) => (
                            <option key={i} value={type.title}>
                              {type.title}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            {typesFetchError ? 'Error loading types - click to retry' : 'No product types available'}
                          </option>
                        )}
                      </select>
                      {productTypes.length === 0 && !loadingTypes && (
                        <button
                          type="button"
                          onClick={fetchProductTypes}
                          disabled={isSubmitting || isUpdating}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 hover:text-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Refresh product types"
                        >
                          <RefreshCw size={18} />
                        </button>
                      )}
                    </div>
                    {typesFetchError && (
                      <div className="flex items-center gap-2 text-red-500 text-xs mt-1">
                        <AlertCircle size={12} />
                        <span>{typesFetchError}</span>
                        <button
                          type="button"
                          onClick={fetchProductTypes}
                          disabled={isSubmitting || isUpdating}
                          className="text-orange-500 underline hover:text-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm md:text-base font-medium mb-1 md:mb-2">Product Description</label>
                    <textarea
                      value={product.productDescription}
                      onChange={(e) => updateProduct(productIndex, 'productDescription', e.target.value)}
                      placeholder="Describe your product features, benefits, and specifications..."
                      rows={3}
                      disabled={isSubmitting || isUpdating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500 text-sm md:text-base resize-vertical disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm md:text-base font-medium mb-1 md:mb-2">SKU</label>
                    <input
                      value={product.sku || ''}
                      onChange={(e) => updateProduct(productIndex, 'sku', e.target.value)}
                      placeholder="e.g. PROD-123"
                      disabled={isSubmitting || isUpdating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:border-orange-500 focus:outline-none focus:ring-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm md:text-base font-medium mb-1 md:mb-2">
                    Website Link
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={product.websiteLink}
                      onChange={(e) => updateProduct(productIndex, 'websiteLink', e.target.value)}
                      placeholder="https://example.com/product"
                      disabled={isSubmitting || isUpdating}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <LinkIcon className="absolute left-3 top-2.5 text-orange-400" size={16} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-700 text-sm md:text-base font-medium">
                      Units & Prices <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => addUnit(productIndex)}
                      disabled={isSubmitting || isUpdating}
                      className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {product.units.map((unit, unitIndex) => (
                    <div key={unitIndex} className="p-3 border border-gray-200 rounded-lg bg-gray-50 mb-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                          <input
                            required
                            value={unit.unit}
                            onChange={(e) => updateUnit(productIndex, unitIndex, 'unit', e.target.value)}
                            placeholder="e.g. 100ml, XL, Large"
                            disabled={isSubmitting || isUpdating}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          <input
                            required
                            type="text"
                            value={unit.price}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              if (!inputValue) {
                                updateUnit(productIndex, unitIndex, 'price', '');
                                return;
                              }
                              const valueWithoutSymbol = inputValue.replace(/₹/g, '');
                              updateUnit(productIndex, unitIndex, 'price', valueWithoutSymbol);
                            }}
                            placeholder="₹0.00"
                            disabled={isSubmitting || isUpdating}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          {product.units.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeUnit(productIndex, unitIndex)}
                              disabled={isSubmitting || isUpdating}
                              className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-50 ml-auto md:ml-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                        </div>

                        {/* Weight Input Field */}
                        <input
                          type="text"
                          placeholder="Weight (optional, e.g. 500g, 1kg)"
                          value={unit.weight || ''}
                          onChange={(e) => updateUnit(productIndex, unitIndex, 'weight', e.target.value)}
                          disabled={isSubmitting || isUpdating}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />

                        <input
                          type="url"
                          placeholder="Image URL for this unit (optional)"
                          value={unit.imageUrl || ''}
                          onChange={(e) => updateUnit(productIndex, unitIndex, 'imageUrl', e.target.value)}
                          disabled={isSubmitting || isUpdating}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {unit.imageUrl && (
                          <div className="mt-2">
                            <img
                              src={unit.imageUrl}
                              alt={`${unit.unit} variant`}
                              className="w-16 h-16 object-cover rounded-md border border-gray-200"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-700 text-sm md:text-base font-medium">
                      Colors & Prices (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => addColor(productIndex)}
                      disabled={isSubmitting || isUpdating}
                      className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {product.colors.map((color, colorIndex) => (
                    <div key={colorIndex} className="p-3 border border-gray-200 rounded-lg bg-gray-50 mb-2">
                      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-center">
                        <input
                          // Removed 'required' attribute here to make color optional
                          value={color.color}
                          onChange={(e) => updateColor(productIndex, colorIndex, 'color', e.target.value)}
                          placeholder="Color name (e.g. Red)"
                          disabled={isSubmitting || isUpdating}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <input
                          // Removed 'required' attribute here to make price optional unless color name is filled
                          type="text"
                          value={color.price}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (!inputValue) {
                              updateColor(productIndex, colorIndex, 'price', '');
                              return;
                            }
                            const valueWithoutSymbol = inputValue.replace(/₹/g, '');
                            updateColor(productIndex, colorIndex, 'price', valueWithoutSymbol);
                          }}
                          placeholder="Price (₹0.00)"
                          disabled={isSubmitting || isUpdating}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {product.colors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColor(productIndex, colorIndex)}
                            disabled={isSubmitting || isUpdating}
                            className="text-gray-400 hover:text-orange-600 transition-colors p-1 rounded-full hover:bg-orange-50 ml-auto md:ml-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                      </div>
                      <div className="mt-2">
                        <input
                          type="url"
                          placeholder="Image URL for this color (optional)"
                          value={color.imageUrl || ''}
                          onChange={(e) => updateColor(productIndex, colorIndex, 'imageUrl', e.target.value)}
                          disabled={isSubmitting || isUpdating}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-
                          -none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {color.imageUrl && (
                          <div className="mt-2">
                            <img
                              src={color.imageUrl}
                              alt={`${color.color} variant`}
                              className="w-16 h-16 object-cover rounded-md border border-gray-200"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2">
                    Main Product Photo <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-10">
                    <label className={`cursor-pointer mb-2 md:mb-0 ${(isSubmitting || isUpdating) ? 'pointer-events-none opacity-50' : ''}`}>
                      <div className="relative">
                        {product.productPhotoPreview ? (
                          <div className="relative">
                            <img
                              src={product.productPhotoPreview}
                              alt="Product preview"
                              className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg border-2 border-orange-200"
                            />
                            {product.isExternalImage && (
                              <div className="absolute top-1 right-1 bg-green-100 text-green-600 rounded-full p-1">
                                <CheckCircle size={12} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-dashed border-orange-200 rounded-md flex items-center justify-center bg-orange-50">
                            <Image className="text-orange-400" size={24} />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoChange(productIndex, e)}
                          disabled={isSubmitting || isUpdating}
                          className="hidden"
                        />
                      </div>
                    </label>
                    <div className="flex-1">
                      <input
                        type="url"
                        placeholder="Or enter image URL (https://...)"
                        value={product.productPhotoUrl || ''}
                        onChange={(e) => handleImageUrlInput(productIndex, e.target.value)}
                        disabled={isSubmitting || isUpdating}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload a file or provide an image URL. Max file size: 5MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 border border-orange-100">
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting || isUpdating}
                className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving to Both Collections...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Product Details
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleUpdate}
                disabled={isSubmitting || isUpdating}
                className="w-full px-4 py-2.5 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Updating Both Collections...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Update Product Details
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductDetailsTemplate;

