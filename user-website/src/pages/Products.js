import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getActiveProducts, getAllCategories } from '../services/dataService';
import ProductCard from '../components/ProductCard';
import {
  getProductDescriptionText,
  sanitizeProductDescription
} from '../utils/productDescription';
import '../css/Products.css';

const getProductImages = (product) => {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls.slice(0, 5);
  }
  return product.imageUrl ? [product.imageUrl] : [];
};

const Products = ({ addToCart }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartNotice, setCartNotice] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedCategory = searchParams.get('category') || '';
  const requestedProductId = searchParams.get('product') || '';
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!requestedProductId) {
      setSelectedProduct(null);
      return;
    }
    if (products.length === 0) return;
    const requestedProduct = products.find((product) => product.id === requestedProductId);
    if (requestedProduct) {
      setSelectedProduct(requestedProduct);
      setSelectedImageIndex(0);
      setQuantity(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [products, requestedProductId]);

  const fetchProducts = async () => {
    try {
      setLoadError('');
      const [productData, categoryData] = await Promise.all([
        getActiveProducts(),
        getAllCategories()
      ]);
      setProducts(productData);
      setCategories(categoryData);
    } catch (error) {
      console.error('Lỗi khi tải sản phẩm:', error);
      setLoadError(error.message || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  const usedCategories = useMemo(() => {
    const categoryIds = new Set(products.map((product) => product.categoryId).filter(Boolean));
    return categories.filter((category) => category.isActive !== false && categoryIds.has(category.id));
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return products
      .filter((product) => {
        const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
        const matchesSearch = !query ||
          [product.name, getProductDescriptionText(product.description), product.sku]
            .some((value) => String(value || '').toLocaleLowerCase().includes(query));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === 'price-low') return Number(a.price || 0) - Number(b.price || 0);
        if (sortOrder === 'price-high') return Number(b.price || 0) - Number(a.price || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [products, searchTerm, selectedCategory, sortOrder]);

  const setCategory = (categoryId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (categoryId) nextParams.set('category', categoryId);
    else nextParams.delete('category');
    setSearchParams(nextParams);
  };

  const setSearch = (value) => {
    setSearchTerm(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) nextParams.set('search', value);
    else nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  };

  const clearFilters = () => {
    setSearchTerm('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('category');
    nextParams.delete('search');
    setSearchParams(nextParams);
  };

  const openProduct = (product) => {
    setSelectedProduct(product);
    setSelectedImageIndex(0);
    setQuantity(1);
    setCartNotice('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('product', product.id);
    setSearchParams(nextParams);
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('product');
    setSearchParams(nextParams, { replace: true });
  };
  const selectedImages = selectedProduct ? getProductImages(selectedProduct) : [];
  const selectedCategoryName = categories.find((category) => category.id === selectedCategory)?.name;
  const detailCategoryName = categories.find(
    (category) => category.id === selectedProduct?.categoryId && category.isActive !== false
  )?.name || 'Sản phẩm';
  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];

    const otherProducts = products.filter((product) => product.id !== selectedProduct.id);
    const sameCategory = selectedProduct.categoryId
      ? otherProducts.filter((product) => product.categoryId === selectedProduct.categoryId)
      : [];
    const sameCategoryIds = new Set(sameCategory.map((product) => product.id));
    const otherCategories = otherProducts.filter((product) => !sameCategoryIds.has(product.id));

    return [...sameCategory, ...otherCategories].slice(0, 4);
  }, [products, selectedProduct]);
  const hasSelectedProductFlashSale = selectedProduct?.flashSale &&
    Number(selectedProduct.originalPrice) > Number(selectedProduct.price);
  const availableStock = Number(selectedProduct?.stock) || 0;

  const changeSelectedImage = (direction) => {
    if (selectedImages.length < 2) return;
    setSelectedImageIndex((current) => (
      (current + direction + selectedImages.length) % selectedImages.length
    ));
  };

  const addSelectedProductToCart = () => {
    if (addToCart(selectedProduct, quantity)) {
      setCartNotice(`${selectedProduct.name || 'Sản phẩm'} đã được thêm vào giỏ hàng.`);
    }
  };

  const buySelectedProductNow = () => {
    if (addToCart(selectedProduct, quantity)) navigate('/cart');
  };

  return selectedProduct ? (
    <div className="store-product-detail-page">
      <div className="store-product-detail-container">
        <nav className="store-product-breadcrumb" aria-label="Đường dẫn">
          <Link to="/products">Sản phẩm</Link>
          <span aria-hidden="true">›</span>
          <span>{detailCategoryName}</span>
        </nav>

        <header className="store-product-detail-heading">
          <button type="button" onClick={closeProduct}>‹ Quay lại sản phẩm</button>
        </header>

        <div className="store-product-detail-layout">
          <section className="store-product-detail-gallery" aria-label="Ảnh sản phẩm">
            <div className="store-product-detail-image-stage">
              {selectedImages.length > 0 ? (
                <img
                  src={selectedImages[selectedImageIndex]}
                  alt={selectedProduct.name || 'Sản phẩm'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center'
                  }}
                />
              ) : (
                <div className="store-product-detail-placeholder" aria-hidden="true">🥬</div>
              )}
              {selectedImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="store-product-image-arrow is-previous"
                    aria-label="Xem ảnh trước"
                    onClick={() => changeSelectedImage(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="store-product-image-arrow is-next"
                    aria-label="Xem ảnh tiếp theo"
                    onClick={() => changeSelectedImage(1)}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {selectedImages.length > 1 && (
              <div className="store-product-detail-thumbnails">
                {selectedImages.map((image, index) => (
                  <button
                    key={`${selectedProduct.id}-${index}`}
                    type="button"
                    className={index === selectedImageIndex ? 'selected' : ''}
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`Xem ảnh ${index + 1}`}
                    aria-pressed={index === selectedImageIndex}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="store-product-detail-info" aria-label="Thông tin sản phẩm">
            <h1 className="store-product-detail-name">{selectedProduct.name || 'Sản phẩm'}</h1>
            <div className="store-product-detail-price">
              <span>{hasSelectedProductFlashSale ? 'FLASH SALE' : 'Giá bán'}</span>
              <div>
                <strong>{Number(selectedProduct.price || 0).toLocaleString('vi-VN')}₫</strong>
                {hasSelectedProductFlashSale && (
                  <del>{Number(selectedProduct.originalPrice).toLocaleString('vi-VN')}₫</del>
                )}
              </div>
              {hasSelectedProductFlashSale && (
                <small>{selectedProduct.flashSale.name || 'Ưu đãi có thời hạn'}</small>
              )}
            </div>

            <div className={`store-product-detail-stock ${availableStock > 0 ? '' : 'out-of-stock'}`}>
              <span aria-hidden="true" />
              {availableStock > 0 ? `Còn ${availableStock} sản phẩm` : 'Tạm hết hàng'}
            </div>

            <dl className="store-product-detail-specs">
              <div>
                <dt>Danh mục</dt>
                <dd>{detailCategoryName}</dd>
              </div>
              {selectedProduct.sku && (
                <div>
                  <dt>Mã sản phẩm</dt>
                  <dd>{selectedProduct.sku}</dd>
                </div>
              )}
              <div>
                <dt>Tình trạng</dt>
                <dd>{availableStock > 0 ? 'Đang kinh doanh' : 'Tạm hết hàng'}</dd>
              </div>
            </dl>

            <div className="store-product-detail-quantity">
              <span>Số lượng</span>
              <div>
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  −
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  disabled={quantity >= availableStock}
                  onClick={() => setQuantity((current) => Math.min(availableStock, current + 1))}
                >
                  +
                </button>
              </div>
            </div>
            {cartNotice && <p className="store-product-cart-notice" role="status">{cartNotice}</p>}
          </section>
        </div>

        <section className="store-product-detail-description">
          <h2>Mô tả sản phẩm</h2>
          <div
            className="store-product-detail-description-content"
            dangerouslySetInnerHTML={{
              __html: selectedProduct.description
                ? sanitizeProductDescription(selectedProduct.description)
                : 'Sản phẩm chưa có mô tả.'
            }}
          />
        </section>

        {relatedProducts.length > 0 && (
          <section className="store-product-related" aria-labelledby="store-product-related-title">
            <header className="store-product-related-heading">
              <div>
                <h2 id="store-product-related-title">Sản phẩm liên quan</h2>
                <p>Có thể bạn cũng quan tâm</p>
              </div>
              {selectedProduct.categoryId && (
                <Link to={`/products?category=${encodeURIComponent(selectedProduct.categoryId)}`}>
                  Xem tất cả <span aria-hidden="true">›</span>
                </Link>
              )}
            </header>
            <div className="store-product-related-grid">
              {relatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={categories.find((category) => (
                    category.id === product.categoryId && category.isActive !== false
                  ))}
                  onOpen={openProduct}
                  onAdd={addToCart}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="store-product-detail-sticky">
        <div className="store-product-detail-sticky-product">
          {selectedImages[0] ? (
            <img src={selectedImages[0]} alt="" />
          ) : (
            <span aria-hidden="true">🥬</span>
          )}
          <strong>{selectedProduct.name || 'Sản phẩm'}</strong>
        </div>
        <strong className="store-product-detail-sticky-price">
          {Number(selectedProduct.price || 0).toLocaleString('vi-VN')}₫
        </strong>
        <div className="store-product-detail-sticky-actions">
          <button
            type="button"
            className="store-product-add-to-cart"
            onClick={addSelectedProductToCart}
            disabled={availableStock <= 0}
          >
            Thêm vào giỏ
          </button>
          <button
            type="button"
            className="store-product-buy-now"
            onClick={buySelectedProductNow}
            disabled={availableStock <= 0}
          >
            Mua ngay
          </button>
        </div>
      </footer>
    </div>
  ) : (
    <div className="store-products-page">
      <div className="store-products-container">
        <header className="store-products-heading">
          <div>
            <span className="store-eyebrow">GIAN HÀNG NP FOOD</span>
            <h1>{selectedCategoryName || 'Sản phẩm'}</h1>
            <p>Chọn sản phẩm yêu thích, đặt hàng nhanh chóng ngay tại cửa hàng.</p>
          </div>
          <span className="store-products-count">{products.length} sản phẩm</span>
        </header>

        <section className="store-products-toolbar" aria-label="Tìm và lọc sản phẩm">
          <label className="store-products-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên sản phẩm..."
              aria-label="Tìm sản phẩm"
            />
          </label>
          <select value={selectedCategory} onChange={(event) => setCategory(event.target.value)} aria-label="Lọc theo danh mục">
            <option value="">Tất cả danh mục</option>
            {usedCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sắp xếp sản phẩm">
            <option value="newest">Mới nhất</option>
            <option value="price-low">Giá thấp đến cao</option>
            <option value="price-high">Giá cao đến thấp</option>
          </select>
        </section>

        {loading ? (
          <div className="store-products-state">Đang tải sản phẩm...</div>
        ) : loadError ? (
          <div className="store-products-state store-products-error" role="alert">
            <strong>Không tải được sản phẩm</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchProducts(); }}>Thử tải lại</button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="store-products-state">
            <span aria-hidden="true">📦</span>
            <strong>{products.length === 0 ? 'Cửa hàng đang cập nhật sản phẩm' : 'Không tìm thấy sản phẩm phù hợp'}</strong>
            <p>{products.length === 0 ? 'Sản phẩm mới sẽ sớm được cập nhật. Bạn có thể liên hệ cửa hàng để được hỗ trợ.' : 'Thử từ khóa hoặc danh mục khác.'}</p>
            {(selectedCategory || searchTerm) && (
              <button type="button" className="store-clear-filters" onClick={clearFilters}>Xóa bộ lọc</button>
            )}
          </div>
        ) : (
          <div className="store-products-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                category={categories.find((category) => category.id === product.categoryId && category.isActive !== false)}
                onOpen={openProduct}
                onAdd={addToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
