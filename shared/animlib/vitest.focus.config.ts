import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['test/depth-focus.gpu.ts'],testTimeout:30000,hookTimeout:30000}});
