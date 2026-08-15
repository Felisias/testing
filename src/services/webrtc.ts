import { getSocket } from './socket';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
  analyser?: AnalyserNode;
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

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  constructor() {
    this.setupSocketListeners();
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
            const answer = await peer.connection.createAnswer();
            await peer.connection.setLocalDescription(answer);
            socket.emit('voice:signal', {
              to: from,
              signal: answer,
              type: 'answer',
            });
          } else if (type === 'answer') {
            await peer.connection.setRemoteDescription(new RTCSessionDescription(signal));
          } else if (type === 'ice-candidate') {
            if (signal) {
              await peer.connection.addIceCandidate(new RTCIceCandidate(signal));
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
      if (this.localStream) return true;

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
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.localAnalyser = this.audioContext.createAnalyser();
        this.localAnalyser.fftSize = 256;
        source.connect(this.localAnalyser);

        this.startVolumeMonitoring();
      } catch (e) {
        console.warn('AudioContext visualization not supported:', e);
      }

      return true;
    } catch (err) {
      console.warn('Microphone access not granted or unavailable:', err);
      return false;
    }
  }

  public callPeer(peerId: string) {
    if (this.peerConnections.has(peerId)) return;
    const peer = this.createPeerConnection(peerId);

    peer.connection
      .createOffer({
        offerToReceiveAudio: true,
      })
      .then((offer) => peer.connection.setLocalDescription(offer))
      .then(() => {
        getSocket().emit('voice:signal', {
          to: peerId,
          signal: peer.connection.localDescription,
          type: 'offer',
        });
      })
      .catch((err) => console.warn('Error creating WebRTC offer:', err));
  }

  private createPeerConnection(peerId: string): PeerConnection {
    const connection = new RTCPeerConnection(this.rtcConfig);
    const peer: PeerConnection = { peerId, connection };

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
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
        let audioEl = peer.audioElement;
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioEl.muted = this.isDeafened;
          peer.audioElement = audioEl;
        }
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch((e) => console.log('Audio autoplay prevented:', e));
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
        this.onVolumeChangeCallback?.(0);
        this.animationFrameId = requestAnimationFrame(checkVolume);
        return;
      }

      this.localAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedVolume = Math.min(100, Math.round((average / 128) * 100));

      this.onVolumeChangeCallback?.(normalizedVolume);

      const currentlySpeaking = normalizedVolume > this.speakingThreshold;
      if (currentlySpeaking !== this.isSpeaking) {
        this.isSpeaking = currentlySpeaking;
        this.onSpeakingChangeCallback?.(currentlySpeaking);
        getSocket().emit('voice:state', {
          micMuted: this.isMuted,
          isSpeaking: currentlySpeaking,
        });
      }

      this.animationFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  public setVolumeCallback(cb: (vol: number) => void) {
    this.onVolumeChangeCallback = cb;
  }

  public setSpeakingCallback(cb: (speaking: boolean) => void) {
    this.onSpeakingChangeCallback = cb;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    getSocket().emit('voice:state', {
      micMuted: this.isMuted,
      isSpeaking: false,
    });
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;
    this.peerConnections.forEach((peer) => {
      if (peer.audioElement) {
        peer.audioElement.muted = this.isDeafened;
      }
    });
    return this.isDeafened;
  }

  public getIsDeafened(): boolean {
    return this.isDeafened;
  }

  public removePeer(peerId: string) {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.connection.close();
      if (peer.audioElement) {
        peer.audioElement.srcObject = null;
        peer.audioElement.remove();
      }
      this.peerConnections.delete(peerId);
    }
  }

  public cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.peerConnections.forEach((peer) => {
      peer.connection.close();
      if (peer.audioElement) {
        peer.audioElement.srcObject = null;
        peer.audioElement.remove();
      }
    });
    this.peerConnections.clear();
  }
}

export const voiceManager = new VoiceManager();
