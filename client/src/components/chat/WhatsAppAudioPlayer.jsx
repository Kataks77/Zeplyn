import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

export default function WhatsAppAudioPlayer({ src, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && (!duration || duration === 0)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackRate = () => {
    if (!audioRef.current) return;
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const waveHeights = [10, 18, 14, 24, 16, 28, 20, 12, 22, 30, 18, 14, 26, 20, 16, 12, 22, 14, 18, 10];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 4px',
      minWidth: '240px',
      maxWidth: '310px'
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: isMe ? 'rgba(255, 255, 255, 0.22)' : 'var(--primary)',
          color: '#ffffff',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'transform 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isPlaying ? <Pause size={17} fill="#ffffff" /> : <Play size={17} fill="#ffffff" style={{ marginLeft: '2px' }} />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div 
          onClick={handleSeek}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            height: '24px',
            cursor: 'pointer',
            padding: '2px 0'
          }}
          title="Clique para avançar ou retroceder"
        >
          {waveHeights.map((h, i) => {
            const barPercent = (i / waveHeights.length) * 100;
            const played = barPercent <= progressPercent;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}px`,
                  borderRadius: '2px',
                  backgroundColor: played 
                    ? (isMe ? '#ffffff' : 'var(--primary)') 
                    : (isMe ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)'),
                  transition: 'background-color 0.1s ease'
                }}
              />
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.68rem',
          color: isMe ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)'
        }}>
          <span>{formatTime(currentTime > 0 ? currentTime : duration)}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span 
              title="Nota de Voz WhatsApp PTT" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                color: isMe ? '#a7f3d0' : '#38bdf8',
                fontWeight: 600,
                fontSize: '0.64rem'
              }}
            >
              <Mic size={11} /> PTT
            </span>
            <button
              type="button"
              onClick={cyclePlaybackRate}
              style={{
                background: isMe ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '1px 4px',
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'inherit',
                cursor: 'pointer'
              }}
              title="Velocidade de reprodução"
            >
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
