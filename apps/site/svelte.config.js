import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    warningFilter: (w) => ['state_referenced_locally'].includes(w),
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
    experimental: {
      async: true
    }
  },
  kit: {
    adapter: adapter()
  }
};

export default config;
