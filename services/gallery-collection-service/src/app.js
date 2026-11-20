import { createPlaceholderApp } from '@soaylemer/service-core';

export const createGalleryApp = (config = {}) => createPlaceholderApp({
  ...config, name: 'gallery-collection-service', phase: 4,
});
