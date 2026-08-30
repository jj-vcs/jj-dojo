import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  resolve: {
    alias: [
      {
        find: 'lit/decorators',
        replacement: path.resolve(__dirname, 'node_modules/lit/decorators.js'),
      },
      {
        find: /^lit\/directives\/(.*)$/,
        replacement: path.resolve(__dirname, 'node_modules/lit/directives/$1'),
      },
      {
        find: 'vscode-elements/main',
        replacement: path.resolve(
          __dirname,
          'node_modules/@vscode-elements/elements',
        ),
      },
    ],
  },
  server: {
    port: 3000,
    open: false,
    host: true,
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
};
