import React, { useState, useEffect } from 'react';
import { Participant, UserRole } from '../../types';
import { voiceManager } from '../../services/webrtc';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface VoiceControlsProps {
  participants: Record<string, Participant>;
  currentUserId?: string;
  userRole: UserRole;
  userName: string;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  participants,
  currentUserId,
  userRole,
  userName,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showMicHelp, setShowMicHelp] = useState(false);

  useEffect(() => {
    // Check permission & init voice
    voiceManager.initLocalAudio().then((granted) => {
      setMicPermissionState(granted ? 'granted' : 'denied');
    });

    voiceManager.setVolumeCallback((vol) => {
      setLocalVolume(vol);
    });

    voiceManager.setSpeakingCallback((speaking) => {
      setIsLocalSpeaking(speaking);
    });

    return () => {
      voiceManager.setVolumeCallback(() => {});
      voiceManager.setSpeakingCallback(() => {});
    };
  }, []);

  const handleToggleMute = () => {
    const muted = voiceManager.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleDeafen = () => {
    const deafened = voiceManager.toggleDeafen();
    setIsDeafened(deafened);
  };

  const handleRetryMic = async () => {
    const success = await voiceManager.initLocalAudio();
    setMicPermissionState(success ? 'granted' : 'denied');
  };

  const participantList = Object.values(participants) as Participant[];

  return (
    <div
      id="voice-controls-panel"
      className="bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 rounded-2xl p-2 flex items-center justify-between gap-3 text-slate-800"
    >
      {/* Voice Status & Speaking Participants */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold shrink-0">
          <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
          <span>Голосовая связь</span>
        </div>

        {/* Self Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition shrink-0 ${
            isLocalSpeaking && !isMuted
              ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
              : isMuted
              ? 'bg-slate-100 text-slate-500'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          <div className="relative flex items-center justify-center">
            {isLocalSpeaking && !isMuted && (
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`w-2 h-2 rounded-full ${
                isMuted ? 'bg-rose-400' : isLocalSpeaking ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </div>
          <span className="font-semibold">{userName} (Вы)</span>
          {isMuted ? (
            <MicOff className="w-3 h-3 text-rose-500" />
          ) : (
            <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${Math.min(100, localVolume * 1.5)}%` }}
              />
            </div>
          )}
        </div>

        {/* Other Connected Peers */}
        {participantList
          .filter((p) => p.id !== currentUserId)
          .map((p) => {
            const isPeerSpeaking = p.isSpeaking && !p.micMuted;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition shrink-0 ${
                  isPeerSpeaking
                    ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
                    : p.micMuted
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  {isPeerSpeaking && (
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.micMuted ? 'bg-rose-400' : isPeerSpeaking ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <span className="font-medium">
                  {p.name} {p.role === 'tutor' ? '👨‍🏫' : '👨‍🎓'}
                </span>
                {p.micMuted && <MicOff className="w-3 h-3 text-rose-400" />}
              </div>
            );
          })}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {micPermissionState === 'denied' && (
          <button
            onClick={handleRetryMic}
            title="Включить доступ к микрофону"
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-amber-200 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Разрешить микрофон</span>
          </button>
        )}

        {/* Mic Mute / Unmute */}
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Включить микрофон (M)' : 'Выключить микрофон (M)'}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm ${
            isMuted
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span className="hidden md:inline">{isMuted ? 'Микрофон выкл' : 'Микрофон вкл'}</span>
        </button>

        {/* Deafen (Mute Incoming Audio) */}
        <button
          onClick={handleToggleDeafen}
          title={isDeafened ? 'Включить звук урока' : 'Заглушить звук (Deafen)'}
          className={`p-2 rounded-xl text-xs font-semibold transition flex items-center justify-center ${
            isDeafened
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Mic Help Modal Toggle */}
        <button
          onClick={() => setShowMicHelp(!showMicHelp)}
          title="Справка по звуку"
          className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Mic Help Dropdown */}
      {showMicHelp && (
        <div
          className="absolute right-2 bottom-full mb-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in"
          onMouseLeave={() => setShowMicHelp(false)}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Голосовая связь в реальном времени
            </h4>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Платформа передает голос напрямую между участниками по технологии WebRTC с подавлением эха и шума.
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Зеленый круг вокруг имени показывает, кто сейчас говорит</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Микрофон можно заглушить в любой момент кнопкой или клавишей M</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
