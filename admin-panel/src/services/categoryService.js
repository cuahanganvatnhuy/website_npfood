import { db } from './firebase';
import { ref, push, get, update, remove, set } from 'firebase/database';

const categoriesRef = ref(db, 'categories');

// Create category
export const createCategory = async (categoryData) => {
  try {
    const newCategoryRef = push(categoriesRef);
    await set(newCategoryRef, {
      ...categoryData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return newCategoryRef.key;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

// Get all categories
export const getAllCategories = async () => {
  try {
    const snapshot = await get(categoriesRef);
    const categories = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        categories.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    // Sort by order
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// Get single category
export const getCategoryById = async (categoryId) => {
  try {
    const categoryRef = ref(db, `categories/${categoryId}`);
    const snapshot = await get(categoryRef);
    if (!snapshot.exists()) {
      throw new Error('Category not found');
    }
    return { id: snapshot.key, ...snapshot.val() };
  } catch (error) {
    console.error('Error fetching category:', error);
    throw error;
  }
};

// Update category
export const updateCategory = async (categoryId, categoryData) => {
  try {
    const categoryRef = ref(db, `categories/${categoryId}`);
    await update(categoryRef, {
      ...categoryData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

// Delete category
export const deleteCategory = async (categoryId) => {
  try {
    const categoryRef = ref(db, `categories/${categoryId}`);
    await remove(categoryRef);
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// Update category order
export const updateCategoryOrder = async (categories) => {
  try {
    const updates = {};
    categories.forEach((category, index) => {
      updates[`categories/${category.id}/order`] = index;
      updates[`categories/${category.id}/updatedAt`] = new Date().toISOString();
    });
    await update(ref(db), updates);
  } catch (error) {
    console.error('Error updating category order:', error);
    throw error;
  }
};
