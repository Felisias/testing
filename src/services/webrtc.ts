import { getSocket } from './socket';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
}

export class VoiceManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map();
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private animationFrameId: number | null = null;
  private onVolumeChangeCallback: ((volume: number) => void) | null = null;
  private onSpeakingChangeCallback: ((isSpeaking: boolean) => void) | null = null;
  private isSpeaking: boolean = false;
  private speakingThreshold: number = 15; // 0-100 scale
  private audioContainer: HTMLElement | null = null;

  // Reliable free STUN servers
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com:3478' },
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
            await peer.connection.setRemoteDescription(new RTCSessionDescription(signal));

            // Ensure our local tracks are attached before answering
            if (this.localStream) {
              const senders = peer.connection.getSenders();
              this.localStream.getAudioTracks().forEach((track) => {
                const alreadyAdded = senders.some((s) => s.track === track);
                if (!alreadyAdded) {
                  peer!.connection.addTrack(track, this.localStream!);
                }
              });
            }

            const answer = await peer.connection.createAnswer();
            await peer.connection.setLocalDescription(answer);

            socket.emit('voice:signal', {
              to: from,
              signal: answer,
              type: 'answer',
            });
          } else if (type === 'answer') {
            if (peer.connection.signalingState !== 'stable') {
              await peer.connection.setRemoteDescription(new RTCSessionDescription(signal));
            }
          } else if (type === 'ice-candidate') {
            if (signal) {
              try {
                await peer.connection.addIceCandidate(new RTCIceCandidate(signal));
              } catch (e) {
                console.warn('Could not add ICE candidate:', e);
              }
            }
          }
        } catch (err) {
          console.warn('Error handling WebRTC signal:', err);
        }
      }
    );

    socket.on('participant:left', ({ userId }: { userId: string }) => {
      this.removePeer(userId);
    });
  }

  public async initLocalAudio(): Promise<boolean> {
    try {
      if (this.localStream && this.localStream.active) {
        return true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;

      // Audio analysis for speaking indicator
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

        this.startVolumeMonitoring();
      } catch (e) {
        console.warn('AudioContext visualization not supported:', e);
      }

      // Attach tracks to all existing peer connections and renegotiate
      this.peerConnections.forEach((peer, peerId) => {
        const senders = peer.connection.getSenders();
        stream.getAudioTracks().forEach((track) => {
          const alreadyAdded = senders.some((s) => s.track === track);
          if (!alreadyAdded) {
            peer.connection.addTrack(track, stream);
          }
        });

        // Trigger renegotiation offer
        peer.connection
          .createOffer({ offerToReceiveAudio: true })
          .then((offer) => peer.connection.setLocalDescription(offer))
          .then(() => {
            getSocket().emit('voice:signal', {
              to: peerId,
              signal: peer.connection.localDescription,
              type: 'offer',
            });
          })
          .catch((err) => console.warn('Renegotiation failed for', peerId, err));
      });

      return true;
    } catch (err) {
      console.warn('Microphone access not granted or unavailable:', err);
      return false;
    }
  }

  public callPeer(peerId: string) {
    let peer = this.peerConnections.get(peerId);
    if (!peer) {
      peer = this.createPeerConnection(peerId);
    }

    peer.connection
      .createOffer({
        offerToReceiveAudio: true,
      })
      .then((offer) => peer!.connection.setLocalDescription(offer))
      .then(() => {
        getSocket().emit('voice:signal', {
          to: peerId,
          signal: peer!.connection.localDescription,
          type: 'offer',
        });
      })
      .catch((err) => console.warn('Error creating WebRTC offer:', err));
  }

  private createPeerConnection(peerId: string): PeerConnection {
    const connection = new RTCPeerConnection(this.rtcConfig);
    const peer: PeerConnection = { peerId, connection };

    // Request bidirectional audio transceiver
    try {
      connection.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (e) {
      // Older browser fallback
    }

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        connection.addTrack(track, this.localStream!);
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

    // Remote Audio Stream
    connection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        let audioEl = peer.audioElement;

        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.muted = this.isDeafened;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.setAttribute('data-peer-id', peerId);

          const container = this.getOrCreateAudioContainer();
          container.appendChild(audioEl);
          peer.audioElement = audioEl;
        }

        audioEl.srcObject = stream;
        audioEl.volume = 1.0;
        audioEl.muted = this.isDeafened;

        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.log('Audio autoplay prevented, awaiting user click:', e);
          });
        }
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
        peer.audioElement.remove();
      }
      peer.connection.close();
    });
    this.peerConnections.clear();
  }
}

export const voiceManager = new VoiceManager();
