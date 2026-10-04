import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // tsconfig 의 paths 와 같은 별칭. '/src' 는 프로젝트 루트 기준으로 해석된다.
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // 생성 스크립트의 중간 결과는 게임과 상관없다. 바뀔 때마다 화면이 처음으로 돌아가지 않게 한다.
      // ⚠ public/assets 는 무시하면 안 된다. 개발 서버는 public 파일 목록을 감시로 갱신해서,
      //   서버를 켠 뒤 새로 생긴 모델을 모르고 게임 페이지(HTML)를 대신 돌려준다.
      ignored: ['**/art-src/**', '**/preview/**'],
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // 학생 게임과 선생님 화면은 별도 페이지다. (명세 73)
      // 이렇게 나눠야 학생 번들에 교사 화면이 섞이지 않고, 교사 화면에 three.js 가 안 실린다.
      input: {
        main: 'index.html',
        teacher: 'teacher.html',
      },
      output: {
        // three.js 는 큰 라이브러리라 별도 청크로 분리해 첫 화면을 빠르게 띄운다.
        manualChunks(id: string) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'three';
          }
          return undefined;
        },
      },
    },
  },
});
