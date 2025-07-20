import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Download, Loader, AlertTriangle, Play, StopCircle } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import styles from './FaceTracker.module.css';

export default function FaceTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const animationFrameId = useRef();
  
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [faceApi, setFaceApi] = useState(null);

  useEffect(() => {
    const loadScript = () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      script.async = true;
      script.onload = () => setFaceApi(window.faceapi);
      script.onerror = () => setError("Failed to load the face-api.js script from the CDN.");
      document.body.appendChild(script);
    };
    
    if (!window.faceapi) {
        loadScript();
    } else {
        setFaceApi(window.faceapi);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  useEffect(() => {
    const setup = async () => {
      if (!faceApi) return;
      try {
        setIsReady(false);
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        await Promise.all([
          faceApi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceApi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        await startCamera();
        setIsReady(true);
      } catch (err) {
        console.error("Initialization Error:", err);
        setError("Failed to load AI models from the CDN.");
      }
    };
    setup();
  }, [faceApi]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setError("Camera access denied. Please grant permission.");
    }
  };

  const drawLoop = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !faceApi || videoRef.current.paused || videoRef.current.ended) {
      animationFrameId.current = requestAnimationFrame(drawLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const displaySize = { width: video.clientWidth, height: video.clientHeight };

    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      faceApi.matchDimensions(canvas, displaySize);
    }

    ctx.drawImage(video, 0, 0, displaySize.width, displaySize.height);

    const detections = await faceApi.detectAllFaces(video, new faceApi.TinyFaceDetectorOptions()).withFaceLandmarks();
    const resizedDetections = faceApi.resizeResults(detections, displaySize);

    resizedDetections.forEach(detection => {
      const box = detection.detection.box;
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });

    animationFrameId.current = requestAnimationFrame(drawLoop);
  }, [faceApi, isReady]);

  const handleVideoPlay = () => {
    if (isReady) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      drawLoop();
    }
  };

  const handleStartRecording = () => {
    if (canvasRef.current && videoRef.current.srcObject) {
      recordedChunksRef.current = [];
      const stream = canvasRef.current.captureStream(30);
      const audioTrack = videoRef.current.srcObject.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      const options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        setError(`Recording format (${options.mimeType}) is not supported on this browser.`);
        return;
      }

      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: options.mimeType });
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          recordedChunksRef.current = [];
        };
        mediaRecorderRef.current.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            setError("An error occurred during recording.");
            setIsRecording(false);
        };
        mediaRecorderRef.current.start(100); 
        setIsRecording(true);
      } catch (e) {
        console.error("Failed to create MediaRecorder:", e);
        setError("Failed to initialize the recorder.");
      }
    } else {
        console.error("Canvas or Video stream not available for recording.");
        setError("Could not start recording. Camera stream is not ready.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const handleRecordAgain = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setIsRecording(false);
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.appWrapper}>
        <header className={styles.appHeader}>
          <h1>Face Tracking Recorder</h1>
          <p>Record video with a face-tracking overlay.</p>
        </header>

        <main className={styles.mainContent}>
          <div className={styles.videoContainer}>
            {!isReady && !error && (
              <div className={`${styles.overlay} ${styles.loaderOverlay}`}>
                <Loader className="animate-spin" size={40} />
                <p>Loading models...</p>
              </div>
            )}
            {error && (
              <div className={`${styles.overlay} ${styles.errorOverlay}`}>
                <AlertTriangle size={40} />
                <p>{error}</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onPlay={handleVideoPlay}
              className={styles.videoElement}
              style={{ opacity: 0 }} 
            />
            <canvas ref={canvasRef} className={styles.canvasElement} />

            {videoUrl && (
              <div className={`${styles.overlay} ${styles.previewOverlay}`}>
                <video src={videoUrl} controls autoPlay />
              </div>
            )}
          </div>

          <div className={styles.controls}>
            {!videoUrl ? (
              isRecording ? (
                <ActionButton onClick={handleStopRecording} disabled={!isReady} className={`${styles.actionButton} ${styles.danger}`}>
                  <StopCircle size={20} />
                  <span>Stop Recording</span>
                </ActionButton>
              ) : (
                <ActionButton onClick={handleStartRecording} disabled={!isReady || isRecording} className={`${styles.actionButton} ${styles.primary}`}>
                  <Play size={20} />
                  <span>Start Recording</span>
                </ActionButton>
              )
            ) : (
              <>
                <ActionButton 
                  onClick={() => { const a = document.createElement('a'); a.href = videoUrl; a.download = `face-recording-${Date.now()}.webm`; a.click(); }} 
                  className={`${styles.actionButton} ${styles.success}`}
                >
                  <Download size={20} />
                  <span>Download</span>
                </ActionButton>
                <ActionButton onClick={handleRecordAgain} className={`${styles.actionButton} ${styles.secondary}`}>
                  <Video size={20} />
                  <span>Record Again</span>
                </ActionButton>
              </>
            )}
          </div>
        </main>
        
        <footer className={styles.appFooter}>
        </footer>
      </div>
    </div>
  );
}
