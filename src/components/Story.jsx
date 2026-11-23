import { forwardRef } from 'react';
import Icon from './icons.jsx';
import { profile, scenes, contact } from '../data/content.js';

const LINKS = [
  { key: 'email', id: 'aMail', icon: 'gmail', label: 'Gmail로 메일 보내기' },
  { key: 'github', id: 'aGit', icon: 'github', label: 'GitHub' },
  { key: 'instagram', id: 'aInsta', icon: 'instagram', label: 'Instagram' },
];

// 화면에 고정된 글자 레이어. 위치·투명도는 3D 코드가 스크롤에 맞춰 매 프레임 갱신한다.
const Story = forwardRef(function Story(_, ref) {
  return (
    <div className="story" ref={ref}>
      <h1 className="L name" id="lName">{profile.name}</h1>
      <p className="L kr" id="lKr">{profile.school}</p>
      <p className="L en" id="lEn">
        {profile.intro.map((line, i) => (
          <span key={i}>{i > 0 && <br />}{line}</span>
        ))}
      </p>

      <h2 className="L title" id="lQ">{scenes.quant.title}</h2>
      <p className="L big" id="lBits"><span id="nBits">{scenes.quant.bits}</span>bit</p>
      <p className="L small" id="lLab">{scenes.quant.label}</p>

      <h2 className="L title" id="lD">{scenes.device.title}</h2>
      <p className="L big" id="lEnv">{scenes.device.env}</p>
      <p className="L small" id="lModel">{scenes.device.model}</p>

      <h2 className="L name" id="lCName">{profile.name}</h2>
      <nav className="L links" id="lLinks" aria-label="연락처 링크">
        {LINKS.filter((l) => contact[l.key]).map((l) => {
          const external = !contact[l.key].startsWith('mailto:');
          return (
            <a key={l.key} id={l.id} href={contact[l.key]} aria-label={l.label}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <Icon name={l.icon} />
            </a>
          );
        })}
      </nav>
    </div>
  );
});

export default Story;
