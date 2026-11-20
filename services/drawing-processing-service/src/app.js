import { createPlaceholderApp } from '@soaylemer/service-core';

export const createDrawingApp = (config = {}) => createPlaceholderApp({
  ...config, name: 'drawing-processing-service', phase: 2,
});
