import { useEffect, useState } from 'react';
import '../css/ProductCard.css';

const getImageUrl = (product) => (
  Array.isArray(product.imageUrls) && product.imageUrls.length > 0
    ? product.imageUrls[0]
    : product.imageUrl || ''
);

const ProductCard = ({ product, category, onOpen, onAdd }) => {
  const imageUrl = getImageUrl(product);
  const inStock = Number(product.stock) > 0;
  const hasFlashSale = product.flashSale &&
    Number(product.originalPrice) > Number(product.price);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const endsAt = product.flashSale?.endsAt;
    if (!hasFlashSale || !endsAt) {
      setCountdown('');
      return undefined;
    }

    const updateCountdown = () => {
      const endTime = new Date(endsAt).getTime();
      if (!Number.isFinite(endTime)) {
        setCountdown('');
        return;
      }

      const remainingSeconds = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      const days = Math.floor(remainingSeconds / 86400);
      const hours = Math.floor((remainingSeconds % 86400) / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
      setCountdown(days > 0 ? `${days} ngày ${clock}` : clock);
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [hasFlashSale, product.flashSale?.endsAt]);

  return (
    <article className="store-product-card">
      <button type="button" className="store-product-image-button" onClick={() => onOpen(product)} aria-label={`Xem ${product.name}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name || 'Sản phẩm'}
            className="store-product-image"
            style={{
              width: 'auto',
              height: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'center'
            }}
            loading="lazy"
          />
        ) : (
          <span className="store-product-image-placeholder" aria-hidden="true">🥬</span>
        )}
        {category && <span className="store-product-category">{category.name}</span>}
        {hasFlashSale && <span className="store-product-flash-sale">FLASH SALE</span>}
      </button>
      <div className="store-product-info">
        <button type="button" className="store-product-name" onClick={() => onOpen(product)}>
          {product.name || 'Sản phẩm'}
        </button>
        <div className="store-product-card-bottom">
          <div>
            <span className="store-product-price-line">
              <strong className={`store-product-price ${hasFlashSale ? 'on-sale' : ''}`}>{Number(product.price || 0).toLocaleString('vi-VN')} ₫</strong>
              {hasFlashSale && <del className="store-product-original-price">{Number(product.originalPrice).toLocaleString('vi-VN')} ₫</del>}
            </span>
            {hasFlashSale && <small className="store-product-sale-name">{product.flashSale.name}</small>}
            {hasFlashSale && countdown && <small className="store-product-sale-countdown">⏱ Còn {countdown}</small>}
            <span className={`store-product-stock ${inStock ? '' : 'out-of-stock'}`}>
              {inStock ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}
            </span>
          </div>
          <button
            type="button"
            className="store-product-add"
            onClick={() => onAdd(product)}
            disabled={!inStock}
            aria-label={`Thêm ${product.name} vào giỏ hàng`}
          >
            ＋
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
