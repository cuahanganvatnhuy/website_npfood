import { db } from './firebase';
import { ref, push, get, update, remove, set } from 'firebase/database';

// Introduction Page
const introRef = ref(db, 'introduction');

export const getIntroduction = async () => {
  try {
    const snapshot = await get(introRef);
    if (!snapshot.exists()) {
      return null;
    }
    let latestIntro = null;
    let latestTime = 0;
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.updatedAt && new Date(data.updatedAt) > latestTime) {
        latestTime = new Date(data.updatedAt);
        latestIntro = { id: childSnapshot.key, ...data };
      }
    });
    return latestIntro;
  } catch (error) {
    console.error('Error fetching introduction:', error);
    throw error;
  }
};

export const saveIntroduction = async (introData) => {
  try {
    const existing = await getIntroduction();
    if (existing) {
      await update(ref(db, `introduction/${existing.id}`), {
        ...introData,
        updatedAt: new Date().toISOString()
      });
      return existing.id;
    } else {
      const newIntroRef = push(introRef);
      await set(newIntroRef, {
        ...introData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return newIntroRef.key;
    }
  } catch (error) {
    console.error('Error saving introduction:', error);
    throw error;
  }
};

// News/Articles
const newsRef = ref(db, 'news');

export const createNews = async (newsData) => {
  try {
    const newNewsRef = push(newsRef);
    await set(newNewsRef, {
      ...newsData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return newNewsRef.key;
  } catch (error) {
    console.error('Error creating news:', error);
    throw error;
  }
};

export const getAllNews = async () => {
  try {
    const snapshot = await get(newsRef);
    const news = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        news.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    // Sort by createdAt descending
    news.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return news;
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const getNewsById = async (newsId) => {
  try {
    const newsItemRef = ref(db, `news/${newsId}`);
    const snapshot = await get(newsItemRef);
    if (!snapshot.exists()) {
      throw new Error('News not found');
    }
    return { id: snapshot.key, ...snapshot.val() };
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const updateNews = async (newsId, newsData) => {
  try {
    const newsItemRef = ref(db, `news/${newsId}`);
    await update(newsItemRef, {
      ...newsData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating news:', error);
    throw error;
  }
};

export const deleteNews = async (newsId) => {
  try {
    const newsItemRef = ref(db, `news/${newsId}`);
    await remove(newsItemRef);
  } catch (error) {
    console.error('Error deleting news:', error);
    throw error;
  }
};

export const getPublishedNews = async () => {
  try {
    const news = await getAllNews();
    return news.filter(item => item.published === true);
  } catch (error) {
    console.error('Error fetching published news:', error);
    throw error;
  }
};

// Contact Page
const contactRef = ref(db, 'contact');

export const getContactInfo = async () => {
  try {
    const snapshot = await get(contactRef);
    if (!snapshot.exists()) {
      return null;
    }
    let latestContact = null;
    let latestTime = 0;
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.updatedAt && new Date(data.updatedAt) > latestTime) {
        latestTime = new Date(data.updatedAt);
        latestContact = { id: childSnapshot.key, ...data };
      }
    });
    return latestContact;
  } catch (error) {
    console.error('Error fetching contact info:', error);
    throw error;
  }
};

export const saveContactInfo = async (contactData) => {
  try {
    const existing = await getContactInfo();
    if (existing) {
      await update(ref(db, `contact/${existing.id}`), {
        ...contactData,
        updatedAt: new Date().toISOString()
      });
      return existing.id;
    } else {
      const newContactRef = push(contactRef);
      await set(newContactRef, {
        ...contactData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return newContactRef.key;
    }
  } catch (error) {
    console.error('Error saving contact info:', error);
    throw error;
  }
};

// Contact Messages (from users)
const messagesRef = ref(db, 'contactMessages');

export const createContactMessage = async (messageData) => {
  try {
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, {
      ...messageData,
      createdAt: new Date().toISOString(),
      read: false
    });
    return newMessageRef.key;
  } catch (error) {
    console.error('Error creating contact message:', error);
    throw error;
  }
};

export const getAllContactMessages = async () => {
  try {
    const snapshot = await get(messagesRef);
    const messages = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        messages.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    // Sort by createdAt descending
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return messages;
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    throw error;
  }
};

export const markMessageAsRead = async (messageId) => {
  try {
    const messageRef = ref(db, `contactMessages/${messageId}`);
    await update(messageRef, { read: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

export const markMessageAsUnread = async (messageId) => {
  try {
    const messageRef = ref(db, `contactMessages/${messageId}`);
    await update(messageRef, { read: false });
  } catch (error) {
    console.error('Error marking message as unread:', error);
    throw error;
  }
};

export const deleteContactMessage = async (messageId) => {
  try {
    const messageRef = ref(db, `contactMessages/${messageId}`);
    await remove(messageRef);
  } catch (error) {
    console.error('Error deleting contact message:', error);
    throw error;
  }
};

// Banners
const bannersRef = ref(db, 'banners');

export const createBanner = async (bannerData) => {
  try {
    const newBannerRef = push(bannersRef);
    await set(newBannerRef, {
      ...bannerData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return newBannerRef.key;
  } catch (error) {
    console.error('Error creating banner:', error);
    throw error;
  }
};

export const getAllBanners = async () => {
  try {
    const snapshot = await get(bannersRef);
    const banners = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        banners.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    // Sort by order ascending
    banners.sort((a, b) => (a.order || 0) - (b.order || 0));
    return banners;
  } catch (error) {
    console.error('Error fetching banners:', error);
    throw error;
  }
};

export const getBannerById = async (bannerId) => {
  try {
    const bannerRef = ref(db, `banners/${bannerId}`);
    const snapshot = await get(bannerRef);
    if (!snapshot.exists()) {
      throw new Error('Banner not found');
    }
    return { id: snapshot.key, ...snapshot.val() };
  } catch (error) {
    console.error('Error fetching banner:', error);
    throw error;
  }
};

export const updateBanner = async (bannerId, bannerData) => {
  try {
    const bannerRef = ref(db, `banners/${bannerId}`);
    await update(bannerRef, {
      ...bannerData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    throw error;
  }
};

export const deleteBanner = async (bannerId) => {
  try {
    const bannerRef = ref(db, `banners/${bannerId}`);
    await remove(bannerRef);
  } catch (error) {
    console.error('Error deleting banner:', error);
    throw error;
  }
};

export const getActiveBanners = async () => {
  try {
    const banners = await getAllBanners();
    return banners.filter(item => item.isActive === true);
  } catch (error) {
    console.error('Error fetching active banners:', error);
    throw error;
  }
};
