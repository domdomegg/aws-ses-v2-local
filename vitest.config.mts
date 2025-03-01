import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		globalSetup: './test/test-global-setup.ts',
		setupFiles: './test/test-env-setup.ts',
		fileParallelism: false,
	},
});
