import { onVideo } from './bridge.js';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LessonPlayer from 'aha-original/LessonPlayer';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import 'aha-original/styles.css';
import 'aha-original/interface.css';

const root = createRoot(document.getElementById('root')!);
function Video({ data }) {
  const [menu, setMenu] = useState(false);
  const lesson = { id: data.id, videoId: data.id, title: data.title, subtitle: 'Visual explanation', subject: 'My ideas',
    duration: data.duration, artwork: 'vectors', color: 'sage', generationStatus: data.status };
  return <LessonPlayer lesson={lesson} menuOpen={menu} onMenu={() => setMenu(!menu)}
    menuContent={menu ? <div className="aha-menu"><p>Interactive Aha lesson</p><p>Right-click the animation to request follow-up scenes.</p><button onClick={() => setMenu(false)}>Return to lesson</button></div> : null}
    onHome={() => setMenu(true)} onPlayed={() => {}} overlayOpen={false}/>;
}
onVideo(data => { document.getElementById('status')!.hidden = true; root.render(<Video key={data.id} data={data}/>); });
window.addEventListener('aha-teardown', () => root.unmount(), { once: true });
