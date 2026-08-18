import React, { useState, useEffect } from 'react';
import { Participant, UserRole } from '../../types';
import {
  voiceManager,
  AudioDeviceInfo,
  NoiseSuppressionMode,
  AudioSettings,
} from '../../services/webrtc';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sliders,
  X,
  Check,
  Sparkles,
  ShieldCheck,
  Layers,
} from 'lucide-react';

interface VoiceControlsProps {
  participants: Record<string, Participant>;
  currentUserId?: string;
  userRole: UserRole;
  userName: string;
}

const VOICE_COLLAPSED_KEY = 'tutorboard_voice_collapsed';

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  participants,
  currentUserId,
  userRole,
  userName,
}) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showMicHelp, setShowMicHelp] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  // Devices & Audio Settings
  const [microphones, setMicrophones] = useState<AudioDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<AudioDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('default');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('default');
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  // Noise Suppression State
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => voiceManager.getAudioSettings());

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VOICE_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // If stream already exists, load devices and settings
    if (voiceManager.hasLocalStream()) {
      setMicPermissionState('granted');
      loadDevices();
    }
    setAudioSettings(voiceManager.getAudioSettings());

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

  const loadDevices = async () => {
    const { microphones: mics, speakers: spks } = await voiceManager.getAudioDevices();
    setMicrophones(mics);
    setSpeakers(spks);
    const curr = voiceManager.getCurrentDevices();
    if (curr.inputDeviceId) setSelectedMic(curr.inputDeviceId);
    if (curr.outputDeviceId) setSelectedSpeaker(curr.outputDeviceId);
  };

  const handleMicSelect = async (devId: string) => {
    setSelectedMic(devId);
    const ok = await voiceManager.setAudioInputDevice(devId);
    if (ok) {
      setDeviceNotice('Микрофон успешно переключен');
      setTimeout(() => setDeviceNotice(null), 2000);
    }
  };

  const handleSpeakerSelect = async (devId: string) => {
    setSelectedSpeaker(devId);
    const ok = await voiceManager.setAudioOutputDevice(devId);
    if (ok) {
      setDeviceNotice('Устройство вывода изменено');
      setTimeout(() => setDeviceNotice(null), 2000);
    }
  };

  const handleToggleNoiseSuppression = async (enabled: boolean) => {
    await voiceManager.setNoiseSuppressionEnabled(enabled);
    setAudioSettings(voiceManager.getAudioSettings());
    setDeviceNotice(enabled ? 'Шумоподавление включено' : 'Шумоподавление выключено');
    setTimeout(() => setDeviceNotice(null), 2000);
  };

  const handleModeChange = async (mode: NoiseSuppressionMode) => {
    await voiceManager.setNoiseSuppressionMode(mode);
    setAudioSettings(voiceManager.getAudioSettings());
  };

  const handleThresholdChange = (val: number) => {
    voiceManager.setNoiseGateThreshold(val);
    setAudioSettings(voiceManager.getAudioSettings());
  };

  const handleToggleEcho = async (enabled: boolean) => {
    await voiceManager.setEchoCancellation(enabled);
    setAudioSettings(voiceManager.getAudioSettings());
  };

  const handleToggleAutoGain = async (enabled: boolean) => {
    await voiceManager.setAutoGainControl(enabled);
    setAudioSettings(voiceManager.getAudioSettings());
  };

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleMute = async () => {
    const isNowMuted = await voiceManager.toggleMute();
    setIsMuted(isNowMuted);
    if (!isNowMuted) {
      setMicPermissionState('granted');
      loadDevices();
    }
  };

  const handleToggleDeafen = () => {
    const deafened = voiceManager.toggleDeafen();
    setIsDeafened(deafened);
  };

  const handleRetryMic = async () => {
    const success = await voiceManager.initLocalAudio();
    setMicPermissionState(success ? 'granted' : 'denied');
    if (success) {
      await voiceManager.setMicrophoneMuted(false);
      setIsMuted(false);
      loadDevices();
    }
  };

  const participantList = Object.values(participants) as Participant[];

  // ---------------- COLLAPSED MINIMAL VIEW ----------------
  if (isCollapsed) {
    return (
      <div
        id="voice-controls-panel-collapsed"
        className="bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/90 rounded-2xl px-2.5 py-1.5 flex items-center gap-2 text-slate-800 transition-all duration-200"
      >
        {/* Connection status badge */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Развернуть панель голосовой связи"
          className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="hidden sm:inline">Связь</span>
          <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500 shrink-0" />
        </button>

        {/* Quick Mic Mute / Unmute Button */}
        <button
          type="button"
          onClick={handleToggleMute}
          title={isMuted ? 'Включить микрофон (M)' : 'Выключить микрофон (M)'}
          className={`p-2 w-8 h-8 rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer shadow-2xs shrink-0 ${
            isMuted
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              : isLocalSpeaking
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        {/* Expand Trigger Button */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Развернуть панель"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ---------------- FULL EXPANDED VIEW ----------------
  return (
    <div
      id="voice-controls-panel"
      className="bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/90 rounded-2xl p-2 flex items-center justify-between gap-3 text-slate-800 transition-all duration-200 relative"
    >
      {/* Voice Status & Speaking Participants */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold shrink-0">
          <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Голосовая связь</span>
          {audioSettings.noiseSuppressionEnabled && (
            <span
              title="Интеллектуальное шумоподавление активно"
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md"
            >
              <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
              Шум: Авто
            </span>
          )}
        </div>

        {/* Self Indicator */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
            isLocalSpeaking && !isMuted
              ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
              : isMuted
              ? 'bg-slate-100 text-slate-500'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          <div className="w-2.5 h-2.5 relative flex items-center justify-center shrink-0">
            {isLocalSpeaking && !isMuted && (
              <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`w-2 h-2 rounded-full ${
                isMuted ? 'bg-rose-400' : isLocalSpeaking ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </div>
          <span className="font-semibold">{userName} (Вы)</span>
          {isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : (
            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-0.5 shrink-0">
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                  isPeerSpeaking
                    ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400'
                    : p.micMuted
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <div className="w-2.5 h-2.5 relative flex items-center justify-center shrink-0">
                  {isPeerSpeaking && (
                    <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75" />
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
                {p.micMuted && <MicOff className="w-3 h-3 text-rose-400 shrink-0" />}
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
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-amber-200 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Разрешить микрофон</span>
          </button>
        )}

        {/* Mic Mute / Unmute */}
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Включить микрофон (M)' : 'Выключить микрофон (M)'}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
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
          className={`p-2 rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer ${
            isDeafened
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Audio & Noise Suppression Settings */}
        <button
          onClick={() => {
            setShowDeviceSettings(!showDeviceSettings);
            if (!showDeviceSettings) {
              loadDevices();
              setAudioSettings(voiceManager.getAudioSettings());
            }
          }}
          title="Настройка звука и шумоподавления"
          className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 ${
            showDeviceSettings
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Mic Help Modal Toggle */}
        <button
          onClick={() => setShowMicHelp(!showMicHelp)}
          title="Справка по звуку"
          className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Collapse Panel Button */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Свернуть панель связи"
          className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Audio Devices & Noise Suppression Settings Modal */}
      {showDeviceSettings && (
        <div className="absolute right-0 bottom-full mb-3 w-88 max-w-[95vw] bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in max-h-[80vh] overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Звук и шумоподавление</span>
            </h4>
            <button
              onClick={() => setShowDeviceSettings(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {deviceNotice && (
            <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{deviceNotice}</span>
            </div>
          )}

          <div className="space-y-3.5 text-xs">
            {/* Microphone Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Микрофон (Вход)
              </label>
              <select
                value={selectedMic}
                onChange={(e) => handleMicSelect(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="default">По умолчанию (Системный)</option>
                {microphones.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Speaker Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Динамики / Наушники (Выход)
              </label>
              <select
                value={selectedSpeaker}
                onChange={(e) => handleSpeakerSelect(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="default">По умолчанию (Системный)</option>
                {speakers.map((s) => (
                  <option key={s.deviceId} value={s.deviceId}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Noise Suppression Section */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Шумоподавление</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioSettings.noiseSuppressionEnabled}
                    onChange={(e) => handleToggleNoiseSuppression(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {audioSettings.noiseSuppressionEnabled && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 space-y-2.5">
                  {/* Mode selector */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleModeChange('smart')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        audioSettings.noiseSuppressionMode === 'smart'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Умный фильтр</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange('standard')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                        audioSettings.noiseSuppressionMode === 'standard'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>Стандартное</span>
                    </button>
                  </div>

                  {/* Noise Gate threshold slider with live visualization */}
                  {audioSettings.noiseSuppressionMode === 'smart' && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">Чувствительность отсечения:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {audioSettings.noiseGateThreshold}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="50"
                        value={audioSettings.noiseGateThreshold}
                        onChange={(e) => handleThresholdChange(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Отсекает клики мыши, клавиатуру и фоновый гул ниже выбранного порога.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Additional Audio Enhancements: Echo & Gain */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">Подавление эха:</span>
                <input
                  type="checkbox"
                  checked={audioSettings.echoCancellation}
                  onChange={(e) => handleToggleEcho(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">Авто-усиление микрофона:</span>
                <input
                  type="checkbox"
                  checked={audioSettings.autoGainControl}
                  onChange={(e) => handleToggleAutoGain(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>
            </div>

            {/* Mic Live Volume Level Test with threshold indicator */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Проверка уровня микрофона:</span>
                <span className="font-mono text-emerald-600">{localVolume}%</span>
              </div>
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, localVolume * 1.5)}%` }}
                />
                {/* Gate threshold marker line */}
                {audioSettings.noiseSuppressionEnabled && audioSettings.noiseSuppressionMode === 'smart' && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-sm"
                    style={{ left: `${Math.min(100, audioSettings.noiseGateThreshold * 1.5)}%` }}
                    title={`Порог активации: ${audioSettings.noiseGateThreshold}%`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
            Платформа передает голос напрямую между участниками по технологии WebRTC с интеллектуальным шумоподавлением и подавлением эха.
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Зеленый круг вокруг имени показывает, кто сейчас говорит</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Шумоподавление и порог отсечения можно настроить через иконку ползунков 🎚️</span>
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
