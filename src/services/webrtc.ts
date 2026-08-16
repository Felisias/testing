import { getSocket } from './socket';

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
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private peerConnections: Map<string, PeerConnectionState> = new Map();
  private isMuted: boolean = true;
  private isDeafened: boolean = false;
  private animationFrameId: number | null = null;
  private onVolumeChangeCallback: ((volume: number) => void) | null = null;
  private onSpeakingChangeCallback: ((isSpeaking: boolean) => void) | null = null;
  private isSpeaking: boolean = false;
  private speakingThreshold: number = 15; // 0-100 scale
  private audioContainer: HTMLElement | null = null;

  // Selected Device IDs
  private selectedInputDeviceId: string = 'default';
  private selectedOutputDeviceId: string = 'default';

  // Reliable free STUN servers for robust NAT traversal
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

  // Auto unlock browser audio on any user gesture
  private setupUserGestureUnlock() {
    const unlock = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      this.peerConnections.forEach((peer) => {
        if (peer.audioElement) {
          peer.audioElement.muted = this.isDeafened;
          peer.audioElement.volume = 1.0;
          if (peer.audioElement.paused) {
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
        let peer = this.peerConnections.get(from);

        if (!peer) {
          peer = this.createPeerConnection(from);
        }

        try {
          if (type === 'offer') {
            const isPolite = peer.isPolite;
            const readyForOffer =
              !peer.makingOffer &&
              (peer.connection.signalingState === 'stable' || peer.connection.signalingState === 'have-remote-offer');
            const offerCollision = !readyForOffer;

            peer.ignoreOffer = !isPolite && offerCollision;
            if (peer.ignoreOffer) {
              return;
            }

            if (offerCollision && isPolite) {
              try {
                await peer.connection.setLocalDescription({ type: 'rollback' } as any);
              } catch (e) {
                // Rollback fallback
              }
            }

            await peer.connection.setRemoteDescription(new RTCSessionDescription(signal));

            // Flush pending ICE candidates
            while (peer.pendingCandidates.length > 0) {
              const cand = peer.pendingCandidates.shift();
              if (cand) {
                try {
                  await peer.connection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
            }

            // Ensure our local audio track is attached before answering
            if (this.localStream) {
              const localTrack = this.localStream.getAudioTracks()[0];
              if (localTrack) {
                const senders = peer.connection.getSenders();
                const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
                if (audioSender) {
                  await audioSender.replaceTrack(localTrack);
                } else {
                  peer.connection.addTrack(localTrack, this.localStream);
                }
              }
            }

            const answer = await peer.connection.createAnswer();
            await peer.connection.setLocalDescription(answer);

            socket.emit('voice:signal', {
              to: from,
              signal: peer.connection.localDescription,
              type: 'answer',
            });
          } else if (type === 'answer') {
            if (peer.connection.signalingState === 'have-local-offer') {
              await peer.connection.setRemoteDescription(new RTCSessionDescription(signal));

              // Flush pending ICE candidates
              while (peer.pendingCandidates.length > 0) {
                const cand = peer.pendingCandidates.shift();
                if (cand) {
                  try {
                    await peer.connection.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
              }
            }
          } else if (type === 'ice-candidate') {
            if (signal) {
              if (peer.connection.remoteDescription && peer.connection.remoteDescription.type) {
                try {
                  await peer.connection.addIceCandidate(new RTCIceCandidate(signal));
                } catch (e) {}
              } else {
                peer.pendingCandidates.push(signal);
              }
            }
          }
        } catch (err) {
          console.warn('WebRTC signal handler caught:', err);
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
          this.callPeer(p.id);
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

  public async setAudioInputDevice(deviceId: string): Promise<boolean> {
    this.selectedInputDeviceId = deviceId;
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newAudioTrack = newStream.getAudioTracks()[0];

      if (!newAudioTrack) return false;

      // Replace tracks in all peer connections
      this.peerConnections.forEach(async (peer) => {
        const senders = peer.connection.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          try {
            await audioSender.replaceTrack(newAudioTrack);
          } catch (e) {
            peer.connection.addTrack(newAudioTrack, newStream);
          }
        } else {
          peer.connection.addTrack(newAudioTrack, newStream);
        }
      });

      // Stop old tracks
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((t) => t.stop());
      }
      this.localStream = newStream;
      newAudioTrack.enabled = !this.isMuted;

      // Reconnect analyser
      this.attachAnalyserToStream(newStream);

      return true;
    } catch (err) {
      console.warn('Error switching audio input:', err);
      return false;
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    this.selectedOutputDeviceId = deviceId;
    let success = true;

    this.peerConnections.forEach((peer) => {
      if (peer.audioElement && typeof (peer.audioElement as any).setSinkId === 'function') {
        (peer.audioElement as any).setSinkId(deviceId).catch((err: any) => {
          console.warn('setSinkId error:', err);
          success = false;
        });
      }
    });

    return success;
  }

  private attachAnalyserToStream(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 256;
      this.localAnalyser.smoothingTimeConstant = 0.4;
      source.connect(this.localAnalyser);

      if (!this.animationFrameId) {
        this.startVolumeMonitoring();
      }
    } catch (e) {
      console.warn('AudioContext visualization setup warning:', e);
    }
  }

  public async initLocalAudio(inputDeviceId?: string): Promise<boolean> {
    try {
      if (this.localStream && this.localStream.active && !inputDeviceId) {
        return true;
      }

      const devId = inputDeviceId || this.selectedInputDeviceId;
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: devId === 'default' ? undefined : { exact: devId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !this.isMuted;
      }

      this.attachAnalyserToStream(stream);

      // Attach tracks to all existing peer connections and renegotiate if needed
      this.peerConnections.forEach(async (peer, peerId) => {
        if (audioTrack) {
          const senders = peer.connection.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            try {
              await audioSender.replaceTrack(audioTrack);
            } catch (e) {
              peer.connection.addTrack(audioTrack, stream);
            }
          } else {
            peer.connection.addTrack(audioTrack, stream);
          }
        }

        // If connection is stable, ensure offer is updated
        if (peer.connection.signalingState === 'stable') {
          this.callPeer(peerId);
        }
      });

      return true;
    } catch (err) {
      console.warn('Microphone access not granted or unavailable:', err);
      return false;
    }
  }

  public async callPeer(peerId: string) {
    let peer = this.peerConnections.get(peerId);
    if (!peer) {
      peer = this.createPeerConnection(peerId);
    }

    try {
      peer.makingOffer = true;

      // Attach local track if available
      if (this.localStream) {
        const localTrack = this.localStream.getAudioTracks()[0];
        if (localTrack) {
          const senders = peer.connection.getSenders();
          const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            try {
              await audioSender.replaceTrack(localTrack);
            } catch (e) {
              peer.connection.addTrack(localTrack, this.localStream);
            }
          } else {
            peer.connection.addTrack(localTrack, this.localStream);
          }
        }
      }

      if (peer.connection.signalingState !== 'stable') {
        return;
      }

      const offer = await peer.connection.createOffer({
        offerToReceiveAudio: true,
      });

      if (peer.connection.signalingState !== 'stable') {
        return;
      }

      await peer.connection.setLocalDescription(offer);

      getSocket().emit('voice:signal', {
        to: peerId,
        signal: peer.connection.localDescription,
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
    } catch (e) {
      // Standard fallback
    }

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
      if (connection.iceConnectionState === 'failed') {
        try {
          if (typeof connection.restartIce === 'function') {
            connection.restartIce();
          } else {
            this.callPeer(peerId);
          }
        } catch (e) {}
      }
    };

    // Remote Audio Stream
    connection.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      let audioEl = peer.audioElement;

      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.muted = this.isDeafened;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('data-peer-id', peerId);

        // Apply selected speaker if available
        if (this.selectedOutputDeviceId !== 'default' && typeof (audioEl as any).setSinkId === 'function') {
          (audioEl as any).setSinkId(this.selectedOutputDeviceId).catch(() => {});
        }

        const container = this.getOrCreateAudioContainer();
        container.appendChild(audioEl);
        peer.audioElement = audioEl;
      }

      audioEl.srcObject = stream;
      audioEl.volume = 1.0;
      audioEl.muted = this.isDeafened;

      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Playback will resume upon user gesture
        });
      }
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

      const speakingNow = normalizedVol > this.speakingThreshold;
      if (speakingNow !== this.isSpeaking) {
        this.isSpeaking = speakingNow;
        this.onSpeakingChangeCallback?.(speakingNow);
        getSocket().emit('voice:state', { micMuted: this.isMuted, isSpeaking: speakingNow });
      }

      this.animationFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsDeafened(): boolean {
    return this.isDeafened;
  }

  public toggleMute(): boolean {
    this.setMicrophoneMuted(!this.isMuted);
    return this.isMuted;
  }

  public toggleDeafen(): boolean {
    this.setDeafened(!this.isDeafened);
    return this.isDeafened;
  }

  public setMicrophoneMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    getSocket().emit('voice:state', { micMuted: muted, isSpeaking: false });
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
