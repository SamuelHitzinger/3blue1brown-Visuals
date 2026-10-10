import {defineConfig} from 'vitest/config';

// Optional native WebGPU checks; deliberately separate from portable unit tests.
export default defineConfig({test:{include:['test/gpu.smoke.ts','test/gpu-recovery.gpu.ts'],testTimeout:30000,hookTimeout:30000}});
