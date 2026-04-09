import { useState, useEffect } from 'react';
import { Search, Edit, Trash2, Plus, ArrowUpDown, AlertCircle, X, Package, Grid, List } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

interface Unit {
  unit: string;
  price: string;
  quantityInStock: number;
  lastRestocked?: string;
  sku: string;
}

interface ProductInventoryItem {
  id: string;
  productName: string;
  sku: string;
  units: Unit[];
  overallStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'N/A';
  imageUrl: string;
  productDescription: string;
}

const ProductInventorySize: React.FC = () => {
  const [products, setProducts] = useState<ProductInventoryItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductInventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ProductInventoryItem | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<ProductInventoryItem | null>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // State for view mode

  useEffect(() => {
    fetchProducts();
    
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Function to calculate overall status based on units' stock
  const calculateOverallStatus = (units: Unit[]): 'In Stock' | 'Low Stock' | 'Out of Stock' | 'N/A' => {
    if (!units || units.length === 0) return 'N/A';
    
    const totalStock = units.reduce((sum, unit) => sum + unit.quantityInStock, 0);
    if (totalStock <= 0) return 'Out of Stock';
    if (totalStock <= 5) return 'Low Stock'; // Example threshold for low stock
    return 'In Stock';
  };
  
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const tenentId = localStorage.getItem('tenentid');
      
      const response = await axios.get('https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/productinventorysizeroute/inventory', {                                                                                         
        params: { tenentId }
      });
      
      if (response.data && response.data.products) {
        const transformedProducts = response.data.products.map((item: any) => ({
          id: item._id || item.id,
          productName: item.productName,
          sku: item.sku || '',
          units: item.units || [],
          // Recalculate overallStatus based on fetched units
          overallStatus: calculateOverallStatus(item.units || []),
          imageUrl: item.productPhotoUrl || '',
          productDescription: item.productDescription || ''
        }));
        
        setProducts(transformedProducts);
        // Apply current search and sort after fetching
        applyFiltersAndSorting(transformedProducts, searchTerm, sortField, sortDirection);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Swal.fire({
        icon: "error",
        title: "Failed to Load Inventory",
        text: "Could not fetch products from the server. Please try again later.",
      });
      
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSorting = (
    currentProducts: ProductInventoryItem[], 
    term: string, 
    field: keyof ProductInventoryItem | '', 
    direction: 'asc' | 'desc'
  ) => {
    let tempProducts = [...currentProducts];

    // Apply search filter
    if (term) {
      tempProducts = tempProducts.filter(product => 
        product.productName.toLowerCase().includes(term.toLowerCase()) || 
        product.sku.toLowerCase().includes(term.toLowerCase())
      );
    }

    // Apply sorting
    if (field) {
      tempProducts.sort((a, b) => {
        if (field === 'units') {
          const unitA = a.units[0]?.unit || '';
          const unitB = b.units[0]?.unit || '';
          if (unitA < unitB) return direction === 'asc' ? -1 : 1;
          if (unitA > unitB) return direction === 'asc' ? 1 : -1;
          return 0;
        }
        
        const valueA = String(a[field]).toLowerCase();
        const valueB = String(b[field]).toLowerCase();
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setFilteredProducts(tempProducts);
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    applyFiltersAndSorting(products, term, sortField, sortDirection);
  };
  
  const handleSort = (field: keyof ProductInventoryItem) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    applyFiltersAndSorting(products, searchTerm, field, newDirection);
  };
  
  const handleEdit = (product: ProductInventoryItem) => {
    setEditingProduct({...product});
  };
  
  const handleUpdateProductField = (field: keyof ProductInventoryItem, value: any) => {
    if (editingProduct) {
      setEditingProduct({
        ...editingProduct,
        [field]: value
      });
    }
  };

  const handleUpdateUnit = (index: number, field: 'unit' | 'price' | 'sku', value: string) => {
    if (editingProduct) {
      const newUnits = [...editingProduct.units];
      if (newUnits[index]) {
        newUnits[index] = { ...newUnits[index], [field]: value };
      }
      setEditingProduct({
        ...editingProduct,
        units: newUnits
      });
    }
  };

  const handleUpdateUnitStock = (unitIndex: number, value: number) => {
    if (editingProduct) {
      const newUnits = [...editingProduct.units];
      if (newUnits[unitIndex]) {
        newUnits[unitIndex] = { ...newUnits[unitIndex], quantityInStock: value };
      }
      setEditingProduct({
        ...editingProduct,
        units: newUnits,
        // Update overall status immediately in the edit form
        overallStatus: calculateOverallStatus(newUnits) 
      });
    }
  };

  const handleAddUnit = () => {
    if (editingProduct) {
      setEditingProduct({
        ...editingProduct,
        units: [...editingProduct.units, { 
          unit: '', 
          price: '', 
          quantityInStock: 0,
          sku: '' 
        }]
      });
    }
  };

  const handleRemoveUnit = (index: number) => {
    if (editingProduct) {
      const newUnits = editingProduct.units.filter((_, i) => i !== index);
      setEditingProduct({
        ...editingProduct,
        units: newUnits,
        // Update overall status after removing a unit
        overallStatus: calculateOverallStatus(newUnits)
      });
    }
  };

  const handleRestockUnit = async (productId: string, unitIndex: number, unitName: string) => {
    Swal.fire({
      title: `Restock ${unitName}`,
      input: 'number',
      inputLabel: 'Enter quantity to add',
      inputPlaceholder: 'Quantity',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || parseInt(value) <= 0) {
          return 'Please enter a valid quantity';
        }
        return null;
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        try {
          const quantity = parseInt(result.value);
          const tenentId = localStorage.getItem('tenentid');
          
          const response = await axios.post(
            `https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/productinventorysizeroute/inventory/${productId}/units/${unitIndex}/restock`,
            {
              tenentId,
              addQuantity: quantity
            }
          );
          
          if (response.data) {
            // OPTIMIZATION: Update state directly instead of refetching all products
            setProducts(prevProducts => prevProducts.map(product => {
              if (product.id === productId) {
                const newUnits = [...product.units];
                if (newUnits[unitIndex]) {
                  newUnits[unitIndex] = {
                    ...newUnits[unitIndex],
                    quantityInStock: response.data.newQuantityInStock, // Assuming API returns new stock
                    lastRestocked: new Date().toISOString() // Update restock date
                  };
                }
                return {
                  ...product,
                  units: newUnits,
                  overallStatus: calculateOverallStatus(newUnits) // Recalculate status
                };
              }
              return product;
            }));

            setFilteredProducts(prevFilteredProducts => prevFilteredProducts.map(product => {
              if (product.id === productId) {
                const newUnits = [...product.units];
                if (newUnits[unitIndex]) {
                  newUnits[unitIndex] = {
                    ...newUnits[unitIndex],
                    quantityInStock: response.data.newQuantityInStock, // Assuming API returns new stock
                    lastRestocked: new Date().toISOString() // Update restock date
                  };
                }
                return {
                  ...product,
                  units: newUnits,
                  overallStatus: calculateOverallStatus(newUnits) // Recalculate status
                };
              }
              return product;
            }));

            // If currently editing, update the editingProduct as well
            if (editingProduct && editingProduct.id === productId) {
              setEditingProduct(prevEditingProduct => {
                if (!prevEditingProduct) return null;
                const newUnits = [...prevEditingProduct.units];
                if (newUnits[unitIndex]) {
                  newUnits[unitIndex] = {
                    ...newUnits[unitIndex],
                    quantityInStock: response.data.newQuantityInStock,
                    lastRestocked: new Date().toISOString()
                  };
                }
                return {
                  ...prevEditingProduct,
                  units: newUnits,
                  overallStatus: calculateOverallStatus(newUnits)
                };
              });
            }
            
            Swal.fire(
              'Restocked!',
              `Added ${quantity} items to ${unitName}. New stock: ${response.data.newQuantityInStock}.`,
              'success'
            );
          }
        } catch (error: any) {
          console.error('Error restocking unit:', error);
          Swal.fire({
            icon: "error",
            title: "Restock Failed",
            text: error.response?.data?.message || "Failed to restock unit. Please try again.",
          });
        }
      }
    });
  };
  
  const saveEditedProduct = async () => {
    if (!editingProduct) return;

    const invalidUnits = editingProduct.units.some(u => !u.unit.trim() || !u.price.trim());
    if (invalidUnits) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Units",
        text: "Please ensure all unit names and prices are filled out, or remove empty units.",
      });
      return;
    }
    
    try {
      const tenentId = localStorage.getItem('tenentid');
      
      const productData = {
        id: editingProduct.id,
        tenentId,
        productName: editingProduct.productName,
        sku: editingProduct.sku,
        units: editingProduct.units,
        productDescription: editingProduct.productDescription
      };
      
      const response = await axios.put(
        `https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/productinventorysizeroute/inventory/${editingProduct.id}`,
        productData
      );
      
      if (response.data) {
        // OPTIMIZATION: Update the specific product in state instead of refetching all
        const updatedProduct = {
          ...editingProduct,
          // Ensure overallStatus is recalculated for the updated product
          overallStatus: calculateOverallStatus(editingProduct.units),
          // Assuming the API might return an updated productPhotoUrl if changed, otherwise keep existing
          imageUrl: response.data.productPhotoUrl || editingProduct.imageUrl 
        };

        setProducts(prevProducts => 
          prevProducts.map(p => (p.id === updatedProduct.id ? updatedProduct : p))
        );
        setFilteredProducts(prevFilteredProducts => 
          prevFilteredProducts.map(p => (p.id === updatedProduct.id ? updatedProduct : p))
        );
        
        setEditingProduct(null);
        
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Product inventory updated successfully!",
        });
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.response?.data?.message || "Failed to update product inventory. Please try again.",
      });
    }
  };
  
  const handleDelete = async (productName: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const tenentId = localStorage.getItem('tenentid');
          await axios.delete(`https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/productinventorysizeroute/inventory/${productName}`, {                                                                                                                                                                                    
            params: { tenentId }
          });
          
          const updatedProducts = products.filter(product => product.productName !== productName);
          setProducts(updatedProducts);
          setFilteredProducts(updatedProducts); // Ensure filtered list is also updated
          
          Swal.fire(
            'Deleted!',
            'The product has been removed from inventory.',
            'success'
          );
        } catch (error: any) {
          console.error('Error deleting product:', error);
          Swal.fire({
            icon: "error",
            title: "Delete Failed",
            text: error.response?.data?.message || "Failed to delete product. Please try again.",
          });
        }
      }
    });
  };
  
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'bg-emerald-600';
      case 'Low Stock':
        return 'bg-amber-600';
      case 'Out of Stock':
        return 'bg-rose-600';
      default:
        return 'bg-slate-500';
    }
  };

  const getUnitStatusClass = (quantity: number) => {
    if (quantity <= 0) return 'bg-red-100 text-red-700';
    if (quantity <= 5) return 'bg-yellow-100 text-yellow-700'; // Low stock for individual units
    return 'bg-green-100 text-green-700';
  };
  
  const handleAddNewProduct = () => {
    window.location.href = '/product-details-template';
  };

  const renderMobileProductCard = (product: ProductInventoryItem) => {
    return (
      <div key={product.id} className="bg-white rounded-xl shadow-lg p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center border-2 border-orange-200">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.productName} 
                  className="h-12 w-12 rounded-full object-cover" 
                />
              ) : (
                <span className="text-orange-600 font-semibold">{product.productName.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className="text-base font-bold text-slate-900">{product.productName}</div>
        </div>
        
        <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 mb-4">
          <div><span className="font-medium">SKU:</span> {product.sku}</div>
          <div>
            <span className="font-medium">Units:</span>
            {product.units.length > 0 ? (
              <div className="mt-2 space-y-2">
                {product.units.map((u, i) => (
                  <div key={i} className="bg-slate-50 p-2 rounded text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{u.unit} - Rs{u.price}</span>
                      <button
                        onClick={() => handleRestockUnit(product.id, i, u.unit)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Package size={14} />
                        Restock
                      </button>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${getUnitStatusClass(u.quantityInStock)}`}>
                      {u.quantityInStock} in stock
                    </span>
                  </div>
                ))}
              </div>
            ) : 'N/A'}
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(product.overallStatus)} text-white`}>
            {product.overallStatus}
          </span>
        </div>
        
        <div className="flex justify-between gap-2">
          <button
            onClick={() => handleEdit(product)}
            className="flex-1 bg-orange-200 text-orange-800 transition-colors p-2 rounded-lg hover:bg-orange-300 flex items-center justify-center gap-1 text-sm font-medium"
          >
            <Edit size={16} /> Edit
          </button>
          <button
            onClick={() => handleDelete(product.productName)}
            className="flex-1 bg-purple-200 text-purple-800 transition-colors p-2 rounded-lg hover:bg-purple-300 flex items-center justify-center gap-1 text-sm font-medium"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    );
  };
  
  const renderProductListView = () => {
    return (
        <div className="space-y-3">
            {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-xl shadow-lg p-4 grid grid-cols-1 md:grid-cols-[2fr,1fr,3fr,1fr,1fr] items-center gap-4 transition-shadow hover:shadow-md">
                    
                    {/* Column 1: Product Info */}
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 flex-shrink-0">
                            {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.productName} className="h-12 w-12 rounded-full object-cover"/>
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
                                    <span className="text-orange-600 font-semibold">{product.productName.substring(0, 2).toUpperCase()}</span>
                                </div>
                            )}
                        </div>
                        <span className="font-bold text-slate-800">{product.productName}</span>
                    </div>
                    
                    {/* Column 2: SKU */}
                    <div className="text-slate-500 font-mono text-sm">
                        {product.sku}
                    </div>
                    
                    {/* Column 3: Units/Variants */}
                    <div className="space-y-2">
                        {product.units.length > 0 ? product.units.map((unit, unitIndex) => (
                            <div key={unitIndex} className="bg-slate-50 p-2 rounded-lg grid grid-cols-3 items-center gap-2 text-sm">
                                <div className="font-medium text-slate-800 whitespace-nowrap">
                                    <span>{unit.unit}</span>
                                    <span className="text-slate-500 ml-3">Rs{unit.price}</span>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs text-center font-medium ${getUnitStatusClass(unit.quantityInStock)}`}>
                                    {unit.quantityInStock} in stock
                                </div>
                                <button
                                    onClick={() => handleRestockUnit(product.id, unitIndex, unit.unit)}
                                    className="flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors font-semibold"
                                >
                                    <Package size={14} />
                                    Restock
                                </button>
                            </div>
                        )) : <div className="text-slate-400 text-sm">No units defined</div>}
                    </div>
                    
                    {/* Column 4: Overall Status */}
                    <div className="flex justify-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(product.overallStatus)} text-white`}>
                            {product.overallStatus}
                        </span>
                    </div>

                    {/* Column 5: Actions */}
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={() => handleEdit(product)} className="text-slate-500 hover:text-blue-600 transition-colors" title="Edit Product">
                            <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(product.productName)} className="text-slate-500 hover:text-red-600 transition-colors" title="Delete Product">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Loading inventory...</h2>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="py-12 px-4 sm:px-6 pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">Product Inventory</h1>
            
            <div className="flex w-full sm:w-auto items-center gap-2">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-10 pr-4 py-1.5 bg-white text-black border-2 border-orange-200 rounded-lg font-semibold placeholder-gray-500 focus:outline-none focus:bg-orange-100 hover:bg-orange-100 transition-all duration-300 text-sm md:text-base w-full"
                />
                <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-white border-2 border-orange-200 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('grid')} className={`p-1 rounded-md ${viewMode === 'grid' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}>
                      <Grid size={18}/>
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-1 rounded-md ${viewMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}>
                      <List size={18}/>
                  </button>
              </div>

              <button 
                onClick={handleAddNewProduct}
                className="flex items-center gap-2 px-3 py-1.5 bg-white text-black border-2 border-orange-200 rounded-lg font-semibold hover:bg-orange-100 transition-all duration-300 text-sm md:text-base"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Product</span>
              </button>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => handleSort('productName')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                sortField === 'productName' 
                  ? 'bg-orange-100 border-orange-300 text-orange-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Sort by Name {sortField === 'productName' && <ArrowUpDown className="inline ml-1" size={14} />}
            </button>
            <button
              onClick={() => handleSort('sku')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                sortField === 'sku' 
                  ? 'bg-orange-100 border-orange-300 text-orange-500' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Sort by SKU {sortField === 'sku' && <ArrowUpDown className="inline ml-1" size={14} />}
            </button>
            <button
              onClick={() => handleSort('overallStatus')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                sortField === 'overallStatus' 
                  ? 'bg-orange-100 border-orange-300 text-orange-500' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Sort by Status {sortField === 'overallStatus' && <ArrowUpDown className="inline ml-1" size={14} />}
            </button>
          </div>
          
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-8 rounded-xl text-center shadow-lg">
              <AlertCircle className="mx-auto text-slate-600 mb-4" size={48} />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">No products found</h2>
              <p className="text-slate-500">Try adjusting your search or add new products to your inventory.</p>
            </div>
          ) : (
            <>
              {isMobileView ? (
                <div className="space-y-4">
                  {filteredProducts.map(product => renderMobileProductCard(product))}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                      <div className="relative h-48 bg-gray-100">
                        {product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.productName} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-orange-50">
                            <span className="text-orange-600 text-2xl font-bold">
                              {product.productName.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getStatusClass(product.overallStatus)}`}>
                            {product.overallStatus}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2">
                          {product.productName}
                        </h3>
                        <div className="text-sm text-slate-600 mb-3">
                          <div className="mb-1"><span className="font-medium">SKU:</span> {product.sku}</div>
                          {product.productDescription && (
                            <div className="text-xs text-slate-500 line-clamp-2 mb-2">
                              {product.productDescription}
                            </div>
                          )}
                        </div>
                        <div className="mb-4">
                          <div className="text-sm font-medium text-slate-700 mb-2">Units & Stock:</div>
                          {product.units.length > 0 ? (
                            <div className="space-y-2">
                              {product.units.slice(0, 2).map((unit, index) => (
                                <div key={index} className="bg-slate-50 p-2 rounded text-xs">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">{unit.unit}</span>
                                    <span className="text-slate-600">Rs{unit.price}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className={`px-2 py-1 rounded text-xs ${getUnitStatusClass(unit.quantityInStock)}`}>
                                      {unit.quantityInStock} in stock
                                    </span>
                                    <button
                                      onClick={() => handleRestockUnit(product.id, index, unit.unit)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                    >
                                      <Package size={12} />
                                      Restock
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {product.units.length > 2 && (
                                <div className="text-xs text-slate-500 text-center py-1">
                                  +{product.units.length - 2} more units
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-500 text-xs">No units available</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="flex-1 bg-orange-200 text-orange-800 hover:bg-orange-300 transition-colors py-2 px-3 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
                          >
                            <Edit size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.productName)}
                            className="flex-1 bg-purple-200 text-purple-800 hover:bg-purple-300 transition-colors py-2 px-3 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                renderProductListView()
              )}
            </>
          )}
          
          {editingProduct && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-xl max-w-2xl w-full shadow-xl border-t-4 border-orange-500 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Edit size={20} className="text-orange-500" />
                  Edit Product
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">Product Name</label>
                    <input 
                      type="text" 
                      value={editingProduct.productName} 
                      onChange={(e) => handleUpdateProductField('productName', e.target.value)} 
                      className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">Product Description</label>
                    <textarea 
                      value={editingProduct.productDescription} 
                      onChange={(e) => handleUpdateProductField('productDescription', e.target.value)} 
                      placeholder="Enter product description..." 
                      rows={3} 
                      className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-vertical" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">SKU</label>
                    <input 
                      type="text" 
                      value={editingProduct.sku} 
                      onChange={(e) => handleUpdateProductField('sku', e.target.value)} 
                      className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-2">Product Units</label>
                    {editingProduct.units.map((unit, index) => (
                      <div key={index} className="border border-orange-200 rounded-lg p-4 mb-4 bg-orange-50">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <input
                            type="text"
                            placeholder="Unit name (e.g., 'Bottle', 'KG')"
                            value={unit.unit}
                            onChange={(e) => handleUpdateUnit(index, 'unit', e.target.value)}
                            className="px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <input
                            type="text"
                            placeholder="Price"
                            value={unit.price}
                            onChange={(e) => handleUpdateUnit(index, 'price', e.target.value)}
                            className="px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs text-slate-600 mb-1">Stock Quantity</label>
                          <input
                            type="number"
                            placeholder="Stock"
                            value={unit.quantityInStock || 0}
                            onChange={(e) => handleUpdateUnitStock(index, parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <button
                            onClick={() => handleRestockUnit(editingProduct.id, index, unit.unit)}
                            className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                          >
                            <Package size={14} />
                            Restock This Unit
                          </button>
                          <button
                            onClick={() => handleRemoveUnit(index)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Remove unit"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleAddUnit}
                      className="mt-2 flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800 transition-colors px-3 py-1.5 border border-orange-200 rounded bg-white hover:bg-orange-50"
                    >
                      <Plus size={16} /> Add Another Unit
                    </button>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end gap-3">
                  <button 
                    onClick={() => setEditingProduct(null)} 
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveEditedProduct} 
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProductInventorySize;

