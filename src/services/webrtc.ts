import { getSocket } from './socket';

const STORAGE_MIC_KEY = 'webrtc_selected_mic';
const STORAGE_SPEAKER_KEY = 'webrtc_selected_speaker';
const STORAGE_NOISE_SUPPRESSION_KEY = 'webrtc_noise_suppression_enabled';
const STORAGE_NOISE_MODE_KEY = 'webrtc_noise_suppression_mode';
const STORAGE_NOISE_GATE_KEY = 'webrtc_noise_gate_threshold';
const STORAGE_ECHO_CANCEL_KEY = 'webrtc_echo_cancellation';
const STORAGE_AUTO_GAIN_KEY = 'webrtc_auto_gain';

export type NoiseSuppressionMode = 'smart' | 'standard' | 'off';

export interface AudioSettings {
  noiseSuppressionEnabled: boolean;
  noiseSuppressionMode: NoiseSuppressionMode;
  noiseGateThreshold: number; // 0 - 100
  echoCancellation: boolean;
  autoGainControl: boolean;
}

interface PeerConnectionState {
  peerId: string;
  connection: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
  makingOffer: boolean;
  ignoreOffer: boolean;
  isPolite: boolean;
}

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export class VoiceManager {
  private localStream: MediaStream | null = null;
  private rawLocalStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private peerConnections: Map<string, PeerConnectionState> = new Map();
  private isMuted: boolean = true; // Initially muted as requested
  private isDeafened: boolean = false;
  private animationFrameId: number | null = null;
  private onVolumeChangeCallback: ((volume: number) => void) | null = null;
  private onSpeakingChangeCallback: ((isSpeaking: boolean) => void) | null = null;
  private isSpeaking: boolean = false;
  private audioContainer: HTMLElement | null = null;

  // Audio DSP Noise Suppression Nodes
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilterNode: BiquadFilterNode | null = null;
  private lowpassFilterNode: BiquadFilterNode | null = null;
  private gateGainNode: GainNode | null = null;
  private mediaStreamDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private currentGateGain: number = 1.0;

  // Selected Device IDs
  private selectedInputDeviceId: string = 'default';
  private selectedOutputDeviceId: string = 'default';

  // Noise Suppression and Audio Enhancements Config
  private noiseSuppressionEnabled: boolean = true;
  private noiseSuppressionMode: NoiseSuppressionMode = 'smart';
  private noiseGateThreshold: number = 15; // 0-100 scale
  private echoCancellation: boolean = true;
  private autoGainControl: boolean = true;

  // Reliable free STUN servers for robust NAT traversal across different PCs and networks
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor() {
    try {
      const savedMic = localStorage.getItem(STORAGE_MIC_KEY);
      if (savedMic) this.selectedInputDeviceId = savedMic;
      const savedSpeaker = localStorage.getItem(STORAGE_SPEAKER_KEY);
      if (savedSpeaker) this.selectedOutputDeviceId = savedSpeaker;

      const savedNoiseSupp = localStorage.getItem(STORAGE_NOISE_SUPPRESSION_KEY);
      if (savedNoiseSupp !== null) this.noiseSuppressionEnabled = savedNoiseSupp === 'true';

      const savedMode = localStorage.getItem(STORAGE_NOISE_MODE_KEY) as NoiseSuppressionMode;
      if (savedMode && ['smart', 'standard', 'off'].includes(savedMode)) {
        this.noiseSuppressionMode = savedMode;
      }

      const savedGate = localStorage.getItem(STORAGE_NOISE_GATE_KEY);
      if (savedGate) {
        const parsed = parseInt(savedGate, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) this.noiseGateThreshold = parsed;
      }

      const savedEcho = localStorage.getItem(STORAGE_ECHO_CANCEL_KEY);
      if (savedEcho !== null) this.echoCancellation = savedEcho === 'true';

      const savedGain = localStorage.getItem(STORAGE_AUTO_GAIN_KEY);
      if (savedGain !== null) this.autoGainControl = savedGain === 'true';
    } catch {}

    this.setupSocketListeners();
    this.setupUserGestureUnlock();
  }

  private getOrCreateAudioContainer(): HTMLElement {
    if (this.audioContainer && document.body.contains(this.audioContainer)) {
      return this.audioContainer;
    }
    let container = document.getElementById('webrtc-audio-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'webrtc-audio-container';
      container.style.position = 'fixed';
      container.style.width = '0px';
      container.style.height = '0px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);
    }
    this.audioContainer = container;
    return container;
  }

  public getAudioContext(): AudioContext {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  // Auto unlock browser audio playback on user gestures
  private setupUserGestureUnlock() {
    const unlock = () => {
      const ctx = this.audioContext;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      this.peerConnections.forEach((peer) => {
        if (peer.audioElement) {
          peer.audioElement.muted = this.isDeafened;
          peer.audioElement.volume = 1.0;
          if (peer.audioElement.paused && !this.isDeafened) {
            peer.audioElement.play().catch(() => {});
          }
        }
      });
    };

    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private setupSocketListeners() {
    const socket = getSocket();

    socket.on(
      'voice:signal',
      async (data: { from: string; signal: any; type: 'offer' | 'answer' | 'ice-candidate' }) => {
        const { from, signal, type } = data;
        if (!from || !signal) return;

        let peer = this.peerConnections.get(from);
        if (!peer) {
          peer = this.createPeerConnection(from);
        }

        const connection = peer.connection;

        try {
          if (type === 'offer') {
            const offerCollision = peer.makingOffer || connection.signalingState !== 'stable';
            peer.ignoreOffer = !peer.isPolite && offerCollision;
            if (peer.ignoreOffer) {
              return;
            }

            if (offerCollision && peer.isPolite) {
              try {
                await connection.setLocalDescription({ type: 'rollback' } as any);
              } catch (e) {}
            }

            await connection.setRemoteDescription(new RTCSessionDescription(signal));

            // Attach our local audio track before answering if available
            if (this.localStream) {
              const localTrack = this.localStream.getAudioTracks()[0];
              if (localTrack) {
                const senders = connection.getSenders();
                const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
                if (audioSender) {
                  await audioSender.replaceTrack(localTrack).catch(() => {});
                } else {
                  try {
                    connection.addTrack(localTrack, this.localStream);
                  } catch (e) {}
                }
              }
            }

            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);

            socket.emit('voice:signal', {
              to: from,
              signal: connection.localDescription,
              type: 'answer',
            });

            // Drain queued ICE candidates
            while (peer.pendingCandidates.length > 0) {
              const cand = peer.pendingCandidates.shift();
              if (cand) {
                try {
                  await connection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
            }
          } else if (type === 'answer') {
            if (connection.signalingState === 'have-local-offer') {
              await connection.setRemoteDescription(new RTCSessionDescription(signal));

              // Drain queued ICE candidates
              while (peer.pendingCandidates.length > 0) {
                const cand = peer.pendingCandidates.shift();
                if (cand) {
                  try {
                    await connection.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
              }
            }
          } else if (type === 'ice-candidate') {
            if (connection.remoteDescription && connection.remoteDescription.type) {
              try {
                await connection.addIceCandidate(new RTCIceCandidate(signal));
              } catch (e) {
                if (!peer.ignoreOffer) {
                  console.warn('addIceCandidate error:', e);
                }
              }
            } else {
              peer.pendingCandidates.push(signal);
            }
          }
        } catch (err) {
          console.warn('WebRTC signal handler error:', err);
        }
      }
    );

    socket.on('participant:left', ({ userId }: { userId: string }) => {
      this.removePeer(userId);
    });

    socket.on('participant:joined', (p: { id: string }) => {
      if (p && p.id && p.id !== socket.id) {
        this.callPeer(p.id);
      }
    });

    socket.on('room:participants', (list: Array<{ id: string }>) => {
      const myId = socket.id;
      if (!Array.isArray(list)) return;
      list.forEach((p) => {
        if (p && p.id && p.id !== myId && !this.peerConnections.has(p.id)) {
          if (myId && p.id > myId) {
            this.callPeer(p.id);
          }
        }
      });
    });
  }

  // Device Enumeration
  public async getAudioDevices(): Promise<{
    microphones: AudioDeviceInfo[];
    speakers: AudioDeviceInfo[];
  }> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return { microphones: [], speakers: [] };
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones: AudioDeviceInfo[] = [];
      const speakers: AudioDeviceInfo[] = [];

      let micIdx = 1;
      let spkIdx = 1;

      devices.forEach((d) => {
        if (d.kind === 'audioinput') {
          microphones.push({
            deviceId: d.deviceId,
            label: d.label || `Микрофон ${micIdx++}`,
            kind: 'audioinput',
          });
        } else if (d.kind === 'audiooutput') {
          speakers.push({
            deviceId: d.deviceId,
            label: d.label || `Динамики / Наушники ${spkIdx++}`,
            kind: 'audiooutput',
          });
        }
      });

      return { microphones, speakers };
    } catch (err) {
      console.warn('Error enumerating devices:', err);
      return { microphones: [], speakers: [] };
    }
  }

  public getCurrentDevices() {
    return {
      inputDeviceId: this.selectedInputDeviceId,
      outputDeviceId: this.selectedOutputDeviceId,
    };
  }

  private setupAudioProcessingPipeline(rawStream: MediaStream): MediaStream {
    try {
      const ctx = this.getAudioContext();

      // Disconnect previous audio nodes if any
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch {}
      }

      this.sourceNode = ctx.createMediaStreamSource(rawStream);

      // 1. Highpass filter (~85Hz) removes low-frequency table bumps, AC hum, computer fan vibrations
      this.highpassFilterNode = ctx.createBiquadFilter();
      this.highpassFilterNode.type = 'highpass';
      this.highpassFilterNode.frequency.setValueAtTime(85, ctx.currentTime);
      this.highpassFilterNode.Q.setValueAtTime(0.7, ctx.currentTime);

      // 2. Lowpass filter (~7500Hz) removes high-frequency hiss, coil whine, electronic buzz
      this.lowpassFilterNode = ctx.createBiquadFilter();
      this.lowpassFilterNode.type = 'lowpass';
      this.lowpassFilterNode.frequency.setValueAtTime(7500, ctx.currentTime);
      this.lowpassFilterNode.Q.setValueAtTime(0.7, ctx.currentTime);

      // 3. Noise Gate Gain Node (attenuates background room noise, key clicks when quiet)
      this.gateGainNode = ctx.createGain();
      this.gateGainNode.gain.setValueAtTime(1.0, ctx.currentTime);
      this.currentGateGain = 1.0;

      // 4. Destination node generates a processed MediaStream to send over WebRTC
      this.mediaStreamDestinationNode = ctx.createMediaStreamDestination();

      // 5. Analyser node for volume monitoring (measures signal before gate attenuation)
      this.localAnalyser = ctx.createAnalyser();
      this.localAnalyser.fftSize = 256;
      this.localAnalyser.smoothingTimeConstant = 0.3;

      // Connect DSP graph: Source -> Highpass -> Lowpass -> GateGain -> MediaStreamDestination
      this.sourceNode.connect(this.highpassFilterNode);
      this.highpassFilterNode.connect(this.lowpassFilterNode);
      this.lowpassFilterNode.connect(this.gateGainNode);
      this.gateGainNode.connect(this.mediaStreamDestinationNode);

      // Connect filtered signal to Analyser (to evaluate voice volume cleanly)
      this.lowpassFilterNode.connect(this.localAnalyser);

      if (!this.animationFrameId) {
        this.startVolumeMonitoring();
      }

      // Return processed stream if smart noise filter is active
      if (this.noiseSuppressionEnabled && this.noiseSuppressionMode === 'smart') {
        return this.mediaStreamDestinationNode.stream;
      }

      return rawStream;
    } catch (e) {
      console.warn('AudioContext DSP processing fallback:', e);
      return rawStream;
    }
  }

  public hasLocalStream(): boolean {
    return !!(this.localStream && this.localStream.active && this.localStream.getAudioTracks().length > 0);
  }

  public async initLocalAudio(inputDeviceId?: string): Promise<boolean> {
    try {
      if (this.hasLocalStream() && !inputDeviceId) {
        return true;
      }

      const devId = inputDeviceId || this.selectedInputDeviceId;
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: devId === 'default' ? undefined : { exact: devId },
          echoCancellation: this.echoCancellation,
          noiseSuppression: this.noiseSuppressionEnabled && this.noiseSuppressionMode !== 'off',
          autoGainControl: this.autoGainControl,
        },
        video: false,
      };

      const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.rawLocalStream = rawStream;

      const finalStream = this.setupAudioProcessingPipeline(rawStream);
      this.localStream = finalStream;

      const audioTrack = finalStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !this.isMuted;
      }

      // Attach tracks to all existing peer connections
      for (const [peerId, peer] of this.peerConnections.entries()) {
        if (audioTrack) {
          const senders = peer.connection.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            try {
              await audioSender.replaceTrack(audioTrack);
            } catch (e) {
              peer.connection.addTrack(audioTrack, finalStream);
            }
          } else {
            try {
              peer.connection.addTrack(audioTrack, finalStream);
            } catch (e) {}
          }
        }

        // If connection is stable, trigger renegotiation
        if (peer.connection.signalingState === 'stable') {
          this.callPeer(peerId);
        }
      }

      return true;
    } catch (err) {
      console.warn('Microphone access not granted or unavailable:', err);
      return false;
    }
  }

  public async setAudioInputDevice(deviceId: string): Promise<boolean> {
    this.selectedInputDeviceId = deviceId;
    try {
      localStorage.setItem(STORAGE_MIC_KEY, deviceId);
    } catch {}

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
          echoCancellation: this.echoCancellation,
          noiseSuppression: this.noiseSuppressionEnabled && this.noiseSuppressionMode !== 'off',
          autoGainControl: this.autoGainControl,
        },
        video: false,
      };

      const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.rawLocalStream) {
        this.rawLocalStream.getAudioTracks().forEach((t) => t.stop());
      }
      this.rawLocalStream = rawStream;

      const finalStream = this.setupAudioProcessingPipeline(rawStream);
      const newAudioTrack = finalStream.getAudioTracks()[0];

      if (!newAudioTrack) return false;

      // Replace tracks in all peer connections
      this.peerConnections.forEach(async (peer) => {
        const senders = peer.connection.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          try {
            await audioSender.replaceTrack(newAudioTrack);
          } catch (e) {
            peer.connection.addTrack(newAudioTrack, finalStream);
          }
        } else {
          peer.connection.addTrack(newAudioTrack, finalStream);
        }
      });

      // Stop old tracks if different
      if (this.localStream && this.localStream !== finalStream) {
        this.localStream.getAudioTracks().forEach((t) => t.stop());
      }
      this.localStream = finalStream;
      newAudioTrack.enabled = !this.isMuted;

      return true;
    } catch (err) {
      console.warn('Error switching audio input:', err);
      return false;
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    this.selectedOutputDeviceId = deviceId;
    try {
      localStorage.setItem(STORAGE_SPEAKER_KEY, deviceId);
    } catch {}

    let success = true;

    for (const peer of this.peerConnections.values()) {
      if (peer.audioElement && typeof (peer.audioElement as any).setSinkId === 'function') {
        try {
          await (peer.audioElement as any).setSinkId(deviceId === 'default' ? '' : deviceId);
        } catch (err: any) {
          console.warn('setSinkId error:', err);
          success = false;
        }
      }
    }

    return success;
  }

  public async callPeer(peerId: string) {
    let peer = this.peerConnections.get(peerId);
    if (!peer) {
      peer = this.createPeerConnection(peerId);
    }

    const connection = peer.connection;

    try {
      peer.makingOffer = true;

      // Attach local track if available
      if (this.localStream) {
        const localTrack = this.localStream.getAudioTracks()[0];
        if (localTrack) {
          const senders = connection.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            try {
              await audioSender.replaceTrack(localTrack);
            } catch (e) {
              connection.addTrack(localTrack, this.localStream);
            }
          } else {
            try {
              connection.addTrack(localTrack, this.localStream);
            } catch (e) {}
          }
        }
      }

      if (connection.signalingState !== 'stable') {
        return;
      }

      const offer = await connection.createOffer({
        offerToReceiveAudio: true,
      });

      if (connection.signalingState !== 'stable') {
        return;
      }

      await connection.setLocalDescription(offer);

      getSocket().emit('voice:signal', {
        to: peerId,
        signal: connection.localDescription,
        type: 'offer',
      });
    } catch (err) {
      console.warn('Error creating WebRTC offer for peer:', peerId, err);
    } finally {
      peer.makingOffer = false;
    }
  }

  private createPeerConnection(peerId: string): PeerConnectionState {
    const connection = new RTCPeerConnection(this.rtcConfig);
    const socketId = getSocket().id || '';
    const isPolite = socketId < peerId;

    const peer: PeerConnectionState = {
      peerId,
      connection,
      pendingCandidates: [],
      makingOffer: false,
      ignoreOffer: false,
      isPolite,
    };

    // Request bidirectional audio transceiver
    try {
      connection.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (e) {}

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        try {
          connection.addTrack(track, this.localStream!);
        } catch (e) {}
      });
    }

    // ICE Candidate
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('voice:signal', {
          to: peerId,
          signal: event.candidate,
          type: 'ice-candidate',
        });
      }
    };

    // ICE Connection state monitoring
    connection.oniceconnectionstatechange = () => {
      if (connection.iceConnectionState === 'failed' || connection.iceConnectionState === 'disconnected') {
        try {
          if (typeof connection.restartIce === 'function') {
            connection.restartIce();
          } else {
            this.callPeer(peerId);
          }
        } catch (e) {}
      }
    };

    // Remote Audio Stream (outputs EXCLUSIVELY to HTMLAudioElement with setSinkId)
    connection.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      let audioEl = peer.audioElement;

      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.muted = this.isDeafened;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('data-peer-id', peerId);

        // Apply selected speaker / headphones device if specified
        if (
          this.selectedOutputDeviceId &&
          this.selectedOutputDeviceId !== 'default' &&
          typeof (audioEl as any).setSinkId === 'function'
        ) {
          (audioEl as any).setSinkId(this.selectedOutputDeviceId).catch((err: any) => {
            console.warn('setSinkId initial error:', err);
          });
        }

        const container = this.getOrCreateAudioContainer();
        container.appendChild(audioEl);
        peer.audioElement = audioEl;
      } else {
        if (
          this.selectedOutputDeviceId &&
          this.selectedOutputDeviceId !== 'default' &&
          typeof (audioEl as any).setSinkId === 'function'
        ) {
          (audioEl as any).setSinkId(this.selectedOutputDeviceId).catch(() => {});
        }
      }

      audioEl.srcObject = stream;
      audioEl.volume = 1.0;
      audioEl.muted = this.isDeafened;

      const playAudio = () => {
        if (audioEl && !this.isDeafened) {
          audioEl.play().catch(() => {});
        }
      };

      playAudio();

      event.track.onunmute = () => {
        playAudio();
      };
    };

    this.peerConnections.set(peerId, peer);
    return peer;
  }

  private startVolumeMonitoring() {
    if (!this.localAnalyser) return;
    const bufferLength = this.localAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (!this.localAnalyser || this.isMuted) {
        // When muted, ensure gate is closed
        if (this.gateGainNode && this.audioContext) {
          try {
            this.gateGainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gateGainNode.gain.setValueAtTime(0.0, this.audioContext.currentTime);
            this.currentGateGain = 0.0;
          } catch {}
        }
        if (this.isSpeaking) {
          this.isSpeaking = false;
          this.onSpeakingChangeCallback?.(false);
          getSocket().emit('voice:state', { micMuted: this.isMuted, isSpeaking: false });
        }
        this.animationFrameId = requestAnimationFrame(checkVolume);
        return;
      }

      this.localAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedVol = Math.min(100, Math.round((average / 128) * 100));

      this.onVolumeChangeCallback?.(normalizedVol);

      const speakingNow = normalizedVol >= this.noiseGateThreshold;

      // Intelligent DSP Noise Gate dynamic attenuation
      if (this.gateGainNode && this.audioContext) {
        try {
          const now = this.audioContext.currentTime;
          if (this.noiseSuppressionEnabled && this.noiseSuppressionMode === 'smart') {
            if (speakingNow) {
              // Quick smooth attack when voice starts speaking (15ms)
              if (this.currentGateGain < 0.95) {
                this.gateGainNode.gain.cancelScheduledValues(now);
                this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.015);
                this.currentGateGain = 1.0;
              }
            } else {
              // Smooth exponential release to eliminate keyboard/ambient noise (120ms)
              if (this.currentGateGain > 0.05) {
                this.gateGainNode.gain.cancelScheduledValues(now);
                this.gateGainNode.gain.setTargetAtTime(0.02, now, 0.12);
                this.currentGateGain = 0.02;
              }
            }
          } else {
            // Full passthrough if smart mode is disabled
            if (this.currentGateGain < 0.99) {
              this.gateGainNode.gain.cancelScheduledValues(now);
              this.gateGainNode.gain.setValueAtTime(1.0, now);
              this.currentGateGain = 1.0;
            }
          }
        } catch {}
      }

      if (speakingNow !== this.isSpeaking) {
        this.isSpeaking = speakingNow;
        this.onSpeakingChangeCallback?.(speakingNow);
        getSocket().emit('voice:state', { micMuted: this.isMuted, isSpeaking: speakingNow });
      }

      this.animationFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  public getAudioSettings(): AudioSettings {
    return {
      noiseSuppressionEnabled: this.noiseSuppressionEnabled,
      noiseSuppressionMode: this.noiseSuppressionMode,
      noiseGateThreshold: this.noiseGateThreshold,
      echoCancellation: this.echoCancellation,
      autoGainControl: this.autoGainControl,
    };
  }

  public async setNoiseSuppressionEnabled(enabled: boolean): Promise<void> {
    this.noiseSuppressionEnabled = enabled;
    try {
      localStorage.setItem(STORAGE_NOISE_SUPPRESSION_KEY, String(enabled));
    } catch {}
    await this.reapplyAudioConfig();
  }

  public async setNoiseSuppressionMode(mode: NoiseSuppressionMode): Promise<void> {
    this.noiseSuppressionMode = mode;
    try {
      localStorage.setItem(STORAGE_NOISE_MODE_KEY, mode);
    } catch {}
    await this.reapplyAudioConfig();
  }

  public setNoiseGateThreshold(threshold: number): void {
    const clamped = Math.max(0, Math.min(100, threshold));
    this.noiseGateThreshold = clamped;
    try {
      localStorage.setItem(STORAGE_NOISE_GATE_KEY, String(clamped));
    } catch {}
  }

  public async setEchoCancellation(enabled: boolean): Promise<void> {
    this.echoCancellation = enabled;
    try {
      localStorage.setItem(STORAGE_ECHO_CANCEL_KEY, String(enabled));
    } catch {}
    await this.reapplyAudioConfig();
  }

  public async setAutoGainControl(enabled: boolean): Promise<void> {
    this.autoGainControl = enabled;
    try {
      localStorage.setItem(STORAGE_AUTO_GAIN_KEY, String(enabled));
    } catch {}
    await this.reapplyAudioConfig();
  }

  private async reapplyAudioConfig(): Promise<void> {
    if (!this.hasLocalStream() || !this.rawLocalStream) return;

    try {
      // Re-apply browser hardware constraints to the raw audio track
      const rawTrack = this.rawLocalStream.getAudioTracks()[0];
      if (rawTrack && typeof rawTrack.applyConstraints === 'function') {
        await rawTrack.applyConstraints({
          echoCancellation: this.echoCancellation,
          noiseSuppression: this.noiseSuppressionEnabled && this.noiseSuppressionMode !== 'off',
          autoGainControl: this.autoGainControl,
        }).catch(() => {});
      }

      // Determine which stream should be sent to peers
      let finalStream: MediaStream = this.rawLocalStream;
      if (this.noiseSuppressionEnabled && this.noiseSuppressionMode === 'smart' && this.mediaStreamDestinationNode) {
        finalStream = this.mediaStreamDestinationNode.stream;
      }

      if (this.localStream !== finalStream) {
        this.localStream = finalStream;
        const newTrack = finalStream.getAudioTracks()[0];
        if (newTrack) {
          newTrack.enabled = !this.isMuted;
          for (const peer of this.peerConnections.values()) {
            const senders = peer.connection.getSenders();
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              await audioSender.replaceTrack(newTrack).catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error reapplying audio config:', e);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsDeafened(): boolean {
    return this.isDeafened;
  }

  public async toggleMute(): Promise<boolean> {
    if (this.isMuted) {
      await this.setMicrophoneMuted(false);
    } else {
      await this.setMicrophoneMuted(true);
    }
    return this.isMuted;
  }

  public toggleDeafen(): boolean {
    this.setDeafened(!this.isDeafened);
    return this.isDeafened;
  }

  public async setMicrophoneMuted(muted: boolean): Promise<boolean> {
    this.isMuted = muted;

    if (!muted && !this.hasLocalStream()) {
      const ok = await this.initLocalAudio();
      if (!ok) {
        this.isMuted = true;
        getSocket().emit('voice:state', { micMuted: true, isSpeaking: false });
        return false;
      }
    }

    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !muted;
      });

      // Ensure transceivers have the track attached
      if (!muted && audioTracks[0]) {
        for (const peer of this.peerConnections.values()) {
          const senders = peer.connection.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            await audioSender.replaceTrack(audioTracks[0]).catch(() => {});
          }
        }
      }
    }

    getSocket().emit('voice:state', { micMuted: this.isMuted, isSpeaking: false });
    return true;
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.peerConnections.forEach((peer) => {
      if (peer.audioElement) {
        peer.audioElement.muted = deafened;
      }
    });
  }

  public setVolumeCallback(cb: (vol: number) => void) {
    this.onVolumeChangeCallback = cb;
  }

  public setSpeakingCallback(cb: (speaking: boolean) => void) {
    this.onSpeakingChangeCallback = cb;
  }

  public onVolumeChange(cb: (vol: number) => void) {
    this.onVolumeChangeCallback = cb;
  }

  public onSpeakingChange(cb: (speaking: boolean) => void) {
    this.onSpeakingChangeCallback = cb;
  }

  public removePeer(peerId: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      if (peer.audioElement) {
        peer.audioElement.pause();
        peer.audioElement.srcObject = null;
        peer.audioElement.remove();
      }
      peer.connection.close();
      this.peerConnections.delete(peerId);
    }
  }

  public resetPeers() {
    this.peerConnections.forEach((peer) => {
      if (peer.audioElement) {
        peer.audioElement.pause();
        peer.audioElement.srcObject = null;
        peer.audioElement.remove();
      }
      try {
        peer.connection.close();
      } catch {}
    });
    this.peerConnections.clear();
  }

  public leave() {
    this.cleanup();
  }

  public cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.peerConnections.forEach((peer) => {
      if (peer.audioElement) {
        peer.audioElement.pause();
        peer.audioElement.srcObject = null;
        peer.audioElement.remove();
      }
      peer.connection.close();
    });
    this.peerConnections.clear();
  }
}

export const voiceManager = new VoiceManager();
