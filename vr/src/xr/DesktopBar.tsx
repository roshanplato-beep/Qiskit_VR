import { useEffect, useState } from 'react';
import { useLab } from '../state/store';
import { SETTING_IDS, isSample } from '../data/bundle';
import { xrStore } from './xrStore';
import { webUrl } from '../state/url';

const bar: React.CSSProperties = {
  position: 'fixed', left: 0, right: 0, bottom: 0, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px',
  background: 'rgba(5,10,18,.92)', color: '#e8f1ff', alignItems: 'center', zIndex: 10, font: '14px system-ui, sans-serif',
  borderTop: '1px solid #1d3a4d',
};
const btn = (on: boolean): React.CSSProperties => ({
  minWidth: 44, minHeight: 36, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', font: 'inherit',
  color: '#e8f1ff', background: on ? '#1d8fa8' : '#12293a', border: `1px solid ${on ? '#7ff3ff' : '#2a5068'}`,
});

export function SampleBanner() {
  const bundle = useLab((s) => s.bundle);
  if (!bundle || !isSample(bundle)) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, textAlign: 'center', padding: '6px 10px',
      background: '#b00020', color: '#fff', font: '700 15px system-ui, sans-serif', letterSpacing: '.04em' }}>
      SAMPLE DATA - not real results
    </div>
  );
}

export function DesktopBar() {
  const s = useLab();
  const [vrOk, setVrOk] = useState(false);
  useEffect(() => {
    navigator.xr?.isSessionSupported('immersive-vr').then(setVrOk).catch(() => setVrOk(false));
  }, []);
  const mitigated = s.mitigation === 1;
  return (
    <div style={bar}>
      <span style={{ opacity: .7 }}>Noise</span>
      {SETTING_IDS.map((id) => (
        <button key={id} style={btn(s.setting === id)} onClick={() => s.setSetting(id)}>{id}</button>
      ))}
      <button style={btn(mitigated)} onClick={() => s.setMitigation(mitigated ? 0 : 1)}>
        Mitigation {mitigated ? 'ON' : 'OFF'}
      </button>
      <span style={{ opacity: .7 }}>Split</span>
      {(['val', 'test'] as const).map((sp) => (
        <button key={sp} style={btn(s.split === sp)} onClick={() => s.setSplit(sp)}>{sp === 'val' ? 'Validation' : 'Test'}</button>
      ))}
      <span style={{ opacity: .7 }}>Scene</span>
      {(['lab', 'wall', 'verdict'] as const).map((sc) => (
        <button key={sc} style={btn(s.scene === sc)} onClick={() => s.setScene(sc)}>{sc}</button>
      ))}
      <button style={btn(false)} onClick={() => s.setTourStep(s.tourStep >= 8 ? 0 : s.tourStep + 1)}>
        Tour next{s.tourStep ? ` (${s.tourStep}/8)` : ''}
      </button>
      <span style={{ flex: 1 }} />
      <a style={{ color: '#7ff3ff' }} href={webUrl()}>Back to console</a>
      {vrOk && <button style={{ ...btn(true), fontWeight: 700 }} onClick={() => xrStore.enterVR()}>Enter VR</button>}
      {!vrOk && <span style={{ opacity: .6 }}>WebXR immersive-vr not available: desktop mode</span>}
    </div>
  );
}
