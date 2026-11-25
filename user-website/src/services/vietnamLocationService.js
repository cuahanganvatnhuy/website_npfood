const apiBaseUrl = 'https://provinces.open-api.vn/api/v2';
let provincesCache;
const wardsCache = new Map();

const readJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Không thể tải danh sách khu vực.');
  return response.json();
};

export const getVietnamProvinces = async () => {
  if (provincesCache) return provincesCache;
  const provinces = await readJson(`${apiBaseUrl}/p/`);
  if (!Array.isArray(provinces)) throw new Error('Danh sách tỉnh/thành không hợp lệ.');
  provincesCache = provinces
    .filter((province) => province && Number.isFinite(Number(province.code)) && province.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return provincesCache;
};

export const getVietnamWards = async (provinceCode) => {
  if (!Number.isFinite(Number(provinceCode))) {
    throw new Error('Vui lòng chọn tỉnh/thành trước.');
  }
  if (wardsCache.has(provinceCode)) return wardsCache.get(provinceCode);

  const province = await readJson(`${apiBaseUrl}/p/${encodeURIComponent(provinceCode)}?depth=2`);
  if (!Array.isArray(province.wards)) throw new Error('Danh sách phường/xã không hợp lệ.');
  const wards = province.wards
    .filter((ward) => ward && Number.isFinite(Number(ward.code)) && ward.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  wardsCache.set(provinceCode, wards);
  return wards;
};
