import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { adjustStock, updateMinStock } from '../../services/stockService';
import { useAuth } from '../../context/AuthContext';
import t from '../../utils/translations';

const ProductDetail = () => {
  const { productCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [qtyAdjustment, setQtyAdjustment] = useState('');
  const [newMinStock, setNewMinStock] = useState('');
  const [directQty, setDirectQty] = useState('');
  const [qtyInputMode, setQtyInputMode] = useState('adjustment'); // 'adjustment' or 'direct'
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch product details
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productCode],
    queryFn: async () => {
      const productDoc = await getDoc(doc(db, 'products_kivos', productCode));
      if (!productDoc.exists()) throw new Error('Product not found');
      return { productCode: productDoc.id, ...productDoc.data() };
    },
  });

  // Fetch stock details
  const { data: stock, isLoading: stockLoading, refetch: refetchStock } = useQuery({
    queryKey: ['stock', productCode],
    queryFn: async () => {
      const stockDoc = await getDoc(doc(db, 'stock_kivos', productCode));
      if (!stockDoc.exists()) return { qtyOnHand: 0 };
      return stockDoc.data();
    },
  });

  useEffect(() => {
    if (product?.lowStockLimit !== undefined) {
      setNewMinStock(product.lowStockLimit.toString());
    }
  }, [product]);

  const handleSaveQuantity = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    let delta;
    if (qtyInputMode === 'direct') {
      const newQty = parseFloat(directQty);
      if (isNaN(newQty) || newQty < 0) {
        setErrorMessage('Please enter a valid quantity (0 or greater)');
        return;
      }
      delta = newQty - (stock?.qtyOnHand || 0);
    } else {
      delta = parseFloat(qtyAdjustment);
      if (isNaN(delta) || delta === 0) {
        setErrorMessage('Please enter a valid adjustment amount');
        return;
      }
    }

    const newQty = (stock?.qtyOnHand || 0) + delta;
    if (newQty < 0) {
      setErrorMessage('Adjustment would result in negative stock');
      return;
    }

    setIsSaving(true);
    try {
      await adjustStock({
        productCode,
        delta,
        reason: 'manual_adjustment',
        notes: `Adjustment from Product Detail screen (${qtyInputMode === 'direct' ? 'direct quantity' : 'delta'})`,
        updatedBy: user?.uid || 'unknown',
      });

      setSuccessMessage('Stock quantity updated successfully');
      setQtyAdjustment('');
      setDirectQty('');
      await refetchStock();
      queryClient.invalidateQueries(['stock']);
    } catch (err) {
      setErrorMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMinStock = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    const minVal = parseInt(newMinStock, 10);
    if (isNaN(minVal) || minVal < 0) {
      setErrorMessage('Please enter a valid minimum stock value');
      return;
    }

    setIsSaving(true);
    try {
      await updateMinStock({
        productCode,
        lowStockLimit: minVal,
        updatedBy: user?.uid || 'unknown',
      });

      setSuccessMessage('Minimum stock updated successfully');
      queryClient.invalidateQueries(['product', productCode]);
      queryClient.invalidateQueries(['stock']);
    } catch (err) {
      setErrorMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (productLoading || stockLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t.productDetail.productNotFound}</p>
        </div>
      </div>
    );
  }

  const currentQty = stock?.qtyOnHand || 0;
  const previewQty = qtyInputMode === 'direct' 
    ? (directQty ? parseFloat(directQty) : currentQty)
    : (qtyAdjustment ? currentQty + parseFloat(qtyAdjustment || 0) : currentQty);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/stock')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← {t.productDetail.backToList}
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{product.description || product.name}</h1>
          <p className="text-gray-600 mt-1">{t.productDetail.productCode}: {productCode}</p>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t.productDetail.productDetails}</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.productCode}</label>
              <p className="text-gray-900">{product.productCode}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.description}</label>
              <p className="text-gray-900">{product.description || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.name}</label>
              <p className="text-gray-900">{product.name || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.category}</label>
              <p className="text-gray-900">{product.category || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.supplierBrand}</label>
              <p className="text-gray-900">{product.supplierBrand || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.costPrice}</label>
              <p className="text-gray-900">€{(product.costPrice || 0).toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.salePrice}</label>
              <p className="text-gray-900">€{(product.salePrice || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Barcodes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t.productDetail.barcodes}</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.unitBarcode}</label>
              <p className="text-gray-900 font-mono">{product.barcodeUnit || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.boxBarcode}</label>
              <p className="text-gray-900 font-mono">{product.barcodeBox || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.cartonBarcode}</label>
              <p className="text-gray-900 font-mono">{product.barcodeCarton || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.unitsPerBox}</label>
              <p className="text-gray-900">{product.qtyInBox || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">{t.productDetail.boxesPerCarton}</label>
              <p className="text-gray-900">{product.qtyInCarton || '-'}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.productDetail.additionalInfo}</h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-600">{t.productDetail.weight}</label>
                <p className="text-gray-900">{product.weight || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">{t.productDetail.location}</label>
                <p className="text-gray-900">{product.location || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">{t.productDetail.active}</label>
                <p className="text-gray-900">{product.isActive ? t.common.yes : t.common.no}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t.productDetail.stockManagement}</h2>
          
          {/* Current Stock */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <label className="text-sm font-medium text-gray-600">{t.productDetail.currentStock}</label>
            <p className="text-3xl font-bold text-blue-600">{currentQty}</p>
          </div>

          {/* Adjust Quantity */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.productDetail.updateQuantity}
            </label>
            
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setQtyInputMode('adjustment')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  qtyInputMode === 'adjustment'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.productDetail.adjustment}
              </button>
              <button
                type="button"
                onClick={() => setQtyInputMode('direct')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  qtyInputMode === 'direct'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.productDetail.setTotal}
              </button>
            </div>

            {/* Input Field */}
            <div className="flex gap-3">
              {qtyInputMode === 'adjustment' ? (
                <input
                  type="number"
                  step="1"
                  placeholder={t.productDetail.adjustmentPlaceholder}
                  value={qtyAdjustment}
                  onChange={(e) => setQtyAdjustment(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder={t.productDetail.directPlaceholder}
                  value={directQty}
                  onChange={(e) => setDirectQty(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              <button
                onClick={handleSaveQuantity}
                disabled={isSaving || (qtyInputMode === 'adjustment' ? !qtyAdjustment : !directQty)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 font-medium"
              >
                {t.common.save}
              </button>
            </div>
            {((qtyInputMode === 'adjustment' && qtyAdjustment) || (qtyInputMode === 'direct' && directQty)) && (
              <p className="mt-2 text-sm text-gray-600">
                {t.productDetail.newQtyWillBe}:{' '}
                <span className={`font-semibold ${previewQty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {previewQty}
                </span>
                {qtyInputMode === 'adjustment' && qtyAdjustment && (
                  <span className="text-gray-500"> ({currentQty} {parseFloat(qtyAdjustment) >= 0 ? '+' : ''} {qtyAdjustment})</span>
                )}
              </p>
            )}
          </div>

          {/* Minimum Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.productDetail.minimumStockLevel}
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                step="1"
                min="0"
                value={newMinStock}
                onChange={(e) => setNewMinStock(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveMinStock}
                disabled={isSaving || newMinStock === (product.lowStockLimit?.toString() || '0')}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 font-medium"
              >
                {t.productDetail.update}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {t.productDetail.lowStockThreshold}
            </p>
          </div>
        </div>

        {/* Stock Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t.productDetail.stockStatus}</h2>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg border-2" 
              style={{
                borderColor: currentQty === 0 ? '#dc2626' : currentQty <= (product.lowStockLimit || 0) ? '#f59e0b' : '#10b981',
                backgroundColor: currentQty === 0 ? '#fee2e2' : currentQty <= (product.lowStockLimit || 0) ? '#fef3c7' : '#d1fae5'
              }}
            >
              <p className="text-sm font-medium text-gray-600 mb-1">{t.productDetail.status}</p>
              <p className="text-2xl font-bold" 
                style={{
                  color: currentQty === 0 ? '#dc2626' : currentQty <= (product.lowStockLimit || 0) ? '#f59e0b' : '#10b981'
                }}
              >
                {currentQty === 0 ? t.productDetail.outOfStock : currentQty <= (product.lowStockLimit || 0) ? t.productDetail.lowStock : t.productDetail.normal}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600">{t.productDetail.lastUpdated}</label>
              <p className="text-gray-900">
                {stock?.lastModified?.toDate?.()?.toLocaleDateString() || '-'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600">{t.productDetail.stockValue}</label>
              <p className="text-2xl font-bold text-gray-900">
                €{((currentQty * (product.costPrice || 0)).toFixed(2))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;

