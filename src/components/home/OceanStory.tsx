"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { createOceanSequence } from './oceanSequence';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);
// Mobile browser chrome changes height during a swipe; avoid refreshing the timeline on each change.
ScrollTrigger.config({ ignoreMobileResize: true });

export function OceanStory() {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      root.dataset.motion = 'on';
      // Choose once per animation session: rotating a phone must not reload its video.
      const mobile = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
      // Keep mobile progress outside the sticky scene: browser chrome and the
      // scene's stable large viewport must never change the bar's bottom offset.
      const mobileProgress = mobile ? document.createElement('div') : null;
      if (mobileProgress) {
        mobileProgress.className = 'story-progress story-progress--viewport';
        mobileProgress.setAttribute('aria-hidden', 'true');
        mobileProgress.dataset.active = 'false';
        mobileProgress.appendChild(document.createElement('div'));
        document.body.appendChild(mobileProgress);
      }
      const progressTarget = mobileProgress?.firstElementChild ?? progressRef.current;
      const sequence = mobile && canvasRef.current ? createOceanSequence(canvasRef.current) : null;
      if (!sequence) { video.src = mobile ? '/videos/tartaruga-scroll-mobile.mp4' : '/videos/tartaruga-scroll.mp4'; video.muted = true; video.load(); }
      const frames = root.querySelectorAll<HTMLElement>('.story-frame');
      const scene = root.querySelector<HTMLElement>('.story-scene');
      const playhead = { progress: 0 };
      let raf = 0;
      let disposed = false;
      let priming = false;
      // Seek only when the decoder is ready. Fast scrolls keep the latest target.
      const seek = () => {
        raf = 0;
        if (disposed || priming || document.hidden || video.seeking || !Number.isFinite(video.duration) || video.readyState < 2) return;
        const target = Math.min(Math.max(0, video.duration - 0.04), playhead.progress * video.duration);
        if (Math.abs(video.currentTime - target) > 0.035) video.currentTime = target;
      };
      const scheduleSeek = () => { if (sequence) { sequence.update(playhead.progress); return; } if (!raf && !disposed) raf = requestAnimationFrame(seek); };
      // Some mobile WebKit versions initialize their decoder only after a user gesture.
      // Playback is immediately paused; ScrollTrigger remains the only playhead driver.
      const primeVideo = () => {
        if (priming || disposed) return;
        priming = true;
        void video.play().then(() => {
          if (disposed) return;
          video.pause();
          priming = false;
          root.removeEventListener('pointerdown', primeVideo);
          scheduleSeek();
        }, () => { priming = false; scheduleSeek(); });
      };
      const readyEvents = ['loadeddata', 'canplay', 'seeked'] as const;
      readyEvents.forEach(event => video.addEventListener(event, scheduleSeek));
      if (!sequence) root.addEventListener('pointerdown', primeVideo, { passive: true });
      document.addEventListener('visibilitychange', scheduleSeek);
      gsap.set(frames, { autoAlpha: 0, y: 36 });
      gsap.set(frames[0], { autoAlpha: 1, y: 0 });
      const syncProgressVisibility = (self: ScrollTrigger) => {
        if (mobileProgress) mobileProgress.dataset.active = String(self.isActive || (self.progress === 0 && root.getBoundingClientRect().top <= 0));
      };
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top top',
          // Match the sticky container's actual travel, including stable mobile viewport height.
          end: () => `+=${Math.max(1, root.offsetHeight - (scene?.offsetHeight ?? window.innerHeight))}`,
          scrub: mobile ? 0.2 : 0.65, invalidateOnRefresh: true,
          onRefresh: syncProgressVisibility,
          onToggle: self => { sequence?.setActive(self.isActive); syncProgressVisibility(self); } },
      });
      timeline.to(playhead, { progress: 1, duration: 1, ease: 'none', onUpdate: scheduleSeek }, 0)
        .to(progressTarget, { scaleX: 1, duration: 1, ease: 'none' }, 0)
        .to(frames[0], { autoAlpha: 0, y: -30, duration: 0.08 }, 0.10)
        .fromTo(frames[1], { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.09 }, 0.23)
        .to(frames[1], { autoAlpha: 0, y: -30, duration: 0.08 }, 0.42)
        .fromTo(frames[2], { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.09 }, 0.51)
        .to(frames[2], { autoAlpha: 0, y: -30, duration: 0.08 }, 0.70)
        .fromTo(frames[3], { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.09 }, 0.79);
      ScrollTrigger.refresh();
      return () => {
        disposed = true;
        sequence?.destroy();
        mobileProgress?.remove();
        cancelAnimationFrame(raf);
        readyEvents.forEach(event => video.removeEventListener(event, scheduleSeek));
        root.removeEventListener('pointerdown', primeVideo);
        document.removeEventListener('visibilitychange', scheduleSeek);
        root.dataset.motion = 'off';
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }, root);
    return () => media.revert();
  }, []);

  return <section ref={rootRef} className="ocean-story" data-motion="off" aria-label="Il progetto MareSalvo">
    <div className="story-scene">
      <div className="story-media" aria-hidden="true">
        <video ref={videoRef} muted playsInline preload="auto" disablePictureInPicture poster="/images/tartaruga-poster.jpg" onLoadedData={() => setVideoError(false)} onError={() => setVideoError(true)} />
        <canvas ref={canvasRef} className="story-sequence" />
        <div className="story-shade" />
      </div>
      <div className="story-frames">
        <div className="story-frame story-intro">
          <p className="story-eyebrow">MARESALVO / UN PROGETTO PER IL MEDITERRANEO</p>
          <h1>Il mare è vita.<br /><span>Prendiamocene cura.</span></h1>
          <p className="story-description">Conoscere il mare. Viverlo con rispetto.<br />Proteggere ciò che lo rende unico.</p>
          <Link href="/osservatorio" className="story-link">Esplora l’Osservatorio <ArrowUpRight size={19} /></Link>
        </div>
        <div className="story-frame">
          <p className="story-eyebrow">01 / CONOSCERE</p>
          <h2>Ogni gesto in mare<br />inizia dalla <em>consapevolezza.</em></h2>
          <p className="story-description">Percorsi per conoscere il mare,<br />viverlo con consapevolezza e rispettarlo.</p>
          <Link href="/questionari" className="story-link">Scegli il tuo percorso <ArrowUpRight size={19} /></Link>
        </div>
        <div className="story-frame">
          <p className="story-eyebrow">02 / PROTEGGERE</p>
          <h2>Una rete persa.<br />Un impatto che <em>rimane.</em></h2>
          <p className="story-description">Le reti abbandonate continuano a intrappolare la vita marina. Una segnalazione è il primo passo verso il recupero.</p>
          <Link href="/segnala-rete" className="story-link">Segnala una rete <ArrowUpRight size={19} /></Link>
        </div>
        <div className="story-frame">
          <p className="story-eyebrow">03 / ESPLORARE</p>
          <h2>Un mare da vivere.<br />Un mondo da <em>preservare.</em></h2>
          <p className="story-description">Esplora fondali, aree marine protette e segnalazioni. Il viaggio continua sulla mappa.</p>
          <a href="#mappa" className="story-link">Esplora la mappa <ArrowDown size={19} /></a>
        </div>
      </div>
      {videoError && <p role="status" className="story-video-error">Video non disponibile. Puoi continuare a esplorare il progetto.</p>}
      <div className="story-progress" aria-hidden="true"><div ref={progressRef} /></div>
    </div>
  </section>;
}
