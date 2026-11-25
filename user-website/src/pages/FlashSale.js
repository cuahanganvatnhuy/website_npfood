import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { getActiveProducts, getAllCategories } from '../services/dataService';
import '../css/FlashSale.css';

const FlashSale = ({ addToCart }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [allProducts, allCategories] = await Promise.all([
        getActiveProducts(),
        getAllCategories()
      ]);
      setProducts(allProducts.filter((product) => product.flashSale));
      setCategories(allCategories);
    } catch (loadError) {
      console.error('Không thể tải chương trình Flash Sale:', loadError);
      setError('Không thể tải chương trình Flash Sale. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="store-flash-sale-page">
      <div className="store-flash-sale-container">
        <header className="store-flash-sale-heading">
          <div>
            <span className="store-flash-sale-eyebrow">ƯU ĐÃI CÓ THỜI HẠN</span>
            <h1>Flash Sale</h1>
            <p>Sản phẩm đang được giảm giá trong các chương trình còn hiệu lực.</p>
          </div>
          <span className="store-flash-sale-icon" aria-hidden="true">⚡</span>
        </header>

        {loading ? (
          <div className="store-flash-sale-state">Đang tải sản phẩm Flash Sale...</div>
        ) : error ? (
          <div className="store-flash-sale-state store-flash-sale-error" role="alert">
            <strong>{error}</strong>
            <button type="button" onClick={fetchData}>Thử tải lại</button>
          </div>
        ) : products.length === 0 ? (
          <div className="store-flash-sale-state">
            <span aria-hidden="true">⚡</span>
            <strong>Hiện chưa có Flash Sale đang diễn ra</strong>
            <p>Hãy quay lại sau hoặc xem các sản phẩm khác của NP Food.</p>
            <Link to="/products">Xem sản phẩm</Link>
          </div>
        ) : (
          <>
            <div className="store-flash-sale-summary">
              <strong>{products.length} sản phẩm đang giảm giá</strong>
              <span>Giá ưu đãi được cập nhật theo thời gian chương trình.</span>
            </div>
            <div className="store-flash-sale-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={categories.find((category) => category.id === product.categoryId && category.isActive !== false)}
                  onOpen={() => navigate(`/products?product=${encodeURIComponent(product.id)}`)}
                  onAdd={addToCart}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FlashSale;
