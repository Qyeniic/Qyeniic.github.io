import { useEffect, useRef } from 'react';
import Story from './components/Story.jsx';
import { cards } from './data/content.js';
import { createScene } from './scene/createScene.js';

export default function App() {
  const canvasRef = useRef(null);
  const storyRef = useRef(null);
  const mainRef = useRef(null);
  const barRef = useRef(null);

  // 3D 무대는 한 번 마운트하고, 컴포넌트가 사라질 때 정리한다.
  useEffect(() => {
    const dispose = createScene({
      canvas: canvasRef.current,
      root: storyRef.current,
      scrollRoot: mainRef.current,
      progressBar: barRef.current,
      cards,
    });
    return dispose;
  }, []);

  return (
    <>
      <canvas id="stage" ref={canvasRef} aria-hidden="true" />
      <div className="progress" id="bar" ref={barRef} />

      <main ref={mainRef}>
        <section id="s-intro" data-stage aria-label="소개" />
        <section id="s-quant" data-stage aria-label="양자화" />
        <section id="s-device" data-stage aria-label="온디바이스 양자화" />
        <section id="s-cards" data-stage aria-label="프로젝트와 활동">
          {/* 스크린리더용 카드 목록 (화면에는 3D 카드로 보임) */}
          <ul className="sr">
            {cards.map((c) => (
              <li key={c.t}>{c.t}: {c.s} ({c.b.join(', ')})</li>
            ))}
          </ul>
        </section>
        <section id="s-contact" data-stage aria-label="연락처" />
      </main>

      <Story ref={storyRef} />
    </>
  );
}
