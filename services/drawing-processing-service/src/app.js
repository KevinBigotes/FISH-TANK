import { createPlaceholderApp } from '@fish-tank/service-core';

export const createDrawingApp = (config = {}) => createPlaceholderApp({
  ...config, name: 'drawing-processing-service', phase: 2,
});
