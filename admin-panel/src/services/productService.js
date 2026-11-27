import { db } from './firebase';
import { ref, push, get, update, remove, set } from 'firebase/database';

const productsRef = ref(db, 'products');

export const createProduct = async (productData) => {
  try {
    const newProductRef = push(productsRef);
    const now = new Date().toISOString();
    await set(newProductRef, {
      ...productData,
      createdAt: now,
      updatedAt: now
    });
    return newProductRef.key;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

export const getAllProducts = async () => {
  try {
    const snapshot = await get(productsRef);
    const products = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        products.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    await update(ref(db, `products/${productId}`), {
      ...productData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    await remove(ref(db, `products/${productId}`));
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const deleteProducts = async (productIds) => {
  const uniqueIds = [...new Set(productIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  const updates = Object.fromEntries(
    uniqueIds.map((productId) => [`products/${productId}`, null])
  );
  try {
    await update(ref(db), updates);
  } catch (error) {
    console.error('Error deleting products:', error);
    throw error;
  }
};
