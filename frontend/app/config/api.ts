export const API_CONFIG = {
  development: {
    BASE_URL: 'http://localhost:5000',
    UPLOAD_URL: 'http://localhost:5000/api/dify/upload',
    CONVERT_URL: 'http://localhost:5000/api/dify/convert',
    TRANSLATE_URL: 'http://localhost:5000/api/dify/translate-document',
    COUNTRY_REPORT_URL: 'http://localhost:5000/api/dify/country-report',
    QUARTERLY_REPORT_URL: 'http://localhost:5000/api/dify/quarterly-report',
    TRANSLATE_IMAGE_URL: 'http://localhost:5000/api/translate-image',
  },
  production: {
    BASE_URL: 'https://smartdocx.jxchen.me',
    UPLOAD_URL: 'https://smartdocx.jxchen.me/api/dify/upload',
    CONVERT_URL: 'https://smartdocx.jxchen.me/api/dify/convert',
    TRANSLATE_URL: 'https://smartdocx.jxchen.me/api/dify/translate-document',
    COUNTRY_REPORT_URL: 'https://smartdocx.jxchen.me/api/dify/country-report',
    QUARTERLY_REPORT_URL: 'https://smartdocx.jxchen.me/api/dify/quarterly-report',
    TRANSLATE_IMAGE_URL: 'https://smartdocx.jxchen.me/api/translate-image',
  },
};

export const getApiConfig = () => {
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isDevelopment ? API_CONFIG.development : API_CONFIG.production;
};