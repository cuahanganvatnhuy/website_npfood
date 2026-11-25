const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
    } else {
      reject(new Error('Tệp hình ảnh không hợp lệ.'));
    }
  };
  reader.onerror = () => reject(reader.error || new Error('Không thể đọc tệp hình ảnh.'));
  reader.readAsDataURL(file);
});

export default readImageFile;
