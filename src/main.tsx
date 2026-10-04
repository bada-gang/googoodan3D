import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadArtManifest } from '@/config/artReady';
import { initRepositories } from '@/data';
import { loadModelManifest } from '@/config/modelReady';
import { App } from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root 를 찾을 수 없습니다.');

// 그림·모델 목록과 저장소를 먼저 준비한다. 모두 실패해도 게임은 뜬다.
void Promise.all([loadArtManifest(), loadModelManifest(), initRepositories()]).finally(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
